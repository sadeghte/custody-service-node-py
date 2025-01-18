import * as redis from 'redis';
import * as url from 'url';
import { timeout } from './utils';

type ZellularBatchTx  = {
    type: "AgentRegister" | "CreateDepositAddress" | "Deposit" | "AddWithdraw" | "ApproveWithdraw" | "TransferWithdraw",
    data: any
}

export class Zellular {
	private appName: string;
	private baseUrl: string;
	private thresholdPercent: number;
	private r: redis.RedisClientType;

	constructor(appName: string, baseUrl: string, thresholdPercent: number = 67) {
		this.appName = appName;
		this.baseUrl = baseUrl;
		this.thresholdPercent = thresholdPercent;

		const parsedUrl = url.parse(baseUrl);
		this.r = redis.createClient({
			url: `redis://${parsedUrl.hostname}:${parsedUrl.port}`,
		});
		this.r.connect();
	}

	async *batches(after: number = 0): AsyncGenerator<[any, number], void, unknown> {
		if (after < 0) {
			throw new Error("after should be equal or bigger than 0");
		}
		while (true) {
			const batches = await this.r.lRange(this.appName, after, after + 100);
			for (let batch of batches) {
				after += 1;
				yield [batch, after];
			}
			await timeout(100); // Sleep for 0.1s
		}
	}

	async getLastFinalized() {
		const length = await this.r.lLen(this.appName);
		return { index: length };
	}

	async send(batch: ZellularBatchTx[], blocking: boolean = false) {
		let index;
		if (blocking) {
			index = await this.getLastFinalized();
		}

		await this.r.rPush(this.appName, JSON.stringify(batch));

		if (!blocking) {
			return;
		}

		let receivedBatch;
		for await ([receivedBatch, index] of this.batches(index)) {
			const parsedBatch = JSON.parse(receivedBatch);
			if (batch === parsedBatch) {
				return index;
			}
		}
	}
}

if (require.main === module) {
	(async () => {
		const verifier = new Zellular("custody_service_deposits", "http://localhost:6379");
		for await (const [batch, index] of verifier.batches()) {
			const txs = JSON.parse(batch);
			for (let i = 0; i < txs.length; i++) {
				console.log(index, i, txs[i]);
			}
		}
	})()
}

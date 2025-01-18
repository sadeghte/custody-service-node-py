import { Connection, VersionedBlockResponse } from "@solana/web3.js";
import { callRpc, range, registerDeposits, timeout, zellularRegisterWithdrawTransfer } from './utils';
import { AvailableTokenInfo, ChainID, DepositAddressDoc, TokenID, ZellularDepositTx } from "./types";
import { getBlockTransfers, getBlock } from './solana-chain-utils';
import * as database from "./database/database"
import { RedisQueue } from './redis-queue';
import { ClusterManager } from "./cluster-manager";
import { Assetman } from "./assetman/assetman";
import { WithdrawDoc } from "./database/db-withdraws";
import { callCustodyServiceRpc } from "./backend-api";


const BLOCKS_PROCESS_QUEUE = "custody-service-sol-blocks-queue"
const SOLANA_NODE_RPC = process.env.SOLANA_NODE_RPC;
const SOLANA_KEYPAIR = process.env.SOLANA_KEYPAIR;
const SOLANA_ASSETMAN_ADDRESS = process.env.SOLANA_ASSETMAN_ADDRESS;

console.log({
    solanaNetwork: SOLANA_NODE_RPC,
})

if (!SOLANA_NODE_RPC)
    throw `SOLANA_NODE_RPC env variable not set`
if (!SOLANA_KEYPAIR)
    throw `SOLANA_KEYPAIR env variable not set`
if (!SOLANA_ASSETMAN_ADDRESS)
    throw `SOLANA_ASSETMAN_ADDRESS env variable not set`


async function processBlock(block: number, daList: DepositAddressDoc[], availableTokens: AvailableTokenInfo[]): Promise<ZellularDepositTx[]> {
    let blockData: VersionedBlockResponse | null = await getBlock(block, {
        transactionDetails: 'full',
        rewards: false,
        maxSupportedTransactionVersion: 0
    })
        .catch(e => null)

    if (!blockData)
        return []
    
    const { solTransfers, splTransfers } = getBlockTransfers(blockData, daList.map(({ address }) => address), availableTokens);

    let addressOwnerInfo = daList.reduce((obj, da) => {
        obj[da.address] = {
            agent: da.agent,
            account: da.account,
            user: da.user
        }
        return obj;
    }, {});

    let deposits: ZellularDepositTx[] = solTransfers.map(t => ({
        chain: ChainID.Solana,
        block,
        agent: addressOwnerInfo[t.address].agent,
        account: addressOwnerInfo[t.address].account,
        user: addressOwnerInfo[t.address].user,
        txHash: t.txHash,
        address: t.address,
        deposit: {
            token: TokenID.Solana,
            // contract: "",
            amount: t.change,
            decimals: 9,
        }
    }))

    deposits = [
        ...deposits,
        ...splTransfers.map(t => ({
            chain: ChainID.Solana,
            block,
            agent: addressOwnerInfo[t.address].agent,
            account: addressOwnerInfo[t.address].account,
            user: addressOwnerInfo[t.address].user,
            txHash: t.txHash,
            address: t.address,
            deposit: {
                token: t.token.symbol,
                contract: t.token.contract,
                decimals: t.token.decimals,
                amount: t.change,
            }
        }))
    ]

    return deposits;
}

async function fetchBlocks() {
    await database.init();
    let queue = new RedisQueue(BLOCKS_PROCESS_QUEUE)

    const connection = new Connection(SOLANA_NODE_RPC!, 'finalized');

    let lastSlot = 0;
    // let lastSlot = 22000;
    while(true) {
        const currentSlot = await connection.getSlot();
        
        if (lastSlot > 0) {
            const blocksToCheck = range(lastSlot + 1, currentSlot + 1);
            for(let block of blocksToCheck) {
                await queue.push(`${block}`);
            }
            // const queueLength = await queue.length();
            // console.log({ currentSlot, blocksToCheck, queueLength })
        }

        lastSlot = currentSlot;
        await timeout(1000);
    }
}

async function startBlockProcessor() {
    await database.init();

    const assetman: Assetman = new Assetman({
        rpc: SOLANA_NODE_RPC,
        privateKey: SOLANA_KEYPAIR,
        address: SOLANA_ASSETMAN_ADDRESS
    })

    let queue = new RedisQueue(BLOCKS_PROCESS_QUEUE)

    while (true) {
        let slot = await queue.pop();
        // console.log(`ID: ${process.env.WORKER_ID}, block to check: ${slot}`);

        const depositWallets = await database.getDepositAddresses({ chain: ChainID.Solana })
        const availableTokens = await callCustodyServiceRpc("getAvailableTokens", {chain: "SOL"})

        let deposits: ZellularDepositTx[] = await processBlock(parseInt(slot), depositWallets, availableTokens)

        if (deposits.length > 0) {
            console.log(`ID: ${process.env.WORKER_ID}, ${deposits.length} deposit detected.`)

            let transferTxHash = await assetman.transferToMainVault(deposits);
            console.log("deposit transfer tx: " + transferTxHash);

            await registerDeposits(deposits)
        }
    }
}

async function executeWithdraws() {
    await database.init();

    const assetman: Assetman = new Assetman({
        rpc: SOLANA_NODE_RPC,
        privateKey: SOLANA_KEYPAIR,
        address: SOLANA_ASSETMAN_ADDRESS
    })

    while(true) {
        const withdraws:WithdrawDoc[] = await database.getWithdraws({status: "approved", transferTx: {$exists: false}})
        console.log(`[${withdraws.length}] pending withdraw found.`)

        if(withdraws.length > 0) {
            try {
                const txHash = await assetman.withdraw(withdraws);
                console.log({txHash})
                
                await zellularRegisterWithdrawTransfer(withdraws, txHash);
            }
            catch(e) {
                console.log("Error on transferring withdraws: ", e);
            }
        }

        await timeout(5000);
    }
}

export type WorkerType = "BlockFetcher" | "BlockProcessor" | "WithdrawExecuter"

// @ts-ignore
if (ClusterManager.isPrimary) {
    // start cluster manager
    const manager = new ClusterManager<WorkerType>();
    manager.start([
        "BlockFetcher",

        "BlockProcessor",
        // "BlockProcessor",

        "WithdrawExecuter",
    ]);
} else {
    // Worker logic (if needed, it can be customized further)
    const workerId = process.env.WORKER_ID;
    const workerType:WorkerType = process.env.WORKER_TYPE! as WorkerType;
    console.log(`Worker process started with ID: ${workerId}, type: ${workerType}, PID: ${process.pid}`);

    switch(workerType) {
        case "BlockFetcher":
            fetchBlocks()
                .catch(e => {
                    console.log(e);
                    process.exit(0)
                })
            break;
        case "BlockProcessor":
            startBlockProcessor()
                .catch(e => {
                    console.log(e);
                    process.exit(0)
                })
            break;
        case "WithdrawExecuter":
            executeWithdraws()
                .catch(e => {
                    console.log(e);
                    process.exit(0)
                })
            break;
    }
}

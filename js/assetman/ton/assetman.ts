import { Address, beginCell, BitString, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';
import { str2opcode } from './utils';

export const ZERO_ADDR = Address.parseRaw("0:0000000000000000000000000000000000000000000000000000000000000000");

export type AssetmanConfig = {
    id: number;
    admin: Address;
    publicKey: bigint;
};

export function assetmanConfigToCell(config: AssetmanConfig): Cell {
    return beginCell()
        .storeUint(config.id, 32)
        .storeAddress(config.admin)
        .storeUint(config.publicKey, 256)
        .endCell();
}

export const Opcodes = {
    setAdmin: str2opcode("op::set_admin"),
    setPubkey: str2opcode("op::set_pubkey"),
    withdrawTon: str2opcode("op::withdraw_ton"),
    withdrawJetton: str2opcode("op::withdraw_jetton"),

    jettonTransferNotification: 0x7362d09c,
    jettonExcesses: 0xd53276db,
};

export class TonAssetman implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) { }

    static createFromAddress(address: Address) {
        return new TonAssetman(address);
    }

    static createFromConfig(config: AssetmanConfig, code: Cell, workchain = 0) {
        const data = assetmanConfigToCell(config);
        const init = { code, data };
        return new TonAssetman(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint): Promise<Cell> {
        const body = beginCell().endCell()
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body,
        });
        return body;
    }

    async sendSetAdmin(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint;
            queryID?: number;
            admin: Address,
        }
    ): Promise<Cell> {
        const body = beginCell()
            .storeUint(Opcodes.setAdmin, 32)
            .storeUint(opts.queryID ?? 0, 64)
            .storeAddress(opts.admin)
            .endCell();
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body,
        });
        return body;
    }

    async sendSetPubkey(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint;
            queryID?: number;
            publicKey: bigint,
        }
    ): Promise<Cell> {
        const body = beginCell()
            .storeUint(Opcodes.setPubkey, 32)
            .storeUint(opts.queryID ?? 0, 64)
            .storeUint(opts.publicKey, 256)
            .endCell()
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body,
        });
        return body;
    }

    static getWithdrawMessage(amount: number | bigint, token: string, address: Address): string {
        // return `allowed withdraw ${amount} ${token} to address ${address}`;
        return `allowed withdraw ${token}`;
    }

    async sendWithdrawTon(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: string | bigint,
            queryID?: number,
            
            to: Address,
            amount: number | bigint,
            signature: string,
        }
    ): Promise<Cell> {
        let signatureBuffer = Buffer.from(opts.signature, 'hex');
        const body = beginCell()
            .storeUint(Opcodes.withdrawTon, 32)
            .storeUint(opts.queryID ?? 0, 64)

            .storeAddress(opts.to)
            .storeCoins(opts.amount)
            .storeBits(new BitString(signatureBuffer, 0, 64 << 3))
            .endCell()

        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body,
        });
        return body;
    }

    async sendWithdrawJetton(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint;
            queryID?: number;

            jettonWallet: Address,
            to: Address,
            amount: number | bigint,
            signature: string,
        }
    ): Promise<Cell> {
        let signatureBuffer = Buffer.from(opts.signature, 'hex');

        const transferCell = beginCell()
            .storeAddress(opts.to)
            .storeCoins(opts.amount)
            .storeBits(new BitString(signatureBuffer, 0, 64 << 3))
            .endCell()
        const body = beginCell()
            .storeUint(Opcodes.withdrawJetton, 32)
            .storeUint(opts.queryID ?? 0, 64)
            .storeAddress(opts.jettonWallet)
            .storeRef(transferCell)
            .endCell() 

        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body,
        });
        return body;
    }

    async getData(provider: ContractProvider): Promise<AssetmanConfig> {
        const { stack } = await provider.get("get_contract_storage_data", []);
        return {
            id: stack.readNumber(),
            admin: stack.readAddress(),
            publicKey: stack.readBigNumber(),
        }
    }

    async getTonBalance(provider: ContractProvider) {
        const result = await provider.get('get_ton_balance', []);
        return result.stack.readNumber();
    }

    async getID(provider: ContractProvider) {
        const result = await provider.get('get_id', []);
        return result.stack.readNumber();
    }

    async getAdmin(provider: ContractProvider): Promise<Address> {
        const result = await provider.get('get_admin', []);
        return result.stack.readAddress();
    }

    async getPubkey(provider: ContractProvider) {
        const result = await provider.get('get_pubkey', []);
        return result.stack.readBigNumber();
    }
}

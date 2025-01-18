import { WithdrawDoc } from "./database/db-withdraws";
import { ChainID, DepositAddressDoc, TokenID, ZellularDepositTx } from "./types";
import { Zellular } from "./zellular";
import axios from 'axios'

let zellular = new Zellular("custody_service_app", "http://localhost:6379");

export const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export const range = (start, end) => Array.from({length: end - start}, (v, k) => k + start)

export async function registerDeposits(deposits: ZellularDepositTx[]) {
	return zellular.send([{
        type: "Deposit", 
        data: deposits
    }]);
}

export async function zellularRegisterWithdrawTransfer(withdraws: WithdrawDoc[], txHash: string) {
    return zellular.send([{
        type: "TransferWithdraw",
        data: {
            withdraws: withdraws.map(w => w.id),
            txHash,
        }
    }])
}

export async function callRpc(url: string, method: string, params?: any, id: number = 1): Promise<any> {
    const payload = {
        jsonrpc: "2.0",
        method,
        params,
        id,
    };

    try {
        const response = await axios.post(url, payload, {
            headers: { 'Content-Type': 'application/json' },
        });

        if (response.data.error) {
            throw new Error(
                `RPC Error: ${response.data.error.message} (Code: ${response.data.error.code})`
            );
        }

        return response.data.result;
    } catch (error) {
        console.error("JSON-RPC call failed:", error.message);
        throw error;
    }
}
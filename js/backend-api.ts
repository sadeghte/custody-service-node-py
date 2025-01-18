import { AvailableTokenInfo } from "./types";
import { callRpc } from "./utils";

const CUSTODY_SERVICE_RPC = "http://127.0.0.1:5000/jsonrpc/"
type CustodySetviceMethod = "registerAgent" | "getUserAgents" | "createDepositAddressRange" 
    | "getDepositAddresses" | "getAvailableTokens"

export async function callCustodyServiceRpc(method: CustodySetviceMethod, params?: any) {
    return await callRpc(CUSTODY_SERVICE_RPC, method, params)
}

export async function getAvailableTokens(chain: string): Promise<AvailableTokenInfo[]> {
    return callCustodyServiceRpc("getAvailableTokens", {chain})
}
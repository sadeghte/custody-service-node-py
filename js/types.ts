export enum SignatureCurce {
	SECP256K1 = "secp256k1",
	Ed25519 = "ed25519",
}

export enum SignatureSchema {
	Schnorr = "Schnorr",
	ECDSA = "ECDSA",
	EdDSA = "EdDSA",
	BLS = "BLS",
	TSS = "TSS",
	Ring_Signature = "Ring Signature",
	RSA = "RSA", 
}

export enum ChainID {
	Solana = "SOL",
	Ton = "TON"
}

export enum TokenID {
	Solana = "SOL",
	Ton =  "TON",
}

export type AddressWithMemo = {
	address: string,
	memo?: string,
}

export type TokenInfo = {
	chain: ChainID,
	token: TokenID,
	contract?: string
}

export interface DatabaseDoc extends Document {
    _id: string
}

/**
 * DepositAddress database document
 */
export interface DepositAddressDoc extends DatabaseDoc {
	agent: String; // Reference to the Agent collection
	account: number, // Each agent can ahve several accounts (spot, margin, futures, ...)
	chain: string; // Blockchain name (e.g., Ethereum, Solana)
	user: number; // User identifier for deposits
	address: string; // Deposit address
	memo?: string, // Deposit address's memo/comment/tag
	active: boolean; // Whether the address is active
}

export type DepositAddressGenerator = (agentId: bigint, account: number, userId: bigint) => Promise<AddressWithMemo>;


type DepositedToken = {
	token: string,
	contract?: string,
	amount: string,
	decimals: number,
}

export type ZellularDepositTx = {
	chain: ChainID,
	block?: number,
	agent: string,
	account: number,
	user: number,
	txHash: string,
	address: string,
	deposit: DepositedToken,
    extra?: any,
}

export type AvailableTokenInfo = {
    symbol: string,
    name?: string,
    decimals: number,
    contract?: string
}
import {
    PublicKey, 
} from "@solana/web3.js";
import { Assetman } from "./assetman/assetman";

const FROST_ED25519_PUBKEY = "0c3e8b85340b3df11373e1382f3921e45364bb71517a7c97ee4bb8d9b71e2c17"
const SOLANA_NODE_RPC = process.env.SOLANA_NODE_RPC;
const SOLANA_KEYPAIR = process.env.SOLANA_KEYPAIR;
const SOLANA_ASSETMAN_ADDRESS = process.env.SOLANA_ASSETMAN_ADDRESS;

if (!SOLANA_NODE_RPC)
    throw `SOLANA_NODE_RPC env variable not set`
if (!SOLANA_KEYPAIR)
    throw `SOLANA_KEYPAIR env variable not set`
if (!SOLANA_ASSETMAN_ADDRESS)
    throw `SOLANA_ASSETMAN_ADDRESS env variable not set`

const assetman: Assetman = new Assetman({
    rpc: SOLANA_NODE_RPC,
    privateKey: SOLANA_KEYPAIR,
    address: SOLANA_ASSETMAN_ADDRESS
})

async function main() {
    const withdrawAuthority: PublicKey = new PublicKey(Uint8Array.from(Buffer.from(FROST_ED25519_PUBKEY, "hex")));
    const txHash = await assetman.initialize(withdrawAuthority);
    console.log({txHash})
}

main()
    .catch(e => console.error(e))
    .finally(() => process.exit(0))
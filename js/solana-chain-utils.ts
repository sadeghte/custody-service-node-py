import { GetVersionedBlockConfig, PublicKey, TokenBalance, VersionedBlockResponse } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { callRpc } from './utils';
import { AvailableTokenInfo } from './types';
// import { ZexAssetmanSol } from "./sol-assetman-idl.json";


const SOLANA_NODE_RPC = process.env.SOLANA_NODE_RPC;


export async function getBlock(slot: number, config?: GetVersionedBlockConfig) {
    const result = await callRpc(
        SOLANA_NODE_RPC,
        "getBlock",[slot, config]
    )
    return result
}

export async function transferToMainVault() {

}

export function getBlockTransfers2(block: VersionedBlockResponse, watchingWallets: string[]) {
	const watchingMap = watchingWallets.reduce((acc, curr) => ({ ...acc, [curr]: true }), {})

	// Initialize arrays to hold SOL and SPL token transfers
	const solTransfers: any[] = [];
	const splTransfers: any[] = [];

	// Iterate through transactions in the block
	block.transactions.forEach(({ transaction, meta }, i) => {
		if (!meta || !meta.postBalances || !meta.preBalances) return;

		const txHash = transaction.signatures[0];
		const accountKeys = transaction.message.staticAccountKeys.map(pk => pk.toBase58());

		// SOL transfers: Compare preBalances and postBalances
		accountKeys.forEach((account, index) => {
			const solBalanceChange = meta.postBalances[index] - meta.preBalances[index];
			if (solBalanceChange > 0 && watchingMap[account]) {
				solTransfers.push({
					txHash,
					address: account,
					change: solBalanceChange, // Convert lamports to SOL
				});
			}
		});

		// TOKEN transfers: Compare preTokenBalances and postTokenBalances
		const changes: { [key: string]: { pre?: TokenBalance, post?: TokenBalance } } = {}
        // @ts-ignore
		for (let item of meta.preTokenBalances) {
			let key = `${item.accountIndex}-${item.mint}`
			changes[key] = { pre: item }
		}
        // @ts-ignore
		for (let item of meta.postTokenBalances) {
			let key = `${item.accountIndex}-${item.mint}`
			changes[key] = { ...changes[key], post: item }
		}

		// SPL token transfers: Look for Token Program instructions
		for (let [key, change] of Object.entries(changes)) {
			let preBalance: number = parseInt(change.pre?.uiTokenAmount.amount ?? "0")
			let postBalance: number = parseInt(change.post?.uiTokenAmount.amount ?? "0")
			const tokenBalanceChange = postBalance - preBalance;
			const account = change.pre?.owner || change.post?.owner;

            // @ts-ignore
			if (tokenBalanceChange > 0 && watchingMap[account]) {
				splTransfers.push({
					txHash,
					address: account,
					mint: change.pre?.owner || change.post?.owner,
					change: tokenBalanceChange, // Convert lamports to SOL
				});
			}
		}

	});
	return { solTransfers, splTransfers }
}

export function getBlockTransfers(block: VersionedBlockResponse, watchingWallets: string[], availableTokens: AvailableTokenInfo[]) {
    const walletsMap = watchingWallets.reduce((acc, curr) => ({ ...acc, [curr]: true }), {});
    const tokensMap = availableTokens
        .filter(t => !!t.contract)
        .reduce((acc, curr) => ({...acc, [curr.contract]: curr}), {})
  
    // Initialize arrays to hold SOL and SPL token transfers
    const solTransfers: any[] = [];
    const splTransfers: any[] = [];
  
    // Iterate through transactions in the block
    block.transactions.forEach(({ transaction, meta }) => {
      if (!meta || !meta.postBalances || !meta.preBalances) return;
  
      const txHash = transaction.signatures[0];
      // @ts-ignore
      const accountKeys = transaction.message.accountKeys.map(pk => pk);
  
      // SOL transfers: Compare preBalances and postBalances
      accountKeys.forEach((account, index) => {
        const solBalanceChange = meta.postBalances[index] - meta.preBalances[index];
        if (solBalanceChange > 0 && walletsMap[account]) {
          solTransfers.push({
            txHash,
            address: account,
            change: solBalanceChange.toString(), // Lamports (1 SOL = 10^9 Lamports)
          });
        }
      });
  
      // TOKEN transfers: Compare preTokenBalances and postTokenBalances
      const changes: { [key: string]: { pre?: TokenBalance; post?: TokenBalance } } = {};
      for (const item of meta.preTokenBalances || []) {
        const key = `${item.accountIndex}-${item.mint}`;
        changes[key] = { pre: item };
      }
      for (const item of meta.postTokenBalances || []) {
        const key = `${item.accountIndex}-${item.mint}`;
        changes[key] = { ...changes[key], post: item };
      }
  
      // SPL token transfers: Look for token balance changes
      for (const [key, change] of Object.entries(changes)) {
        const preBalance = parseInt(change.pre?.uiTokenAmount.amount ?? "0", 10);
        const postBalance = parseInt(change.post?.uiTokenAmount.amount ?? "0", 10);
        const tokenBalanceChange = postBalance - preBalance;
        const mint = change.pre?.mint || change.post?.mint;
  
        const account = change.pre?.owner || change.post?.owner;
        if (tokenBalanceChange > 0 && tokensMap[mint] && walletsMap[account]) {
          splTransfers.push({
            txHash,
            address: account,
            change: tokenBalanceChange.toString(),
            token: tokensMap[mint],
          });
        }
      }
    });
  
    return { solTransfers, splTransfers };
  }
  
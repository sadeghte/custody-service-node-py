from custody_service.utils import call_rpc_method, register_deposits
from custody_service.chain_utils.solana_chain_utils import get_slot, get_block
from .solana_chain_utils import SOLANA_NODE_RPC
from solana.rpc.async_api import AsyncClient
from solana.rpc.types import TokenAccountOpts
from typing import List, Dict, Any
from pathlib import Path
import asyncio, httpx, sys, json, os


client = AsyncClient(SOLANA_NODE_RPC)


async def get_block_transfers(block, watching_addrs: List[str]):
    sol_transfers = []
    spl_transfers = []
    
    transactions = block["transactions"]
    total_received = 0

    for tx in transactions:
        meta = tx["meta"]
        transaction = tx["transaction"]
        
        if not meta or not transaction:
            continue
        
        tx_hash = transaction["signatures"][0];

        # Extract accounts and balances
        accounts = transaction["message"]["accountKeys"]
        pre_balances = meta["preBalances"]
        post_balances = meta["postBalances"]

        # Check if the target address is in the accounts
        for target_address in watching_addrs:
            if target_address in accounts:
                index = accounts.index(target_address)
                # Calculate balance difference
                balance_change = post_balances[index] - pre_balances[index]
                if balance_change > 0:
                    sol_transfers.append({
                        "txHash": tx_hash,
                        "address": target_address,
                        "change": balance_change,
                    })
    
    return {"sol_transfers": sol_transfers, "spl_transfers": spl_transfers}


async def process_block(block: int, deposit_addresses):
    block_data = await get_block(block)

    transfers = await get_block_transfers(block_data, [da["address"] for da in deposit_addresses])

    address_owner_info = {
        da["address"]: {
            "agent": da["agent"], 
            "account": da["account"], 
            "user": da["user"]
        } for da in deposit_addresses
    }

    deposits = [
        {
            "chain": "SOL",
            "block": block,
            "agent": address_owner_info[t["address"]]["agent"],
            "account": address_owner_info[t["address"]]["account"],
            "user": address_owner_info[t["address"]]["user"],
            "txHash": t["txHash"],
            "address": t["address"],
            "deposit": {
                "token": "SOL",
                "amount": t["change"],
                "decimals": 1_000_000_000,
            },
        }
        for t in transfers["sol_transfers"]
    ]

    return deposits


async def call_custody_rpc(method: str, params):
    CUSTODY_NODE_RPC = "http://127.0.0.1:5000/jsonrpc/"
    result = await call_rpc_method(CUSTODY_NODE_RPC, method, params)
    return result.get("result")

async def observe():
    last_block = 0
    while True:
        deposit_addresses = await call_custody_rpc("getDepositAddresses", {"chain": "SOL"})
        current_block = await get_slot();
        if last_block > 0:
            blocks_to_check = list(range(last_block, current_block))
            print(f"blocks to check: {blocks_to_check}")
            
            tasks = [process_block(b, deposit_addresses) for b in blocks_to_check]
            blocks_result = await asyncio.gather(*tasks)

            # flatten the 2D array
            deposits = [item for sublist in blocks_result for item in sublist]
            
            if len(deposits) > 0:
                print(f"deposit detected.", json.dumps(deposits, indent=2))
                register_deposits(deposits)
				
        
        last_block = current_block
        await asyncio.sleep(1)

__all__ = ["observe"]

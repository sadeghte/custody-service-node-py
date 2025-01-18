from ..custom_types import ZellularDepositTx, ZellularDepositeToken, ChainId
from ..configs import new_solana_client
from ..chain_utils.solana_chain_utils import get_deposit_address
from solana.rpc.api import Signature, GetTransactionResp
from custody_service.chain_utils import solana_chain_utils
from typing import Optional
import json


MIN_DEPOSIT_AMOUNT = 0.0001 * 1000_0000_1000


async def validate_deposit(deposit: ZellularDepositTx) -> Optional[ZellularDepositTx]:
    try:
        # print("fetching tx ...", deposit)
        tx_data = await solana_chain_utils.get_transaction(deposit["txHash"], "jsonParsed")
        # print("tx: ", tx_data)
        # Extract transaction meta and instructions
        meta = tx_data.get("meta", {})
        if not meta:
            print("no meta")
            return None

        # Look for SOL transfer instruction
        for instruction in tx_data["transaction"]["message"]["instructions"]:
            program_id = instruction.get("programId")
            print("programm_id: ", program_id);
            if program_id == "11111111111111111111111111111111":  # System Program
                parsed = instruction.get("parsed", {})
                if parsed.get("type") == "transfer":
                    info = parsed.get("info", {})
                    if (
                            info.get("destination") == deposit["address"] and
                            int(info.get("lamports", 0)) >= MIN_DEPOSIT_AMOUNT
                    ):
                        return ZellularDepositTx(
                            chain="SOL",
                            block=tx_data["slot"],
                            txHash=tx_data["transaction"]["signatures"][0],
                            agent="Unknown",  # Adjust based on your context
                            account=0,  # Adjust based on your context
                            user=0,  # Adjust based on your context
                            address=info["destination"],
                            deposit=ZellularDepositeToken(
                                token="SOL",
                                amount=int(info["lamports"]),
                                decimals=9
                            )
                        )
        return None
    except Exception as e:
        print(f"Error validating transaction: {e}")
        return None


async def get_last_confirmed_block():
    return await solana_chain_utils.get_slot()

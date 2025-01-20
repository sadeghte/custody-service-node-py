from custody_service.configs import get_zellular
from custody_service.custom_types import ZellularDepositTx, ChainId
from custody_service.tx_validation import all_validators
from custody_service import database
import asyncio
import sys


async def confirm_deposits(chainId):
    print("start confirming deposits ...")
    validator = all_validators[chainId]
    while (True):
        try:
            deposits = database.get_unconfirmed(ChainId.Solana)
            last_confirmed_block = await validator.get_last_confirmed_block()

            print("last confirmed block: ", last_confirmed_block)
            for d in deposits:
                if d["block"] <= last_confirmed_block:
                    print("validating: ", d)
                    validated = await validator.validate_deposit(d)
                    if validated:
                        database.update_deposit({"txHash": d["txHash"]}, {
                                                "$set": {"confirmed": True}})
                    else:
                        print("not validated")
        except Exception as e:
            print("An error uccured: ", e)
        await asyncio.sleep(5)


if __name__ == "__main__":
    chainId = sys.argv[1]
    valid_chain_ids = [chain.value for chain in ChainId]
    if not chainId in valid_chain_ids:
        raise Exception(f"Incorrect chainId: {
                        chainId}. correct: {valid_chain_ids}")
    asyncio.run(confirm_deposits(chainId))

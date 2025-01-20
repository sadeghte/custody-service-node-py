from custody_service.configs import get_zellular
from custody_service.custom_types import ZellularTx, ChainId
from custody_service.tx_validation import all_validators
from custody_service import database
import json
import hashlib
import asyncio


def generate_agent_id(signers: list[str], sequence_id: str):
    data = b''.join(bytes.fromhex(hex_str[2:]) for hex_str in signers)
    data += sequence_id.encode('utf-8')
    hash_object = hashlib.sha256(data)
    return "0x" + hash_object.hexdigest()


async def observe_zellular():
    print("start reading zellular txs ...")
    verifier = get_zellular("custody_service_app")
    for batch, index in verifier.batches():
        txs: list[ZellularTx] = json.loads(batch)
        for i, tx in enumerate(txs):
            print(index, i, json.dumps(tx, indent=2))
            try:
                match tx["type"]:
                    case "AgentRegister":
                        agent = tx['data']
                        agent["id"] = generate_agent_id(
                            agent["signers"], f"{index}-{i}")
                        database.insert_agent(agent)
                    case "CreateDepositAddress":
                        address_data = tx["data"]
                        database.insert_deposit_address(address_data)
                    case "Deposit":
                        print("inserting deposits into db ...")
                        for d in tx["data"]:
                            print("doc to be inserted: ", json.dumps(d, indent=2))
                            database.insert_deposit({**d, "confirmed": False, "transferred": False})
                    case "AddWithdraw":
                        withdraw = tx["data"]
                        database.insert_new_withdraw(withdraw)
                    case "ApproveWithdraw":
                        id = tx["data"]["id"]
                        verifying_key = tx["data"]["avsVerifyingKey"]
                        signature = tx["data"]["avsSignature"]
                        # TODO: validate signature
                        database.approve_withdraw(id, verifying_key, signature)
                    case "TransferWithdraw":
                        withdraw_ids = tx["data"]["withdraws"]
                        tx_hash = tx["data"]["txHash"]
                        database.set_withdraws_transfer_tx(withdraw_ids, tx_hash)
                    case _:
                        print("Invalid TX")
                        pass
            except Exception as e:
                print("Zellular method handler: An error occurred", str(e))
                pass

if __name__ == "__main__":
    try:
        asyncio.run(observe_zellular())
    except KeyboardInterrupt:
        pass
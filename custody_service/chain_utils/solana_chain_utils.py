from solders.pubkey import Pubkey
from custody_service.utils import call_rpc_method
from custody_service.database.db_withdraws import WithdrawDoc
import hashlib, json, os


SOLANA_NODE_RPC = os.getenv("SOLANA_NODE_RPC")


async def get_slot(commitment:str="finalized"):
    result = await call_rpc_method(
        SOLANA_NODE_RPC,
        "getSlot",
        [
            {
                "commitment": commitment
            }
        ]
    )
    return result["result"]


async def get_transaction(tx_hash: str, encoding: str="json"):
    result = await call_rpc_method(
        SOLANA_NODE_RPC,
        "getTransaction",
        [
            tx_hash,
            {
                "encoding": encoding,
                "commitment": "finalized"
            }
        ]
    )
    return result["result"]


async def get_block(slot_num: int):
    result = await call_rpc_method(
        SOLANA_NODE_RPC,
        "getBlock",
        [
            slot_num,
            {
                "transactionDetails": "full",
                "rewards": False,
                "maxSupportedTransactionVersion": 0,
                "commitment": "finalized"
            }
        ]
    )
    return result["result"]


def get_deposit_address(program_id: str, agent: str, account: int, index: int) -> str:
    program_id = Pubkey.from_string(program_id)

    # Convert prefix seed (UTF-8 string) to bytes
    prefix_bytes = "user-vault".encode('utf-8')

    # Convert agent (u256 hex string) to bytes
    agent_bytes = bytes.fromhex(agent[2:])  # Skip the '0x' prefix
    if len(agent_bytes) > 32:
        raise ValueError(
            "agentId hex string is too long to fit into 32 bytes.")
    elif len(agent_bytes) < 32:
        agent_bytes = agent_bytes.rjust(32, b'\x00')

    # Convert account and index to bytes (int to 8-byte representation)
    account_bytes = account.to_bytes(8, 'big')
    index_bytes = index.to_bytes(8, 'big')

    # Combine all the seed data into one list
    seeds = [prefix_bytes, agent_bytes, account_bytes, index_bytes]
    # for b in seeds:
    #     print("-".join([f"{byte:02x}" for byte in b]))

    # Derive the PDA using the seeds and program ID
    (deposit_address, _) = Pubkey.find_program_address(seeds, program_id)

    # Return the PDA as a string
    return {"address": str(deposit_address)}


def __hash_multiple_data(data_list):
    hash_object = hashlib.sha256()
    for data in data_list:
        if isinstance(data, str):
            # For strings, encode to bytes
            hash_object.update(data.encode())
        elif isinstance(data, int):
            # Convert integers to bytes
            hash_object.update(data.to_bytes((data.bit_length() + 7) // 8 or 1, byteorder="big"))
        elif isinstance(data, bytes):
            # Directly update for bytes
            hash_object.update(data)
        elif isinstance(data, str) and all(c in "0123456789abcdefABCDEF" for c in data):
            # For hex strings, decode into bytes
            hash_object.update(bytes.fromhex(data))
        else:
            raise TypeError(f"Unsupported data type: {type(data)}")
    return hash_object.hexdigest()


def hash_withdraw(withdraw: WithdrawDoc):
    if withdraw["token"].get("contract") is None:
        msg = f"allowed withdraw {withdraw['amount']} {withdraw['token']['symbol']} to address {withdraw['toAddress']}"
    else:
        msg = f"allowed withdraw {withdraw['amount']} {withdraw['token']['contract']} to address {withdraw['toAddress']}"
   
    return msg.encode("utf-8").hex()


if __name__ == "__main__":
    program_id = "7agD1A3RRjhFR2vi3FXCMs8ou65FFC1HZa3MtvC5aHT5"
    agentId = "0x9d3e02bff4c58845b766f21c10a5556093198e511d1f228c15f8fd319d91556e"
    account = 0
    for index in list(range(0, 6)):
        address = get_deposit_address(agentId, account, index)
        print(index, address)

    # output:
    #
    # 0: '22pZgV8Nq4eN1mxRghA4JiGbCrj1q2pVk5bDeVz3GfD5'
    # 1: 'GmBWwiJ6mGUPuV3au6GYS5fnWrTNULo8JDj48dsLeBA1'
    # 2: 'F3dZ3fpygb5WZMr2jq2ABsUdUx8BcEGyhr3vHXfHGia4'
    # 3: 'A5zPsxpw4wToQdqUqHR2d4iQeyXUSBR2w9BeeePM76nf'
    # 4: 'EchhycvbpVsGUXkrMmGNUg4uUuVnmzGzjNaEHzqrqnHw'
    # 5: '7XdECKzkbAbuMtR3nYMfjBKvautdWCtzHkrgdbKMgcju'

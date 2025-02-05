from tonsdk.utils import Address
from custody_service.database.db_withdraws import WithdrawDoc
import os, hashlib


def get_deposit_address(assetman_addr: str, agent: str, account: int, user: int) :
    bytes1 = bytes(Address(assetman_addr).to_buffer())
    bytes2 = bytes.fromhex(agent[2:])
    
    # Convert integers to 4-byte big-endian representations
    int1_bytes = account.to_bytes(8, 'big')
    int2_bytes = user.to_bytes(5, 'big')
    
    # Concatenate all bytes and compute SHA-256
    sha256_hash = hashlib.sha256(bytes1 + bytes2 + int1_bytes + int2_bytes).hexdigest()
    
    return {
        'address': assetman_addr,
        'memo': sha256_hash[0:30],
    }
    

def hash_withdraw(withdraw: WithdrawDoc):
    if withdraw["token"].get("contract") is None:
        msg = f"allowed withdraw TON"
    else:
        msg = f"allowed withdraw Jetton"
   
    return msg.encode("utf-8").hex()
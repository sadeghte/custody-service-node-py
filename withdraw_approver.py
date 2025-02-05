from pyfrost.network.sa import SA
from pyfrost.network.dkg_handler import DkgHandler
from custody_service.abstracts import NodesInfo
from custody_service.chain_utils.solana_chain_utils import hash_withdraw
from custody_service import database
from custody_service.utils import get_zellular
from custody_service.custom_types import ZellularTx
import logging
import json
import random
import time
import timeit
import sys
import os
import random
import asyncio
# TODO: Merge examples with libp2p.


zellular = get_zellular()

CHAIN_KEY_TYPE = {
    'SOL': 'ed25519',
    'TON': 'ed25519',
}

def get_key_path(key_type: str):
    return f"./frost-keys/{key_type}.json"

def get_chain_key_path(chain: str):
    return get_key_path(CHAIN_KEY_TYPE[chain]);

def init_logs():
    file_path = "logs"
    file_name = "test.log"
    log_formatter = logging.Formatter(
        "%(asctime)s - %(message)s",
    )
    root_logger = logging.getLogger()
    if not os.path.exists(file_path):
        os.mkdir(file_path)
    with open(f"{file_path}/{file_name}", "w"):
        pass
    file_handler = logging.FileHandler(f"{file_path}/{file_name}")
    file_handler.setFormatter(log_formatter)
    root_logger.addHandler(file_handler)
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(log_formatter)
    root_logger.addHandler(console_handler)
    root_logger.setLevel(logging.DEBUG)


async def init(key_type, node_count, threshold):
    nodes_info = NodesInfo()
    all_nodes = nodes_info.get_all_nodes(node_count)
    dkg_handler = DkgHandler(nodes_info, default_timeout=50)

    # Requesting DKG:
    now = timeit.default_timer()
    dkg_key = await dkg_handler.request_dkg(threshold, all_nodes, key_type)
    then = timeit.default_timer()
    
    # Writing JSON data to the file
    key_path = get_key_path(key_type);
    os.makedirs(os.path.dirname(key_path), exist_ok=True)
    with open(key_path, "w") as file:
        json.dump(dkg_key, file, indent=4)

    logging.info(f"Requesting DKG takes: {then - now} seconds.")
    logging.info(f'The DKG result is {dkg_key["result"]}')

    print(f"DKG done. result: {dkg_key['result']}");
    print(f"Key ID: {dkg_key['public_key']}");

async def run_withdraw_executer(chain: str) -> None:
    nodes_info = NodesInfo()
    sa = SA(nodes_info, default_timeout=50)

    key_path = get_chain_key_path(chain)
    with open(key_path, "r") as file:
        dist_key = json.load(file)

    if dist_key is None:
        raise Exception("FROST key missing.")
    
    threshold = dist_key["threshold"]
    public_key = dist_key["public_key"]

    # for each signature we select a random subset
    # only nonce[0] will be tested
    while True:
        withdraws = list(database.get_withdraws(status="initialized", target_chain=chain))
        count = len(withdraws)
        logging.info(f"[{count}] pending {chain} chain withdraw found.")
        
        if count > 0:
            # select random partners
            selected_party = dist_key["party"][:]
            random.shuffle(selected_party)
            selected_party = selected_party[:threshold]
            logging.info(
                f"Signature selected party: {json.dumps(selected_party, indent=4)}")

            # Requesting nonce generation
            nonces = {}
            nonces_response = await sa.request_nonces(selected_party, public_key, count)

            for node_id in selected_party:
                nonces.setdefault(node_id, [])
                nonces[node_id] += nonces_response[node_id]["commitments"]

            z_txs: list[ZellularTx] = []
            for i in range(count):
                now = timeit.default_timer()
                # sa_data = {"data": "Hi there"}
                sa_data = {
                    "type": "WithdrawConfirm",
                    "data":{
                        "withdraw": withdraws[i]["id"],
                    }
                }
                
                # prepare nonce dict
                nonces_dict = {}
                for node_id in selected_party:
                    nonce = nonces[node_id].pop()
                    nonces_dict[node_id] = nonce

                signature = await sa.request_signature(dist_key, nonces_dict, sa_data, selected_party)
                then = timeit.default_timer()
                
                z_txs.append({
                    "type": "ApproveWithdraw",
                    "data": {
                        "id": withdraws[i]["id"],
                        "avsVerifyingKey": dist_key["public_key"],
                        "avsSignature": signature["signature"],
                    }
                })

                logging.info(f"Requesting signature {i} takes {then - now} seconds")
                logging.info(f"Signature data: {json.dumps(signature, indent=4)}")
                
            if len(z_txs) > 0:
                zellular.send(z_txs, blocking=True)
        
        await asyncio.sleep(10)


if __name__ == "__main__":
    init_logs()
    
    if len(sys.argv) < 2:
        raise Exception("Arguments missing")
    
    if sys.argv[1] == "init":
        if len(sys.argv) < 5:
            raise Exception("Missing key type argument.")
        
        [_, _, key_type, node_count, threshold] = sys.argv
        print("initialising FROST key: ", {'key_type': key_type, 'node_count': node_count, 'threshold': threshold})
        asyncio.run(init(key_type, int(node_count), int(threshold)))
    else:
        chain = sys.argv[1];
        sys.set_int_max_str_digits(0)

        try:
            asyncio.run(run_withdraw_executer(chain))
        except KeyboardInterrupt:
            pass

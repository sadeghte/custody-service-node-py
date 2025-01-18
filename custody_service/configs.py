from solana.rpc.api import Client
from solana.rpc.async_api import AsyncClient
from fastecdsa import keys, curve
from fastecdsa.encoding.sec1 import SEC1Encoder
from .zellular import Zellular
import hashlib

VALID_IPS = {
	"127.0.0.1": []
}

CONTRACTS = {
    "SOL": {
        "asset_manager": "7KNvnNe6sMAVRwXijVeEJ3qn8ACLMcZT3gQQ76VPoKDN"
    }
}

# DEPOSIT_ADDRESSES = {
# 	"SOL": [
# 		"8yxYA1AJfC69CcXeKEmQAG5vcXLaJEUBJ3B4u2Wf3eMj",
#   		"2gNmroTggdBAwJakcagBD2nSpmfJWHgp2CFbrdPBfhB7",
# 		"4os2qSDc4yFZLyygTigySDauBvzPp5t6ynh345VmyDHY",
# 	]
# }

def num_to_hex(num: int, byte_len:int= 32) -> str:
	return f"{num:0{byte_len*2}x}"

def generate_privates_and_nodes_info(number: int = 100):
	first_private = (
		71940701385098721223324549130922930535689437869965850741649618196713151413648
	)
	nodes_info_dict = {}
	privates_list = []
	previous_key = first_private
	for i in range(number):
		key_bytes = previous_key.to_bytes(32, "big")
		hashed = hashlib.sha256(key_bytes).digest()
		new_private = int.from_bytes(hashed, byteorder="big") % curve.secp256k1.q
		previous_key = new_private
		public_key = keys.get_public_key(new_private, curve.secp256k1)
		compressed_pub_key = int(
			SEC1Encoder.encode_public_key(public_key, True).hex(), 16
		)
		id = num_to_hex(i + 1);
		nodes_info_dict[id] = {
			"id": id,
			"public_key": compressed_pub_key,
			"host": "127.0.0.1",
			"port": str(5000 + i),
		}
		privates_list.append(new_private)
	return privates_list, nodes_info_dict

def get_zellular(app_name: str):
	return Zellular(app_name, "http://localhost:6379")

def new_solana_client(rpc: str = "http://localhost:8899") -> Client:
	return Client(rpc)

def new_solana_async_client(rpc: str = "http://localhost:8899") -> AsyncClient:
	return AsyncClient(rpc)
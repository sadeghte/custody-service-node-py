import httpx, json
from .zellular import Zellular



zellular = Zellular("custody_service_app", "http://localhost:6379")


def get_zellular():
    return zellular;


def register_deposits(deposits):
    zellular = get_zellular()
    return zellular.send([{
        "type": "Deposit", 
        "data": deposits
    }])


async def call_rpc_method(endpoint: str, method: str, params: any, id: int = 1) -> dict:
    payload = json.dumps({
        "jsonrpc": "2.0",
        "id": id,
        "method": method,
        "params": params
    })
    async with httpx.AsyncClient() as client:
        response = await client.post(
            endpoint,
            headers={"Content-Type": "application/json"},
            content=payload
        )
        response.raise_for_status()  # Raise an error for HTTP status codes >= 400
        result = response.json()
        if "error" in result:
            raise Exception(f"RPC Error: {result['error']}")
        return result
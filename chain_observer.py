from custody_service.chain_utils import all_observers
import sys
import asyncio


if __name__ == "__main__":
    chainId = sys.argv[1]
    asyncio.run(all_observers[chainId].observe())
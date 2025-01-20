# start custody service node
```bash
# node ids: 1, 2, 3, ...
$ dotenv -f node-<id>.env run -- python node.py
```

# start chain worker
```bash
# chain-IDs: SOL
$ dotenv -f node-<id>.env run -- python chain_observer.py <chain-id>
# for SOL chain
$ dotenv -f node-<id>.env run -- npx ts-node ./js/solana-chain-worker.ts
```

# start zellular observer
```bash
$ dotenv -f node-<id>.env run -- python zellular_observer.py
```

# Start zellular deposits tx validator
```bash
# chain-IDs: SOL
$ dotenv -f .env run -- python deposit_validator.py <chain-id>
```

# Start withdraw approver
```bash
# initialize network to generate frost key
$ python withdraw_approver.py init <running node count> <threshold>

# initialize contract to store frost key on-chain
$ dotenv -f node-<id>.env run -- npx ts-node ./js/solana-contract-init.ts

# start approver to gather the avs signature and approve the withdraws
# it must be run on the one of nodes to access its withdraw collection
$ dotenv -f node-<id>.env run -- python withdraw_approver.py
```
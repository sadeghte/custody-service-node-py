import * as anchor from "@coral-xyz/anchor";
import { ZexAssetmanSol } from "./type"
import { 
    Connection, 
    PublicKey, 
    Keypair, 
    Transaction, 
    Ed25519Program, 
    SYSVAR_INSTRUCTIONS_PUBKEY, 
    SystemProgram
} from "@solana/web3.js";
import BN from "bn.js"
import fs from "fs";
import * as path from 'path';
import { ChainID, TokenID, ZellularDepositTx } from "../../types";
import { WithdrawDoc } from "js/database/db-withdraws";
import { getAssociatedTokenAddressSync, getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { ASSOCIATED_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";
import { getAvailableTokens } from "../../backend-api";


const ASSETMAN_CONFIG_SEEDS = Buffer.from("assetman-configs", "utf-8")
const MAIN_VAULTS_SEED = Buffer.from("main-vault", "utf-8");
const USER_VAULTS_SEED = Buffer.from("user-vault");


type SolanaAssetmanConfigs = {
    rpc: string,
    privateKey: string,
    address: string,
}

export class SolanaAssetman {
    configs: SolanaAssetmanConfigs;
    private PROGRAM_ID: PublicKey;
    private connection: Connection;
    private wallet:anchor.Wallet;
    private provider: anchor.Provider;
    private program: anchor.Program<ZexAssetmanSol>

    constructor(configs: SolanaAssetmanConfigs) {
        this.configs = configs;

        this.connection = new Connection(configs.rpc, "finalized");
        this.wallet = new anchor.Wallet(
            Keypair.fromSecretKey(
                Uint8Array.from(Buffer.from(configs.privateKey, "hex"))
            )
        )
        this.provider = new anchor.AnchorProvider(this.connection, this.wallet, {
            preflightCommitment: "processed",
        });
        this.PROGRAM_ID = new PublicKey(configs.address);
        const idl = JSON.parse(fs.readFileSync(path.resolve(__dirname, "./idl.json"), "utf-8"));
        this.program = new anchor.Program(
            idl, 
            this.PROGRAM_ID, 
            this.provider
        );
    }

    async initialize(withdrawAuthority, admin?: PublicKey) {
        const configsPDA = this.getConfigsPDA();
        const tx = await this.program.methods
            .initialize(withdrawAuthority)
            .accounts({
                configs: configsPDA,
                admin: !!admin ? admin : this.wallet.publicKey,
                // systemProgram: anchor.web3.SystemProgram.programId,
            })
            .rpc();
    
        return tx;
    }

    async setWithdrawAuthority(withdrawAuthority) {
        const configsPDA = this.getConfigsPDA();
        const tx = await this.program.methods
            .setWithdrawAuthority(withdrawAuthority)
            .accounts({
                configs: configsPDA,
                admin: this.wallet.publicKey,
                // systemProgram: anchor.web3.SystemProgram.programId,
            })
            .rpc();
    
        return tx;
    }

    async fetchConfigs() {
        const configsPDA = this.getConfigsPDA();
        return await this.program.account.configs.fetch(configsPDA);
    }

    async transferToMainVault(deposits: ZellularDepositTx[]) {
        const solDeposits = deposits.filter(d => (d.chain === ChainID.Solana && !d.deposit.contract))
        const splDeposits = deposits.filter(d => d.chain === ChainID.Solana && !!d.deposit.contract)

        const mainVault = this.getMainVaultPDA();

        const transferTx = new Transaction();
        for(const d of solDeposits) {
            transferTx.add(
                await this.program.methods
                .transferSolToMainVault(
                    // @ts-ignore
                    Buffer.from(d.agent.substr(2), "hex"), 
                    new BN(d.account), 
                    new BN(d.user)
                )
                .accounts({
                    userVault: d.address,
                    mainVault,
                })
                .signers([])
                .instruction()
            );
        }
        for(const d of splDeposits) {
            const mint = new PublicKey(d.deposit.contract)
            const userVault = this.getUserVaultPDA(d.agent, d.account, d.user);
            const userTokenAccount = getAssociatedTokenAddressSync(mint, userVault, true);
            const mainVaultTokenAccount = getAssociatedTokenAddressSync(mint, mainVault, true);

            transferTx.add(
                await this.program.methods
                .transferSplToMainVault(
                    // @ts-ignore
                    Buffer.from(d.agent.substr(2), "hex"), 
                    new BN(d.account), 
                    new BN(d.user)
                )
                .accounts({
                    signer: this.wallet.publicKey,
                    userVault,
                    mainVault,
                    userTokenAccount,
                    mainVaultTokenAccount,
                    mint,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
                })
                .instruction()
            );
        }
        let transferTxHash = await this.provider.sendAndConfirm(transferTx);
        return transferTxHash
    }

    async withdraw(withdraws: WithdrawDoc[]) {
        const solWithdraws = withdraws.filter(d => (d.targetChain === ChainID.Solana && d.token.symbol == TokenID.Solana))
        const splWithdraws = withdraws.filter(d => d.targetChain === ChainID.Solana && d.token.symbol !== TokenID.Solana)

        const configs = this.getConfigsPDA();
        const mainVault = this.getMainVaultPDA();
        const tx = new Transaction();
        for(const w of solWithdraws) {
            const message = `allowed withdraw ${w.amount} ${w.token.symbol} to address ${w.toAddress}`;
            tx.add(
                Ed25519Program.createInstructionWithPublicKey({
                    signature: Buffer.from(w.avsSignature.signature, 'hex'),
                    message: Buffer.from(message, 'utf-8'),
                    publicKey: Buffer.from(w.avsSignature.verifyingKey, 'hex'),
                })
            ) 
            tx.add(
                await this.program.methods
                    // @ts-ignore
                    .withdrawSol(new BN(w.amount), Buffer.from(w.avsSignature.signature, "hex"))
                    .accounts({
                        configs,
                        mainVault,
                        destination: new PublicKey(w.toAddress),
                        instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
                    })
                    .signers([])
                    .instruction()
            );
        }

        const availableTokens = await getAvailableTokens("SOL");
        for(const w of splWithdraws) {
            const tokenInfo = availableTokens.find(t => t.symbol === w.token.symbol);
            if(!tokenInfo) {
                console.log(w)
                throw `token not founn`
            }

            const mint = new PublicKey(tokenInfo.contract);
            const destination = new PublicKey(w.toAddress)
            const message = `allowed withdraw ${w.amount} ${w.token.contract} to address ${w.toAddress}`;

            console.log({
                signer: this.wallet.publicKey.toBase58(),
                configs: configs.toBase58(),
                mainVault: mainVault.toBase58(),
                mainVaultTokenAccount: getAssociatedTokenAddressSync(mint, mainVault, true).toBase58(),
                destination: destination.toBase58(),
                destinationTokenAccount: getAssociatedTokenAddressSync(mint, destination, true).toBase58(),
                mint: mint.toBase58(),
                instructions: SYSVAR_INSTRUCTIONS_PUBKEY.toBase58(),
                tokenProgram: TOKEN_PROGRAM_ID.toBase58(),
                associatedTokenProgram: ASSOCIATED_PROGRAM_ID.toBase58(),
                message,
            })
            tx.add(
                Ed25519Program.createInstructionWithPublicKey({
                    signature: Buffer.from(w.avsSignature.signature, 'hex'),
                    message: Buffer.from(message, 'utf-8'),
                    publicKey: Buffer.from(w.avsSignature.verifyingKey, 'hex'),
                })
            ) 
            tx.add(
                await this.program.methods
                    // @ts-ignore
                    .withdrawSpl(new BN(w.amount), Buffer.from(w.avsSignature.signature, "hex"))
                    .accounts({
                        signer: this.wallet.publicKey,
                        configs,
                        mainVault,
                        mainVaultTokenAccount: getAssociatedTokenAddressSync(mint, mainVault, true),
                        destination,
                        destinationTokenAccount: getAssociatedTokenAddressSync(mint, destination, true),
                        mint,
                        instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
                        tokenProgram: TOKEN_PROGRAM_ID,
                        associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
                    })
                    .signers([])
                    .instruction()
            );
        }
        let txHash = await this.provider.sendAndConfirm(tx);
        return txHash
    }

    // ================= utility methods ===================

    getConfigsPDA(): PublicKey {
        const [accountPDA, accountBump] = PublicKey.findProgramAddressSync(
            [ASSETMAN_CONFIG_SEEDS],
            this.PROGRAM_ID
        );
        return accountPDA;
    }
    
    getMainVaultPDA(): PublicKey {
        const [accountPDA, accountBump] = PublicKey.findProgramAddressSync(
            [MAIN_VAULTS_SEED],
            this.PROGRAM_ID
        );
        return accountPDA;
    }
    
    getUserVaultPDA(agent: string, accountIndex: number, userIndex: number): PublicKey {
        const agentBuff = Buffer.from(agent.substr(2), "hex");
        
        const accountBuff = Buffer.alloc(8);
        accountBuff.writeBigUInt64BE(BigInt(accountIndex))
    
        const userBuff = Buffer.alloc(8);
        userBuff.writeBigUInt64BE(BigInt(userIndex))
        
        const [accountPDA, accountBump] = PublicKey.findProgramAddressSync(
            [USER_VAULTS_SEED, agentBuff, accountBuff, userBuff],
            this.PROGRAM_ID
        );
        return accountPDA;
    }
}
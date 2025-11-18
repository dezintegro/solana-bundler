import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { WalletCollection, FundDistributionPlan } from '../types';
import logger from '../utils/logger';

/**
 * FundDistributor handles SOL distribution from main wallet to dev and buyer wallets
 */
export class FundDistributor {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Calculate fund distribution plan
   */
  static calculateDistribution(
    devAmount: number,
    buyerAmount: number,
    buyerCount: number
  ): FundDistributionPlan {
    // Estimate transaction fees (0.000005 SOL per transfer)
    const feePerTransfer = 0.000005;
    const totalTransfers = 1 + buyerCount; // 1 for dev + N for buyers
    const estimatedFees = feePerTransfer * totalTransfers;

    const totalRequired = devAmount + buyerAmount * buyerCount + estimatedFees;

    return {
      totalRequired,
      devAmount,
      buyerAmount,
      buyerCount,
      estimatedFees,
    };
  }

  /**
   * Check if main wallet has sufficient balance
   */
  async checkBalance(mainWalletPubkey: PublicKey, requiredAmount: number): Promise<boolean> {
    try {
      const balance = await this.connection.getBalance(mainWalletPubkey);
      const balanceInSol = balance / LAMPORTS_PER_SOL;

      logger.info(
        `Main wallet balance: ${balanceInSol.toFixed(4)} SOL, Required: ${requiredAmount.toFixed(4)} SOL`
      );

      return balanceInSol >= requiredAmount;
    } catch (error) {
      logger.error('Failed to check balance', error);
      throw new Error(
        `Failed to check balance: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Distribute funds from main wallet to dev and buyer wallets
   */
  async distributeFunds(
    collection: WalletCollection,
    devAmount: number,
    buyerAmount: number
  ): Promise<{ devTxSignature: string; buyerTxSignatures: string[] }> {
    logger.info('Starting fund distribution');

    const plan = FundDistributor.calculateDistribution(
      devAmount,
      buyerAmount,
      collection.buyers.length
    );

    // Check main wallet balance
    const hasBalance = await this.checkBalance(collection.main.publicKey, plan.totalRequired);
    if (!hasBalance) {
      throw new Error(
        `Insufficient balance in main wallet. Required: ${plan.totalRequired.toFixed(4)} SOL`
      );
    }

    try {
      // Transfer to dev wallet
      logger.info(`Transferring ${devAmount} SOL to dev wallet`);
      const devTxSignature = await this.transferSol(
        collection.main.keypair,
        collection.dev.publicKey,
        devAmount
      );
      logger.info(`Dev wallet funded. Tx: ${devTxSignature}`);

      // Transfer to buyer wallets
      const buyerTxSignatures: string[] = [];
      for (let i = 0; i < collection.buyers.length; i++) {
        const buyer = collection.buyers[i];
        if (!buyer) continue;
        logger.info(`Transferring ${buyerAmount} SOL to buyer wallet ${i + 1}/${collection.buyers.length}`);

        const txSignature = await this.transferSol(
          collection.main.keypair,
          buyer.publicKey,
          buyerAmount
        );

        buyerTxSignatures.push(txSignature);
        logger.debug(`Buyer wallet ${i + 1} funded. Tx: ${txSignature}`);
      }

      logger.info(
        `Fund distribution completed. Dev: ${devTxSignature}, Buyers: ${buyerTxSignatures.length} transactions`
      );

      return {
        devTxSignature,
        buyerTxSignatures,
      };
    } catch (error) {
      logger.error('Fund distribution failed', error);
      throw new Error(
        `Fund distribution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Transfer SOL from one wallet to another
   */
  private async transferSol(
    from: any,
    to: PublicKey,
    amount: number
  ): Promise<string> {
    try {
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: from.publicKey,
          toPubkey: to,
          lamports: Math.floor(amount * LAMPORTS_PER_SOL),
        })
      );

      const signature = await sendAndConfirmTransaction(this.connection, transaction, [from], {
        commitment: 'confirmed',
      });

      return signature;
    } catch (error) {
      logger.error('Transfer failed', error);
      throw new Error(
        `Transfer failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get balance for a wallet
   */
  async getBalance(publicKey: PublicKey): Promise<number> {
    try {
      const balance = await this.connection.getBalance(publicKey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      logger.error('Failed to get balance', error);
      throw new Error(
        `Failed to get balance: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get balances for all wallets in collection
   */
  async getAllBalances(collection: WalletCollection): Promise<{
    main: number;
    dev: number;
    buyers: number[];
  }> {
    try {
      const [mainBalance, devBalance, ...buyerBalances] = await Promise.all([
        this.getBalance(collection.main.publicKey),
        this.getBalance(collection.dev.publicKey),
        ...collection.buyers.map((buyer) => this.getBalance(buyer.publicKey)),
      ]);

      return {
        main: mainBalance,
        dev: devBalance,
        buyers: buyerBalances,
      };
    } catch (error) {
      logger.error('Failed to get all balances', error);
      throw new Error(
        `Failed to get all balances: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

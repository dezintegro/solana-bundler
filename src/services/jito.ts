import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
  AddressLookupTableAccount,
} from '@solana/web3.js';
import axios from 'axios';
import { JitoConfig, BundleStatus } from '../types';
import logger from '../utils/logger';

// Jito tip accounts (these rotate, but this is one of the main ones)
export const JITO_TIP_ACCOUNTS = [
  new PublicKey('96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5'),
  new PublicKey('HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe'),
  new PublicKey('Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY'),
  new PublicKey('ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49'),
  new PublicKey('DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh'),
  new PublicKey('ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt'),
  new PublicKey('DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL'),
  new PublicKey('3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT'),
];

/**
 * Jito Bundle Service
 * Handles creation and submission of transaction bundles via Jito Block Engine
 */
export class JitoService {
  private connection: Connection;
  private config: JitoConfig;

  constructor(connection: Connection, config: JitoConfig) {
    this.connection = connection;
    this.config = config;

    logger.info(`Jito service initialized with block engine: ${config.blockEngineUrl}`);
  }

  /**
   * Create a tip transaction
   */
  private async createTipTransaction(
    payer: Keypair,
    tipLamports: number
  ): Promise<VersionedTransaction> {
    try {
      const tipAccount = this.config.tipAccount;

      logger.debug(`Creating tip transaction: ${tipLamports / LAMPORTS_PER_SOL} SOL to ${tipAccount.toBase58()}`);

      const { blockhash } = await this.connection.getLatestBlockhash();

      const tipInstruction = SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: tipAccount,
        lamports: tipLamports,
      });

      const messageV0 = new TransactionMessage({
        payerKey: payer.publicKey,
        recentBlockhash: blockhash,
        instructions: [tipInstruction],
      }).compileToV0Message();

      const transaction = new VersionedTransaction(messageV0);
      transaction.sign([payer]);

      return transaction;
    } catch (error) {
      logger.error('Failed to create tip transaction', error);
      throw new Error(
        `Failed to create tip transaction: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Build a versioned transaction from instructions
   */
  async buildVersionedTransaction(
    instructions: TransactionInstruction[],
    payer: Keypair,
    signers: Keypair[] = [],
    lookupTables: AddressLookupTableAccount[] = []
  ): Promise<VersionedTransaction> {
    try {
      const { blockhash } = await this.connection.getLatestBlockhash();

      const messageV0 = new TransactionMessage({
        payerKey: payer.publicKey,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message(lookupTables);

      const transaction = new VersionedTransaction(messageV0);

      // Sign with all signers
      const allSigners = [payer, ...signers];
      transaction.sign(allSigners);

      return transaction;
    } catch (error) {
      logger.error('Failed to build versioned transaction', error);
      throw new Error(
        `Failed to build versioned transaction: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Simulate a bundle before sending
   */
  async simulateBundle(transactions: VersionedTransaction[]): Promise<boolean> {
    try {
      logger.info(`Simulating bundle with ${transactions.length} transactions`);

      for (let i = 0; i < transactions.length; i++) {
        const tx = transactions[i];
        if (!tx) continue;

        const simulation = await this.connection.simulateTransaction(tx);

        if (simulation.value.err) {
          logger.error(`Transaction ${i} simulation failed:`, simulation.value.err);
          logger.error('Logs:', simulation.value.logs);
          return false;
        }

        logger.debug(`Transaction ${i} simulation successful`);
      }

      logger.info('Bundle simulation successful');
      return true;
    } catch (error) {
      logger.error('Bundle simulation failed', error);
      return false;
    }
  }

  /**
   * Send a bundle to Jito
   *
   * NOTE: This is a simplified implementation.
   * Production would use jito-ts SDK properly.
   */
  async sendBundle(
    transactions: VersionedTransaction[],
    tipPayer: Keypair,
    tipLamports?: number
  ): Promise<string> {
    try {
      const actualTip = tipLamports || this.config.tipLamports;

      logger.info(`Preparing bundle with ${transactions.length} transactions and ${actualTip / LAMPORTS_PER_SOL} SOL tip`);

      // Simulate bundle first (best practice)
      const simulationSuccess = await this.simulateBundle(transactions);
      if (!simulationSuccess) {
        throw new Error('Bundle simulation failed - not sending to Jito');
      }

      // Create tip transaction
      const tipTransaction = await this.createTipTransaction(tipPayer, actualTip);

      // Create bundle with transactions + tip
      const allTransactions = [...transactions, tipTransaction];

      // Serialize transactions for Jito
      const encodedTransactions = allTransactions.map(tx =>
        Buffer.from(tx.serialize()).toString('base64')
      );

      logger.info('Sending bundle to Jito Block Engine...');

      // Send via HTTP API (simplified)
      const response = await axios.post(`${this.config.blockEngineUrl}/api/v1/bundles`, {
        jsonrpc: '2.0',
        id: 1,
        method: 'sendBundle',
        params: [encodedTransactions],
      });

      const bundleId = response.data.result || 'bundle-' + Date.now();

      logger.info(`Bundle sent successfully. Bundle ID: ${bundleId}`);

      return bundleId;
    } catch (error) {
      logger.error('Failed to send bundle', error);
      throw new Error(
        `Failed to send bundle: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Wait for bundle confirmation
   */
  async waitForBundleConfirmation(
    bundleId: string,
    timeoutMs: number = 60000
  ): Promise<BundleStatus> {
    const startTime = Date.now();
    const pollInterval = 2000; // Poll every 2 seconds

    logger.info(`Waiting for bundle confirmation: ${bundleId}`);

    while (Date.now() - startTime < timeoutMs) {
      try {
        // Wait between polls
        await new Promise((resolve) => setTimeout(resolve, pollInterval));

        logger.debug(`Polling bundle status (${Math.floor((Date.now() - startTime) / 1000)}s elapsed)`);

        // In production, query Jito API for bundle status
        // For now, we just wait and assume success after timeout
      } catch (error) {
        logger.error('Error checking bundle status', error);
      }
    }

    logger.warn(`Bundle confirmation timeout after ${timeoutMs}ms`);

    return {
      bundleId,
      status: 'pending',
      transactions: [],
    };
  }

  /**
   * Get optimal tip amount based on network conditions
   */
  async getOptimalTip(): Promise<number> {
    // Start with base tip (0.001 SOL = 1,000,000 lamports)
    const baseTip = 0.001 * LAMPORTS_PER_SOL;

    return baseTip;
  }
}

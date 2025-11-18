import {
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
  AddressLookupTableAccount,
} from '@solana/web3.js';
import { searcherClient } from 'jito-ts/dist/sdk/block-engine/searcher';
import { Bundle } from 'jito-ts/dist/sdk/block-engine/types';
import { BundleResult } from 'jito-ts/dist/gen/block-engine/bundle';
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
 * Uses production jito-ts SDK with gRPC communication
 */
export class JitoService {
  private connection: Connection;
  private config: JitoConfig;
  private client: ReturnType<typeof searcherClient>;
  private bundleTransactionLimit: number = 5;

  constructor(connection: Connection, config: JitoConfig) {
    this.connection = connection;
    this.config = config;

    // Create SearcherClient without auth keypair (public access)
    this.client = searcherClient(config.blockEngineUrl);

    logger.info(`Jito service initialized with block engine: ${config.blockEngineUrl}`);
    logger.info('Using production jito-ts SDK (no auth required)');
  }

  /**
   * Get tip accounts from Jito
   */
  async getTipAccounts(): Promise<PublicKey[]> {
    try {
      const result = await this.client.getTipAccounts();

      if ('error' in result) {
        logger.warn('Failed to fetch tip accounts from Jito, using defaults', result.error);
        return JITO_TIP_ACCOUNTS;
      }

      const tipAccounts = result.value.map((account) => new PublicKey(account));
      logger.debug(`Fetched ${tipAccounts.length} tip accounts from Jito`);

      return tipAccounts;
    } catch (error) {
      logger.error('Error fetching tip accounts', error);
      return JITO_TIP_ACCOUNTS;
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
   * Send a bundle to Jito using production SDK
   */
  async sendBundle(
    transactions: VersionedTransaction[],
    tipPayer: Keypair,
    tipLamports?: number
  ): Promise<string> {
    try {
      const actualTip = tipLamports || this.config.tipLamports;

      logger.info(
        `Preparing bundle with ${transactions.length} transactions and ${actualTip / LAMPORTS_PER_SOL} SOL tip`
      );

      // Validate transaction count
      if (transactions.length > this.bundleTransactionLimit - 1) {
        throw new Error(
          `Bundle has ${transactions.length} transactions, but limit is ${this.bundleTransactionLimit - 1} (saving 1 slot for tip)`
        );
      }

      // Simulate bundle first (best practice)
      const simulationSuccess = await this.simulateBundle(transactions);
      if (!simulationSuccess) {
        throw new Error('Bundle simulation failed - not sending to Jito');
      }

      // Get recent blockhash for tip transaction
      const { blockhash } = await this.connection.getLatestBlockhash();

      // Create Bundle instance
      const bundle = new Bundle(transactions, this.bundleTransactionLimit);

      // Add tip transaction to bundle
      const bundleWithTip = bundle.addTipTx(
        tipPayer,
        actualTip,
        this.config.tipAccount,
        blockhash
      );

      if (bundleWithTip instanceof Error) {
        throw new Error(`Failed to add tip to bundle: ${bundleWithTip.message}`);
      }

      logger.info('Sending bundle to Jito Block Engine via gRPC...');

      // Send bundle using SearcherClient
      const result = await this.client.sendBundle(bundleWithTip);

      if ('error' in result) {
        throw new Error(`Bundle submission failed: ${result.error.message} - ${result.error.details}`);
      }

      const bundleId = result.value;

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
   * Wait for bundle confirmation using onBundleResult stream
   */
  async waitForBundleConfirmation(
    bundleId: string,
    timeoutMs: number = 60000
  ): Promise<BundleStatus> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let resolved = false;

      logger.info(`Waiting for bundle confirmation: ${bundleId}`);

      // Set timeout
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          unsubscribe();
          logger.warn(`Bundle confirmation timeout after ${timeoutMs}ms`);
          resolve({
            bundleId,
            status: 'pending',
            transactions: [],
          });
        }
      }, timeoutMs);

      // Subscribe to bundle results
      const unsubscribe = this.client.onBundleResult(
        (result: BundleResult) => {
          if (result.bundleId === bundleId && !resolved) {
            resolved = true;
            clearTimeout(timeout);
            unsubscribe();

            const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
            logger.info(`Received bundle result after ${elapsed}s`);

            resolve(this.parseBundleResult(result));
          }
        },
        (error: Error) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            unsubscribe();
            logger.error('Bundle result stream error', error);
            reject(error);
          }
        }
      );
    });
  }

  /**
   * Parse BundleResult from Jito into our BundleStatus type
   */
  private parseBundleResult(result: BundleResult): BundleStatus {
    if (result.finalized) {
      return {
        bundleId: result.bundleId,
        status: 'confirmed',
        transactions: [],
      };
    }

    if (result.processed) {
      return {
        bundleId: result.bundleId,
        status: 'confirmed',
        landedSlot: result.processed.slot,
        transactions: [],
      };
    }

    if (result.accepted) {
      return {
        bundleId: result.bundleId,
        status: 'processing',
        landedSlot: result.accepted.slot,
        transactions: [],
      };
    }

    if (result.rejected) {
      let errorMsg = 'Bundle rejected';

      if (result.rejected.simulationFailure) {
        errorMsg = `Simulation failure: ${result.rejected.simulationFailure.msg || 'Unknown'}`;
      } else if (result.rejected.stateAuctionBidRejected) {
        errorMsg = `State auction bid rejected: ${result.rejected.stateAuctionBidRejected.msg || 'Bid too low'}`;
      } else if (result.rejected.winningBatchBidRejected) {
        errorMsg = `Winning batch bid rejected: ${result.rejected.winningBatchBidRejected.msg || 'Bid too low'}`;
      } else if (result.rejected.internalError) {
        errorMsg = `Internal error: ${result.rejected.internalError.msg}`;
      } else if (result.rejected.droppedBundle) {
        errorMsg = `Dropped: ${result.rejected.droppedBundle.msg}`;
      }

      return {
        bundleId: result.bundleId,
        status: 'failed',
        error: errorMsg,
        transactions: [],
      };
    }

    if (result.dropped) {
      return {
        bundleId: result.bundleId,
        status: 'failed',
        error: `Bundle dropped: ${result.dropped.reason}`,
        transactions: [],
      };
    }

    return {
      bundleId: result.bundleId,
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

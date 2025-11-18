import { Connection, LAMPORTS_PER_SOL, TransactionInstruction } from '@solana/web3.js';
import { PumpfunService } from './pumpfun';
import { JitoService } from './jito';
import { WalletCollection, LaunchConfig, TokenLaunchResult, JitoConfig } from '../types';
import logger from '../utils/logger';

/**
 * Token Launcher Service
 * Orchestrates token creation and initial buys via Jito bundles
 */
export class TokenLauncherService {
  private pumpfun: PumpfunService;
  private jito: JitoService;

  constructor(connection: Connection, jitoConfig: JitoConfig) {
    this.pumpfun = new PumpfunService(connection);
    this.jito = new JitoService(connection, jitoConfig);

    logger.info('Token Launcher service initialized');
  }

  /**
   * Launch a token with bundled buys
   *
   * This is the main function that:
   * 1. Creates the token
   * 2. Builds buy transactions for all buyer wallets
   * 3. Bundles everything together
   * 4. Submits to Jito for atomic execution
   */
  async launch(
    config: LaunchConfig,
    walletCollection: WalletCollection
  ): Promise<TokenLaunchResult> {
    const startTime = Date.now();

    try {
      logger.info('='.repeat(60));
      logger.info('🚀 Starting Token Launch');
      logger.info('='.repeat(60));
      logger.info(`Token: ${config.tokenName} (${config.tokenSymbol})`);
      logger.info(`Buyers: ${config.buyerWalletCount}`);
      logger.info(`Buy amount per wallet: ${config.buyAmountPerWallet} SOL`);
      logger.info(`Jito tip: ${config.jitoTip} SOL`);
      logger.info('='.repeat(60));

      // Step 1: Create token instruction
      logger.info('📝 Step 1: Building token creation instruction...');
      const { instruction: createInstruction, mint } = await this.pumpfun.createTokenInstruction(
        walletCollection.dev.keypair,
        {
          metadata: {
            name: config.tokenName,
            symbol: config.tokenSymbol,
            description: config.tokenDescription,
            imageUri: config.tokenImageUrl || '',
          },
        }
      );

      logger.info(`✅ Token mint will be: ${mint.toBase58()}`);

      // Step 2: Build buy instructions for all buyer wallets
      logger.info(`📝 Step 2: Building ${walletCollection.buyers.length} buy instructions...`);
      const buyInstructions: TransactionInstruction[] = [];

      for (let i = 0; i < walletCollection.buyers.length; i++) {
        const buyer = walletCollection.buyers[i];
        if (!buyer) continue;

        logger.debug(`Building buy instruction for buyer ${i + 1}/${walletCollection.buyers.length}`);

        const buyInstruction = await this.pumpfun.buyTokenInstruction(buyer.keypair, {
          mint,
          solAmount: config.buyAmountPerWallet * LAMPORTS_PER_SOL,
          maxSlippageBps: config.slippageBps,
        });

        buyInstructions.push(buyInstruction);
      }

      logger.info(`✅ Built ${buyInstructions.length} buy instructions`);

      // Step 3: Build versioned transactions
      logger.info('📝 Step 3: Building versioned transactions...');

      // Create token transaction (signed by dev wallet)
      const createTx = await this.jito.buildVersionedTransaction(
        [createInstruction],
        walletCollection.dev.keypair
      );

      // Create buy transactions (each signed by respective buyer)
      const buyTxs = await Promise.all(
        buyInstructions.map((instruction, i) => {
          const buyer = walletCollection.buyers[i];
          if (!buyer) throw new Error(`Buyer ${i} not found`);
          return this.jito.buildVersionedTransaction([instruction], buyer.keypair);
        })
      );

      const allTransactions = [createTx, ...buyTxs];

      logger.info(`✅ Built ${allTransactions.length} versioned transactions`);

      // Step 4: Send bundle to Jito
      logger.info('📝 Step 4: Sending bundle to Jito Block Engine...');

      const bundleId = await this.jito.sendBundle(
        allTransactions,
        walletCollection.dev.keypair,
        config.jitoTip * LAMPORTS_PER_SOL
      );

      logger.info(`✅ Bundle submitted! Bundle ID: ${bundleId}`);

      // Step 5: Wait for confirmation (with timeout)
      logger.info('⏳ Step 5: Waiting for bundle confirmation...');

      const bundleStatus = await this.jito.waitForBundleConfirmation(bundleId, 60000);

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

      if (bundleStatus.status === 'confirmed') {
        logger.info('='.repeat(60));
        logger.info('🎉 Token Launch Successful!');
        logger.info('='.repeat(60));
        logger.info(`Token Mint: ${mint.toBase58()}`);
        logger.info(`Bundle ID: ${bundleId}`);
        logger.info(`Time elapsed: ${elapsed}s`);
        logger.info('='.repeat(60));

        return {
          success: true,
          bundleId,
          mintAddress: mint.toBase58(),
          bundleStatus,
          signatures: bundleStatus.transactions,
          timestamp: Date.now(),
        };
      } else {
        logger.warn('='.repeat(60));
        logger.warn('⚠️  Bundle Status: ' + bundleStatus.status);
        logger.warn('='.repeat(60));
        logger.warn(`Bundle may still be processing. Check status later.`);
        logger.warn(`Bundle ID: ${bundleId}`);
        logger.warn(`Time elapsed: ${elapsed}s`);
        logger.warn('='.repeat(60));

        return {
          success: false,
          bundleId,
          mintAddress: mint.toBase58(),
          bundleStatus,
          signatures: [],
          error: `Bundle status: ${bundleStatus.status}`,
          timestamp: Date.now(),
        };
      }
    } catch (error) {
      logger.error('='.repeat(60));
      logger.error('❌ Token Launch Failed');
      logger.error('='.repeat(60));
      logger.error('Error:', error);
      logger.error('='.repeat(60));

      return {
        success: false,
        bundleId: '',
        bundleStatus: {
          bundleId: '',
          status: 'failed',
          transactions: [],
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        signatures: [],
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Dry run - simulates a launch without actually sending
   */
  async dryRun(config: LaunchConfig, walletCollection: WalletCollection): Promise<boolean> {
    try {
      logger.info('🧪 Running dry run simulation...');

      // Build instructions (same as launch, but don't send)
      const { instruction: createInstruction, mint } = await this.pumpfun.createTokenInstruction(
        walletCollection.dev.keypair,
        {
          metadata: {
            name: config.tokenName,
            symbol: config.tokenSymbol,
            description: config.tokenDescription,
            imageUri: config.tokenImageUrl || '',
          },
        }
      );

      // Build buy instructions
      const buyInstructions: TransactionInstruction[] = [];
      for (const buyer of walletCollection.buyers) {
        const instruction = await this.pumpfun.buyTokenInstruction(buyer.keypair, {
          mint,
          solAmount: config.buyAmountPerWallet * LAMPORTS_PER_SOL,
          maxSlippageBps: config.slippageBps,
        });
        buyInstructions.push(instruction);
      }

      // Build transactions
      const createTx = await this.jito.buildVersionedTransaction(
        [createInstruction],
        walletCollection.dev.keypair
      );

      const buyTxs = await Promise.all(
        buyInstructions.map((instruction, i) => {
          const buyer = walletCollection.buyers[i];
          if (!buyer) throw new Error(`Buyer ${i} not found`);
          return this.jito.buildVersionedTransaction([instruction], buyer.keypair);
        })
      );

      // Simulate
      const allTransactions = [createTx, ...buyTxs];
      const success = await this.jito.simulateBundle(allTransactions);

      if (success) {
        logger.info('✅ Dry run successful - bundle would likely succeed');
      } else {
        logger.error('❌ Dry run failed - bundle would likely fail');
      }

      return success;
    } catch (error) {
      logger.error('Dry run error:', error);
      return false;
    }
  }
}

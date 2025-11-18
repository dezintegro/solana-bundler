import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { getAccount, getAssociatedTokenAddress } from '@solana/spl-token';
import { PriceMonitorService, PriceChangeEvent } from './price-monitor';
import { PumpfunService } from './pumpfun';
import { WalletCollection } from '../types';
import logger from '../utils/logger';

/**
 * Trigger types for sell strategies
 */
export type TriggerType = 'time' | 'price' | 'marketcap' | 'profit' | 'manual';

/**
 * Trigger configuration
 */
export interface TriggerConfig {
  type: TriggerType;
  value?: number; // For price, marketcap, profit targets
}

/**
 * DELAY mode configuration
 */
export interface DelayConfig {
  trigger: TriggerConfig;
  delayMinutes: number;
  sellPercentage: number;
  wallets: 'all' | 'dev' | number[];
}

/**
 * SMART mode - sell at multiple price levels
 */
export interface SmartConfig {
  levels: Array<{
    price: number;
    percentage: number;
    wallets: 'all' | 'dev' | number[];
  }>;
  partialSell: boolean;
  spacingSeconds: number;
}

/**
 * AUTO mode - fully automated selling
 */
export interface AutoConfig {
  targets: {
    targetPrice?: number;
    targetMarketCap?: number;
    targetProfit?: number;
  };
  action: 'sell-all' | 'sell-percentage';
  percentage?: number;
  stopLoss?: {
    enabled: boolean;
    price?: number;
    percentageDrop?: number;
  };
}

/**
 * Sell strategy status
 */
export interface StrategyStatus {
  id: string;
  mode: 'delay' | 'smart' | 'auto';
  active: boolean;
  triggered: boolean;
  startTime: number;
  triggerTime?: number;
  completionTime?: number;
  totalSold: number;
  totalSOLReceived: number;
}

/**
 * Smart Selling Service
 * Automated selling strategies
 */
export class SmartSellingService {
  private connection: Connection;
  private priceMonitor: PriceMonitorService;
  private pumpfun: PumpfunService;
  private activeStrategies: Map<string, StrategyStatus> = new Map();

  constructor(
    connection: Connection,
    priceMonitor: PriceMonitorService,
    pumpfun: PumpfunService
  ) {
    this.connection = connection;
    this.priceMonitor = priceMonitor;
    this.pumpfun = pumpfun;

    logger.info('Smart Selling service initialized');
  }

  /**
   * DELAY MODE: Sell with delay after trigger
   */
  async executeDelay(
    mint: PublicKey,
    config: DelayConfig,
    walletCollection: WalletCollection
  ): Promise<string> {
    const strategyId = `delay-${mint.toBase58()}-${Date.now()}`;

    logger.info(`Starting DELAY strategy: ${strategyId}`);

    const status: StrategyStatus = {
      id: strategyId,
      mode: 'delay',
      active: true,
      triggered: false,
      startTime: Date.now(),
      totalSold: 0,
      totalSOLReceived: 0,
    };

    this.activeStrategies.set(strategyId, status);

    // Wait for trigger
    await this.waitForTrigger(mint, config.trigger);

    status.triggered = true;
    status.triggerTime = Date.now();

    logger.info(`Trigger activated! Waiting ${config.delayMinutes} minutes before selling...`);

    // Wait delay
    await new Promise((resolve) => setTimeout(resolve, config.delayMinutes * 60 * 1000));

    // Execute sell
    logger.info('Delay completed. Executing sell...');

    await this.executeSell(mint, config.sellPercentage, config.wallets, walletCollection);

    status.active = false;
    status.completionTime = Date.now();

    logger.info(`DELAY strategy completed: ${strategyId}`);

    return strategyId;
  }

  /**
   * SMART MODE: Sell at multiple price levels
   */
  async executeSmart(
    mint: PublicKey,
    config: SmartConfig,
    walletCollection: WalletCollection
  ): Promise<string> {
    const strategyId = `smart-${mint.toBase58()}-${Date.now()}`;

    logger.info(`Starting SMART strategy: ${strategyId}`);

    const status: StrategyStatus = {
      id: strategyId,
      mode: 'smart',
      active: true,
      triggered: false,
      startTime: Date.now(),
      totalSold: 0,
      totalSOLReceived: 0,
    };

    this.activeStrategies.set(strategyId, status);

    // Sort levels by price (ascending)
    const sortedLevels = [...config.levels].sort((a, b) => a.price - b.price);

    let completedLevels = 0;

    // Subscribe to price changes
    const unsubscribe = this.priceMonitor.subscribeToPrice(mint, async (event: PriceChangeEvent) => {
      const currentPrice = event.newPrice;

      // Check each level
      for (let i = completedLevels; i < sortedLevels.length; i++) {
        const level = sortedLevels[i];
        if (!level) continue;

        // If price reached or exceeded this level
        if (currentPrice >= level.price) {
          logger.info(
            `Price level ${i + 1}/${sortedLevels.length} reached: ${level.price} SOL (current: ${currentPrice})`
          );

          // Execute sell for this level
          await this.executeSell(mint, level.percentage, level.wallets, walletCollection);

          completedLevels++;

          // Wait spacing if configured
          if (config.partialSell && config.spacingSeconds > 0 && i < sortedLevels.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, config.spacingSeconds * 1000));
          }

          // If all levels completed, finish
          if (completedLevels >= sortedLevels.length) {
            status.active = false;
            status.completionTime = Date.now();
            unsubscribe();
            logger.info(`SMART strategy completed: ${strategyId}`);
            break;
          }
        }
      }
    });

    return strategyId;
  }

  /**
   * AUTO MODE: Fully automated selling
   */
  async executeAuto(
    mint: PublicKey,
    config: AutoConfig,
    walletCollection: WalletCollection
  ): Promise<string> {
    const strategyId = `auto-${mint.toBase58()}-${Date.now()}`;

    logger.info(`Starting AUTO strategy: ${strategyId}`);

    const status: StrategyStatus = {
      id: strategyId,
      mode: 'auto',
      active: true,
      triggered: false,
      startTime: Date.now(),
      totalSold: 0,
      totalSOLReceived: 0,
    };

    this.activeStrategies.set(strategyId, status);

    let initialPrice = 0;
    let highestPrice = 0;

    // Subscribe to price changes
    const unsubscribe = this.priceMonitor.subscribeToPrice(mint, async (event: PriceChangeEvent) => {
      const currentPrice = event.newPrice;

      // Track initial and highest price
      if (initialPrice === 0) {
        initialPrice = currentPrice;
      }
      if (currentPrice > highestPrice) {
        highestPrice = currentPrice;
      }

      // Check stop loss
      if (config.stopLoss?.enabled) {
        let stopLossTriggered = false;

        if (config.stopLoss.price && currentPrice <= config.stopLoss.price) {
          logger.warn(`Stop loss triggered by price: ${currentPrice} <= ${config.stopLoss.price}`);
          stopLossTriggered = true;
        }

        if (config.stopLoss.percentageDrop && highestPrice > 0) {
          const dropPercent = ((highestPrice - currentPrice) / highestPrice) * 100;
          if (dropPercent >= config.stopLoss.percentageDrop) {
            logger.warn(
              `Stop loss triggered by drop: ${dropPercent.toFixed(2)}% >= ${config.stopLoss.percentageDrop}%`
            );
            stopLossTriggered = true;
          }
        }

        if (stopLossTriggered) {
          await this.executeSell(mint, 100, 'all', walletCollection);
          status.active = false;
          status.completionTime = Date.now();
          unsubscribe();
          logger.info(`AUTO strategy stopped (stop loss): ${strategyId}`);
          return;
        }
      }

      // Check targets
      let targetReached = false;

      if (config.targets.targetPrice && currentPrice >= config.targets.targetPrice) {
        logger.info(`Target price reached: ${currentPrice} >= ${config.targets.targetPrice}`);
        targetReached = true;
      }

      // TODO: Implement marketcap and profit checks

      if (targetReached) {
        const percentage = config.action === 'sell-all' ? 100 : config.percentage || 100;
        await this.executeSell(mint, percentage, 'all', walletCollection);

        status.active = false;
        status.completionTime = Date.now();
        unsubscribe();
        logger.info(`AUTO strategy completed: ${strategyId}`);
      }
    });

    return strategyId;
  }

  /**
   * Wait for trigger condition
   */
  private async waitForTrigger(mint: PublicKey, trigger: TriggerConfig): Promise<void> {
    return new Promise((resolve) => {
      switch (trigger.type) {
        case 'time':
          // Time-based trigger (wait specified duration)
          const waitMs = (trigger.value || 0) * 60 * 1000;
          setTimeout(resolve, waitMs);
          break;

        case 'price':
          // Price-based trigger
          const unsubscribe = this.priceMonitor.subscribeToPrice(mint, (event: PriceChangeEvent) => {
            if (trigger.value && event.newPrice >= trigger.value) {
              unsubscribe();
              resolve();
            }
          });
          break;

        case 'manual':
          // Manual trigger (never resolves automatically)
          logger.info('Waiting for manual trigger...');
          break;

        default:
          resolve();
      }
    });
  }

  /**
   * Execute sell operation
   */
  private async executeSell(
    mint: PublicKey,
    percentage: number,
    wallets: 'all' | 'dev' | number[],
    walletCollection: WalletCollection
  ): Promise<void> {
    logger.info(`Executing sell: ${percentage}% from ${wallets}`);

    // Determine which wallets to sell from
    const walletsToSell: Keypair[] = [];

    if (wallets === 'all') {
      walletsToSell.push(...walletCollection.buyers.map((b) => b.keypair));
    } else if (wallets === 'dev') {
      walletsToSell.push(walletCollection.dev.keypair);
    } else {
      for (const index of wallets) {
        const buyer = walletCollection.buyers[index];
        if (buyer) {
          walletsToSell.push(buyer.keypair);
        }
      }
    }

    // Execute sells
    for (const wallet of walletsToSell) {
      try {
        const ata = await getAssociatedTokenAddress(mint, wallet.publicKey);
        const tokenAccount = await getAccount(this.connection, ata);

        const sellAmount = (tokenAccount.amount * BigInt(Math.floor(percentage * 100))) / 10000n;

        if (sellAmount > 0n) {
          const minSolOutput = Math.floor(Number(sellAmount) * 0.95); // 5% slippage

          const instruction = await this.pumpfun.sellTokenInstruction(wallet, {
            mint,
            tokenAmount: Number(sellAmount),
            minSolOutput,
          });

          // Send transaction (simplified - in production would use bundle for multiple wallets)
          const tx = await this.connection.sendTransaction(
            await this.buildVersionedTx(wallet, [instruction]),
            { skipPreflight: false }
          );

          await this.connection.confirmTransaction(tx, 'confirmed');

          logger.info(`Sold ${Number(sellAmount) / 1e6} tokens from ${wallet.publicKey.toBase58()}`);
        }
      } catch (error) {
        logger.error(`Failed to sell from ${wallet.publicKey.toBase58()}`, error);
      }
    }
  }

  /**
   * Helper: Build versioned transaction
   */
  private async buildVersionedTx(payer: Keypair, instructions: any[]): Promise<any> {
    const { TransactionMessage, VersionedTransaction } = await import('@solana/web3.js');
    const { blockhash } = await this.connection.getLatestBlockhash();

    const messageV0 = new TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message();

    const tx = new VersionedTransaction(messageV0);
    tx.sign([payer]);

    return tx;
  }

  /**
   * Get active strategy status
   */
  getStrategy(strategyId: string): StrategyStatus | undefined {
    return this.activeStrategies.get(strategyId);
  }

  /**
   * List all active strategies
   */
  listActiveStrategies(): StrategyStatus[] {
    return Array.from(this.activeStrategies.values()).filter((s) => s.active);
  }

  /**
   * Stop a strategy
   */
  stopStrategy(strategyId: string): boolean {
    const strategy = this.activeStrategies.get(strategyId);
    if (strategy) {
      strategy.active = false;
      strategy.completionTime = Date.now();
      logger.info(`Strategy stopped: ${strategyId}`);
      return true;
    }
    return false;
  }
}

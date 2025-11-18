import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { getAccount, getAssociatedTokenAddress } from '@solana/spl-token';
import { PumpfunService } from './pumpfun';
import { JitoService } from './jito';
import { WalletCollection } from '../types';
import logger from '../utils/logger';

/**
 * Trading pattern types
 */
export type TradingPattern = 'random' | 'waves' | 'pump' | 'organic';

/**
 * Wallet rotation strategy
 */
export type WalletRotation = 'sequential' | 'random';

/**
 * Volume trading configuration
 */
export interface VolumeConfig {
  // Pattern selection
  pattern: TradingPattern;

  // Timing parameters
  minDelaySeconds: number;
  maxDelaySeconds: number;

  // Trade size parameters
  minTradeAmountSOL: number;
  maxTradeAmountSOL: number;

  // Duration
  durationMinutes: number;

  // Wallet distribution
  walletRotation: WalletRotation;
  simultaneousTrades: number; // Max 5 for Jito bundles
}

/**
 * Individual trade action
 */
export interface TradeAction {
  type: 'buy' | 'sell';
  walletIndex: number;
  amountSOL: number;
  delayMs: number;
}

/**
 * Volume session status
 */
export interface VolumeSessionStatus {
  id: string;
  mint: PublicKey;
  pattern: TradingPattern;
  active: boolean;
  startTime: number;
  endTime?: number;
  tradesExecuted: number;
  totalVolume: number;
  errors: number;
}

/**
 * Volume Trading Service
 * Automated trading volume generation
 */
export class VolumeTradingService {
  private connection: Connection;
  private pumpfun: PumpfunService;
  private _jito: JitoService; // Reserved for future bundle execution
  private activeSessions: Map<string, VolumeSessionStatus> = new Map();
  private stopSignals: Map<string, boolean> = new Map();

  constructor(connection: Connection, pumpfun: PumpfunService, jito: JitoService) {
    this.connection = connection;
    this.pumpfun = pumpfun;
    this._jito = jito; // TODO: Use for bundle execution

    logger.info('Volume Trading service initialized');
    logger.debug(`Jito service available: ${!!this._jito}`);
  }

  /**
   * Start volume trading session
   */
  async startSession(
    mint: PublicKey,
    config: VolumeConfig,
    walletCollection: WalletCollection
  ): Promise<string> {
    const sessionId = `volume-${mint.toBase58()}-${Date.now()}`;

    logger.info(`Starting volume trading session: ${sessionId}`);
    logger.info(`Pattern: ${config.pattern}, Duration: ${config.durationMinutes} minutes`);

    const status: VolumeSessionStatus = {
      id: sessionId,
      mint,
      pattern: config.pattern,
      active: true,
      startTime: Date.now(),
      tradesExecuted: 0,
      totalVolume: 0,
      errors: 0,
    };

    this.activeSessions.set(sessionId, status);
    this.stopSignals.set(sessionId, false);

    // Generate trade pattern
    const tradePattern = this.generateTradePattern(config, walletCollection.buyers.length);

    // Execute trades in background
    this.executeTrades(sessionId, mint, tradePattern, walletCollection, config).catch((error) => {
      logger.error(`Volume trading session error: ${sessionId}`, error);
      status.active = false;
      status.endTime = Date.now();
    });

    return sessionId;
  }

  /**
   * Stop active session
   */
  stopSession(sessionId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (session && session.active) {
      this.stopSignals.set(sessionId, true);
      logger.info(`Stopping volume trading session: ${sessionId}`);
      return true;
    }
    return false;
  }

  /**
   * Get session status
   */
  getSession(sessionId: string): VolumeSessionStatus | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * List all active sessions
   */
  listActiveSessions(): VolumeSessionStatus[] {
    return Array.from(this.activeSessions.values()).filter((s) => s.active);
  }

  /**
   * Generate trade pattern based on configuration
   */
  private generateTradePattern(config: VolumeConfig, walletCount: number): TradeAction[] {
    const trades: TradeAction[] = [];
    const endTime = Date.now() + config.durationMinutes * 60 * 1000;
    let currentTime = Date.now();

    switch (config.pattern) {
      case 'random':
        trades.push(...this.generateRandomPattern(config, walletCount, currentTime, endTime));
        break;

      case 'waves':
        trades.push(...this.generateWavesPattern(config, walletCount, currentTime, endTime));
        break;

      case 'pump':
        trades.push(...this.generatePumpPattern(config, walletCount, currentTime, endTime));
        break;

      case 'organic':
        trades.push(...this.generateOrganicPattern(config, walletCount, currentTime, endTime));
        break;
    }

    logger.info(`Generated ${trades.length} trades for pattern: ${config.pattern}`);
    return trades;
  }

  /**
   * Random pattern: Random buy/sell at random intervals
   */
  private generateRandomPattern(
    config: VolumeConfig,
    walletCount: number,
    startTime: number,
    endTime: number
  ): TradeAction[] {
    const trades: TradeAction[] = [];
    let currentTime = startTime;

    while (currentTime < endTime) {
      const delay = this.randomDelay(config.minDelaySeconds, config.maxDelaySeconds);
      currentTime += delay;

      if (currentTime >= endTime) break;

      const walletIndex = this.selectWallet(walletCount, trades.length, config.walletRotation);
      const amount = this.randomAmount(config.minTradeAmountSOL, config.maxTradeAmountSOL);
      const type = Math.random() > 0.5 ? 'buy' : 'sell';

      trades.push({
        type,
        walletIndex,
        amountSOL: amount,
        delayMs: delay,
      });
    }

    return trades;
  }

  /**
   * Waves pattern: Cycles of accumulation (more buys) and distribution (more sells)
   */
  private generateWavesPattern(
    config: VolumeConfig,
    walletCount: number,
    startTime: number,
    endTime: number
  ): TradeAction[] {
    const trades: TradeAction[] = [];
    let currentTime = startTime;
    const waveDuration = (endTime - startTime) / 4; // 4 waves
    let wavePhase = 0; // 0 = accumulation, 1 = distribution

    while (currentTime < endTime) {
      const delay = this.randomDelay(config.minDelaySeconds, config.maxDelaySeconds);
      currentTime += delay;

      if (currentTime >= endTime) break;

      // Switch phase every wave
      const progress = (currentTime - startTime) % (waveDuration * 2);
      wavePhase = progress < waveDuration ? 0 : 1;

      const walletIndex = this.selectWallet(walletCount, trades.length, config.walletRotation);
      const amount = this.randomAmount(config.minTradeAmountSOL, config.maxTradeAmountSOL);

      // Accumulation: 70% buy, Distribution: 70% sell
      const buyProbability = wavePhase === 0 ? 0.7 : 0.3;
      const type = Math.random() < buyProbability ? 'buy' : 'sell';

      trades.push({
        type,
        walletIndex,
        amountSOL: amount,
        delayMs: delay,
      });
    }

    return trades;
  }

  /**
   * Pump pattern: Aggressive buying to increase price
   */
  private generatePumpPattern(
    config: VolumeConfig,
    walletCount: number,
    startTime: number,
    endTime: number
  ): TradeAction[] {
    const trades: TradeAction[] = [];
    let currentTime = startTime;

    while (currentTime < endTime) {
      const delay = this.randomDelay(config.minDelaySeconds, config.maxDelaySeconds);
      currentTime += delay;

      if (currentTime >= endTime) break;

      const walletIndex = this.selectWallet(walletCount, trades.length, config.walletRotation);
      const amount = this.randomAmount(config.minTradeAmountSOL, config.maxTradeAmountSOL);

      // 90% buys, 10% sells
      const type = Math.random() < 0.9 ? 'buy' : 'sell';

      trades.push({
        type,
        walletIndex,
        amountSOL: amount,
        delayMs: delay,
      });
    }

    return trades;
  }

  /**
   * Organic pattern: Most natural looking with varying sizes and intervals
   */
  private generateOrganicPattern(
    config: VolumeConfig,
    walletCount: number,
    startTime: number,
    endTime: number
  ): TradeAction[] {
    const trades: TradeAction[] = [];
    let currentTime = startTime;

    while (currentTime < endTime) {
      // More variation in delays for organic look
      const delayVariation = (config.maxDelaySeconds - config.minDelaySeconds) * 1.5;
      const delay = this.randomDelay(
        config.minDelaySeconds,
        config.minDelaySeconds + delayVariation
      );
      currentTime += delay;

      if (currentTime >= endTime) break;

      const walletIndex = this.selectWallet(walletCount, trades.length, 'random'); // Always random for organic

      // More variation in amounts - sometimes very small, sometimes larger
      const sizeMultiplier = Math.random() < 0.3 ? 0.5 : Math.random() < 0.1 ? 2.0 : 1.0;
      const baseAmount = this.randomAmount(config.minTradeAmountSOL, config.maxTradeAmountSOL);
      const amount = baseAmount * sizeMultiplier;

      // Slightly more buys than sells (55/45) for natural growth
      const type = Math.random() < 0.55 ? 'buy' : 'sell';

      trades.push({
        type,
        walletIndex,
        amountSOL: amount,
        delayMs: delay,
      });
    }

    return trades;
  }

  /**
   * Execute trades according to pattern
   */
  private async executeTrades(
    sessionId: string,
    mint: PublicKey,
    tradePattern: TradeAction[],
    walletCollection: WalletCollection,
    config: VolumeConfig
  ): Promise<void> {
    const status = this.activeSessions.get(sessionId);
    if (!status) return;

    logger.info(`Executing ${tradePattern.length} trades for session ${sessionId}`);

    for (let i = 0; i < tradePattern.length; i++) {
      // Check stop signal
      if (this.stopSignals.get(sessionId)) {
        logger.info(`Session ${sessionId} stopped by user`);
        break;
      }

      const trade = tradePattern[i];
      if (!trade) continue;

      // Wait for delay
      await new Promise((resolve) => setTimeout(resolve, trade.delayMs));

      // Collect trades for bundling (max simultaneousTrades)
      const bundleTrades: TradeAction[] = [trade];
      for (
        let j = 1;
        j < config.simultaneousTrades && i + j < tradePattern.length;
        j++
      ) {
        const nextTrade = tradePattern[i + j];
        if (nextTrade && nextTrade.delayMs === 0) {
          bundleTrades.push(nextTrade);
        }
      }

      // Execute bundle
      try {
        await this.executeTradeBatch(mint, bundleTrades, walletCollection);
        status.tradesExecuted += bundleTrades.length;
        status.totalVolume += bundleTrades.reduce((sum, t) => sum + t.amountSOL, 0);

        logger.info(
          `Session ${sessionId}: Executed ${bundleTrades.length} trades (${status.tradesExecuted}/${tradePattern.length})`
        );

        i += bundleTrades.length - 1; // Skip already executed trades
      } catch (error) {
        logger.error(`Failed to execute trade batch`, error);
        status.errors++;
      }
    }

    // Mark session as complete
    status.active = false;
    status.endTime = Date.now();
    logger.info(`Session ${sessionId} completed. Trades: ${status.tradesExecuted}, Volume: ${status.totalVolume} SOL`);
  }

  /**
   * Execute a batch of trades as a Jito bundle
   */
  private async executeTradeBatch(
    mint: PublicKey,
    trades: TradeAction[],
    walletCollection: WalletCollection
  ): Promise<void> {
    const instructions = [];

    for (const trade of trades) {
      const wallet = walletCollection.buyers[trade.walletIndex];
      if (!wallet) {
        logger.warn(`Wallet index ${trade.walletIndex} not found`);
        continue;
      }

      try {
        if (trade.type === 'buy') {
          // Buy instruction
          const buyInstruction = await this.pumpfun.buyTokenInstruction(wallet.keypair, {
            mint,
            solAmount: trade.amountSOL,
            maxSlippageBps: 500, // 5% slippage
          });
          instructions.push({
            wallet: wallet.keypair,
            instruction: buyInstruction,
          });
        } else {
          // Sell instruction
          const ata = await getAssociatedTokenAddress(mint, wallet.keypair.publicKey);
          const tokenAccount = await getAccount(this.connection, ata);

          // Sell 10-30% of holdings for organic look
          const sellPercentage = 0.1 + Math.random() * 0.2;
          const sellAmount = Number(tokenAccount.amount) * sellPercentage;

          if (sellAmount > 0) {
            const minSolOutput = Math.floor(sellAmount * 0.95); // 5% slippage

            const sellInstruction = await this.pumpfun.sellTokenInstruction(wallet.keypair, {
              mint,
              tokenAmount: Math.floor(sellAmount),
              minSolOutput,
            });
            instructions.push({
              wallet: wallet.keypair,
              instruction: sellInstruction,
            });
          }
        }
      } catch (error) {
        logger.error(`Failed to create instruction for wallet ${trade.walletIndex}`, error);
      }
    }

    if (instructions.length === 0) {
      logger.warn('No instructions to execute in batch');
      return;
    }

    // Submit as Jito bundle
    logger.info(`Submitting bundle with ${instructions.length} trades`);

    // For now, execute individually since bundle creation needs more setup
    // TODO: Implement proper bundle execution with Jito
    for (const { wallet, instruction } of instructions) {
      try {
        const tx = await this.buildVersionedTx(wallet, [instruction]);
        const signature = await this.connection.sendTransaction(tx, { skipPreflight: false });
        await this.connection.confirmTransaction(signature, 'confirmed');
        logger.info(`Trade executed: ${signature}`);
      } catch (error) {
        logger.error(`Failed to execute trade`, error);
        throw error;
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
   * Random delay in milliseconds
   */
  private randomDelay(minSeconds: number, maxSeconds: number): number {
    return (minSeconds + Math.random() * (maxSeconds - minSeconds)) * 1000;
  }

  /**
   * Random amount in SOL
   */
  private randomAmount(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  /**
   * Select wallet based on rotation strategy
   */
  private selectWallet(walletCount: number, tradeIndex: number, rotation: WalletRotation): number {
    if (rotation === 'sequential') {
      return tradeIndex % walletCount;
    } else {
      return Math.floor(Math.random() * walletCount);
    }
  }
}

import { Connection, PublicKey, AccountInfo } from '@solana/web3.js';
import { PUMPFUN_PROGRAM_ID } from './pumpfun';
import logger from '../utils/logger';

/**
 * Bonding Curve account structure
 * Based on Pumpfun program
 */
export interface BondingCurveData {
  virtualSolReserves: bigint;
  virtualTokenReserves: bigint;
  realSolReserves: bigint;
  realTokenReserves: bigint;
  tokenTotalSupply: bigint;
  complete: boolean;
  creator: PublicKey;
}

/**
 * Price data with calculated metrics
 */
export interface PriceData {
  priceInSOL: number;
  priceInUSD?: number;
  marketCapSOL: number;
  marketCapUSD?: number;
  virtualLiquidity: number;
  realLiquidity: number;
  timestamp: number;
}

/**
 * Price change event
 */
export interface PriceChangeEvent {
  mint: string;
  oldPrice: number;
  newPrice: number;
  priceChange: number;
  priceChangePercent: number;
  timestamp: number;
}

/**
 * Price Monitor Service
 * Monitors bonding curve prices in real-time
 */
export class PriceMonitorService {
  private connection: Connection;
  private subscriptions: Map<string, number> = new Map();
  private priceCallbacks: Map<string, Array<(event: PriceChangeEvent) => void>> = new Map();
  private lastPrices: Map<string, number> = new Map();
  private solPriceUSD?: number;

  constructor(connection: Connection) {
    this.connection = connection;
    logger.info('Price Monitor service initialized');
  }

  /**
   * Get bonding curve PDA for a mint
   */
  private getBondingCurvePDA(mint: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('bonding-curve'), mint.toBuffer()],
      PUMPFUN_PROGRAM_ID
    );
  }

  /**
   * Parse bonding curve account data
   */
  parseBondingCurve(data: Buffer): BondingCurveData {
    try {
      // Account structure (estimated based on common patterns):
      // 8 bytes: discriminator
      // 8 bytes: virtual_sol_reserves (u64)
      // 8 bytes: virtual_token_reserves (u64)
      // 8 bytes: real_sol_reserves (u64)
      // 8 bytes: real_token_reserves (u64)
      // 8 bytes: token_total_supply (u64)
      // 1 byte: complete (bool)
      // 32 bytes: creator (Pubkey)

      let offset = 8; // Skip discriminator

      const virtualSolReserves = data.readBigUInt64LE(offset);
      offset += 8;

      const virtualTokenReserves = data.readBigUInt64LE(offset);
      offset += 8;

      const realSolReserves = data.readBigUInt64LE(offset);
      offset += 8;

      const realTokenReserves = data.readBigUInt64LE(offset);
      offset += 8;

      const tokenTotalSupply = data.readBigUInt64LE(offset);
      offset += 8;

      const complete = data.readUInt8(offset) === 1;
      offset += 1;

      const creator = new PublicKey(data.slice(offset, offset + 32));

      return {
        virtualSolReserves,
        virtualTokenReserves,
        realSolReserves,
        realTokenReserves,
        tokenTotalSupply,
        complete,
        creator,
      };
    } catch (error) {
      logger.error('Failed to parse bonding curve data', error);
      throw new Error(
        `Failed to parse bonding curve: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Calculate price from bonding curve
   * Using constant product formula: x * y = k
   */
  calculatePrice(data: BondingCurveData): number {
    try {
      const solReserves = Number(data.virtualSolReserves);
      const tokenReserves = Number(data.virtualTokenReserves);

      if (tokenReserves === 0) {
        return 0;
      }

      // Price = SOL reserves / Token reserves
      const priceInSOL = solReserves / tokenReserves;

      return priceInSOL;
    } catch (error) {
      logger.error('Failed to calculate price', error);
      return 0;
    }
  }

  /**
   * Calculate market cap
   */
  calculateMarketCap(data: BondingCurveData, priceInSOL: number): number {
    try {
      const supply = Number(data.tokenTotalSupply) / 1e6; // Assuming 6 decimals
      return supply * priceInSOL;
    } catch (error) {
      logger.error('Failed to calculate market cap', error);
      return 0;
    }
  }

  /**
   * Get current price data for a mint
   */
  async getCurrentPrice(mint: PublicKey): Promise<PriceData> {
    try {
      const [bondingCurve] = this.getBondingCurvePDA(mint);

      const accountInfo = await this.connection.getAccountInfo(bondingCurve);

      if (!accountInfo) {
        throw new Error('Bonding curve not found - token may not exist');
      }

      const curveData = this.parseBondingCurve(accountInfo.data);
      const priceInSOL = this.calculatePrice(curveData);
      const marketCapSOL = this.calculateMarketCap(curveData, priceInSOL);

      const virtualLiquidity = Number(curveData.virtualSolReserves) / 1e9;
      const realLiquidity = Number(curveData.realSolReserves) / 1e9;

      const priceData: PriceData = {
        priceInSOL,
        marketCapSOL,
        virtualLiquidity,
        realLiquidity,
        timestamp: Date.now(),
      };

      // Add USD prices if SOL price is available
      if (this.solPriceUSD) {
        priceData.priceInUSD = priceInSOL * this.solPriceUSD;
        priceData.marketCapUSD = marketCapSOL * this.solPriceUSD;
      }

      return priceData;
    } catch (error) {
      logger.error(`Failed to get current price for ${mint.toBase58()}`, error);
      throw error;
    }
  }

  /**
   * Subscribe to price changes
   */
  subscribeToPrice(
    mint: PublicKey,
    callback: (event: PriceChangeEvent) => void
  ): () => void {
    try {
      const mintStr = mint.toBase58();
      const [bondingCurve] = this.getBondingCurvePDA(mint);

      logger.info(`Subscribing to price changes for ${mintStr}`);

      // Add callback to list
      if (!this.priceCallbacks.has(mintStr)) {
        this.priceCallbacks.set(mintStr, []);
      }
      this.priceCallbacks.get(mintStr)?.push(callback);

      // Create subscription if not exists
      if (!this.subscriptions.has(mintStr)) {
        const subscriptionId = this.connection.onAccountChange(
          bondingCurve,
          (accountInfo: AccountInfo<Buffer>) => {
            this.handlePriceChange(mintStr, accountInfo);
          },
          'confirmed'
        );

        this.subscriptions.set(mintStr, subscriptionId);
        logger.info(`Created WebSocket subscription for ${mintStr}`);
      }

      // Return unsubscribe function
      return () => {
        const callbacks = this.priceCallbacks.get(mintStr);
        if (callbacks) {
          const index = callbacks.indexOf(callback);
          if (index > -1) {
            callbacks.splice(index, 1);
          }

          // If no more callbacks, remove subscription
          if (callbacks.length === 0) {
            const subId = this.subscriptions.get(mintStr);
            if (subId !== undefined) {
              this.connection.removeAccountChangeListener(subId);
              this.subscriptions.delete(mintStr);
              this.priceCallbacks.delete(mintStr);
              logger.info(`Removed WebSocket subscription for ${mintStr}`);
            }
          }
        }
      };
    } catch (error) {
      logger.error(`Failed to subscribe to price for ${mint.toBase58()}`, error);
      throw error;
    }
  }

  /**
   * Handle price change event
   */
  private handlePriceChange(mintStr: string, accountInfo: AccountInfo<Buffer>): void {
    try {
      const curveData = this.parseBondingCurve(accountInfo.data);
      const newPrice = this.calculatePrice(curveData);

      const oldPrice = this.lastPrices.get(mintStr) || newPrice;
      const priceChange = newPrice - oldPrice;
      const priceChangePercent = oldPrice > 0 ? (priceChange / oldPrice) * 100 : 0;

      // Update last price
      this.lastPrices.set(mintStr, newPrice);

      // Create event
      const event: PriceChangeEvent = {
        mint: mintStr,
        oldPrice,
        newPrice,
        priceChange,
        priceChangePercent,
        timestamp: Date.now(),
      };

      // Notify all callbacks
      const callbacks = this.priceCallbacks.get(mintStr);
      if (callbacks) {
        callbacks.forEach((cb) => {
          try {
            cb(event);
          } catch (error) {
            logger.error('Error in price change callback', error);
          }
        });
      }

      logger.debug(
        `Price update for ${mintStr}: ${oldPrice.toFixed(9)} → ${newPrice.toFixed(9)} SOL (${priceChangePercent.toFixed(2)}%)`
      );
    } catch (error) {
      logger.error('Error handling price change', error);
    }
  }

  /**
   * Set SOL price in USD for USD calculations
   */
  setSolPriceUSD(priceUSD: number): void {
    this.solPriceUSD = priceUSD;
    logger.info(`SOL price updated: $${priceUSD.toFixed(2)}`);
  }

  /**
   * Get all active subscriptions
   */
  getActiveSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * Unsubscribe from all
   */
  unsubscribeAll(): void {
    for (const [mintStr, subId] of this.subscriptions.entries()) {
      this.connection.removeAccountChangeListener(subId);
      logger.info(`Removed subscription for ${mintStr}`);
    }

    this.subscriptions.clear();
    this.priceCallbacks.clear();
    this.lastPrices.clear();

    logger.info('All price subscriptions removed');
  }
}

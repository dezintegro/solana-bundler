import { Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import { Wallet, WalletCollection, WalletConfig } from '../types';
import logger from '../utils/logger';

/**
 * WalletManager handles creation and management of wallets
 */
export class WalletManager {
  /**
   * Generate a new random wallet
   */
  static generateWallet(type: 'main' | 'dev' | 'buyer', index?: number): Wallet {
    const keypair = Keypair.generate();
    logger.debug(`Generated new ${type} wallet: ${keypair.publicKey.toBase58()}`);

    return {
      publicKey: keypair.publicKey,
      keypair,
      type,
      index,
    };
  }

  /**
   * Import wallet from private key (base58 or Uint8Array)
   */
  static importWallet(
    privateKey: string | Uint8Array,
    type: 'main' | 'dev' | 'buyer',
    index?: number
  ): Wallet {
    try {
      const secretKey =
        typeof privateKey === 'string' ? bs58.decode(privateKey) : privateKey;

      if (secretKey.length !== 64) {
        throw new Error('Invalid private key length. Expected 64 bytes.');
      }

      const keypair = Keypair.fromSecretKey(secretKey);
      logger.debug(`Imported ${type} wallet: ${keypair.publicKey.toBase58()}`);

      return {
        publicKey: keypair.publicKey,
        keypair,
        type,
        index,
      };
    } catch (error) {
      logger.error('Failed to import wallet', error);
      throw new Error(
        `Failed to import wallet: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate a complete wallet collection for a launch
   */
  static generateWalletCollection(config: WalletConfig): WalletCollection {
    logger.info(`Generating wallet collection with ${config.buyerCount} buyer wallets`);

    // Generate main wallet
    const main = this.generateWallet('main');

    // Generate dev wallet
    const dev = this.generateWallet('dev');

    // Generate buyer wallets
    const buyers: Wallet[] = [];
    for (let i = 0; i < config.buyerCount; i++) {
      buyers.push(this.generateWallet('buyer', i));
    }

    logger.info(
      `Wallet collection generated: Main=${main.publicKey.toBase58()}, Dev=${dev.publicKey.toBase58()}, Buyers=${buyers.length}`
    );

    return {
      main,
      dev,
      buyers,
    };
  }

  /**
   * Export wallet private key as base58 string
   */
  static exportPrivateKey(wallet: Wallet): string {
    return bs58.encode(wallet.keypair.secretKey);
  }

  /**
   * Get wallet address as base58 string
   */
  static getAddress(wallet: Wallet): string {
    return wallet.publicKey.toBase58();
  }

  /**
   * Validate if a string is a valid Solana address
   */
  static isValidAddress(address: string): boolean {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Export wallet collection summary (for display purposes only, not including private keys)
   */
  static exportSummary(collection: WalletCollection): {
    main: string;
    dev: string;
    buyers: string[];
  } {
    return {
      main: collection.main.publicKey.toBase58(),
      dev: collection.dev.publicKey.toBase58(),
      buyers: collection.buyers.map((b) => b.publicKey.toBase58()),
    };
  }
}

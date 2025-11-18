import CryptoJS from 'crypto-js';
import {
  Wallet,
  WalletCollection,
  EncryptedWallet,
  EncryptedWalletCollection,
} from '../types';
import { WalletManager } from './wallet-manager';
import logger from '../utils/logger';
import fs from 'fs/promises';
import path from 'path';

const ENCRYPTION_ALGORITHM = 'AES-256';
const WALLET_FILE_VERSION = '1.0';

/**
 * Encryption utility for secure wallet storage
 */
export class EncryptionService {
  /**
   * Encrypt a single wallet
   */
  static encryptWallet(wallet: Wallet, password: string): EncryptedWallet {
    // Generate random salt
    const salt = CryptoJS.lib.WordArray.random(128 / 8).toString();

    // Derive key from password and salt
    const key = CryptoJS.PBKDF2(password, salt, {
      keySize: 256 / 32,
      iterations: 10000,
    });

    // Get private key as base58
    const privateKeyBase58 = WalletManager.exportPrivateKey(wallet);

    // Encrypt private key
    const encrypted = CryptoJS.AES.encrypt(privateKeyBase58, key.toString()).toString();

    logger.debug(`Encrypted ${wallet.type} wallet: ${wallet.publicKey.toBase58()}`);

    return {
      encryptedPrivateKey: encrypted,
      publicKey: wallet.publicKey.toBase58(),
      type: wallet.type,
      index: wallet.index,
      algorithm: ENCRYPTION_ALGORITHM,
      salt,
    };
  }

  /**
   * Decrypt a single wallet
   */
  static decryptWallet(encryptedWallet: EncryptedWallet, password: string): Wallet {
    try {
      // Derive key from password and salt
      const key = CryptoJS.PBKDF2(password, encryptedWallet.salt, {
        keySize: 256 / 32,
        iterations: 10000,
      });

      // Decrypt private key
      const decrypted = CryptoJS.AES.decrypt(
        encryptedWallet.encryptedPrivateKey,
        key.toString()
      );
      const privateKeyBase58 = decrypted.toString(CryptoJS.enc.Utf8);

      if (!privateKeyBase58) {
        throw new Error('Decryption failed - incorrect password or corrupted data');
      }

      // Import wallet from decrypted private key
      const wallet = WalletManager.importWallet(
        privateKeyBase58,
        encryptedWallet.type,
        encryptedWallet.index
      );

      // Verify public key matches
      if (wallet.publicKey.toBase58() !== encryptedWallet.publicKey) {
        throw new Error('Public key mismatch after decryption');
      }

      logger.debug(`Decrypted ${wallet.type} wallet: ${wallet.publicKey.toBase58()}`);

      return wallet;
    } catch (error) {
      logger.error('Failed to decrypt wallet', error);
      throw new Error(
        `Failed to decrypt wallet: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Encrypt wallet collection
   */
  static encryptCollection(
    collection: WalletCollection,
    password: string
  ): EncryptedWalletCollection {
    logger.info('Encrypting wallet collection');

    return {
      main: this.encryptWallet(collection.main, password),
      dev: this.encryptWallet(collection.dev, password),
      buyers: collection.buyers.map((buyer) => this.encryptWallet(buyer, password)),
      createdAt: new Date().toISOString(),
      version: WALLET_FILE_VERSION,
    };
  }

  /**
   * Decrypt wallet collection
   */
  static decryptCollection(
    encryptedCollection: EncryptedWalletCollection,
    password: string
  ): WalletCollection {
    logger.info('Decrypting wallet collection');

    try {
      return {
        main: this.decryptWallet(encryptedCollection.main, password),
        dev: this.decryptWallet(encryptedCollection.dev, password),
        buyers: encryptedCollection.buyers.map((buyer) => this.decryptWallet(buyer, password)),
      };
    } catch (error) {
      logger.error('Failed to decrypt wallet collection', error);
      throw new Error(
        `Failed to decrypt wallet collection: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Save encrypted wallet collection to file
   */
  static async saveToFile(
    collection: WalletCollection,
    password: string,
    filePath: string
  ): Promise<void> {
    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      // Encrypt collection
      const encrypted = this.encryptCollection(collection, password);

      // Save to file
      await fs.writeFile(filePath, JSON.stringify(encrypted, null, 2), 'utf-8');

      logger.info(`Wallet collection saved to ${filePath}`);
    } catch (error) {
      logger.error('Failed to save wallet collection', error);
      throw new Error(
        `Failed to save wallet collection: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Load encrypted wallet collection from file
   */
  static async loadFromFile(filePath: string, password: string): Promise<WalletCollection> {
    try {
      // Read file
      const fileContent = await fs.readFile(filePath, 'utf-8');

      // Parse JSON
      const encrypted = JSON.parse(fileContent) as EncryptedWalletCollection;

      // Validate version
      if (encrypted.version !== WALLET_FILE_VERSION) {
        logger.warn(
          `Wallet file version mismatch. Expected ${WALLET_FILE_VERSION}, got ${encrypted.version}`
        );
      }

      // Decrypt collection
      const collection = this.decryptCollection(encrypted, password);

      logger.info(`Wallet collection loaded from ${filePath}`);

      return collection;
    } catch (error) {
      logger.error('Failed to load wallet collection', error);
      throw new Error(
        `Failed to load wallet collection: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Check if wallet file exists
   */
  static async walletFileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

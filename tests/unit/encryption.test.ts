import { EncryptionService } from '../../src/core/encryption';
import { WalletManager } from '../../src/core/wallet-manager';
import { WalletConfig } from '../../src/types';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('EncryptionService', () => {
  const testPassword = 'test-password-12345';
  const wrongPassword = 'wrong-password';

  describe('encryptWallet and decryptWallet', () => {
    it('should encrypt and decrypt wallet successfully', () => {
      const wallet = WalletManager.generateWallet('main');

      const encrypted = EncryptionService.encryptWallet(wallet, testPassword);
      expect(encrypted.publicKey).toBe(wallet.publicKey.toBase58());
      expect(encrypted.type).toBe('main');
      expect(encrypted.encryptedPrivateKey).toBeDefined();
      expect(encrypted.salt).toBeDefined();

      const decrypted = EncryptionService.decryptWallet(encrypted, testPassword);
      expect(decrypted.publicKey.toBase58()).toBe(wallet.publicKey.toBase58());
      expect(decrypted.type).toBe(wallet.type);
    });

    it('should fail to decrypt with wrong password', () => {
      const wallet = WalletManager.generateWallet('dev');
      const encrypted = EncryptionService.encryptWallet(wallet, testPassword);

      expect(() => {
        EncryptionService.decryptWallet(encrypted, wrongPassword);
      }).toThrow();
    });

    it('should preserve wallet index during encryption/decryption', () => {
      const wallet = WalletManager.generateWallet('buyer', 5);

      const encrypted = EncryptionService.encryptWallet(wallet, testPassword);
      expect(encrypted.index).toBe(5);

      const decrypted = EncryptionService.decryptWallet(encrypted, testPassword);
      expect(decrypted.index).toBe(5);
    });

    it('should use different salts for each encryption', () => {
      const wallet = WalletManager.generateWallet('main');

      const encrypted1 = EncryptionService.encryptWallet(wallet, testPassword);
      const encrypted2 = EncryptionService.encryptWallet(wallet, testPassword);

      expect(encrypted1.salt).not.toBe(encrypted2.salt);
      expect(encrypted1.encryptedPrivateKey).not.toBe(encrypted2.encryptedPrivateKey);
    });
  });

  describe('encryptCollection and decryptCollection', () => {
    it('should encrypt and decrypt wallet collection', () => {
      const config: WalletConfig = {
        buyerCount: 3,
        devWalletAmount: 0.1,
        buyerWalletAmount: 0.05,
        password: testPassword,
      };

      const collection = WalletManager.generateWalletCollection(config);
      const encrypted = EncryptionService.encryptCollection(collection, testPassword);

      expect(encrypted.main).toBeDefined();
      expect(encrypted.dev).toBeDefined();
      expect(encrypted.buyers).toHaveLength(3);
      expect(encrypted.createdAt).toBeDefined();
      expect(encrypted.version).toBeDefined();

      const decrypted = EncryptionService.decryptCollection(encrypted, testPassword);

      expect(decrypted.main.publicKey.toBase58()).toBe(collection.main.publicKey.toBase58());
      expect(decrypted.dev.publicKey.toBase58()).toBe(collection.dev.publicKey.toBase58());
      expect(decrypted.buyers).toHaveLength(3);

      decrypted.buyers.forEach((buyer, i) => {
        expect(buyer.publicKey.toBase58()).toBe(collection.buyers[i].publicKey.toBase58());
        expect(buyer.index).toBe(i);
      });
    });

    it('should fail to decrypt collection with wrong password', () => {
      const config: WalletConfig = {
        buyerCount: 2,
        devWalletAmount: 0.1,
        buyerWalletAmount: 0.05,
        password: testPassword,
      };

      const collection = WalletManager.generateWalletCollection(config);
      const encrypted = EncryptionService.encryptCollection(collection, testPassword);

      expect(() => {
        EncryptionService.decryptCollection(encrypted, wrongPassword);
      }).toThrow();
    });
  });

  describe('saveToFile and loadFromFile', () => {
    let tempDir: string;
    let testFilePath: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wallet-test-'));
      testFilePath = path.join(tempDir, 'test-wallets.json');
    });

    afterEach(async () => {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    it('should save and load wallet collection from file', async () => {
      const config: WalletConfig = {
        buyerCount: 2,
        devWalletAmount: 0.1,
        buyerWalletAmount: 0.05,
        password: testPassword,
      };

      const collection = WalletManager.generateWalletCollection(config);

      // Save to file
      await EncryptionService.saveToFile(collection, testPassword, testFilePath);

      // Verify file exists
      const exists = await EncryptionService.walletFileExists(testFilePath);
      expect(exists).toBe(true);

      // Load from file
      const loaded = await EncryptionService.loadFromFile(testFilePath, testPassword);

      expect(loaded.main.publicKey.toBase58()).toBe(collection.main.publicKey.toBase58());
      expect(loaded.dev.publicKey.toBase58()).toBe(collection.dev.publicKey.toBase58());
      expect(loaded.buyers).toHaveLength(2);
    });

    it('should create directory if it does not exist', async () => {
      const nestedPath = path.join(tempDir, 'nested', 'dir', 'wallets.json');
      const config: WalletConfig = {
        buyerCount: 1,
        devWalletAmount: 0.1,
        buyerWalletAmount: 0.05,
        password: testPassword,
      };

      const collection = WalletManager.generateWalletCollection(config);

      await EncryptionService.saveToFile(collection, testPassword, nestedPath);

      const exists = await EncryptionService.walletFileExists(nestedPath);
      expect(exists).toBe(true);
    });

    it('should fail to load with wrong password', async () => {
      const config: WalletConfig = {
        buyerCount: 1,
        devWalletAmount: 0.1,
        buyerWalletAmount: 0.05,
        password: testPassword,
      };

      const collection = WalletManager.generateWalletCollection(config);
      await EncryptionService.saveToFile(collection, testPassword, testFilePath);

      await expect(
        EncryptionService.loadFromFile(testFilePath, wrongPassword)
      ).rejects.toThrow();
    });

    it('should fail to load non-existent file', async () => {
      const nonExistentPath = path.join(tempDir, 'does-not-exist.json');

      await expect(
        EncryptionService.loadFromFile(nonExistentPath, testPassword)
      ).rejects.toThrow();
    });
  });

  describe('walletFileExists', () => {
    it('should return false for non-existent file', async () => {
      const exists = await EncryptionService.walletFileExists('/tmp/does-not-exist.json');
      expect(exists).toBe(false);
    });
  });
});

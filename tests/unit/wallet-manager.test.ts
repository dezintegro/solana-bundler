import { WalletManager } from '../../src/core/wallet-manager';
import { WalletConfig } from '../../src/types';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

describe('WalletManager', () => {
  describe('generateWallet', () => {
    it('should generate a valid main wallet', () => {
      const wallet = WalletManager.generateWallet('main');

      expect(wallet.type).toBe('main');
      expect(wallet.publicKey).toBeDefined();
      expect(wallet.keypair).toBeDefined();
      expect(wallet.index).toBeUndefined();
    });

    it('should generate a valid buyer wallet with index', () => {
      const wallet = WalletManager.generateWallet('buyer', 5);

      expect(wallet.type).toBe('buyer');
      expect(wallet.index).toBe(5);
      expect(wallet.publicKey).toBeDefined();
      expect(wallet.keypair).toBeDefined();
    });

    it('should generate unique wallets', () => {
      const wallet1 = WalletManager.generateWallet('buyer', 0);
      const wallet2 = WalletManager.generateWallet('buyer', 1);

      expect(wallet1.publicKey.toBase58()).not.toBe(wallet2.publicKey.toBase58());
    });
  });

  describe('importWallet', () => {
    it('should import wallet from base58 private key', () => {
      // Generate a test keypair
      const testKeypair = Keypair.generate();
      const privateKeyBase58 = bs58.encode(testKeypair.secretKey);

      // Import wallet
      const wallet = WalletManager.importWallet(privateKeyBase58, 'dev');

      expect(wallet.type).toBe('dev');
      expect(wallet.publicKey.toBase58()).toBe(testKeypair.publicKey.toBase58());
    });

    it('should import wallet from Uint8Array', () => {
      const testKeypair = Keypair.generate();

      const wallet = WalletManager.importWallet(testKeypair.secretKey, 'main');

      expect(wallet.type).toBe('main');
      expect(wallet.publicKey.toBase58()).toBe(testKeypair.publicKey.toBase58());
    });

    it('should throw error for invalid private key', () => {
      expect(() => {
        WalletManager.importWallet('invalid-key', 'dev');
      }).toThrow();
    });

    it('should throw error for wrong length private key', () => {
      const invalidKey = new Uint8Array(32); // Should be 64 bytes

      expect(() => {
        WalletManager.importWallet(invalidKey, 'dev');
      }).toThrow('Invalid private key length');
    });
  });

  describe('generateWalletCollection', () => {
    it('should generate complete wallet collection', () => {
      const config: WalletConfig = {
        buyerCount: 5,
        devWalletAmount: 0.1,
        buyerWalletAmount: 0.05,
        password: 'test-password',
      };

      const collection = WalletManager.generateWalletCollection(config);

      expect(collection.main).toBeDefined();
      expect(collection.main.type).toBe('main');

      expect(collection.dev).toBeDefined();
      expect(collection.dev.type).toBe('dev');

      expect(collection.buyers).toHaveLength(5);
      collection.buyers.forEach((buyer, index) => {
        expect(buyer.type).toBe('buyer');
        expect(buyer.index).toBe(index);
      });
    });

    it('should generate collection with correct number of buyers', () => {
      const config: WalletConfig = {
        buyerCount: 20,
        devWalletAmount: 0.1,
        buyerWalletAmount: 0.05,
        password: 'test-password',
      };

      const collection = WalletManager.generateWalletCollection(config);

      expect(collection.buyers).toHaveLength(20);
    });

    it('should generate unique wallets in collection', () => {
      const config: WalletConfig = {
        buyerCount: 3,
        devWalletAmount: 0.1,
        buyerWalletAmount: 0.05,
        password: 'test-password',
      };

      const collection = WalletManager.generateWalletCollection(config);

      const addresses = [
        collection.main.publicKey.toBase58(),
        collection.dev.publicKey.toBase58(),
        ...collection.buyers.map((b) => b.publicKey.toBase58()),
      ];

      const uniqueAddresses = new Set(addresses);
      expect(uniqueAddresses.size).toBe(addresses.length);
    });
  });

  describe('exportPrivateKey', () => {
    it('should export private key as base58 string', () => {
      const wallet = WalletManager.generateWallet('main');
      const privateKey = WalletManager.exportPrivateKey(wallet);

      expect(typeof privateKey).toBe('string');
      expect(privateKey.length).toBeGreaterThan(0);

      // Verify it can be re-imported
      const reimported = WalletManager.importWallet(privateKey, 'main');
      expect(reimported.publicKey.toBase58()).toBe(wallet.publicKey.toBase58());
    });
  });

  describe('getAddress', () => {
    it('should return wallet address as base58 string', () => {
      const wallet = WalletManager.generateWallet('dev');
      const address = WalletManager.getAddress(wallet);

      expect(typeof address).toBe('string');
      expect(address).toBe(wallet.publicKey.toBase58());
    });
  });

  describe('isValidAddress', () => {
    it('should return true for valid Solana address', () => {
      const wallet = WalletManager.generateWallet('main');
      const address = wallet.publicKey.toBase58();

      expect(WalletManager.isValidAddress(address)).toBe(true);
    });

    it('should return false for invalid address', () => {
      expect(WalletManager.isValidAddress('invalid-address')).toBe(false);
      expect(WalletManager.isValidAddress('')).toBe(false);
      expect(WalletManager.isValidAddress('123')).toBe(false);
    });
  });

  describe('exportSummary', () => {
    it('should export collection summary without private keys', () => {
      const config: WalletConfig = {
        buyerCount: 3,
        devWalletAmount: 0.1,
        buyerWalletAmount: 0.05,
        password: 'test-password',
      };

      const collection = WalletManager.generateWalletCollection(config);
      const summary = WalletManager.exportSummary(collection);

      expect(summary.main).toBe(collection.main.publicKey.toBase58());
      expect(summary.dev).toBe(collection.dev.publicKey.toBase58());
      expect(summary.buyers).toHaveLength(3);
      expect(summary.buyers[0]).toBe(collection.buyers[0].publicKey.toBase58());
    });
  });
});

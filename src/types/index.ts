import { Keypair, PublicKey } from '@solana/web3.js';

/**
 * Configuration for wallet generation
 */
export interface WalletConfig {
  /** Number of buyer wallets to generate */
  buyerCount: number;
  /** Amount of SOL to allocate to dev wallet (in SOL) */
  devWalletAmount: number;
  /** Amount of SOL to allocate to each buyer wallet (in SOL) */
  buyerWalletAmount: number;
  /** Encryption password for wallet storage */
  password: string;
}

/**
 * Represents a wallet with its keypair and metadata
 */
export interface Wallet {
  /** Wallet public key */
  publicKey: PublicKey;
  /** Wallet keypair */
  keypair: Keypair;
  /** Wallet type */
  type: 'main' | 'dev' | 'buyer';
  /** Optional wallet index (for buyer wallets) */
  index?: number;
}

/**
 * Encrypted wallet data for storage
 */
export interface EncryptedWallet {
  /** Encrypted private key */
  encryptedPrivateKey: string;
  /** Public key (base58) */
  publicKey: string;
  /** Wallet type */
  type: 'main' | 'dev' | 'buyer';
  /** Optional wallet index */
  index?: number;
  /** Encryption algorithm used */
  algorithm: string;
  /** Salt used for encryption */
  salt: string;
}

/**
 * Wallet collection for a launch
 */
export interface WalletCollection {
  /** Main funding wallet */
  main: Wallet;
  /** Developer wallet (creates token) */
  dev: Wallet;
  /** Array of buyer wallets */
  buyers: Wallet[];
}

/**
 * Encrypted wallet collection for storage
 */
export interface EncryptedWalletCollection {
  main: EncryptedWallet;
  dev: EncryptedWallet;
  buyers: EncryptedWallet[];
  createdAt: string;
  version: string;
}

/**
 * Fund distribution plan
 */
export interface FundDistributionPlan {
  /** Total SOL needed */
  totalRequired: number;
  /** SOL for dev wallet */
  devAmount: number;
  /** SOL for each buyer wallet */
  buyerAmount: number;
  /** Number of buyer wallets */
  buyerCount: number;
  /** Estimated transaction fees */
  estimatedFees: number;
}

/**
 * Token launch configuration
 */
export interface LaunchConfig {
  /** Token name */
  tokenName: string;
  /** Token symbol */
  tokenSymbol: string;
  /** Token description */
  tokenDescription: string;
  /** Token image URL */
  tokenImageUrl?: string;
  /** Initial buy amount per wallet (in SOL) */
  buyAmountPerWallet: number;
  /** Jito tip amount (in SOL) */
  jitoTip: number;
  /** Number of buyer wallets */
  buyerWalletCount: number;
  /** Slippage tolerance (in basis points, e.g., 100 = 1%) */
  slippageBps: number;
}

/**
 * Bundle transaction result
 */
export interface BundleResult {
  /** Bundle signature */
  signature: string;
  /** Whether bundle was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Timestamp */
  timestamp: number;
}

/**
 * Logger levels
 */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'verbose';

/**
 * Logger configuration
 */
export interface LoggerConfig {
  level: LogLevel;
  logToFile?: boolean;
  logFilePath?: string;
}

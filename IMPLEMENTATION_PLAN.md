# Implementation Plan
## Solana Token Launch Bundler - Детальный План Реализации

**Версия:** 1.0
**Дата:** 2025-11-18

---

## 📊 Оценка Архитектурных Вариантов - Финальная Рекомендация

### Сравнительная Таблица

| Критерий | CLI Script | Web App | Browser Extension |
|----------|-----------|---------|-------------------|
| **Время разработки MVP** | ⭐⭐⭐⭐⭐ 2-3 недели | ⭐⭐ 2-3 месяца | ⭐⭐⭐ 1.5-2 месяца |
| **Безопасность** | ⭐⭐⭐⭐⭐ Максимальная | ⭐⭐ Риски хранения ключей | ⭐⭐⭐⭐ Локальное хранение |
| **Удобство использования** | ⭐⭐⭐ Требует tech skills | ⭐⭐⭐⭐⭐ Простой UI | ⭐⭐⭐⭐ Удобно для web3 |
| **Масштабируемость** | ⭐⭐ Ограничена | ⭐⭐⭐⭐⭐ Неограничена | ⭐⭐⭐ Средняя |
| **Монетизация** | ⭐⭐ Сложная | ⭐⭐⭐⭐⭐ Простая (SaaS) | ⭐⭐⭐⭐ Возможна |
| **Стоимость поддержки** | ⭐⭐⭐⭐⭐ Минимальная | ⭐⭐ Высокая (серверы) | ⭐⭐⭐⭐ Низкая |
| **Юридические риски** | ⭐⭐⭐⭐⭐ Минимальные | ⭐⭐ Высокие (custody) | ⭐⭐⭐⭐ Средние |
| **Скорость итераций** | ⭐⭐⭐⭐⭐ Быстрая | ⭐⭐⭐ Средняя | ⭐⭐⭐ Средняя |

### 🎯 Финальная Рекомендация: PHASED APPROACH

**Фаза 1 (Сейчас - 3 недели): CLI Application**
- ✅ Быстрая разработка и тестирование core logic
- ✅ Минимальные риски безопасности
- ✅ Полный контроль над процессом
- ✅ Использование для собственных запусков
- ✅ Получение feedback и улучшение алгоритмов

**Фаза 2 (1-2 месяца): CLI + Local Web UI**
- ✅ Добавить простой веб-интерфейс (Electron или Next.js local)
- ✅ Приложение работает локально, ключи остаются на машине
- ✅ Удобнее для нетехнических пользователей
- ✅ Можно распространять как standalone app

**Фаза 3 (3-6 месяцев): Public SaaS Platform**
- ✅ Облачная версия с proper security
- ✅ Монетизация через подписки и комиссии
- ✅ API для партнеров
- ✅ Продвинутая аналитика и features

### Почему именно так?

1. **Risk Mitigation**: Начинаем с простого, безопасного решения
2. **Fast Learning**: Быстро понимаем, что работает, а что нет
3. **Cost Efficiency**: Минимальные затраты на start
4. **Security First**: Не рискуем чужими ключами до полной уверенности
5. **Market Validation**: Проверяем спрос перед большими инвестициями

---

## 🗺️ PHASE 1: CLI Application - Детальный План (3 недели)

### Week 1: Foundation & Wallet Management

#### Day 1-2: Project Setup
```bash
# Задачи:
□ Инициализация git репозитория
□ Настройка TypeScript (strict mode)
□ Конфигурация ESLint + Prettier
□ Setup testing framework (Jest)
□ Создание базовой структуры проекта
□ Настройка package.json scripts
□ Конфигурация .env.example
□ Setup logger (Winston)
```

**Конкретные файлы для создания:**
- `package.json` - Dependencies setup
- `tsconfig.json` - TypeScript configuration
- `.eslintrc.js` - Linting rules
- `.prettierrc` - Code formatting
- `jest.config.js` - Test configuration
- `src/utils/logger.ts` - Logger setup
- `src/types/index.ts` - Shared types

**Dependencies:**
```json
{
  "dependencies": {
    "@solana/web3.js": "^1.87.6",
    "@solana/spl-token": "^0.3.9",
    "@coral-xyz/anchor": "^0.29.0",
    "bs58": "^5.0.0",
    "commander": "^11.1.0",
    "dotenv": "^16.3.1",
    "inquirer": "^9.2.12",
    "chalk": "^5.3.0",
    "ora": "^7.0.1",
    "winston": "^3.11.0",
    "tweetnacl": "^1.0.3",
    "crypto-js": "^4.2.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@typescript-eslint/eslint-plugin": "^6.13.0",
    "@typescript-eslint/parser": "^6.13.0",
    "eslint": "^8.54.0",
    "jest": "^29.7.0",
    "prettier": "^3.1.0",
    "ts-jest": "^29.1.1",
    "ts-node": "^10.9.1",
    "typescript": "^5.3.2"
  }
}
```

**Критерии завершения:**
- ✅ `npm install` работает без ошибок
- ✅ `npm run build` компилирует TypeScript
- ✅ `npm run lint` проходит без ошибок
- ✅ Можно запустить пустой CLI скрипт: `npm run start -- --help`

---

#### Day 3-4: Wallet Core Logic

**Файлы для создания:**

**`src/core/wallet/types.ts`**
```typescript
import { Keypair } from '@solana/web3.js';

export interface WalletData {
  publicKey: string;
  secretKey: Uint8Array;
  mnemonic?: string;
}

export interface EncryptedWallet {
  publicKey: string;
  encryptedSecretKey: string;
  salt: string;
  iv: string;
}

export interface WalletConfig {
  mainWallet: Keypair;
  devWallet: Keypair;
  buyerWallets: Keypair[];
}

export interface WalletStorageFormat {
  version: string;
  createdAt: number;
  wallets: {
    main?: EncryptedWallet;
    dev?: EncryptedWallet;
    buyers?: EncryptedWallet[];
  };
}
```

**`src/core/wallet/encryption.ts`**
```typescript
import CryptoJS from 'crypto-js';
import { Keypair } from '@solana/web3.js';

export class WalletEncryption {
  private static ENCRYPTION_ALGORITHM = 'AES';
  private static KEY_SIZE = 256;
  private static ITERATIONS = 10000;

  static encrypt(secretKey: Uint8Array, password: string): EncryptedWallet {
    // TODO: Implement AES-256 encryption
    // - Generate random salt
    // - Derive key using PBKDF2
    // - Encrypt secretKey
    // - Return encrypted data with salt and IV
  }

  static decrypt(encrypted: EncryptedWallet, password: string): Uint8Array {
    // TODO: Implement decryption
    // - Derive key using stored salt
    // - Decrypt data
    // - Validate and return secretKey
  }

  static generateSalt(): string {
    // TODO: Generate cryptographically secure random salt
  }
}
```

**`src/core/wallet/manager.ts`**
```typescript
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { WalletEncryption } from './encryption';
import { logger } from '../../utils/logger';

export class WalletManager {
  private connection: Connection;

  constructor(rpcUrl: string) {
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

  // Generate new wallet
  async createWallet(): Promise<Keypair> {
    // TODO: Generate new Keypair
    // - Log public key
    // - Return Keypair
  }

  // Create multiple wallets
  async createWallets(count: number): Promise<Keypair[]> {
    // TODO: Generate N wallets
    // - Use Promise.all for parallel generation
    // - Log progress
  }

  // Import from private key
  importFromPrivateKey(privateKey: string | Uint8Array): Keypair {
    // TODO: Import wallet
    // - Handle both bs58 string and Uint8Array
    // - Validate key format
  }

  // Get balance
  async getBalance(publicKey: PublicKey): Promise<number> {
    // TODO: Fetch SOL balance
    // - Return in SOL (not lamports)
  }

  // Get multiple balances
  async getBalances(publicKeys: PublicKey[]): Promise<Map<string, number>> {
    // TODO: Fetch balances for multiple wallets
    // - Use Promise.all
    // - Return Map<address, balance>
  }

  // Save wallets to encrypted file
  async saveWallets(
    wallets: WalletConfig,
    password: string,
    filePath: string
  ): Promise<void> {
    // TODO: Save encrypted wallets
    // - Encrypt each wallet
    // - Create JSON structure
    // - Write to file securely
  }

  // Load wallets from file
  async loadWallets(filePath: string, password: string): Promise<WalletConfig> {
    // TODO: Load and decrypt wallets
    // - Read file
    // - Decrypt each wallet
    // - Return WalletConfig
  }
}
```

**`src/core/wallet/funding.ts`**
```typescript
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';

export class WalletFunding {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  // Fund single wallet
  async fundWallet(
    from: Keypair,
    to: PublicKey,
    amountSol: number
  ): Promise<string> {
    // TODO: Transfer SOL
    // - Create transfer instruction
    // - Send and confirm transaction
    // - Return signature
  }

  // Fund multiple wallets in parallel
  async fundWallets(
    from: Keypair,
    destinations: { publicKey: PublicKey; amount: number }[]
  ): Promise<string[]> {
    // TODO: Batch funding
    // - Create multiple transactions
    // - Send in parallel
    // - Handle errors gracefully
    // - Return array of signatures
  }

  // Estimate funding cost
  async estimateFundingCost(
    destinations: number,
    amountPerWallet: number
  ): Promise<number> {
    // TODO: Calculate total cost
    // - Sum all amounts
    // - Add transaction fees
    // - Return total in SOL
  }
}
```

**Tests:**
```typescript
// tests/unit/wallet/manager.test.ts
describe('WalletManager', () => {
  test('should create new wallet', async () => {
    // TODO
  });

  test('should create multiple wallets', async () => {
    // TODO
  });

  test('should import wallet from private key', () => {
    // TODO
  });
});

// tests/unit/wallet/encryption.test.ts
describe('WalletEncryption', () => {
  test('should encrypt and decrypt wallet', () => {
    // TODO
  });

  test('should fail with wrong password', () => {
    // TODO
  });
});
```

**Критерии завершения:**
- ✅ Можно создать новый wallet
- ✅ Можно импортировать wallet из приватного ключа
- ✅ Можно сохранить и загрузить encrypted wallets
- ✅ Все unit тесты проходят
- ✅ Можно получить balance любого кошелька

---

#### Day 5: CLI Commands - Wallet Management

**`src/cli/commands/wallet.ts`**
```typescript
import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { WalletManager } from '../../core/wallet/manager';
import { WalletFunding } from '../../core/wallet/funding';

export function registerWalletCommands(program: Command) {
  const wallet = program.command('wallet').description('Wallet management commands');

  // wallet create-main
  wallet
    .command('create-main')
    .description('Create main wallet for the project')
    .option('-s, --save <path>', 'Save to file', './wallets/main.json')
    .action(async (options) => {
      // TODO: Implement
      // - Prompt for password
      // - Create wallet
      // - Save encrypted
      // - Display public key and instructions
    });

  // wallet create-dev
  wallet
    .command('create-dev')
    .description('Create or import dev wallet')
    .option('-i, --import <key>', 'Import from private key')
    .option('-s, --save <path>', 'Save to file', './wallets/dev.json')
    .action(async (options) => {
      // TODO: Implement
    });

  // wallet create-buyers
  wallet
    .command('create-buyers')
    .description('Create buyer wallets')
    .requiredOption('-c, --count <number>', 'Number of wallets')
    .option('-s, --save <path>', 'Save to file', './wallets/buyers.json')
    .action(async (options) => {
      // TODO: Implement
      // - Show progress bar for creation
      // - Save all wallets
      // - Display summary
    });

  // wallet list
  wallet
    .command('list')
    .description('List all wallets with balances')
    .option('-f, --file <path>', 'Wallet file path')
    .action(async (options) => {
      // TODO: Implement
      // - Load wallets
      // - Fetch balances
      // - Display in table format
    });

  // wallet fund
  wallet
    .command('fund')
    .description('Fund wallets from main wallet')
    .requiredOption('--from <path>', 'Main wallet file')
    .requiredOption('--to <path>', 'Target wallet(s) file')
    .requiredOption('--amount <sol>', 'Amount in SOL')
    .action(async (options) => {
      // TODO: Implement
      // - Load source and target wallets
      // - Confirm transaction details
      // - Execute funding
      // - Display results
    });

  // wallet export
  wallet
    .command('export')
    .description('Export wallet to different format')
    .requiredOption('-f, --file <path>', 'Wallet file')
    .option('--format <type>', 'Export format (json|csv|txt)', 'json')
    .action(async (options) => {
      // TODO: Implement
    });
}
```

**`src/cli/index.ts`**
```typescript
#!/usr/bin/env node

import { Command } from 'commander';
import { registerWalletCommands } from './commands/wallet';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';

dotenv.config();

const program = new Command();

program
  .name('solana-launcher')
  .description('Solana Token Launch Bundler CLI')
  .version('1.0.0');

// Register commands
registerWalletCommands(program);

// Global error handler
process.on('unhandledRejection', (error) => {
  logger.error('Unhandled rejection:', error);
  process.exit(1);
});

program.parse();
```

**Критерии завершения:**
- ✅ Все wallet команды работают
- ✅ Можно создать main, dev, и buyer кошельки
- ✅ Можно профинансировать кошельки из main
- ✅ Можно просмотреть балансы
- ✅ Красивый CLI UI с цветами и прогресс-барами

---

### Week 2: Token Launch & Jito Integration

#### Day 6-7: Pumpfun Integration Research

**Задачи исследования:**
```
□ Изучить Pumpfun program structure
□ Найти program ID и IDL
□ Понять process создания токена:
  - Какие accounts нужны?
  - Какие instructions вызывать?
  - Как устанавливать metadata?
□ Понять process покупки токена:
  - Swap instructions
  - Slippage handling
  - Price calculation
□ Найти примеры кода (GitHub, Discord)
□ Протестировать на devnet вручную
```

**Создать документацию:**
```
docs/PUMPFUN_INTEGRATION.md
- Program IDs (mainnet, devnet)
- Account structure
- Instruction format
- Examples
- Gotchas and edge cases
```

**Критерии завершения:**
- ✅ Понятен полный flow создания и покупки токена
- ✅ Есть рабочие примеры (даже если manual)
- ✅ Документация написана

---

#### Day 8-9: Token Metadata & Creation

**`src/core/pumpfun/types.ts`**
```typescript
export interface TokenMetadata {
  name: string;
  symbol: string;
  description: string;
  image: string;
  social?: {
    twitter?: string;
    telegram?: string;
    website?: string;
  };
}

export interface TokenCreateParams {
  metadata: TokenMetadata;
  creator: Keypair;
  initialSupply?: number;
}

export interface TokenCreateResult {
  mint: PublicKey;
  signature: string;
  metadata: PublicKey;
}
```

**`src/core/pumpfun/metadata.ts`**
```typescript
import { TokenMetadata } from './types';

export class MetadataHandler {
  // Upload image to IPFS or Arweave
  async uploadImage(imagePath: string): Promise<string> {
    // TODO: Implement image upload
    // - Support local files
    // - Upload to decentralized storage
    // - Return URL
  }

  // Create metadata JSON
  async createMetadataJson(metadata: TokenMetadata): Promise<string> {
    // TODO: Create and upload metadata JSON
    // - Follow Metaplex standard
    // - Upload to IPFS/Arweave
    // - Return URI
  }

  // Validate metadata
  validateMetadata(metadata: TokenMetadata): boolean {
    // TODO: Validate all fields
    // - Name length
    // - Symbol format
    // - URLs validity
  }
}
```

**`src/core/pumpfun/program.ts`**
```typescript
import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';

export class PumpfunProgram {
  private connection: Connection;
  private program: Program;

  constructor(connection: Connection, programId: PublicKey) {
    // TODO: Initialize Anchor program
  }

  // Create token instruction
  async createTokenInstruction(
    creator: Keypair,
    metadata: TokenMetadata
  ): Promise<Transaction> {
    // TODO: Build create token transaction
    // - Derive PDAs
    // - Build instruction
    // - Return transaction
  }

  // Buy token instruction
  async buyTokenInstruction(
    buyer: Keypair,
    tokenMint: PublicKey,
    amountSol: number,
    slippage: number = 10
  ): Promise<Transaction> {
    // TODO: Build buy transaction
    // - Calculate token amount based on bonding curve
    // - Set slippage tolerance
    // - Build swap instruction
  }

  // Sell token instruction
  async sellTokenInstruction(
    seller: Keypair,
    tokenMint: PublicKey,
    amountTokens: number,
    slippage: number = 10
  ): Promise<Transaction> {
    // TODO: Build sell transaction
  }

  // Get token price
  async getTokenPrice(tokenMint: PublicKey): Promise<number> {
    // TODO: Fetch current token price from bonding curve
  }
}
```

**Критерии завершения:**
- ✅ Можно создать токен на devnet manually
- ✅ Metadata корректно отображается
- ✅ Можно купить созданный токен

---

#### Day 10-11: Jito Integration

**`src/core/jito/types.ts`**
```typescript
import { VersionedTransaction } from '@solana/web3.js';

export interface JitoConfig {
  blockEngineUrl: string;
  authKeypair?: Keypair;
  tipAccount: PublicKey;
}

export interface BundleConfig {
  transactions: VersionedTransaction[];
  tipLamports: number;
}

export interface BundleStatus {
  bundleId: string;
  status: 'pending' | 'processing' | 'confirmed' | 'failed';
  landedSlot?: number;
  error?: string;
}
```

**`src/core/jito/client.ts`**
```typescript
import { Connection, VersionedTransaction } from '@solana/web3.js';
import axios from 'axios';

export class JitoClient {
  private blockEngineUrl: string;
  private connection: Connection;

  constructor(config: JitoConfig, connection: Connection) {
    this.blockEngineUrl = config.blockEngineUrl;
    this.connection = connection;
  }

  // Send bundle to Jito
  async sendBundle(
    transactions: VersionedTransaction[],
    tipLamports: number
  ): Promise<string> {
    // TODO: Implement Jito bundle submission
    // - Add tip transaction
    // - Serialize transactions
    // - Send to Block Engine
    // - Return bundle ID
  }

  // Get bundle status
  async getBundleStatus(bundleId: string): Promise<BundleStatus> {
    // TODO: Query bundle status
    // - Poll Block Engine API
    // - Return status
  }

  // Wait for bundle confirmation
  async waitForConfirmation(
    bundleId: string,
    timeoutMs: number = 30000
  ): Promise<BundleStatus> {
    // TODO: Wait for bundle to land
    // - Poll status with backoff
    // - Timeout after specified time
    // - Return final status
  }
}
```

**`src/core/jito/bundle.ts`**
```typescript
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  VersionedTransaction,
  TransactionMessage,
} from '@solana/web3.js';

export class BundleBuilder {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  // Build bundle from transactions
  async buildBundle(
    transactions: Transaction[],
    signers: Keypair[][]
  ): Promise<VersionedTransaction[]> {
    // TODO: Convert transactions to VersionedTransactions
    // - Get recent blockhash
    // - Sign each transaction
    // - Return array of VersionedTransactions
  }

  // Add tip transaction
  async createTipTransaction(
    from: Keypair,
    tipAccount: PublicKey,
    tipLamports: number
  ): Promise<VersionedTransaction> {
    // TODO: Create tip transfer transaction
  }

  // Simulate bundle
  async simulateBundle(
    bundle: VersionedTransaction[]
  ): Promise<boolean> {
    // TODO: Simulate each transaction
    // - Check for errors
    // - Return true if all succeed
  }
}
```

**Критерии завершения:**
- ✅ Можно создать и отправить bundle на devnet
- ✅ Можно отслеживать статус bundle
- ✅ Bundle transactions подтверждаются атомарно

---

#### Day 12: Token Launcher Integration

**`src/core/token/launcher.ts`**
```typescript
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { PumpfunProgram } from '../pumpfun/program';
import { JitoClient } from '../jito/client';
import { BundleBuilder } from '../jito/bundle';

export interface LaunchConfig {
  tokenMetadata: TokenMetadata;
  buyConfiguration: BuyConfiguration;
  jitoTip: number;
}

export interface LaunchResult {
  success: boolean;
  bundleId: string;
  tokenMint?: PublicKey;
  signatures: string[];
  totalBought: number;
  error?: string;
}

export class TokenLauncher {
  private connection: Connection;
  private pumpfun: PumpfunProgram;
  private jito: JitoClient;
  private bundleBuilder: BundleBuilder;

  constructor(
    connection: Connection,
    pumpfun: PumpfunProgram,
    jito: JitoClient
  ) {
    this.connection = connection;
    this.pumpfun = pumpfun;
    this.jito = jito;
    this.bundleBuilder = new BundleBuilder(connection);
  }

  // Main launch function
  async launch(
    config: LaunchConfig,
    devWallet: Keypair,
    buyerWallets: Keypair[]
  ): Promise<LaunchResult> {
    try {
      // 1. Create token transaction
      logger.info('Building token creation transaction...');
      const createTx = await this.pumpfun.createTokenInstruction(
        devWallet,
        config.tokenMetadata
      );

      // 2. Create buy transactions
      logger.info('Building buy transactions...');
      const buyTxs = await this.buildBuyTransactions(
        config.buyConfiguration,
        buyerWallets,
        tokenMint // Need to predict mint address
      );

      // 3. Build bundle
      logger.info('Building Jito bundle...');
      const bundle = await this.bundleBuilder.buildBundle(
        [createTx, ...buyTxs],
        [[devWallet], ...buyerWallets.map(w => [w])]
      );

      // 4. Add tip transaction
      const tipTx = await this.bundleBuilder.createTipTransaction(
        devWallet,
        JITO_TIP_ACCOUNT,
        config.jitoTip
      );
      bundle.push(tipTx);

      // 5. Simulate bundle (optional but recommended)
      logger.info('Simulating bundle...');
      const simulationSuccess = await this.bundleBuilder.simulateBundle(bundle);
      if (!simulationSuccess) {
        throw new Error('Bundle simulation failed');
      }

      // 6. Send bundle
      logger.info('Sending bundle to Jito...');
      const bundleId = await this.jito.sendBundle(bundle, config.jitoTip);
      logger.info(`Bundle sent: ${bundleId}`);

      // 7. Wait for confirmation
      logger.info('Waiting for bundle confirmation...');
      const status = await this.jito.waitForConfirmation(bundleId);

      if (status.status === 'confirmed') {
        return {
          success: true,
          bundleId,
          tokenMint,
          signatures: this.extractSignatures(bundle),
          totalBought: this.calculateTotalBought(config.buyConfiguration, buyerWallets.length),
        };
      } else {
        throw new Error(`Bundle failed: ${status.error}`);
      }
    } catch (error) {
      logger.error('Launch failed:', error);
      return {
        success: false,
        bundleId: '',
        signatures: [],
        totalBought: 0,
        error: error.message,
      };
    }
  }

  // Build buy transactions based on configuration
  private async buildBuyTransactions(
    config: BuyConfiguration,
    buyers: Keypair[],
    tokenMint: PublicKey
  ): Promise<Transaction[]> {
    // TODO: Implement based on buy config type
    // - fixed: same amount for all
    // - random: random in range
    // - custom: from array
    // - percentage: % of balance
  }

  // Calculate total tokens bought
  private calculateTotalBought(config: BuyConfiguration, buyerCount: number): number {
    // TODO: Calculate total
  }

  // Extract signatures from bundle
  private extractSignatures(bundle: VersionedTransaction[]): string[] {
    // TODO: Extract all signatures
  }
}
```

**Критерии завершения:**
- ✅ Полный flow от создания до покупки работает
- ✅ Bundle успешно отправляется и подтверждается
- ✅ Все транзакции атомарны
- ✅ Детальное логирование всех шагов

---

### Week 3: Selling, Testing & Polish

#### Day 13-14: Token Selling

**`src/core/token/seller.ts`**
```typescript
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { getAccount, getAssociatedTokenAddress } from '@solana/spl-token';

export interface SellConfig {
  tokenMint: PublicKey;
  sellType: 'percentage' | 'amount' | 'all';
  percentage?: number;
  amount?: number;
  slippage: number;
}

export interface SellResult {
  totalSold: number;
  totalSolReceived: number;
  transactions: {
    wallet: string;
    signature: string;
    tokensSold: number;
    solReceived: number;
    success: boolean;
    error?: string;
  }[];
}

export class TokenSeller {
  private connection: Connection;
  private pumpfun: PumpfunProgram;

  constructor(connection: Connection, pumpfun: PumpfunProgram) {
    this.connection = connection;
    this.pumpfun = pumpfun;
  }

  // Sell from single wallet
  async sellFromWallet(
    wallet: Keypair,
    config: SellConfig
  ): Promise<{ signature: string; sold: number; received: number }> {
    // TODO: Implement single wallet sell
    // - Get token balance
    // - Calculate amount to sell
    // - Create sell transaction
    // - Send and confirm
  }

  // Sell from multiple wallets
  async sellFromWallets(
    wallets: Keypair[],
    config: SellConfig
  ): Promise<SellResult> {
    // TODO: Implement batch selling
    // - Sell from each wallet in parallel
    // - Aggregate results
    // - Handle partial failures
  }

  // Get token balance
  async getTokenBalance(wallet: PublicKey, mint: PublicKey): Promise<number> {
    // TODO: Get SPL token balance
  }

  // Get all token balances
  async getAllTokenBalances(
    wallets: PublicKey[],
    mint: PublicKey
  ): Promise<Map<string, number>> {
    // TODO: Batch fetch balances
  }
}
```

**`src/cli/commands/sell.ts`**
```typescript
export function registerSellCommands(program: Command) {
  const sell = program.command('sell').description('Sell token commands');

  // sell dev
  sell
    .command('dev')
    .description('Sell tokens from dev wallet')
    .requiredOption('--token <mint>', 'Token mint address')
    .requiredOption('--wallet <path>', 'Dev wallet file')
    .option('--percentage <number>', 'Percentage to sell (0-100)', '100')
    .option('--slippage <number>', 'Slippage tolerance (%)', '10')
    .action(async (options) => {
      // TODO: Implement
    });

  // sell buyers
  sell
    .command('buyers')
    .description('Sell tokens from buyer wallets')
    .requiredOption('--token <mint>', 'Token mint address')
    .requiredOption('--wallets <path>', 'Buyer wallets file')
    .option('--percentage <number>', 'Percentage to sell (0-100)', '100')
    .option('--slippage <number>', 'Slippage tolerance (%)', '10')
    .action(async (options) => {
      // TODO: Implement
    });

  // sell all
  sell
    .command('all')
    .description('Sell tokens from all wallets')
    .requiredOption('--token <mint>', 'Token mint address')
    .requiredOption('--dev <path>', 'Dev wallet file')
    .requiredOption('--buyers <path>', 'Buyer wallets file')
    .option('--percentage <number>', 'Percentage to sell (0-100)', '100')
    .option('--slippage <number>', 'Slippage tolerance (%)', '10')
    .action(async (options) => {
      // TODO: Implement
    });
}
```

**Критерии завершения:**
- ✅ Можно продать токены с dev кошелька
- ✅ Можно продать со всех buyer кошельков
- ✅ Параллельная отправка работает корректно
- ✅ Детальная статистика продаж

---

#### Day 15-16: Launch CLI Command

**`src/cli/commands/launch.ts`**
```typescript
import { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import fs from 'fs/promises';

export function registerLaunchCommands(program: Command) {
  const launch = program.command('launch').description('Token launch commands');

  // launch create
  launch
    .command('create')
    .description('Create and launch a new token')
    .requiredOption('--config <path>', 'Launch configuration file')
    .requiredOption('--dev <path>', 'Dev wallet file')
    .requiredOption('--buyers <path>', 'Buyer wallets file')
    .option('--dry-run', 'Simulate without sending transactions')
    .action(async (options) => {
      const spinner = ora('Loading configuration...').start();

      try {
        // 1. Load configuration
        const config = await loadLaunchConfig(options.config);
        spinner.succeed('Configuration loaded');

        // 2. Load wallets
        spinner.start('Loading wallets...');
        const devWallet = await loadWallet(options.dev);
        const buyerWallets = await loadWallets(options.buyers);
        spinner.succeed(`Loaded ${buyerWallets.length} buyer wallets`);

        // 3. Validate balances
        spinner.start('Checking balances...');
        const validation = await validateBalances(devWallet, buyerWallets, config);
        if (!validation.sufficient) {
          spinner.fail('Insufficient balances');
          console.log(chalk.red(validation.message));
          return;
        }
        spinner.succeed('Balances OK');

        // 4. Display summary and confirm
        console.log(chalk.cyan('\n📊 Launch Summary:'));
        console.log(`Token: ${config.tokenMetadata.name} (${config.tokenMetadata.symbol})`);
        console.log(`Buyers: ${buyerWallets.length} wallets`);
        console.log(`Total buy amount: ${calculateTotalBuy(config)} SOL`);
        console.log(`Jito tip: ${config.jitoTip / LAMPORTS_PER_SOL} SOL`);
        console.log(`Estimated cost: ${validation.totalCost} SOL\n`);

        const { confirm } = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirm',
          message: 'Proceed with launch?',
          default: false,
        }]);

        if (!confirm) {
          console.log(chalk.yellow('Launch cancelled'));
          return;
        }

        // 5. Execute launch
        if (options.dryRun) {
          spinner.info('Dry run mode - simulating bundle...');
          // TODO: Simulate
        } else {
          spinner.start('Creating token and building bundle...');
          const launcher = new TokenLauncher(connection, pumpfun, jito);
          const result = await launcher.launch(config, devWallet, buyerWallets);

          if (result.success) {
            spinner.succeed('Token launched successfully! 🚀');
            console.log(chalk.green('\n✅ Launch Results:'));
            console.log(`Bundle ID: ${result.bundleId}`);
            console.log(`Token Mint: ${result.tokenMint?.toBase58()}`);
            console.log(`Transactions: ${result.signatures.length}`);
            console.log(`Total Bought: ${result.totalBought} tokens`);
            console.log(`\nView on Solscan: https://solscan.io/token/${result.tokenMint?.toBase58()}`);
          } else {
            spinner.fail('Launch failed');
            console.log(chalk.red(`Error: ${result.error}`));
          }
        }
      } catch (error) {
        spinner.fail('Launch failed');
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  // launch config
  launch
    .command('config')
    .description('Create launch configuration file interactively')
    .option('--output <path>', 'Output file path', './launch-config.json')
    .action(async (options) => {
      // TODO: Interactive wizard to create config
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Token name:',
          validate: (input) => input.length > 0,
        },
        {
          type: 'input',
          name: 'symbol',
          message: 'Token symbol:',
          validate: (input) => input.length > 0 && input.length <= 10,
        },
        // ... more prompts
      ]);

      const config = buildConfigFromAnswers(answers);
      await fs.writeFile(options.output, JSON.stringify(config, null, 2));
      console.log(chalk.green(`✅ Config saved to ${options.output}`));
    });
}
```

**Критерии завершения:**
- ✅ `launch create` работает end-to-end
- ✅ Dry-run режим для тестирования
- ✅ Interactive config wizard
- ✅ Красивый UI с подтверждениями
- ✅ Детальные результаты

---

#### Day 17-18: Testing & Bug Fixes

**Тестирование на Devnet:**

1. **Unit Tests** (все модули):
```bash
npm run test:unit
```

2. **Integration Tests**:
```typescript
// tests/integration/full-flow.test.ts
describe('Full Launch Flow', () => {
  test('should complete full launch on devnet', async () => {
    // 1. Create wallets
    // 2. Fund from faucet
    // 3. Launch token
    // 4. Verify token created
    // 5. Verify buys executed
    // 6. Sell tokens
    // 7. Verify sells executed
  }, 120000); // 2 minute timeout
});
```

3. **Manual Testing Checklist**:
```
□ Create main wallet
□ Request devnet SOL from faucet
□ Create dev wallet
□ Create 5 buyer wallets
□ Fund all wallets from main
□ Verify all balances
□ Create launch config
□ Dry-run launch (simulation)
□ Execute real launch
□ Verify token created on Solscan
□ Verify all buys in bundle
□ Check token balances
□ Sell 50% from buyers
□ Sell 100% from dev
□ Verify all sells completed
```

**Bug Fixes:**
```
□ Fix any failing tests
□ Handle edge cases:
  - Insufficient balance
  - Network errors
  - Bundle rejection
  - Timeout scenarios
□ Improve error messages
□ Add retry logic where needed
```

**Критерии завершения:**
- ✅ Все unit тесты проходят
- ✅ Integration тест проходит на devnet
- ✅ Manual flow выполнен успешно 3+ раза
- ✅ Нет известных критичных багов

---

#### Day 19-21: Documentation & Polish

**Documentation:**

**`README.md`**
```markdown
# Solana Token Launch Bundler

Automated token launching on Pumpfun with atomic buyback using Jito bundles.

## Features

- 🔐 Secure wallet management with AES-256 encryption
- 🚀 Atomic token launch + buyback via Jito
- 💰 Automated fund distribution
- 📊 Batch token selling
- 🎯 Multiple buy strategies (fixed, random, custom)

## Quick Start

### Installation
\`\`\`bash
npm install -g solana-launcher
\`\`\`

### Usage

1. Create wallets:
\`\`\`bash
# Create main wallet
solana-launcher wallet create-main --save ./wallets/main.json

# Get devnet SOL (use faucet)
# ...

# Create dev wallet
solana-launcher wallet create-dev --save ./wallets/dev.json

# Create buyer wallets
solana-launcher wallet create-buyers --count 10 --save ./wallets/buyers.json
\`\`\`

2. Fund wallets:
\`\`\`bash
solana-launcher wallet fund \\
  --from ./wallets/main.json \\
  --to ./wallets/dev.json \\
  --amount 0.1

solana-launcher wallet fund \\
  --from ./wallets/main.json \\
  --to ./wallets/buyers.json \\
  --amount 0.05
\`\`\`

3. Create launch config:
\`\`\`bash
solana-launcher launch config --output launch.json
\`\`\`

4. Launch token:
\`\`\`bash
solana-launcher launch create \\
  --config launch.json \\
  --dev ./wallets/dev.json \\
  --buyers ./wallets/buyers.json
\`\`\`

5. Sell tokens:
\`\`\`bash
# Sell from all wallets
solana-launcher sell all \\
  --token <MINT_ADDRESS> \\
  --dev ./wallets/dev.json \\
  --buyers ./wallets/buyers.json \\
  --percentage 100
\`\`\`

## Configuration

See [docs/CONFIGURATION.md](docs/CONFIGURATION.md) for detailed configuration options.

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for technical details.

## Security

See [docs/SECURITY.md](docs/SECURITY.md) for security best practices.

## License

MIT
```

**`docs/CONFIGURATION.md`** - Детальная конфигурация
**`docs/TROUBLESHOOTING.md`** - Решение типичных проблем
**`docs/EXAMPLES.md`** - Примеры использования

**Code Polish:**
```
□ Add JSDoc comments to all public APIs
□ Improve error messages (clear and actionable)
□ Add input validation everywhere
□ Standardize logging format
□ Clean up console output
□ Add --verbose flag for detailed logs
```

**Критерии завершения:**
- ✅ Comprehensive README
- ✅ All docs written
- ✅ Code well-commented
- ✅ Clean and professional output
- ✅ Ready for beta users

---

## 🎯 Phase 1 Completion Checklist

### Core Functionality
- [ ] Wallet creation and import works flawlessly
- [ ] Wallet encryption is secure (AES-256)
- [ ] Fund distribution works reliably
- [ ] Token creation on Pumpfun works
- [ ] Jito bundle integration works
- [ ] Atomic launch (create + buy) succeeds
- [ ] Token selling works (dev, buyers, all)
- [ ] All CLI commands implemented

### Quality
- [ ] All unit tests passing (>80% coverage)
- [ ] Integration tests passing on devnet
- [ ] Manual testing completed (3+ successful launches)
- [ ] No known critical bugs
- [ ] Error handling is robust
- [ ] Logging is comprehensive

### Documentation
- [ ] README with quick start guide
- [ ] API documentation
- [ ] Configuration guide
- [ ] Troubleshooting guide
- [ ] Code comments for public APIs

### Production Readiness
- [ ] Works on devnet reliably
- [ ] Works on mainnet (tested with small amounts)
- [ ] Security review completed
- [ ] Performance is acceptable
- [ ] CLI UX is polished

---

## 📈 Success Metrics - Phase 1

### Technical Metrics
- **Bundle Success Rate:** Target > 95% on mainnet
- **Average Bundle Confirmation Time:** < 10 seconds
- **Wallet Creation Time:** < 5 seconds for 50 wallets
- **Zero security incidents:** No private key leaks

### Usage Metrics
- **Personal Launches:** 5+ successful token launches
- **Beta Users:** 3-5 users testing the tool
- **Positive Feedback:** Majority of feedback is positive
- **Documentation Usage:** Users can launch without asking for help

---

## 🔮 Next Steps After Phase 1

### Immediate (Week 4)
1. Gather feedback from personal use
2. Identify most common pain points
3. Fix critical bugs discovered in production
4. Optimize bundle success rate

### Short-term (Month 2)
1. Start Phase 2: Volume Trading feature
2. Recruit 10 beta users
3. Create video tutorials
4. Build small community (Discord/Telegram)

### Medium-term (Month 3-4)
1. Consider adding simple web UI (local)
2. Add advanced features based on feedback:
   - Multiple launch presets
   - Advanced buy strategies
   - Portfolio tracking
3. Prepare for Phase 3 (public platform)

---

## 🛠️ Development Best Practices

### Code Quality
```
- Write TypeScript with strict mode
- Use ESLint + Prettier
- Minimum 70% test coverage
- Document all public APIs
- Handle errors gracefully
- Log everything important
```

### Git Workflow
```
- Feature branches: feature/wallet-management
- Commit messages: "feat: add wallet encryption"
- PR reviews (even if solo - review own code)
- Tag releases: v1.0.0, v1.1.0
```

### Testing Strategy
```
- Unit tests: All pure logic
- Integration tests: End-to-end flows on devnet
- Manual tests: Critical paths on mainnet
- Regression tests: Don't break existing features
```

### Security Practices
```
- Never commit private keys or passwords
- Always encrypt sensitive data
- Validate all user inputs
- Use environment variables for configs
- Regular dependency updates (npm audit)
```

---

## 📞 Support & Resources

### Learning Resources
- Solana Cookbook: https://solanacookbook.com
- Anchor Book: https://book.anchor-lang.com
- Jito Docs: https://jito-labs.gitbook.io

### Community
- Solana Discord: Technical questions
- Jito Discord: Bundle-related questions
- Pumpfun: [Community channels]

### Tools
- Solana Explorer: https://explorer.solana.com
- Solscan: https://solscan.io
- Phantom Wallet: For testing
- Solana CLI: For debugging

---

**Ready to start? Let's build! 🚀**

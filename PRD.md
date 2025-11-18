# Product Requirements Document (PRD)
## Solana Token Launch Bundler

**Version:** 1.1
**Date:** 2025-11-18
**Status:** Updated after Competitive Analysis
**Changelog:** Added LUT support, bundle simulation, regional Jito endpoints (see COMPETITIVE_ANALYSIS.md)

---

## 1. Executive Summary

### 1.1 Product Vision
Автоматизированная платформа для запуска токенов на Pumpfun/Pumpswap в сети Solana с использованием Jito bundles для атомарного выполнения транзакций создания и первичной покупки токена.

### 1.2 Problem Statement
При запуске токенов на Pumpfun существует проблема "снайперов" - ботов, которые отслеживают новые токены и мгновенно их скупают между транзакцией создания и первыми покупками разработчика. Это приводит к:
- Потере контроля над распределением токенов
- Возможности манипуляций ценой
- Неоптимальным условиям запуска

### 1.3 Solution
Использование Jito bundles для атомарного выполнения всех транзакций (создание токена + покупки с множества кошельков) гарантирует, что никакие внешние транзакции не попадут между нашими операциями.

### 1.4 Target Users
- **Primary:** Разработчики токенов и команды проектов в экосистеме Solana
- **Secondary:** Трейдеры и инвесторы, желающие получить более справедливое распределение при запуске
- **Future:** Публичные пользователи через SaaS платформу с комиссией

---

## 2. Product Goals & Success Metrics

### 2.1 Goals
1. Обеспечить 100% успешность атомарных транзакций (bundle не разделяется)
2. Минимизировать время между созданием токена и первыми покупками (< 1 секунда)
3. Автоматизировать управление множественными кошельками (до 50+)
4. Обеспечить безопасное хранение и использование приватных ключей

### 2.2 Success Metrics
- **Technical:**
  - Bundle success rate: > 95%
  - Transaction confirmation time: < 5 seconds
  - Wallet management overhead: < 10 seconds для создания и фондирования 50 кошельков

- **Business:**
  - Phase 1: Успешный личный запуск 5+ токенов
  - Phase 2: 10+ beta users
  - Phase 3: 100+ paying users, $10K+ MRR

---

## 3. Feature Requirements

### 3.1 Feature 1: Wallet Management & Fund Distribution
**Priority:** P0 (Critical)
**Complexity:** Medium

#### 3.1.1 User Stories
- **US-1.1:** Как пользователь, я хочу создать новый main wallet для каждого запуска, чтобы изолировать средства разных проектов
- **US-1.2:** Как пользователь, я хочу создать или импортировать dev wallet, с которого будет создаваться токен
- **US-1.3:** Как пользователь, я хочу автоматически создать N buyer кошельков, чтобы не делать это вручную
- **US-1.4:** Как пользователь, я хочу автоматически распределить SOL с main кошелька на dev и buyer кошельки

#### 3.1.2 Functional Requirements
- **FR-1.1:** Генерация новых Solana кошельков (ED25519 keypairs)
- **FR-1.2:** Импорт существующих кошельков из приватных ключей или seed phrases
- **FR-1.3:** Хранение кошельков в зашифрованном виде (AES-256)
- **FR-1.4:** Конфигурируемое количество buyer кошельков (1-100)
- **FR-1.5:** Автоматическое распределение SOL с main кошелька:
  - На dev wallet: конфигурируемая сумма (по умолчанию 0.1 SOL)
  - На каждый buyer wallet: конфигурируемая сумма (по умолчанию 0.05 SOL каждому)
- **FR-1.6:** Проверка балансов перед операциями
- **FR-1.7:** Экспорт списка кошельков (адреса + приватные ключи) в защищенный файл

#### 3.1.3 Non-Functional Requirements
- **NFR-1.1:** Приватные ключи должны храниться только локально
- **NFR-1.2:** Обязательное шифрование файлов с ключами паролем пользователя
- **NFR-1.3:** Резервное копирование кошельков должно быть простым и безопасным

#### 3.1.4 Technical Specifications
```typescript
interface WalletConfig {
  mainWallet: Keypair;
  devWallet: Keypair;
  buyerWallets: Keypair[];

  fundingAmounts: {
    devWalletSol: number;      // SOL для dev кошелька
    buyerWalletSol: number;    // SOL для каждого buyer кошелька
  };
}

interface WalletOperations {
  createWallets(count: number): Promise<Keypair[]>;
  importWallet(privateKey: string | Uint8Array): Keypair;
  distributeSOL(config: WalletConfig): Promise<TransactionSignature[]>;
  getBalances(wallets: Keypair[]): Promise<Map<string, number>>;
  exportWallets(wallets: Keypair[], password: string): Promise<void>;
}
```

---

### 3.2 Feature 2: Token Launch & Atomic Buyback
**Priority:** P0 (Critical)
**Complexity:** High

#### 3.2.1 User Stories
- **US-2.1:** Как пользователь, я хочу создать токен на Pumpfun с заданными параметрами
- **US-2.2:** Как пользователь, я хочу автоматически купить токен с множества кошельков сразу после создания
- **US-2.3:** Как пользователь, я хочу гарантировать, что между созданием и моими покупками не будет чужих транзакций
- **US-2.4:** Как пользователь, я хочу настроить размер покупки для каждого кошелька индивидуально или по формуле

#### 3.2.2 Functional Requirements
- **FR-2.1:** Создание токена на Pumpfun через program instructions
- **FR-2.2:** Параметры токена (конфигурируемые):
  - Название
  - Символ (ticker)
  - Описание
  - Изображение/логотип (URL или локальный файл)
  - Twitter, Telegram, Website links
- **FR-2.3:** Конфигурация покупок:
  - Fixed amount: одинаковая сумма для всех кошельков
  - Random range: случайная сумма в заданном диапазоне для каждого кошелька
  - Custom distribution: индивидуальные суммы из массива/файла
  - Percentage of balance: процент от баланса каждого кошелька
- **FR-2.4:** Построение Jito bundle:
  - Транзакция 1: Создание токена (dev wallet)
  - Транзакции 2-N: Покупки токена (buyer wallets)
  - Транзакция N+1 (optional): Комиссия на платформенный кошелек
- **FR-2.5:** Отправка bundle через Jito Block Engine
- **FR-2.6:** Мониторинг статуса bundle и подтверждения транзакций
- **FR-2.7:** Retry логика при неудачных попытках
- **FR-2.8:** Подробное логирование всех операций

#### 3.2.3 Non-Functional Requirements
- **NFR-2.1:** Bundle должен быть атомарным (либо все транзакции выполняются, либо ни одна)
- **NFR-2.2:** Максимальное время ожидания подтверждения: 30 секунд
- **NFR-2.3:** Поддержка до 50 покупающих кошельков в одном bundle
- **NFR-2.4:** Обработка ошибок с детальными сообщениями

#### 3.2.4 Technical Specifications
```typescript
interface TokenMetadata {
  name: string;
  symbol: string;
  description: string;
  image: string;           // URL or base64
  social: {
    twitter?: string;
    telegram?: string;
    website?: string;
  };
}

interface BuyConfiguration {
  type: 'fixed' | 'random' | 'custom' | 'percentage';

  // For fixed
  fixedAmount?: number;

  // For random
  randomRange?: {
    min: number;
    max: number;
  };

  // For custom
  customAmounts?: number[];

  // For percentage
  percentage?: number;
}

interface LaunchConfig {
  tokenMetadata: TokenMetadata;
  buyConfiguration: BuyConfiguration;

  jito: {
    tipAmount: number;           // Tip для Jito в lamports
    blockEngineUrl: string;
  };

  platform: {
    feeEnabled: boolean;
    feePercentage?: number;      // Процент комиссии (для фичи 5)
    feeWallet?: string;           // Адрес для комиссии
  };
}

interface BundleResult {
  bundleId: string;
  status: 'pending' | 'confirmed' | 'failed';
  transactions: {
    signature: string;
    status: 'success' | 'failed';
    error?: string;
  }[];
  tokenMint?: string;            // Address созданного токена
  totalBought?: number;          // Общее количество купленных токенов
}

interface TokenLauncher {
  createAndBuyToken(
    config: LaunchConfig,
    wallets: WalletConfig
  ): Promise<BundleResult>;

  buildBundle(
    config: LaunchConfig,
    wallets: WalletConfig
  ): Promise<VersionedTransaction[]>;

  sendBundle(
    bundle: VersionedTransaction[],
    tipAmount: number
  ): Promise<string>;

  monitorBundle(bundleId: string): Promise<BundleResult>;
}
```

---

### 3.3 Feature 3: Token Selling
**Priority:** P1 (High)
**Complexity:** Low

#### 3.3.1 User Stories
- **US-3.1:** Как пользователь, я хочу продать токены с dev кошелька одной командой
- **US-3.2:** Как пользователь, я хочу продать токены со всех buyer кошельков одной командой
- **US-3.3:** Как пользователь, я хочу выбрать процент токенов для продажи (25%, 50%, 100%)

#### 3.3.2 Functional Requirements
- **FR-3.1:** Получение балансов токенов на всех кошельках
- **FR-3.2:** Продажа токенов через Pumpfun/Pumpswap:
  - Полная продажа (100%)
  - Частичная продажа (заданный процент или количество)
- **FR-3.3:** Две отдельные команды:
  - `sell-dev`: продажа только с dev кошелька
  - `sell-all`: продажа со всех buyer кошельков + опционально dev
- **FR-3.4:** Параллельная отправка транзакций (не через bundle)
- **FR-3.5:** Отслеживание успешности каждой транзакции
- **FR-3.6:** Автоматический расчет slippage

#### 3.3.3 Technical Specifications
```typescript
interface SellConfig {
  tokenMint: string;

  sellType: 'percentage' | 'amount';
  percentage?: number;        // 0-100
  amount?: number;            // Конкретное количество токенов

  slippage: number;           // Процент проскальзывания (по умолчанию 10%)

  wallets: 'dev' | 'buyers' | 'all';
}

interface SellResult {
  totalSold: number;
  totalSolReceived: number;
  transactions: {
    wallet: string;
    signature: string;
    tokensSold: number;
    solReceived: number;
    status: 'success' | 'failed';
    error?: string;
  }[];
}

interface TokenSeller {
  sellTokens(
    config: SellConfig,
    wallets: WalletConfig
  ): Promise<SellResult>;

  getTokenBalances(
    tokenMint: string,
    wallets: Keypair[]
  ): Promise<Map<string, number>>;
}
```

---

### 3.4 Feature 4: Volume Trading (Optional)
**Priority:** P2 (Medium)
**Complexity:** High

#### 3.4.1 User Stories
- **US-4.1:** Как пользователь, я хочу поддерживать торговые объемы токена автоматически
- **US-4.2:** Как пользователь, я хочу настроить параметры торговли (частота, размер сделок)
- **US-4.3:** Как пользователь, я хочу использовать существующие buyer кошельки или создать отдельные volume кошельки

#### 3.4.2 Functional Requirements
- **FR-4.1:** Создание дополнительных volume кошельков (опционально)
- **FR-4.2:** Автоматическая торговля токеном:
  - Случайные покупки и продажи
  - Конфигурируемые интервалы времени
  - Случайные размеры сделок в заданном диапазоне
- **FR-4.3:** Стратегии торговли:
  - Random: случайные buy/sell
  - Pump: больше покупок, меньше продаж
  - Stabilize: балансировка цены вокруг целевого значения
- **FR-4.4:** Мониторинг балансов и автоматическая ребалансировка SOL
- **FR-4.5:** Graceful shutdown с сохранением состояния
- **FR-4.6:** Детальная статистика торгов

#### 3.4.3 Non-Functional Requirements
- **NFR-4.1:** Алгоритм торговли должен выглядеть органично (варьирующиеся интервалы и объемы)
- **NFR-4.2:** Защита от исчерпания средств (минимальные резервы SOL)
- **NFR-4.3:** Возможность остановки и возобновления без потери данных

#### 3.4.4 Technical Specifications
```typescript
interface VolumeConfig {
  tokenMint: string;

  wallets: {
    useExisting: boolean;      // Использовать buyer кошельки
    createNew?: number;        // Или создать N новых
  };

  trading: {
    strategy: 'random' | 'pump' | 'stabilize';

    interval: {
      min: number;             // Минимальный интервал между сделками (секунды)
      max: number;             // Максимальный интервал
    };

    tradeSize: {
      minSol: number;
      maxSol: number;
    };

    buyToSellRatio?: number;   // Для стратегии 'pump' (например, 1.5 = больше покупок)
    targetPrice?: number;      // Для стратегии 'stabilize'
  };

  limits: {
    maxDurationMinutes?: number;  // Максимальное время работы
    maxTrades?: number;           // Максимальное количество сделок
    minSolReserve: number;        // Минимальный резерв SOL на кошелек
  };
}

interface VolumeStats {
  totalTrades: number;
  totalBuys: number;
  totalSells: number;
  totalVolumeSol: number;
  averageTradeSize: number;
  uptime: number;                 // Секунды
  currentPrice: number;
}

interface VolumeTrader {
  start(config: VolumeConfig, wallets: WalletConfig): Promise<void>;
  stop(): Promise<void>;
  getStats(): VolumeStats;
  pause(): void;
  resume(): void;
}
```

---

### 3.5 Feature 5: Platform Monetization
**Priority:** P3 (Low - Future)
**Complexity:** Medium

#### 3.5.1 User Stories
- **US-5.1:** Как владелец платформы, я хочу получать комиссию с каждого запуска
- **US-5.2:** Как пользователь, я хочу видеть размер комиссии до запуска
- **US-5.3:** Как владелец платформы, я хочу иметь разные тарифы для разных пользователей

#### 3.5.2 Functional Requirements
- **FR-5.1:** Добавление комиссионной транзакции в bundle
- **FR-5.2:** Конфигурируемый процент комиссии (по умолчанию 1-3%)
- **FR-5.3:** Whitelist для бесплатных/льготных пользователей
- **FR-5.4:** Статистика по собранным комиссиям
- **FR-5.5:** API для интеграции платежей (для SaaS версии)

#### 3.5.3 Technical Specifications
```typescript
interface PlatformFeeConfig {
  enabled: boolean;
  feePercentage: number;           // Процент от суммы покупок
  feeWallet: string;               // Адрес для получения комиссий

  tiers?: {
    userId: string;
    customFeePercentage: number;
  }[];

  whitelist?: string[];            // Бесплатные пользователи
}

interface FeeCalculator {
  calculateFee(totalBuyAmount: number, userId?: string): number;
  buildFeeTransaction(fee: number, feeWallet: string): Transaction;
}
```

---

## 4. Technical Architecture

### 4.1 Technology Stack

#### Phase 1: CLI Application
```
Runtime: Node.js 18+ / Bun
Language: TypeScript 5+
Framework: Commander.js (CLI)

Core Dependencies:
- @solana/web3.js ^1.87.6
- @solana/spl-token ^0.3.9
- @coral-xyz/anchor ^0.29.0 (для Pumpfun program с IDL)
- jito-js ^3.0.0 (Official Jito SDK - CRITICAL) ⭐ NEW
- bs58 ^5.0.0, tweetnacl ^1.0.3 (криптография)
- inquirer ^9.2.12 (интерактивный CLI)
- chalk ^5.3.0, ora ^7.0.1 (UI для CLI)
- dotenv ^16.3.1 (конфигурация)
- winston ^3.11.0 (логирование)
- axios ^1.6.0 (для Jito API calls) ⭐ NEW
- crypto-js ^4.2.0 (AES-256 encryption)

Key Features Added:
✅ LUT (Lookup Tables) support - снижает overhead на 80%
✅ Bundle simulation перед отправкой
✅ Regional Jito endpoints с auto-selection
✅ Pumpfun IDL integration для typed instructions
```

#### Phase 2: Web Application (Future)
```
Backend: Express.js / Fastify
Frontend: React / Next.js
Database: PostgreSQL (users, launches, stats)
Cache: Redis (rate limiting, sessions)
Queue: BullMQ (background jobs)
```

### 4.2 Project Structure

```
solana-token-launcher/
├── src/
│   ├── core/
│   │   ├── wallet/
│   │   │   ├── manager.ts          # WalletManager class
│   │   │   ├── encryption.ts       # AES-256 encryption
│   │   │   ├── storage.ts          # Secure file storage
│   │   │   └── lut-manager.ts      # ⭐ NEW: LUT creation & management
│   │   ├── token/
│   │   │   ├── launcher.ts         # Token creation & bundling
│   │   │   ├── seller.ts           # Token selling logic
│   │   │   └── metadata.ts         # Token metadata handling
│   │   ├── jito/
│   │   │   ├── bundle.ts           # Jito bundle builder (with LUT)
│   │   │   ├── client.ts           # Jito Block Engine client (jito-js SDK)
│   │   │   ├── monitor.ts          # Bundle monitoring
│   │   │   ├── simulator.ts        # ⭐ NEW: Bundle simulation
│   │   │   └── endpoints.ts        # ⭐ NEW: Regional endpoint selection
│   │   ├── pumpfun/
│   │   │   ├── program.ts          # Pumpfun program instructions (Anchor + IDL)
│   │   │   ├── swap.ts             # Buy/Sell через Pumpfun
│   │   │   └── types.ts            # Типы и интерфейсы
│   │   └── volume/
│   │       ├── trader.ts           # Volume trading bot
│   │       ├── strategies.ts       # Trading strategies
│   │       └── stats.ts            # Statistics collection
│   ├── cli/
│   │   ├── index.ts                # CLI entry point
│   │   ├── commands/
│   │   │   ├── wallet.ts           # Wallet commands
│   │   │   ├── launch.ts           # Launch commands
│   │   │   ├── sell.ts             # Sell commands
│   │   │   └── volume.ts           # Volume trading commands
│   │   └── ui/
│   │       ├── prompts.ts          # Interactive prompts
│   │       └── display.ts          # Output formatting
│   ├── config/
│   │   ├── default.ts              # Default configuration
│   │   ├── schema.ts               # Config validation schemas
│   │   └── loader.ts               # Config file loader
│   ├── utils/
│   │   ├── logger.ts               # Winston logger setup
│   │   ├── errors.ts               # Custom error classes
│   │   ├── validation.ts           # Input validation
│   │   └── helpers.ts              # Helper functions
│   └── types/
│       └── index.ts                # Shared TypeScript types
├── config/
│   ├── default.json                # Default config file
│   ├── launch-template.json        # Template for launch configs
│   ├── jito-endpoints.json         # ⭐ NEW: Regional Jito endpoints
│   └── lut-config.json             # ⭐ NEW: LUT configuration
├── idl/
│   └── pumpfun.json                # ⭐ NEW: Pumpfun program IDL
├── wallets/                        # Encrypted wallet storage (gitignored)
├── logs/                           # Application logs (gitignored)
│   ├── app.log                     # General logs
│   └── launches.csv                # ⭐ NEW: Launch analytics
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/
│   ├── PRD.md                      # This document
│   ├── ARCHITECTURE.md             # Technical architecture
│   ├── API.md                      # API documentation
│   └── DEPLOYMENT.md               # Deployment guide
├── scripts/
│   └── setup.sh                    # Initial setup script
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

### 4.3 Key Design Patterns

1. **Repository Pattern**: Для работы с кошельками и конфигурацией
2. **Factory Pattern**: Для создания транзакций и bundles
3. **Strategy Pattern**: Для различных стратегий торговли (фича 4)
4. **Observer Pattern**: Для мониторинга статуса транзакций
5. **Command Pattern**: Для CLI команд

### 4.4 Security Considerations

1. **Wallet Security:**
   - Все приватные ключи шифруются AES-256
   - Пароли не хранятся, используется key derivation (PBKDF2)
   - Опциональное хранение в hardware wallet (Ledger - future)

2. **Network Security:**
   - Использование HTTPS для всех RPC запросов
   - Rotation RPC endpoints при ошибках
   - Rate limiting для предотвращения бана

3. **Code Security:**
   - Input validation для всех пользовательских данных
   - Sanitization URL и файловых путей
   - Dependency scanning (npm audit)

4. **Operational Security:**
   - Логи не содержат приватные ключи
   - Secure deletion временных файлов
   - Опциональный audit log всех операций

---

## 5. Configuration

### 5.1 Environment Variables (.env)
```bash
# Solana RPC
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_RPC_FALLBACK=https://solana-api.projectserum.com

# Jito
JITO_BLOCK_ENGINE_URL=https://mainnet.block-engine.jito.wtf
JITO_TIP_ACCOUNT=96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5

# Wallet encryption
WALLET_ENCRYPTION_PASSWORD=  # Optional, can be prompted

# Pumpfun
PUMPFUN_PROGRAM_ID=6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/app.log

# Platform fees (Feature 5)
PLATFORM_FEE_ENABLED=false
PLATFORM_FEE_PERCENTAGE=2
PLATFORM_FEE_WALLET=

# Network
MAX_RETRIES=3
RETRY_DELAY_MS=1000
TRANSACTION_TIMEOUT_MS=30000
```

### 5.2 Launch Configuration (launch-config.json)
```json
{
  "token": {
    "name": "My Token",
    "symbol": "MTK",
    "description": "Amazing token description",
    "image": "./assets/logo.png",
    "social": {
      "twitter": "https://twitter.com/mytoken",
      "telegram": "https://t.me/mytoken",
      "website": "https://mytoken.com"
    }
  },
  "wallets": {
    "buyerCount": 20,
    "fundingAmounts": {
      "devWalletSol": 0.1,
      "buyerWalletSol": 0.05
    }
  },
  "buy": {
    "type": "random",
    "randomRange": {
      "min": 0.01,
      "max": 0.03
    }
  },
  "jito": {
    "tipAmount": 10000
  }
}
```

---

## 6. Implementation Roadmap

### Phase 1: MVP - Core Functionality (Weeks 1-3)

#### Week 1: Foundation & Wallet Management
**Goal:** Создание базовой инфраструктуры и фичи 1

**Tasks:**
1. Инициализация проекта (TypeScript, ESLint, Prettier)
2. Настройка Solana web3.js и подключение к RPC
3. Реализация WalletManager:
   - Генерация кошельков
   - Импорт/экспорт
   - Шифрование AES-256
4. CLI команды для wallet management:
   - `wallet create-main`
   - `wallet create-dev`
   - `wallet create-buyers --count=N`
   - `wallet import --key=...`
   - `wallet list`
   - `wallet export`
5. Реализация funding logic:
   - Распределение SOL с main на dev и buyers
   - Проверка балансов
6. Unit тесты для wallet операций

**Deliverables:**
- Работающий WalletManager
- CLI для управления кошельками
- Документация API

#### Week 2: Token Launch & Jito Integration
**Goal:** Реализация фичи 2 - создание токена и атомарные покупки

**Tasks:**
1. Изучение Pumpfun program (instructions, accounts)
2. Реализация TokenLauncher:
   - Создание token mint
   - Создание metadata (Metaplex)
   - Upload изображения (если нужно)
3. Интеграция Jito:
   - Подключение к Block Engine
   - Построение bundles
   - Отправка bundles с tip
4. Bundle builder:
   - Создание транзакции токена
   - Создание транзакций покупок
   - Упаковка в bundle
5. Мониторинг и retry logic
6. CLI команды:
   - `launch --config=launch.json`
   - `launch dry-run` (симуляция без отправки)
7. Логирование и error handling
8. Integration тесты на devnet

**Deliverables:**
- Работающий launch механизм
- Jito bundle integration
- CLI команда для запуска

#### Week 3: Token Selling & Polish
**Goal:** Реализация фичи 3 и финализация MVP

**Tasks:**
1. Реализация TokenSeller:
   - Получение token balances
   - Создание sell транзакций через Pumpfun
   - Расчет slippage
2. CLI команды:
   - `sell dev --token=MINT --percentage=100`
   - `sell buyers --token=MINT --percentage=50`
   - `sell all --token=MINT`
3. Параллельная отправка sell транзакций
4. Статистика продаж
5. End-to-end тестирование на devnet:
   - Полный цикл: создание кошельков → фондирование → запуск → продажа
6. Документация:
   - README с примерами
   - Troubleshooting guide
7. Улучшение CLI UX:
   - Прогресс-бары
   - Цветной вывод
   - Детальные ошибки

**Deliverables:**
- Полностью рабочий MVP
- Comprehensive documentation
- Готовность к production тестированию

---

### Phase 2: Advanced Features (Weeks 4-6)

#### Week 4: Volume Trading - Part 1
**Goal:** Базовая реализация фичи 4

**Tasks:**
1. Архитектура VolumeTrader
2. Реализация random strategy:
   - Случайные интервалы
   - Случайные buy/sell
   - Варьирующиеся объемы
3. Управление volume кошельками:
   - Создание новых или использование existing
   - Ребалансировка SOL между ними
4. Основной trading loop
5. Graceful shutdown
6. CLI команды:
   - `volume start --config=volume.json`
   - `volume stop`
   - `volume stats`

**Deliverables:**
- Базовый volume trading bot
- Random strategy implementation

#### Week 5: Volume Trading - Part 2
**Goal:** Продвинутые стратегии и мониторинг

**Tasks:**
1. Реализация pump strategy
2. Реализация stabilize strategy
3. Статистика и analytics:
   - Total volume
   - Buy/sell ratio
   - Average trade size
   - Price impact
4. Persistence:
   - Сохранение состояния
   - Восстановление после сбоев
5. Safety features:
   - Минимальные резервы SOL
   - Circuit breakers при аномалиях
   - Rate limiting
6. Тестирование стратегий на devnet

**Deliverables:**
- Полнофункциональный volume trader
- Множественные стратегии
- Robust error handling

#### Week 6: Platform Monetization Foundation
**Goal:** Подготовка к фиче 5 - монетизации

**Tasks:**
1. Реализация FeeCalculator
2. Интеграция комиссий в bundle
3. Tier system для разных пользователей
4. Whitelist mechanism
5. Статистика по комиссиям
6. CLI флаги:
   - `--fee-enabled`
   - `--fee-percentage=N`
   - `--fee-wallet=ADDRESS`
7. Dashboard для tracking комиссий (простой CLI вывод)

**Deliverables:**
- Fee system готов к использованию
- Конфигурация тарифов

---

### Phase 3: Public Platform (Weeks 7-12+)

#### Weeks 7-8: Web Backend
**Tasks:**
1. Express.js API setup
2. User authentication (JWT)
3. Database schema (PostgreSQL)
4. REST API endpoints:
   - `/auth/register`, `/auth/login`
   - `/wallet/create`, `/wallet/list`
   - `/launch/create`, `/launch/status/:id`
   - `/sell/execute`
   - `/volume/start`, `/volume/stop`
5. Background jobs (BullMQ):
   - Launch execution
   - Volume trading
   - Monitoring
6. Rate limiting и security
7. Payment integration (Stripe or crypto payments)

#### Weeks 9-10: Web Frontend
**Tasks:**
1. React/Next.js setup
2. UI components:
   - Dashboard
   - Wallet management
   - Launch configuration wizard
   - Live monitoring
   - Statistics/Analytics
3. Web3 wallet integration (Phantom, Solflare)
4. Real-time updates (WebSockets)

#### Weeks 11-12: Testing & Deployment
**Tasks:**
1. Security audit
2. Load testing
3. Bug fixes
4. Production deployment:
   - Cloud hosting (AWS/GCP)
   - CI/CD pipeline
   - Monitoring (Sentry, DataDog)
5. Documentation для пользователей
6. Marketing и launch

**Deliverables:**
- Production-ready SaaS platform
- Public beta

---

## 7. Risk Management

### 7.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Jito bundle rejection | High | High | Retry logic, увеличение tip, fallback на обычные транзакции |
| Pumpfun program changes | Medium | High | Мониторинг updates, версионирование, тесная связь с community |
| RPC node failures | High | Medium | Multiple RPC endpoints, automatic failover |
| Network congestion | Medium | Medium | Dynamic fee adjustment, приоритизация через Jito |
| Wallet compromise | Low | Critical | Strong encryption, best practices documentation |

### 7.2 Business Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Regulatory issues | Medium | High | Legal consultation, KYC/AML для public версии |
| Competition | High | Medium | Первыми на рынок, лучший UX, конкурентные цены |
| Market downturn | Medium | Medium | Диверсификация revenue streams |
| Reputation damage | Low | High | Quality assurance, customer support, transparency |

### 7.3 Operational Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| User errors (lost keys) | High | Medium | Backup reminders, recovery mechanisms |
| Support load | Medium | Medium | Good documentation, automated support |
| Infrastructure costs | Medium | Medium | Optimize RPC usage, caching, efficient architecture |

---

## 8. Success Criteria

### Phase 1 (MVP) Success:
- ✅ Успешный запуск 5 токенов на devnet без ошибок
- ✅ Bundle success rate > 90% на devnet
- ✅ Полная документация и примеры
- ✅ Все unit и integration тесты passing

### Phase 2 Success:
- ✅ 3+ beta пользователя успешно используют платформу
- ✅ Volume trading работает 24/7 без crashes
- ✅ Positive feedback от early adopters

### Phase 3 Success:
- ✅ 100+ registered users
- ✅ 50+ successful token launches
- ✅ $5K+ MRR from fees
- ✅ Security audit passed
- ✅ 99.9% uptime

---

## 9. Appendix

### 9.1 Glossary

- **Bundle**: Набор транзакций, отправляемых атомарно через Jito
- **Main Wallet**: Основной кошелек для хранения средств
- **Dev Wallet**: Кошелек разработчика, с которого создается токен
- **Buyer Wallets**: Множество кошельков для покупки токена при запуске
- **Volume Wallets**: Кошельки для генерации торговых объемов
- **Pumpfun**: Платформа для запуска токенов на Solana
- **Jito**: MEV infrastructure для Solana, позволяет отправлять bundles
- **Slippage**: Разница между ожидаемой и фактической ценой исполнения

### 9.2 References

- Solana Documentation: https://docs.solana.com
- Jito Labs: https://jito.wtf
- Pumpfun: [Platform specific docs]
- Metaplex Token Metadata: https://docs.metaplex.com

### 9.3 Change Log

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2025-11-18 | Initial PRD | Claude |

---

**Document Status:** ✅ Ready for Review
**Next Steps:** Review PRD → Finalize architecture → Begin Phase 1 implementation

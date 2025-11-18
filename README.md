# Solana Token Launch Bundler

Автоматизированная платформа для запуска токенов на Pump.fun в сети Solana с использованием Jito bundles для атомарного выполнения транзакций.

## 🎯 Проблема

При запуске токенов на Pump.fun существует проблема "снайперов" - ботов, которые мгновенно скупают новые токены между транзакцией создания и первыми покупками разработчика. Это приводит к потере контроля над распределением токенов и возможности манипуляций ценой.

## ✨ Решение

Использование **Jito bundles** для атомарного выполнения всех транзакций (создание токена + покупки с множества кошельков) гарантирует, что никакие внешние транзакции не попадут между нашими операциями.

## 🚀 Ключевые возможности

### Phase 1: CLI Application ✅ ЗАВЕРШЕНО
- ✅ **Wallet Management** - Безопасное управление множественными кошельками с AES-256 шифрованием
- ✅ **Fund Distribution** - Автоматическое распределение SOL между кошельками
- ✅ **Atomic Launch** - Создание токена и покупки в одном bundle через Jito
- ✅ **Token Selling** - Продажа токенов с dev и buyer кошельков (3 режима)
- ✅ **Real Pumpfun Integration** - Использование реального IDL программы Pumpfun
- ✅ **Production Jito Integration** - Официальный jito-ts SDK v4.2.0 с gRPC
- ✅ **Bundle Simulation** - Проверка bundle перед отправкой
- ✅ **Bundle Status Tracking** - Real-time отслеживание статуса через onBundleResult

### Phase 2: Advanced Features (Планируется)
- 📈 **Volume Trading** - Автоматическая генерация торговых объемов
- 🤖 **Smart Selling Strategies** - DELAY, SMART, AUTO sell modes
- 📊 **Price Monitoring** - Мониторинг цены на bonding curve для автоматических продаж

### Phase 3: Public Platform (Будущее)
- 💻 **Web Interface** - Удобный UI для нетехнических пользователей
- 💵 **Platform Fees** - Монетизация через комиссии
- 📊 **Analytics Dashboard** - Детальная статистика запусков

## 💻 CLI Команды

### Управление кошельками
```bash
# Создать коллекцию кошельков
solana-bundler wallet create -b 10 --dev-amount 0.1 --buyer-amount 0.05

# Загрузить кошельки
solana-bundler wallet load -w ./wallets/launch-wallets.json

# Распределить SOL между кошельками
solana-bundler wallet fund -w ./wallets/launch-wallets.json

# Проверить балансы
solana-bundler wallet balances -w ./wallets/launch-wallets.json
```

### Запуск токена
```bash
# Запустить токен (интерактивный режим)
solana-bundler launch create -w ./wallets/launch-wallets.json

# Dry run (симуляция без отправки)
solana-bundler launch dry-run -w ./wallets/launch-wallets.json
```

### Продажа токенов
```bash
# Продать со всех buyer кошельков через bundle
solana-bundler sell all -m <MINT_ADDRESS> -w ./wallets/launch-wallets.json -p 100

# Продать с dev кошелька
solana-bundler sell dev -m <MINT_ADDRESS> -w ./wallets/launch-wallets.json -p 50

# Продать с конкретного buyer кошелька
solana-bundler sell buyer -i 1 -m <MINT_ADDRESS> -w ./wallets/launch-wallets.json
```

## 📚 Документация

- **[PRD.md](./PRD.md)** - Product Requirements Document (полная спецификация)
- **[COMPETITIVE_ANALYSIS.md](./COMPETITIVE_ANALYSIS.md)** - Анализ существующих решений
- **[IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)** - Детальный план реализации
- **[docs/LUT_ANALYSIS.md](./docs/LUT_ANALYSIS.md)** - Анализ необходимости Address Lookup Tables

## 🏗️ Архитектура

### Technology Stack

```
Runtime: Node.js 18+
Language: TypeScript 5+
Framework: Commander.js (CLI)

Core Dependencies:
├── @solana/web3.js v1.87.6   # Solana blockchain interaction
├── @solana/spl-token         # SPL token operations
├── @coral-xyz/anchor v0.29.0 # Anchor framework
├── jito-ts v4.2.0            # Official Jito SDK (gRPC)
├── crypto-js                 # AES-256 encryption
├── inquirer, chalk, ora      # CLI UI
└── winston                   # Logging

Testing:
├── jest                      # Testing framework
└── ts-jest                   # TypeScript support
```

### Project Structure

```
solana-bundler/
├── src/
│   ├── core/
│   │   ├── wallet-manager.ts    # Wallet generation & management
│   │   ├── encryption.ts        # AES-256 encryption
│   │   └── fund-distributor.ts  # SOL distribution
│   ├── services/
│   │   ├── pumpfun.ts          # Pumpfun program integration
│   │   ├── jito.ts             # Jito bundle service
│   │   └── token-launcher.ts   # Token launch orchestration
│   ├── cli/
│   │   ├── index.ts            # Main CLI entry point
│   │   └── commands/
│   │       ├── wallet.ts       # Wallet commands
│   │       ├── launch.ts       # Launch commands
│   │       └── sell.ts         # Sell commands
│   ├── types/                  # TypeScript definitions
│   └── utils/                  # Logger & utilities
├── idl/
│   └── pump.json               # Pumpfun IDL (official)
├── docs/
│   └── LUT_ANALYSIS.md         # LUT necessity analysis
└── tests/                      # Jest unit tests
```

## 🔍 Ключевые технические решения

### 1. Real Pumpfun Integration
- Использование официального IDL программы Pumpfun
- Правильные discriminators для всех инструкций
- Proper PDA derivation (global, mintAuthority, bondingCurve, metadata)
- Anchor string encoding (4-byte length prefix)

### 2. Production Jito Integration
- Официальный jito-ts SDK v4.2.0 с gRPC
- SearcherClient без auth keypair (публичный доступ)
- Real-time bundle status tracking через onBundleResult stream
- Bundle simulation перед отправкой
- Comprehensive error handling с детализацией rejection reasons

### 3. Security
- AES-256 encryption с PBKDF2 key derivation
- Случайные соли для каждой операции шифрования
- Локальное хранение (ключи не покидают машину)
- Secure wallet collection management

### 4. Testing
- 26 unit tests (100% pass rate)
- Coverage для wallet management и encryption
- Automated testing pipeline

## 📊 Success Metrics

### Phase 1 (MVP) ✅ ЗАВЕРШЕНО
- ✅ Real Pumpfun integration с actual IDL
- ✅ Production Jito integration с jito-ts SDK
- ✅ Wallet management с AES-256 encryption
- ✅ Token selling (3 режима: all, dev, buyer)
- ✅ CLI commands для всех операций
- ✅ 26 unit tests passing
- ⏳ Bundle success rate > 95% (требует mainnet testing)
- ⏳ Simulation accuracy > 99% (требует mainnet testing)

## 🛣️ Roadmap

### ✅ Phase 1: MVP (Завершено)
- [x] Research & Planning
- [x] Competitive Analysis
- [x] PRD & Implementation Plan
- [x] Project Setup
- [x] Wallet Management (generation, encryption, fund distribution)
- [x] Pumpfun Integration (real IDL, proper discriminators)
- [x] Jito Integration (jito-ts SDK, bundle submission, status tracking)
- [x] Token Launcher (atomic bundle execution)
- [x] Token Selling (all/dev/buyer modes)
- [x] CLI Commands (wallet, launch, sell)
- [x] Unit Testing (26 tests)
- [x] Documentation

### 🔄 Phase 2: Advanced Features (В планировании)
- [ ] Volume Trading - автоматическая генерация торговых объемов
- [ ] Smart Selling Strategies - DELAY, SMART, AUTO modes
- [ ] Price Monitoring - мониторинг bonding curve для auto-sell
- [ ] Mainnet Testing - полноценное тестирование на mainnet
- [ ] Performance Optimization - улучшение скорости и надежности

## 🔗 Resources

### Official Documentation
- [Jito Documentation](https://jito-labs.gitbook.io/mev/)
- [Pump.fun Public Docs](https://github.com/pump-fun/pump-public-docs)
- [Solana Documentation](https://docs.solana.com)
- [Anchor Documentation](https://book.anchor-lang.com/)

### Repositories Analyzed
- [jito-labs/jito-js-rpc](https://github.com/jito-labs/jito-js-rpc) - Official Jito SDK
- [jito-labs/mev-bot](https://github.com/jito-labs/mev-bot) - Reference implementation
- [cicere/pumpfun-bundler](https://github.com/cicere/pumpfun-bundler) - 99.7% success rate
- [Rabnail-SOL/Solana-PumpFun-Bundler](https://github.com/Rabnail-SOL/Solana-PumpFun-Bundler) - LUT approach

### Community
- Jito Discord: https://discord.gg/jTSmEzaR
- Solana Discord: https://discord.gg/solana

## ⚠️ Disclaimer

Этот инструмент предназначен для образовательных целей и личного использования. Убедитесь, что вы соблюдаете все применимые законы и правила при запуске токенов.

## 📄 License

MIT License - see LICENSE file for details

---

**Status:** ✅ Phase 1 (MVP) Complete | 🔄 Phase 2 Planning

**Version:** 0.1.0

**Last Updated:** 2025-11-18

## 🎯 Что дальше?

**Phase 1 полностью завершен!** Все core features реализованы и протестированы.

**Следующие шаги:**
1. **Mainnet Testing** - тестирование на реальной сети для валидации успешности bundles
2. **Phase 2 Planning** - детальное планирование Volume Trading и Smart Selling
3. **Performance Tuning** - оптимизация скорости и надежности

Присоединяйтесь к нам в Discord для обсуждения дальнейшего развития!

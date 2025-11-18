# Solana Token Launch Bundler

Автоматизированная платформа для запуска токенов на Pump.fun в сети Solana с использованием Jito bundles для атомарного выполнения транзакций.

## 🎯 Проблема

При запуске токенов на Pump.fun существует проблема "снайперов" - ботов, которые мгновенно скупают новые токены между транзакцией создания и первыми покупками разработчика. Это приводит к потере контроля над распределением токенов и возможности манипуляций ценой.

## ✨ Решение

Использование **Jito bundles** для атомарного выполнения всех транзакций (создание токена + покупки с множества кошельков) гарантирует, что никакие внешние транзакции не попадут между нашими операциями.

## 🚀 Ключевые возможности

### Phase 1: CLI Application (В разработке)
- 🔐 **Wallet Management** - Безопасное управление множественными кошельками с AES-256 шифрованием
- 💰 **Fund Distribution** - Автоматическое распределение SOL между кошельками
- 🎯 **Atomic Launch** - Создание токена и покупки в одном bundle через Jito
- 📊 **Token Selling** - Продажа токенов с dev и buyer кошельков
- 🔧 **LUT Optimization** - Address Lookup Tables для снижения overhead на 80%
- ✅ **Bundle Simulation** - Проверка bundle перед отправкой
- 🌍 **Regional Jito Endpoints** - Автоматический выбор оптимального endpoint

### Phase 2: Advanced Features (Планируется)
- 📈 **Volume Trading** - Автоматическая генерация торговых объемов
- 🤖 **Smart Selling Strategies** - DELAY, SMART, AUTO sell modes
- 🛡️ **Anti-Sniper Protection** - Защита от фронт-раннинга

### Phase 3: Public Platform (Будущее)
- 💻 **Web Interface** - Удобный UI для нетехнических пользователей
- 💵 **Platform Fees** - Монетизация через комиссии
- 📊 **Analytics Dashboard** - Детальная статистика запусков

## 📚 Документация

- **[PRD.md](./PRD.md)** - Product Requirements Document (полная спецификация)
- **[COMPETITIVE_ANALYSIS.md](./COMPETITIVE_ANALYSIS.md)** - Анализ существующих решений
- **[IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)** - Детальный план реализации (3 недели)

## 🏗️ Архитектура

### Technology Stack

```
Runtime: Node.js 18+ / Bun
Language: TypeScript 5+
Framework: Commander.js (CLI)

Core Dependencies:
├── @solana/web3.js        # Solana blockchain interaction
├── @solana/spl-token      # SPL token operations
├── @coral-xyz/anchor      # Pumpfun program integration
├── jito-js                # Official Jito SDK (CRITICAL)
├── bs58, tweetnacl        # Cryptography
├── inquirer, chalk, ora   # CLI UI
└── winston                # Logging
```

### Project Structure (Planned)

```
solana-bundler/
├── src/
│   ├── core/
│   │   ├── wallet/        # Wallet management + LUT
│   │   ├── token/         # Token launching & selling
│   │   ├── jito/          # Jito bundle integration
│   │   ├── pumpfun/       # Pumpfun program (Anchor)
│   │   └── volume/        # Volume trading (Phase 2)
│   ├── cli/               # CLI commands
│   ├── config/            # Configuration
│   └── utils/             # Utilities
├── idl/
│   └── pump.json          # Pumpfun IDL (official)
├── config/
│   ├── jito-endpoints.json
│   └── lut-config.json
└── tests/
```

## 🔍 Ключевые технические решения

### 1. LUT (Lookup Tables) ⭐ КРИТИЧНО
- Снижает размер bundle на **80%**
- Обязательно для работы с 20+ кошельками
- Pre-создается в отдельной транзакции

### 2. Jito Bundle Integration
- Официальный `jito-js` SDK
- Bundle simulation перед отправкой
- Региональные endpoints для минимальной latency

### 3. Pumpfun IDL
- Официальный IDL из pump-public-docs
- Typed instructions через Anchor
- Поддержка всех features (create, buy, sell, migrate)

### 4. Security
- AES-256 encryption для приватных ключей
- Локальное хранение (ключи не покидают машину)
- Secure wallet export/import

## 📊 Success Metrics

### Phase 1 (MVP)
- ✅ Bundle success rate > 95%
- ✅ All bundles использует LUT (100%)
- ✅ Simulation accuracy > 99%
- ✅ 5+ successful launches на devnet
- ✅ 3+ successful launches на mainnet

## 🛣️ Roadmap

### Week 1: Foundation (Days 1-5)
- [x] Research & Planning
- [x] Competitive Analysis
- [x] PRD & Implementation Plan
- [ ] Project Setup
- [ ] Wallet Management + LUT

### Week 2: Core Features (Days 6-12)
- [ ] Pumpfun Integration (Anchor + IDL)
- [ ] Jito Integration (jito-js SDK)
- [ ] Bundle Building with LUT
- [ ] Token Launcher

### Week 3: Polish & Launch (Days 13-21)
- [ ] Token Selling
- [ ] CLI Commands
- [ ] Testing (devnet & mainnet)
- [ ] Documentation
- [ ] MVP Release

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

**Status:** 📝 Planning & Design Complete | 🏗️ Development Starting Soon

**Version:** 0.1.0-alpha

**Last Updated:** 2025-11-18

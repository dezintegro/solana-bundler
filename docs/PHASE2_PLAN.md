# Phase 2: Advanced Features - Implementation Plan

## 📋 Обзор

Phase 2 добавляет advanced функциональность для управления токеном после запуска:
- 📈 **Volume Trading** - генерация торговых объемов
- 🤖 **Smart Selling Strategies** - интеллектуальные стратегии продажи
- 📊 **Price Monitoring** - мониторинг цены на bonding curve

## 🎯 Цели Phase 2

1. **Создание активности** - генерация органично выглядящего торгового объема
2. **Оптимизация выхода** - максимизация прибыли через умные стратегии продажи
3. **Автоматизация** - минимизация ручного управления после запуска

## 📈 Feature 1: Volume Trading

### Концепция

Автоматическая генерация торговых объемов между buyer кошельками для создания активности токена и органичного роста цены.

### Компоненты

#### 1.1 Volume Trading Service (`src/services/volume-trading.ts`)

```typescript
interface VolumeConfig {
  // Паттерн торговли
  pattern: 'random' | 'waves' | 'pump' | 'organic';

  // Параметры частоты
  minDelaySeconds: number;      // Минимальная задержка между сделками
  maxDelaySeconds: number;      // Максимальная задержка

  // Параметры размера сделок
  minTradeAmountSOL: number;    // Минимальный размер сделки
  maxTradeAmountSOL: number;    // Максимальный размер сделки

  // Длительность
  durationMinutes: number;      // Длительность volume trading

  // Распределение
  walletRotation: 'sequential' | 'random';  // Как выбирать кошельки
  simultaneousTrades: number;    // Сколько сделок одновременно
}

interface TradeAction {
  type: 'buy' | 'sell';
  walletIndex: number;
  amountSOL: number;
  delayMs: number;
}
```

**Ключевые методы:**
- `generateTradePattern()` - генерация паттерна сделок
- `executeTrades()` - выполнение сделок по паттерну
- `monitorProgress()` - отслеживание прогресса

#### 1.2 Trading Patterns

**Random Pattern:**
- Случайные buy/sell в случайные моменты
- Имитация органической торговли
- Равномерное распределение между кошельками

**Waves Pattern:**
- Циклы накопления (больше buy) и распределения (больше sell)
- Создает волны на графике
- Постепенный рост цены

**Pump Pattern:**
- Агрессивные покупки для роста цены
- Минимум продаж
- Быстрый рост market cap

**Organic Pattern:**
- Максимально естественный паттерн
- Варьирующиеся размеры сделок
- Неравномерные интервалы

#### 1.3 CLI Commands

```bash
# Запустить volume trading
solana-bundler volume start \
  -m <MINT_ADDRESS> \
  -w ./wallets/launch-wallets.json \
  --pattern waves \
  --duration 60 \
  --min-trade 0.01 \
  --max-trade 0.1

# Статус текущего volume trading
solana-bundler volume status

# Остановить volume trading
solana-bundler volume stop
```

### Технические детали

**Challenges:**
1. Избежать detection паттернов (нужна randomization)
2. Управление SOL балансами кошельков
3. Rate limiting и Jito bundle limits

**Solutions:**
1. Использовать крипто-безопасный RNG для randomization
2. Tracking балансов и redistribution при необходимости
3. Intelligent batching в bundles (max 5 txs)

## 🤖 Feature 2: Smart Selling Strategies

### Концепция

Автоматические и полуавтоматические стратегии продажи для оптимизации прибыли.

### Sell Modes

#### 2.1 DELAY Mode

**Описание:** Продажа с задержкой после выполнения условий

```typescript
interface DelayConfig {
  // Условия запуска
  trigger: {
    type: 'time' | 'price' | 'marketcap' | 'manual';
    value?: number;  // Например, цена в SOL или marketcap
  };

  // Задержка
  delayMinutes: number;

  // Параметры продажи
  sellPercentage: number;        // Процент токенов для продажи
  wallets: 'all' | 'dev' | number[];  // Какие кошельки
}
```

**Примеры использования:**
- Продать 50% через 10 минут после запуска
- Продать все когда цена достигнет 0.001 SOL, с задержкой 5 минут
- Продать при marketcap $100k, задержка 15 минут

**CLI:**
```bash
solana-bundler sell delay \
  -m <MINT> \
  --trigger price \
  --target-price 0.001 \
  --delay 5 \
  --percentage 50 \
  --wallets all
```

#### 2.2 SMART Mode

**Описание:** Интеллектуальная продажа частями на разных ценовых уровнях

```typescript
interface SmartConfig {
  // Уровни продажи
  levels: Array<{
    price: number;           // Целевая цена
    percentage: number;      // Процент для продажи
    wallets: 'all' | 'dev' | number[];
  }>;

  // Настройки
  partialSell: boolean;      // Продавать частями или сразу
  spacing: number;           // Задержка между продажами (сек)
}
```

**Пример конфига:**
```json
{
  "levels": [
    { "price": 0.0005, "percentage": 25, "wallets": [1,2,3] },
    { "price": 0.001, "percentage": 25, "wallets": [4,5,6] },
    { "price": 0.002, "percentage": 30, "wallets": "all" },
    { "price": 0.005, "percentage": 20, "wallets": "dev" }
  ]
}
```

**CLI:**
```bash
# Загрузить конфиг из файла
solana-bundler sell smart \
  -m <MINT> \
  --config ./sell-strategy.json
```

#### 2.3 AUTO Mode

**Описание:** Полностью автоматическая продажа при достижении целевых метрик

```typescript
interface AutoConfig {
  // Цели
  targets: {
    targetPrice?: number;      // Целевая цена
    targetMarketCap?: number;  // Целевой marketcap
    targetProfit?: number;     // Целевая прибыль в SOL
  };

  // Действие при достижении
  action: 'sell-all' | 'sell-percentage' | 'custom';
  percentage?: number;

  // Stop loss
  stopLoss?: {
    enabled: boolean;
    price?: number;            // Цена для stop loss
    percentage?: number;       // Процент падения
  };
}
```

**CLI:**
```bash
# Auto sell при 10x прибыли
solana-bundler sell auto \
  -m <MINT> \
  --target-profit 10 \
  --action sell-all

# Auto sell с stop loss
solana-bundler sell auto \
  -m <MINT> \
  --target-price 0.01 \
  --stop-loss-price 0.0001 \
  --percentage 100
```

## 📊 Feature 3: Price Monitoring

### Концепция

Real-time мониторинг цены токена на bonding curve для триггеров продажи.

### Компоненты

#### 3.1 Price Monitor Service (`src/services/price-monitor.ts`)

```typescript
interface BondingCurveData {
  virtualSolReserves: bigint;
  virtualTokenReserves: bigint;
  realSolReserves: bigint;
  realTokenReserves: bigint;
  tokenTotalSupply: bigint;
  complete: boolean;
  creator: PublicKey;
}

interface PriceData {
  priceInSOL: number;
  marketCapSOL: number;
  marketCapUSD: number;
  virtualLiquidity: number;
  realLiquidity: number;
  timestamp: number;
}
```

**Ключевые методы:**
- `parseBondingCurve()` - парсинг bonding curve account
- `calculatePrice()` - вычисление текущей цены
- `subscribeToPrice()` - подписка на изменения цены
- `getPriceHistory()` - история цен

#### 3.2 Bonding Curve Formula

Константное произведение: `x * y = k`

```typescript
function calculatePrice(data: BondingCurveData): number {
  const solReserves = Number(data.virtualSolReserves);
  const tokenReserves = Number(data.virtualTokenReserves);

  // Цена = SOL reserves / Token reserves
  return solReserves / tokenReserves;
}

function calculateMarketCap(data: BondingCurveData, price: number): number {
  const supply = Number(data.tokenTotalSupply) / 1e6; // Adjust for decimals
  return supply * price;
}
```

#### 3.3 WebSocket Subscription

```typescript
// Подписка на изменения bonding curve
connection.onAccountChange(
  bondingCurveAddress,
  (accountInfo) => {
    const data = parseBondingCurve(accountInfo.data);
    const price = calculatePrice(data);

    // Trigger callbacks
    priceCallbacks.forEach(cb => cb(price));
  },
  'confirmed'
);
```

#### 3.4 CLI Commands

```bash
# Мониторинг цены (real-time)
solana-bundler price watch -m <MINT>

# Получить текущую цену
solana-bundler price get -m <MINT>

# История цен
solana-bundler price history -m <MINT> --last 1h
```

## 🏗️ Architecture

### Service Layer

```
src/services/
├── volume-trading.ts      # Volume generation
├── sell-strategies.ts     # Smart selling
├── price-monitor.ts       # Price monitoring
└── scheduler.ts           # Task scheduling
```

### CLI Layer

```
src/cli/commands/
├── volume.ts              # volume start/stop/status
├── sell-advanced.ts       # delay/smart/auto modes
└── price.ts               # watch/get/history
```

### Data Storage

```
data/
├── volume-sessions/       # Active volume trading sessions
├── sell-strategies/       # Active sell strategies
└── price-history/         # Historical price data
```

## 📝 Implementation Tasks

### Task 1: Price Monitoring (5-7 hours)
- [ ] Bonding curve account parser
- [ ] Price calculation logic
- [ ] WebSocket subscription
- [ ] Price history storage
- [ ] CLI commands (watch, get, history)

### Task 2: Smart Selling (8-10 hours)
- [ ] DELAY mode implementation
- [ ] SMART mode with levels
- [ ] AUTO mode with targets
- [ ] Stop loss logic
- [ ] CLI commands for each mode
- [ ] Integration with price monitor

### Task 3: Volume Trading (10-12 hours)
- [ ] Trade pattern generators (random, waves, pump, organic)
- [ ] Trade execution engine
- [ ] Wallet balance management
- [ ] Progress monitoring
- [ ] CLI commands (start, stop, status)
- [ ] Safety limits and validations

### Task 4: Testing & Polish (5-7 hours)
- [ ] Unit tests для всех компонентов
- [ ] Integration tests
- [ ] Devnet testing
- [ ] Documentation
- [ ] Error handling improvements

**Total: 28-36 hours (~1.5-2 weeks)**

## 🎯 Success Criteria

- ✅ Volume trading создает organic-looking активность
- ✅ Smart selling выполняется на правильных уровнях
- ✅ Price monitoring работает real-time с <1s latency
- ✅ Все стратегии имеют safety limits
- ✅ CLI удобный и интуитивный
- ✅ 90%+ code coverage в тестах

## ⚠️ Risks & Mitigations

### Risk 1: Detection паттернов volume trading
**Mitigation:** Высокая randomization, варьирование размеров и времени

### Risk 2: Неточность price calculation
**Mitigation:** Использовать официальную формулу bonding curve, тестировать на известных токенах

### Risk 3: Потеря средств при auto-sell
**Mitigation:** Обязательный dry-run mode, confirmation prompts, safety limits

### Risk 4: WebSocket disconnects
**Mitigation:** Auto-reconnect logic, fallback на polling, state recovery

## 🔗 Dependencies

- ✅ Phase 1 (wallet management, pumpfun, jito) - **Completed**
- ⏳ SOL price feed для USD calculations
- ⏳ Persistent storage для sessions/history

## 📊 Metrics

Отслеживаем:
- Volume generated (SOL)
- Number of trades executed
- Average price improvement from smart selling
- Uptime price monitoring service
- Error rate для каждого компонента

---

**Status:** 📋 Planning Complete | Ready for Implementation

**Estimated Timeline:** 1.5-2 weeks

**Priority:** High

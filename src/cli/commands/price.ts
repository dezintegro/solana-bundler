import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { Connection, PublicKey } from '@solana/web3.js';
import { PriceMonitorService, PriceChangeEvent } from '../../services/price-monitor';

export const priceCommand = new Command('price')
  .description('Price monitoring commands')
  .addCommand(watchPriceCommand())
  .addCommand(getCurrentPriceCommand());

/**
 * Watch price in real-time
 */
function watchPriceCommand() {
  return new Command('watch')
    .description('Watch token price in real-time')
    .requiredOption('-m, --mint <address>', 'Token mint address')
    .option('-n, --network <network>', 'Solana network (mainnet-beta, devnet, testnet)', 'mainnet-beta')
    .option('--rpc <url>', 'Custom RPC URL (optional)')
    .option('--sol-price <price>', 'SOL price in USD for conversion (optional)')
    .action(async (options) => {
      try {
        const mint = new PublicKey(options.mint);

        console.log(chalk.blue.bold('\n📊 Real-Time Price Monitoring\n'));
        console.log(chalk.gray(`Mint: ${mint.toBase58()}`));
        console.log(chalk.gray(`Network: ${options.network}\n`));

        // Create connection
        const rpcUrl =
          options.rpc ||
          (options.network === 'mainnet-beta'
            ? process.env['RPC_URL'] || 'https://api.mainnet-beta.solana.com'
            : `https://api.${options.network}.solana.com`);

        const connection = new Connection(rpcUrl, 'confirmed');
        const priceMonitor = new PriceMonitorService(connection);

        // Set SOL price if provided
        if (options.solPrice) {
          priceMonitor.setSolPriceUSD(parseFloat(options.solPrice));
        }

        // Get initial price
        const spinner = ora('Fetching initial price...').start();
        const initialPrice = await priceMonitor.getCurrentPrice(mint);
        spinner.succeed('Connected');

        console.log(chalk.green('\n📈 Initial Price:'));
        displayPriceData(initialPrice);

        console.log(chalk.yellow('\n👀 Watching for price changes (Press Ctrl+C to stop)...\n'));

        // Subscribe to price changes
        priceMonitor.subscribeToPrice(mint, (event: PriceChangeEvent) => {
          displayPriceChange(event);
        });

        // Handle graceful shutdown
        process.on('SIGINT', () => {
          console.log(chalk.yellow('\n\n⏹️  Stopping price monitor...'));
          priceMonitor.unsubscribeAll();
          process.exit(0);
        });

        // Keep process alive
        await new Promise(() => {});
      } catch (error) {
        console.log(chalk.red(`\n❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
        process.exit(1);
      }
    });
}

/**
 * Get current price (one-time)
 */
function getCurrentPriceCommand() {
  return new Command('get')
    .description('Get current token price')
    .requiredOption('-m, --mint <address>', 'Token mint address')
    .option('-n, --network <network>', 'Solana network (mainnet-beta, devnet, testnet)', 'mainnet-beta')
    .option('--rpc <url>', 'Custom RPC URL (optional)')
    .option('--sol-price <price>', 'SOL price in USD for conversion (optional)')
    .action(async (options) => {
      try {
        const mint = new PublicKey(options.mint);

        console.log(chalk.blue.bold('\n📊 Token Price\n'));

        // Create connection
        const rpcUrl =
          options.rpc ||
          (options.network === 'mainnet-beta'
            ? process.env['RPC_URL'] || 'https://api.mainnet-beta.solana.com'
            : `https://api.${options.network}.solana.com`);

        const connection = new Connection(rpcUrl, 'confirmed');
        const priceMonitor = new PriceMonitorService(connection);

        // Set SOL price if provided
        if (options.solPrice) {
          priceMonitor.setSolPriceUSD(parseFloat(options.solPrice));
        }

        // Get price
        const spinner = ora('Fetching price...').start();
        const priceData = await priceMonitor.getCurrentPrice(mint);
        spinner.succeed('Price fetched');

        console.log('');
        displayPriceData(priceData);
        console.log('');
      } catch (error) {
        console.log(chalk.red(`\n❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
        process.exit(1);
      }
    });
}

/**
 * Display price data
 */
function displayPriceData(data: any): void {
  console.log(chalk.bold('Price:'));
  console.log(`  ${chalk.green(data.priceInSOL.toFixed(9))} SOL`);
  if (data.priceInUSD) {
    console.log(`  ${chalk.green(`$${data.priceInUSD.toFixed(6)}`)} USD`);
  }

  console.log(chalk.bold('\nMarket Cap:'));
  console.log(`  ${chalk.cyan(data.marketCapSOL.toFixed(4))} SOL`);
  if (data.marketCapUSD) {
    console.log(`  ${chalk.cyan(`$${data.marketCapUSD.toLocaleString()}`)} USD`);
  }

  console.log(chalk.bold('\nLiquidity:'));
  console.log(`  Virtual: ${chalk.yellow(data.virtualLiquidity.toFixed(4))} SOL`);
  console.log(`  Real: ${chalk.yellow(data.realLiquidity.toFixed(4))} SOL`);
}

/**
 * Display price change event
 */
function displayPriceChange(event: PriceChangeEvent): void {
  const timestamp = new Date(event.timestamp).toLocaleTimeString();
  const changeColor = event.priceChange >= 0 ? chalk.green : chalk.red;
  const arrow = event.priceChange >= 0 ? '↑' : '↓';

  console.log(
    `${chalk.gray(timestamp)} ${arrow} ${changeColor(event.newPrice.toFixed(9))} SOL ` +
      `${changeColor(`(${event.priceChangePercent >= 0 ? '+' : ''}${event.priceChangePercent.toFixed(2)}%)`)}`
  );
}

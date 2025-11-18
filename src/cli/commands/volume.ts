import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { Connection, PublicKey } from '@solana/web3.js';
import {
  VolumeTradingService,
  VolumeConfig,
  TradingPattern,
  WalletRotation,
} from '../../services/volume-trading';
import { PumpfunService } from '../../services/pumpfun';
import { JitoService } from '../../services/jito';
import { EncryptionService } from '../../core/encryption';
import { JitoConfig } from '../../types';
import { JITO_TIP_ACCOUNTS } from '../../services/jito';

// Store active sessions (in production, use persistent storage)
const sessionStore = new Map<string, string>();

export const volumeCommand = new Command('volume')
  .description('Volume trading commands')
  .addCommand(startVolumeCommand())
  .addCommand(stopVolumeCommand())
  .addCommand(statusVolumeCommand());

/**
 * Start volume trading session
 */
function startVolumeCommand() {
  return new Command('start')
    .description('Start volume trading session')
    .requiredOption('-m, --mint <address>', 'Token mint address')
    .requiredOption('-w, --wallets <path>', 'Path to wallet collection file')
    .option('--pattern <pattern>', 'Trading pattern (random, waves, pump, organic)', 'organic')
    .option('--duration <minutes>', 'Duration in minutes', '60')
    .option('--min-delay <seconds>', 'Minimum delay between trades', '30')
    .option('--max-delay <seconds>', 'Maximum delay between trades', '120')
    .option('--min-trade <sol>', 'Minimum trade amount in SOL', '0.01')
    .option('--max-trade <sol>', 'Maximum trade amount in SOL', '0.1')
    .option('--rotation <type>', 'Wallet rotation (sequential, random)', 'random')
    .option('--simultaneous <count>', 'Simultaneous trades (max 5)', '3')
    .option('-n, --network <network>', 'Solana network (mainnet-beta, devnet, testnet)', 'mainnet-beta')
    .option('--rpc <url>', 'Custom RPC URL (optional)')
    .action(async (options) => {
      try {
        const mint = new PublicKey(options.mint);

        console.log(chalk.blue.bold('\n📈 Starting Volume Trading Session\n'));
        console.log(chalk.gray(`Mint: ${mint.toBase58()}`));
        console.log(chalk.gray(`Pattern: ${options.pattern}`));
        console.log(chalk.gray(`Duration: ${options.duration} minutes`));
        console.log(chalk.gray(`Trade range: ${options.minTrade} - ${options.maxTrade} SOL\n`));

        // Validate pattern
        const validPatterns: TradingPattern[] = ['random', 'waves', 'pump', 'organic'];
        if (!validPatterns.includes(options.pattern as TradingPattern)) {
          throw new Error(
            `Invalid pattern: ${options.pattern}. Must be one of: ${validPatterns.join(', ')}`
          );
        }

        // Confirm with user and get password
        const answers = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'Start volume trading session?',
            default: false,
          },
          {
            type: 'password',
            name: 'password',
            message: 'Enter wallet collection password:',
            when: (answers) => answers.confirm,
          },
        ]);

        if (!answers.confirm) {
          console.log(chalk.yellow('\n❌ Cancelled'));
          return;
        }

        // Load wallets
        const spinner = ora('Loading wallets...').start();
        const walletCollection = await EncryptionService.loadFromFile(options.wallets, answers.password);
        spinner.succeed(`Loaded ${walletCollection.buyers.length} buyer wallets`);

        // Create connection
        const rpcUrl =
          options.rpc ||
          (options.network === 'mainnet-beta'
            ? process.env['RPC_URL'] || 'https://api.mainnet-beta.solana.com'
            : `https://api.${options.network}.solana.com`);

        const connection = new Connection(rpcUrl, 'confirmed');

        // Initialize services
        spinner.start('Initializing services...');
        const pumpfun = new PumpfunService(connection);

        const tipAccount = JITO_TIP_ACCOUNTS[0];
        if (!tipAccount) {
          throw new Error('No Jito tip accounts available');
        }

        const jitoConfig: JitoConfig = {
          blockEngineUrl: process.env['JITO_BLOCK_ENGINE_URL'] || 'frankfurt.mainnet.block-engine.jito.wtf',
          tipAccount,
          tipLamports: 1000, // Small tip for volume trading
        };

        const jito = new JitoService(connection, jitoConfig);
        const volumeTrading = new VolumeTradingService(connection, pumpfun, jito);
        spinner.succeed('Services initialized');

        // Build config
        const config: VolumeConfig = {
          pattern: options.pattern as TradingPattern,
          minDelaySeconds: parseInt(options.minDelay),
          maxDelaySeconds: parseInt(options.maxDelay),
          minTradeAmountSOL: parseFloat(options.minTrade),
          maxTradeAmountSOL: parseFloat(options.maxTrade),
          durationMinutes: parseInt(options.duration),
          walletRotation: options.rotation as WalletRotation,
          simultaneousTrades: Math.min(parseInt(options.simultaneous), 5),
        };

        // Start session
        spinner.start('Starting volume trading session...');
        const sessionId = await volumeTrading.startSession(mint, config, walletCollection);
        spinner.succeed('Session started!');

        // Save session ID
        sessionStore.set('latest', sessionId);

        console.log(chalk.green(`\n✅ Volume trading session started`));
        console.log(chalk.cyan(`Session ID: ${sessionId}`));
        console.log(chalk.gray(`\nUse 'volume status' to check progress`));
        console.log(chalk.gray(`Use 'volume stop' to stop the session\n`));
      } catch (error) {
        console.log(chalk.red(`\n❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
        process.exit(1);
      }
    });
}

/**
 * Stop volume trading session
 */
function stopVolumeCommand() {
  return new Command('stop')
    .description('Stop active volume trading session')
    .option('-s, --session <id>', 'Session ID (optional, uses latest if not provided)')
    .option('-n, --network <network>', 'Solana network (mainnet-beta, devnet, testnet)', 'mainnet-beta')
    .option('--rpc <url>', 'Custom RPC URL (optional)')
    .action(async (options) => {
      try {
        const sessionId = options.session || sessionStore.get('latest');

        if (!sessionId) {
          throw new Error('No active session found. Please provide session ID with -s option');
        }

        console.log(chalk.blue.bold('\n⏹️  Stopping Volume Trading Session\n'));
        console.log(chalk.gray(`Session ID: ${sessionId}\n`));

        // Create connection
        const spinner = ora('Initializing...').start();
        const rpcUrl =
          options.rpc ||
          (options.network === 'mainnet-beta'
            ? process.env['RPC_URL'] || 'https://api.mainnet-beta.solana.com'
            : `https://api.${options.network}.solana.com`);

        const connection = new Connection(rpcUrl, 'confirmed');

        // Initialize services
        const pumpfun = new PumpfunService(connection);

        const tipAccount = JITO_TIP_ACCOUNTS[0];
        if (!tipAccount) {
          throw new Error('No Jito tip accounts available');
        }

        const jitoConfig: JitoConfig = {
          blockEngineUrl: process.env['JITO_BLOCK_ENGINE_URL'] || 'frankfurt.mainnet.block-engine.jito.wtf',
          tipAccount,
          tipLamports: 1000,
        };

        const jito = new JitoService(connection, jitoConfig);
        const volumeTrading = new VolumeTradingService(connection, pumpfun, jito);

        spinner.text = 'Stopping session...';
        const stopped = volumeTrading.stopSession(sessionId);

        if (stopped) {
          spinner.succeed('Session stopped');
          console.log(chalk.green('\n✅ Volume trading session stopped\n'));
        } else {
          spinner.fail('Session not found or already stopped');
          console.log(chalk.yellow('\n⚠️  Session not found or already stopped\n'));
        }
      } catch (error) {
        console.log(chalk.red(`\n❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
        process.exit(1);
      }
    });
}

/**
 * Check volume trading session status
 */
function statusVolumeCommand() {
  return new Command('status')
    .description('Check volume trading session status')
    .option('-s, --session <id>', 'Session ID (optional, uses latest if not provided)')
    .option('-n, --network <network>', 'Solana network (mainnet-beta, devnet, testnet)', 'mainnet-beta')
    .option('--rpc <url>', 'Custom RPC URL (optional)')
    .action(async (options) => {
      try {
        const sessionId = options.session || sessionStore.get('latest');

        if (!sessionId) {
          throw new Error('No active session found. Please provide session ID with -s option');
        }

        console.log(chalk.blue.bold('\n📊 Volume Trading Session Status\n'));

        // Create connection
        const spinner = ora('Loading...').start();
        const rpcUrl =
          options.rpc ||
          (options.network === 'mainnet-beta'
            ? process.env['RPC_URL'] || 'https://api.mainnet-beta.solana.com'
            : `https://api.${options.network}.solana.com`);

        const connection = new Connection(rpcUrl, 'confirmed');

        // Initialize services
        const pumpfun = new PumpfunService(connection);

        const tipAccount = JITO_TIP_ACCOUNTS[0];
        if (!tipAccount) {
          throw new Error('No Jito tip accounts available');
        }

        const jitoConfig: JitoConfig = {
          blockEngineUrl: process.env['JITO_BLOCK_ENGINE_URL'] || 'frankfurt.mainnet.block-engine.jito.wtf',
          tipAccount,
          tipLamports: 1000,
        };

        const jito = new JitoService(connection, jitoConfig);
        const volumeTrading = new VolumeTradingService(connection, pumpfun, jito);

        spinner.text = 'Fetching session status...';
        const status = volumeTrading.getSession(sessionId);

        if (!status) {
          spinner.fail('Session not found');
          console.log(chalk.yellow('\n⚠️  Session not found\n'));
          return;
        }

        spinner.succeed('Status loaded');

        // Display status
        console.log(chalk.bold('\nSession Information:'));
        console.log(`  ID: ${chalk.cyan(status.id)}`);
        console.log(`  Mint: ${chalk.cyan(status.mint.toBase58())}`);
        console.log(`  Pattern: ${chalk.cyan(status.pattern)}`);
        console.log(`  Status: ${status.active ? chalk.green('Active') : chalk.gray('Completed')}`);

        console.log(chalk.bold('\nProgress:'));
        console.log(`  Trades Executed: ${chalk.yellow(status.tradesExecuted)}`);
        console.log(`  Total Volume: ${chalk.yellow(status.totalVolume.toFixed(4))} SOL`);
        console.log(`  Errors: ${status.errors > 0 ? chalk.red(status.errors) : chalk.green(status.errors)}`);

        console.log(chalk.bold('\nTiming:'));
        const startDate = new Date(status.startTime);
        console.log(`  Started: ${chalk.gray(startDate.toLocaleString())}`);

        if (status.endTime) {
          const endDate = new Date(status.endTime);
          const durationMs = status.endTime - status.startTime;
          const durationMin = Math.floor(durationMs / 60000);
          console.log(`  Ended: ${chalk.gray(endDate.toLocaleString())}`);
          console.log(`  Duration: ${chalk.gray(`${durationMin} minutes`)}`);
        } else {
          const elapsedMs = Date.now() - status.startTime;
          const elapsedMin = Math.floor(elapsedMs / 60000);
          console.log(`  Elapsed: ${chalk.gray(`${elapsedMin} minutes`)}`);
        }

        console.log('');
      } catch (error) {
        console.log(chalk.red(`\n❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
        process.exit(1);
      }
    });
}

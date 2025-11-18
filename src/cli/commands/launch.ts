import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { Connection } from '@solana/web3.js';
import { EncryptionService } from '../../core/encryption';
import { TokenLauncherService } from '../../services/token-launcher';
import { LaunchConfig, JitoConfig } from '../../types';
import { JITO_TIP_ACCOUNTS } from '../../services/jito';
import path from 'path';

export const launchCommand = new Command('launch')
  .description('Token launch commands')
  .addCommand(createLaunchCommand())
  .addCommand(dryRunCommand());

/**
 * Launch token command
 */
function createLaunchCommand() {
  return new Command('create')
    .description('Launch a new token with bundled buys')
    .option('-w, --wallets <path>', 'Path to wallet collection file', './wallets/launch-wallets.json')
    .option('-n, --network <network>', 'Solana network (mainnet-beta, devnet, testnet)', 'mainnet-beta')
    .option('--rpc <url>', 'Custom RPC URL (optional)')
    .option('--jito-block-engine <url>', 'Jito block engine URL', 'https://mainnet.block-engine.jito.wtf')
    .action(async (options) => {
      try {
        console.log(chalk.blue.bold('\n🚀 Token Launch\n'));

        // Load wallets
        const walletsPath = path.resolve(options.wallets);
        const { password } = await inquirer.prompt([
          {
            type: 'password',
            name: 'password',
            message: 'Enter wallet encryption password:',
          },
        ]);

        const spinner = ora('Loading wallets...').start();
        const walletCollection = await EncryptionService.loadFromFile(walletsPath, password);
        spinner.succeed(`Loaded ${walletCollection.buyers.length} buyer wallets`);

        // Prompt for token metadata
        console.log(chalk.blue('\n📋 Token Metadata'));
        const metadata = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Token name:',
            validate: (input) => input.length > 0 || 'Name is required',
          },
          {
            type: 'input',
            name: 'symbol',
            message: 'Token symbol:',
            validate: (input) => input.length > 0 || 'Symbol is required',
          },
          {
            type: 'input',
            name: 'description',
            message: 'Token description:',
            default: '',
          },
          {
            type: 'input',
            name: 'imageUrl',
            message: 'Token image URL (IPFS/Arweave):',
            default: '',
          },
        ]);

        // Prompt for launch parameters
        console.log(chalk.blue('\n⚙️  Launch Parameters'));
        const launchParams = await inquirer.prompt([
          {
            type: 'number',
            name: 'buyAmount',
            message: 'Buy amount per wallet (SOL):',
            default: 0.01,
            validate: (input) => input > 0 || 'Buy amount must be positive',
          },
          {
            type: 'number',
            name: 'jitoTip',
            message: 'Jito tip amount (SOL):',
            default: 0.001,
            validate: (input) => input > 0 || 'Tip amount must be positive',
          },
          {
            type: 'number',
            name: 'slippage',
            message: 'Slippage tolerance (basis points, e.g., 100 = 1%):',
            default: 100,
            validate: (input) => input >= 0 || 'Slippage must be non-negative',
          },
        ]);

        // Confirm launch
        console.log(chalk.yellow('\n📊 Launch Summary'));
        console.log(`Token: ${metadata.name} (${metadata.symbol})`);
        console.log(`Buyers: ${walletCollection.buyers.length} wallets`);
        console.log(`Buy amount: ${launchParams.buyAmount} SOL per wallet`);
        console.log(`Total buy volume: ${launchParams.buyAmount * walletCollection.buyers.length} SOL`);
        console.log(`Jito tip: ${launchParams.jitoTip} SOL`);
        console.log(`Slippage: ${launchParams.slippage / 100}%`);

        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'Proceed with launch?',
            default: false,
          },
        ]);

        if (!confirm) {
          console.log(chalk.yellow('\n❌ Launch cancelled'));
          return;
        }

        // Create connection
        const rpcUrl =
          options.rpc ||
          (options.network === 'mainnet-beta'
            ? process.env['RPC_URL'] || 'https://api.mainnet-beta.solana.com'
            : `https://api.${options.network}.solana.com`);

        const connection = new Connection(rpcUrl, 'confirmed');

        // Setup Jito config
        const tipAccount = JITO_TIP_ACCOUNTS[0];
        if (!tipAccount) {
          throw new Error('No Jito tip accounts available');
        }

        const jitoConfig: JitoConfig = {
          blockEngineUrl: options.jitoBlockEngine,
          tipAccount,
          tipLamports: Math.floor(launchParams.jitoTip * 1_000_000_000),
        };

        // Setup launch config
        const launchConfig: LaunchConfig = {
          tokenName: metadata.name,
          tokenSymbol: metadata.symbol,
          tokenDescription: metadata.description,
          tokenImageUrl: metadata.imageUrl,
          buyAmountPerWallet: launchParams.buyAmount,
          jitoTip: launchParams.jitoTip,
          buyerWalletCount: walletCollection.buyers.length,
          slippageBps: launchParams.slippage,
        };

        // Launch token
        const launcher = new TokenLauncherService(connection, jitoConfig);

        console.log(chalk.blue('\n🚀 Launching token...\n'));

        const result = await launcher.launch(launchConfig, walletCollection);

        // Display result
        if (result.success) {
          console.log(chalk.green.bold('\n🎉 Launch Successful!\n'));
          console.log(chalk.bold('Token Mint:'), result.mintAddress);
          console.log(chalk.bold('Bundle ID:'), result.bundleId);
          console.log(chalk.bold('Status:'), result.bundleStatus.status);
          if (result.bundleStatus.landedSlot) {
            console.log(chalk.bold('Landed Slot:'), result.bundleStatus.landedSlot);
          }
        } else {
          console.log(chalk.red.bold('\n❌ Launch Failed\n'));
          console.log(chalk.red('Error:'), result.error);
          console.log(chalk.yellow('Bundle ID:'), result.bundleId);
          console.log(chalk.yellow('Status:'), result.bundleStatus.status);
        }

        console.log('');
      } catch (error) {
        console.log(chalk.red(`\n❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
        process.exit(1);
      }
    });
}

/**
 * Dry run command
 */
function dryRunCommand() {
  return new Command('dry-run')
    .description('Simulate a token launch without sending (for testing)')
    .option('-w, --wallets <path>', 'Path to wallet collection file', './wallets/launch-wallets.json')
    .option('-n, --network <network>', 'Solana network (mainnet-beta, devnet, testnet)', 'devnet')
    .option('--rpc <url>', 'Custom RPC URL (optional)')
    .action(async (options) => {
      try {
        console.log(chalk.blue.bold('\n🧪 Token Launch Dry Run\n'));

        // Load wallets
        const walletsPath = path.resolve(options.wallets);
        const { password } = await inquirer.prompt([
          {
            type: 'password',
            name: 'password',
            message: 'Enter wallet encryption password:',
          },
        ]);

        const spinner = ora('Loading wallets...').start();
        const walletCollection = await EncryptionService.loadFromFile(walletsPath, password);
        spinner.succeed(`Loaded ${walletCollection.buyers.length} buyer wallets`);

        // Use default/test values for dry run
        const launchConfig: LaunchConfig = {
          tokenName: 'Test Token',
          tokenSymbol: 'TEST',
          tokenDescription: 'Test token for dry run',
          tokenImageUrl: '',
          buyAmountPerWallet: 0.01,
          jitoTip: 0.001,
          buyerWalletCount: walletCollection.buyers.length,
          slippageBps: 100,
        };

        // Create connection
        const rpcUrl =
          options.rpc ||
          (options.network === 'mainnet-beta'
            ? process.env['RPC_URL'] || 'https://api.mainnet-beta.solana.com'
            : `https://api.${options.network}.solana.com`);

        const connection = new Connection(rpcUrl, 'confirmed');

        // Setup Jito config
        const tipAccount = JITO_TIP_ACCOUNTS[0];
        if (!tipAccount) {
          throw new Error('No Jito tip accounts available');
        }

        const jitoConfig: JitoConfig = {
          blockEngineUrl: 'https://mainnet.block-engine.jito.wtf',
          tipAccount,
          tipLamports: Math.floor(0.001 * 1_000_000_000),
        };

        // Run simulation
        const launcher = new TokenLauncherService(connection, jitoConfig);

        console.log(chalk.blue('\n🧪 Running simulation...\n'));

        const success = await launcher.dryRun(launchConfig, walletCollection);

        if (success) {
          console.log(chalk.green.bold('\n✅ Dry run successful - launch should work!\n'));
        } else {
          console.log(chalk.red.bold('\n❌ Dry run failed - check your setup\n'));
        }
      } catch (error) {
        console.log(chalk.red(`\n❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
        process.exit(1);
      }
    });
}

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { Connection, clusterApiUrl } from '@solana/web3.js';
import { WalletManager } from '../../core/wallet-manager';
import { EncryptionService } from '../../core/encryption';
import { FundDistributor } from '../../core/fund-distributor';
import { WalletConfig } from '../../types';
import path from 'path';

export const walletCommand = new Command('wallet')
  .description('Wallet management commands')
  .addCommand(createWalletCommand())
  .addCommand(loadWalletCommand())
  .addCommand(fundWalletsCommand())
  .addCommand(balancesCommand());

/**
 * Create wallet command
 */
function createWalletCommand() {
  return new Command('create')
    .description('Create a new wallet collection for token launch')
    .option('-b, --buyers <number>', 'Number of buyer wallets', '10')
    .option('-d, --dev-amount <number>', 'SOL amount for dev wallet', '0.1')
    .option('--buyer-amount <number>', 'SOL amount per buyer wallet', '0.05')
    .option('-o, --output <path>', 'Output file path', './wallets/launch-wallets.json')
    .action(async (options) => {
      try {
        console.log(chalk.blue.bold('\n🔐 Creating Wallet Collection\n'));

        // Prompt for password
        const { password, confirmPassword } = await inquirer.prompt([
          {
            type: 'password',
            name: 'password',
            message: 'Enter encryption password:',
            validate: (input) => input.length >= 8 || 'Password must be at least 8 characters',
          },
          {
            type: 'password',
            name: 'confirmPassword',
            message: 'Confirm password:',
          },
        ]);

        if (password !== confirmPassword) {
          console.log(chalk.red('❌ Passwords do not match'));
          process.exit(1);
        }

        const config: WalletConfig = {
          buyerCount: parseInt(options.buyers),
          devWalletAmount: parseFloat(options.devAmount),
          buyerWalletAmount: parseFloat(options.buyerAmount),
          password,
        };

        const spinner = ora('Generating wallets...').start();

        // Generate wallet collection
        const collection = WalletManager.generateWalletCollection(config);

        // Save encrypted wallets
        const outputPath = path.resolve(options.output);
        await EncryptionService.saveToFile(collection, password, outputPath);

        spinner.succeed('Wallets created successfully!');

        // Display summary
        const summary = WalletManager.exportSummary(collection);
        console.log(chalk.green('\n✅ Wallet Collection Created\n'));
        console.log(chalk.bold('Main Wallet:'));
        console.log(`  ${summary.main}`);
        console.log(chalk.bold('\nDev Wallet:'));
        console.log(`  ${summary.dev}`);
        console.log(chalk.bold(`\nBuyer Wallets (${summary.buyers.length}):`));
        summary.buyers.forEach((addr, i) => {
          console.log(`  ${i + 1}. ${addr}`);
        });

        console.log(chalk.yellow(`\n📁 Wallets saved to: ${outputPath}`));
        console.log(
          chalk.yellow(
            `\n⚠️  IMPORTANT: Fund your main wallet with at least ${FundDistributor.calculateDistribution(config.devWalletAmount, config.buyerWalletAmount, config.buyerCount).totalRequired.toFixed(4)} SOL`
          )
        );
        console.log(chalk.yellow(`   Main wallet address: ${summary.main}\n`));
      } catch (error) {
        console.log(chalk.red(`\n❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
        process.exit(1);
      }
    });
}

/**
 * Load wallet command
 */
function loadWalletCommand() {
  return new Command('load')
    .description('Load and display wallet collection')
    .argument('<file>', 'Wallet file path')
    .action(async (file) => {
      try {
        console.log(chalk.blue.bold('\n🔓 Loading Wallet Collection\n'));

        // Prompt for password
        const { password } = await inquirer.prompt([
          {
            type: 'password',
            name: 'password',
            message: 'Enter decryption password:',
          },
        ]);

        const spinner = ora('Loading wallets...').start();

        // Load wallet collection
        const filePath = path.resolve(file);
        const collection = await EncryptionService.loadFromFile(filePath, password);

        spinner.succeed('Wallets loaded successfully!');

        // Display summary
        const summary = WalletManager.exportSummary(collection);
        console.log(chalk.green('\n✅ Wallet Collection\n'));
        console.log(chalk.bold('Main Wallet:'));
        console.log(`  ${summary.main}`);
        console.log(chalk.bold('\nDev Wallet:'));
        console.log(`  ${summary.dev}`);
        console.log(chalk.bold(`\nBuyer Wallets (${summary.buyers.length}):`));
        summary.buyers.forEach((addr, i) => {
          console.log(`  ${i + 1}. ${addr}`);
        });
        console.log();
      } catch (error) {
        console.log(chalk.red(`\n❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
        process.exit(1);
      }
    });
}

/**
 * Fund wallets command
 */
function fundWalletsCommand() {
  return new Command('fund')
    .description('Distribute SOL from main wallet to dev and buyer wallets')
    .argument('<file>', 'Wallet file path')
    .option('-d, --dev-amount <number>', 'SOL amount for dev wallet', '0.1')
    .option('--buyer-amount <number>', 'SOL amount per buyer wallet', '0.05')
    .option('-n, --network <network>', 'Solana network (devnet/testnet/mainnet-beta)', 'devnet')
    .option('-r, --rpc <url>', 'Custom RPC URL')
    .action(async (file, options) => {
      try {
        console.log(chalk.blue.bold('\n💸 Funding Wallets\n'));

        // Prompt for password
        const { password } = await inquirer.prompt([
          {
            type: 'password',
            name: 'password',
            message: 'Enter decryption password:',
          },
        ]);

        const spinner = ora('Loading wallets...').start();

        // Load wallet collection
        const filePath = path.resolve(file);
        const collection = await EncryptionService.loadFromFile(filePath, password);

        spinner.text = 'Connecting to Solana network...';

        // Connect to Solana
        const rpcUrl = options.rpc || clusterApiUrl(options.network);
        const connection = new Connection(rpcUrl, 'confirmed');

        spinner.text = 'Checking balances...';

        // Initialize fund distributor
        const distributor = new FundDistributor(connection);

        const devAmount = parseFloat(options.devAmount);
        const buyerAmount = parseFloat(options.buyerAmount);

        // Calculate distribution plan
        const plan = FundDistributor.calculateDistribution(
          devAmount,
          buyerAmount,
          collection.buyers.length
        );

        spinner.stop();

        // Display plan
        console.log(chalk.bold('\n📊 Fund Distribution Plan:\n'));
        console.log(`  Dev wallet:         ${devAmount.toFixed(4)} SOL`);
        console.log(`  Per buyer wallet:   ${buyerAmount.toFixed(4)} SOL`);
        console.log(`  Number of buyers:   ${collection.buyers.length}`);
        console.log(`  Estimated fees:     ${plan.estimatedFees.toFixed(6)} SOL`);
        console.log(chalk.yellow(`  Total required:     ${plan.totalRequired.toFixed(4)} SOL\n`));

        // Confirm
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'Proceed with fund distribution?',
            default: false,
          },
        ]);

        if (!confirm) {
          console.log(chalk.yellow('\n⚠️  Fund distribution cancelled\n'));
          return;
        }

        const fundSpinner = ora('Distributing funds...').start();

        // Distribute funds
        const result = await distributor.distributeFunds(collection, devAmount, buyerAmount);

        fundSpinner.succeed('Funds distributed successfully!');

        console.log(chalk.green('\n✅ Distribution Complete\n'));
        console.log(chalk.bold('Dev wallet transaction:'));
        console.log(`  ${result.devTxSignature}`);
        console.log(chalk.bold(`\nBuyer wallet transactions (${result.buyerTxSignatures.length}):`));
        result.buyerTxSignatures.forEach((sig, i) => {
          console.log(`  ${i + 1}. ${sig}`);
        });
        console.log();
      } catch (error) {
        console.log(chalk.red(`\n❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
        process.exit(1);
      }
    });
}

/**
 * Check balances command
 */
function balancesCommand() {
  return new Command('balances')
    .description('Check balances of all wallets in collection')
    .argument('<file>', 'Wallet file path')
    .option('-n, --network <network>', 'Solana network (devnet/testnet/mainnet-beta)', 'devnet')
    .option('-r, --rpc <url>', 'Custom RPC URL')
    .action(async (file, options) => {
      try {
        console.log(chalk.blue.bold('\n💰 Checking Wallet Balances\n'));

        // Prompt for password
        const { password } = await inquirer.prompt([
          {
            type: 'password',
            name: 'password',
            message: 'Enter decryption password:',
          },
        ]);

        const spinner = ora('Loading wallets...').start();

        // Load wallet collection
        const filePath = path.resolve(file);
        const collection = await EncryptionService.loadFromFile(filePath, password);

        spinner.text = 'Connecting to Solana network...';

        // Connect to Solana
        const rpcUrl = options.rpc || clusterApiUrl(options.network);
        const connection = new Connection(rpcUrl, 'confirmed');

        spinner.text = 'Fetching balances...';

        // Get balances
        const distributor = new FundDistributor(connection);
        const balances = await distributor.getAllBalances(collection);

        spinner.succeed('Balances retrieved!');

        // Display balances
        console.log(chalk.green('\n✅ Wallet Balances\n'));
        console.log(chalk.bold('Main Wallet:'));
        console.log(`  ${collection.main.publicKey.toBase58()}`);
        console.log(`  Balance: ${chalk.yellow(balances.main.toFixed(4))} SOL\n`);

        console.log(chalk.bold('Dev Wallet:'));
        console.log(`  ${collection.dev.publicKey.toBase58()}`);
        console.log(`  Balance: ${chalk.yellow(balances.dev.toFixed(4))} SOL\n`);

        console.log(chalk.bold(`Buyer Wallets (${collection.buyers.length}):`));
        collection.buyers.forEach((buyer, i) => {
          const buyerBalance = balances.buyers[i];
          if (buyerBalance !== undefined) {
            console.log(`  ${i + 1}. ${buyer.publicKey.toBase58()}`);
            console.log(`     Balance: ${chalk.yellow(buyerBalance.toFixed(4))} SOL`);
          }
        });

        const totalBalance =
          balances.main + balances.dev + balances.buyers.reduce((sum, b) => sum + b, 0);
        console.log(chalk.bold(`\nTotal: ${chalk.yellow(totalBalance.toFixed(4))} SOL\n`));
      } catch (error) {
        console.log(chalk.red(`\n❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
        process.exit(1);
      }
    });
}

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAccount, getAssociatedTokenAddress } from '@solana/spl-token';
import { EncryptionService } from '../../core/encryption';
import { PumpfunService } from '../../services/pumpfun';
import { JitoService, JITO_TIP_ACCOUNTS } from '../../services/jito';
import { JitoConfig } from '../../types';
import path from 'path';

export const sellCommand = new Command('sell')
  .description('Sell tokens from wallets')
  .addCommand(sellAllCommand())
  .addCommand(sellDevCommand())
  .addCommand(sellBuyerCommand());

/**
 * Sell from all buyer wallets command
 */
function sellAllCommand() {
  return new Command('all')
    .description('Sell tokens from all buyer wallets via Jito bundle')
    .requiredOption('-m, --mint <address>', 'Token mint address')
    .option('-w, --wallets <path>', 'Path to wallet collection file', './wallets/launch-wallets.json')
    .option('-p, --percentage <number>', 'Percentage of tokens to sell (1-100)', '100')
    .option('-s, --slippage <number>', 'Slippage tolerance in basis points', '500')
    .option('-n, --network <network>', 'Solana network (mainnet-beta, devnet, testnet)', 'mainnet-beta')
    .option('--rpc <url>', 'Custom RPC URL (optional)')
    .option('--jito-tip <number>', 'Jito tip amount in SOL', '0.001')
    .option('--jito-block-engine <url>', 'Jito block engine URL', 'https://mainnet.block-engine.jito.wtf')
    .action(async (options) => {
      try {
        console.log(chalk.blue.bold('\n💰 Sell Tokens from All Buyers\n'));

        const mint = new PublicKey(options.mint);
        const percentage = parseFloat(options.percentage);
        const slippageBps = parseInt(options.slippage);

        if (percentage <= 0 || percentage > 100) {
          console.log(chalk.red('❌ Percentage must be between 1 and 100'));
          return;
        }

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

        // Create connection
        const rpcUrl =
          options.rpc ||
          (options.network === 'mainnet-beta'
            ? process.env['RPC_URL'] || 'https://api.mainnet-beta.solana.com'
            : `https://api.${options.network}.solana.com`);

        const connection = new Connection(rpcUrl, 'confirmed');

        // Check token balances
        console.log(chalk.blue('\n📊 Checking token balances...\n'));
        const sellInstructions: { wallet: string; amount: bigint; index: number }[] = [];

        for (let i = 0; i < walletCollection.buyers.length; i++) {
          const buyer = walletCollection.buyers[i];
          if (!buyer) continue;

          try {
            const ata = await getAssociatedTokenAddress(mint, buyer.keypair.publicKey);
            const tokenAccount = await getAccount(connection, ata);

            if (tokenAccount.amount > 0n) {
              const sellAmount = (tokenAccount.amount * BigInt(Math.floor(percentage * 100))) / 10000n;
              sellInstructions.push({
                wallet: buyer.keypair.publicKey.toBase58(),
                amount: sellAmount,
                index: i,
              });

              console.log(
                chalk.green(
                  `  Buyer ${i + 1}: ${(Number(sellAmount) / 1e6).toFixed(2)} tokens (${percentage}%)`
                )
              );
            }
          } catch {
            // No token account or no balance
          }
        }

        if (sellInstructions.length === 0) {
          console.log(chalk.yellow('\n⚠️  No buyers have token balances'));
          return;
        }

        console.log(chalk.yellow(`\n📦 Will sell from ${sellInstructions.length} wallets`));

        // Confirm
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'Proceed with bundle sale?',
            default: false,
          },
        ]);

        if (!confirm) {
          console.log(chalk.yellow('\n❌ Sale cancelled'));
          return;
        }

        // Setup services
        const pumpfun = new PumpfunService(connection);

        const tipAccount = JITO_TIP_ACCOUNTS[0];
        if (!tipAccount) {
          throw new Error('No Jito tip accounts available');
        }

        const jitoConfig: JitoConfig = {
          blockEngineUrl: options.jitoBlockEngine,
          tipAccount,
          tipLamports: Math.floor(parseFloat(options.jitoTip) * LAMPORTS_PER_SOL),
        };
        const jito = new JitoService(connection, jitoConfig);

        // Build sell transactions
        const sellSpinner = ora('Building sell instructions...').start();
        const transactions = [];

        for (const sell of sellInstructions) {
          const buyer = walletCollection.buyers[sell.index];
          if (!buyer) continue;

          const minSolOutput = Math.floor(Number(sell.amount) * (1 - slippageBps / 10000));

          const instruction = await pumpfun.sellTokenInstruction(buyer.keypair, {
            mint,
            tokenAmount: Number(sell.amount),
            minSolOutput,
          });

          const tx = await jito.buildVersionedTransaction([instruction], buyer.keypair);
          transactions.push(tx);
        }

        sellSpinner.succeed(`Built ${transactions.length} sell transactions`);

        // Send bundle
        console.log(chalk.blue('\n📤 Sending bundle to Jito...\n'));

        const bundleId = await jito.sendBundle(
          transactions,
          walletCollection.main.keypair,
          jitoConfig.tipLamports
        );

        console.log(chalk.green(`\n✅ Bundle sent! ID: ${bundleId}`));
        console.log(chalk.yellow('Waiting for confirmation...'));

        const status = await jito.waitForBundleConfirmation(bundleId, 60000);

        if (status.status === 'confirmed') {
          console.log(chalk.green.bold('\n🎉 Sell successful!\n'));
        } else {
          console.log(chalk.yellow(`\n⚠️  Bundle status: ${status.status}`));
          if (status.error) {
            console.log(chalk.red(`Error: ${status.error}`));
          }
        }
      } catch (error) {
        console.log(chalk.red(`\n❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
        process.exit(1);
      }
    });
}

/**
 * Sell from dev wallet command
 */
function sellDevCommand() {
  return new Command('dev')
    .description('Sell tokens from dev wallet')
    .requiredOption('-m, --mint <address>', 'Token mint address')
    .option('-w, --wallets <path>', 'Path to wallet collection file', './wallets/launch-wallets.json')
    .option('-p, --percentage <number>', 'Percentage of tokens to sell (1-100)', '100')
    .option('-s, --slippage <number>', 'Slippage tolerance in basis points', '500')
    .option('-n, --network <network>', 'Solana network (mainnet-beta, devnet, testnet)', 'mainnet-beta')
    .option('--rpc <url>', 'Custom RPC URL (optional)')
    .action(async (options) => {
      try {
        console.log(chalk.blue.bold('\n💰 Sell Tokens from Dev Wallet\n'));

        const mint = new PublicKey(options.mint);
        const percentage = parseFloat(options.percentage);
        const slippageBps = parseInt(options.slippage);

        if (percentage <= 0 || percentage > 100) {
          console.log(chalk.red('❌ Percentage must be between 1 and 100'));
          return;
        }

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
        spinner.succeed('Wallets loaded');

        // Create connection
        const rpcUrl =
          options.rpc ||
          (options.network === 'mainnet-beta'
            ? process.env['RPC_URL'] || 'https://api.mainnet-beta.solana.com'
            : `https://api.${options.network}.solana.com`);

        const connection = new Connection(rpcUrl, 'confirmed');

        // Check dev token balance
        const ata = await getAssociatedTokenAddress(mint, walletCollection.dev.keypair.publicKey);

        let tokenAccount;
        try {
          tokenAccount = await getAccount(connection, ata);
        } catch {
          console.log(chalk.yellow('\n⚠️  Dev wallet has no token balance'));
          return;
        }

        const sellAmount = (tokenAccount.amount * BigInt(Math.floor(percentage * 100))) / 10000n;
        const minSolOutput = Math.floor(Number(sellAmount) * (1 - slippageBps / 10000));

        console.log(chalk.green(`Token balance: ${(Number(tokenAccount.amount) / 1e6).toFixed(2)} tokens`));
        console.log(chalk.yellow(`Will sell: ${(Number(sellAmount) / 1e6).toFixed(2)} tokens (${percentage}%)`));

        // Confirm
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'Proceed with sale?',
            default: false,
          },
        ]);

        if (!confirm) {
          console.log(chalk.yellow('\n❌ Sale cancelled'));
          return;
        }

        // Build and send transaction
        const pumpfun = new PumpfunService(connection);

        const sellSpinner = ora('Building sell transaction...').start();

        const instruction = await pumpfun.sellTokenInstruction(walletCollection.dev.keypair, {
          mint,
          tokenAmount: Number(sellAmount),
          minSolOutput,
        });

        sellSpinner.text = 'Sending transaction...';

        const tx = await connection.sendTransaction(
          await createVersionedTx(connection, [instruction], walletCollection.dev.keypair),
          { skipPreflight: false }
        );

        sellSpinner.succeed('Transaction sent!');

        console.log(chalk.green(`\nTransaction: ${tx}`));
        console.log(chalk.yellow('Waiting for confirmation...'));

        await connection.confirmTransaction(tx, 'confirmed');

        console.log(chalk.green.bold('\n✅ Sell successful!\n'));
      } catch (error) {
        console.log(chalk.red(`\n❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
        process.exit(1);
      }
    });
}

/**
 * Sell from specific buyer wallet command
 */
function sellBuyerCommand() {
  return new Command('buyer')
    .description('Sell tokens from a specific buyer wallet')
    .requiredOption('-i, --index <number>', 'Buyer wallet index (1-based)')
    .requiredOption('-m, --mint <address>', 'Token mint address')
    .option('-w, --wallets <path>', 'Path to wallet collection file', './wallets/launch-wallets.json')
    .option('-p, --percentage <number>', 'Percentage of tokens to sell (1-100)', '100')
    .option('-s, --slippage <number>', 'Slippage tolerance in basis points', '500')
    .option('-n, --network <network>', 'Solana network (mainnet-beta, devnet, testnet)', 'mainnet-beta')
    .option('--rpc <url>', 'Custom RPC URL (optional)')
    .action(async (options) => {
      try {
        console.log(chalk.blue.bold('\n💰 Sell Tokens from Buyer Wallet\n'));

        const mint = new PublicKey(options.mint);
        const buyerIndex = parseInt(options.index) - 1; // Convert to 0-based
        const percentage = parseFloat(options.percentage);
        const slippageBps = parseInt(options.slippage);

        if (percentage <= 0 || percentage > 100) {
          console.log(chalk.red('❌ Percentage must be between 1 and 100'));
          return;
        }

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
        spinner.succeed('Wallets loaded');

        const buyer = walletCollection.buyers[buyerIndex];
        if (!buyer) {
          console.log(chalk.red(`❌ Buyer index ${options.index} not found. Valid range: 1-${walletCollection.buyers.length}`));
          return;
        }

        // Create connection
        const rpcUrl =
          options.rpc ||
          (options.network === 'mainnet-beta'
            ? process.env['RPC_URL'] || 'https://api.mainnet-beta.solana.com'
            : `https://api.${options.network}.solana.com`);

        const connection = new Connection(rpcUrl, 'confirmed');

        // Check buyer token balance
        const ata = await getAssociatedTokenAddress(mint, buyer.keypair.publicKey);

        let tokenAccount;
        try {
          tokenAccount = await getAccount(connection, ata);
        } catch {
          console.log(chalk.yellow(`\n⚠️  Buyer ${options.index} has no token balance`));
          return;
        }

        const sellAmount = (tokenAccount.amount * BigInt(Math.floor(percentage * 100))) / 10000n;
        const minSolOutput = Math.floor(Number(sellAmount) * (1 - slippageBps / 10000));

        console.log(chalk.green(`Buyer ${options.index} balance: ${(Number(tokenAccount.amount) / 1e6).toFixed(2)} tokens`));
        console.log(chalk.yellow(`Will sell: ${(Number(sellAmount) / 1e6).toFixed(2)} tokens (${percentage}%)`));

        // Confirm
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'Proceed with sale?',
            default: false,
          },
        ]);

        if (!confirm) {
          console.log(chalk.yellow('\n❌ Sale cancelled'));
          return;
        }

        // Build and send transaction
        const pumpfun = new PumpfunService(connection);

        const sellSpinner = ora('Building sell transaction...').start();

        const instruction = await pumpfun.sellTokenInstruction(buyer.keypair, {
          mint,
          tokenAmount: Number(sellAmount),
          minSolOutput,
        });

        sellSpinner.text = 'Sending transaction...';

        const tx = await connection.sendTransaction(
          await createVersionedTx(connection, [instruction], buyer.keypair),
          { skipPreflight: false }
        );

        sellSpinner.succeed('Transaction sent!');

        console.log(chalk.green(`\nTransaction: ${tx}`));
        console.log(chalk.yellow('Waiting for confirmation...'));

        await connection.confirmTransaction(tx, 'confirmed');

        console.log(chalk.green.bold('\n✅ Sell successful!\n'));
      } catch (error) {
        console.log(chalk.red(`\n❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
        process.exit(1);
      }
    });
}

// Helper function to create versioned transaction
async function createVersionedTx(
  connection: Connection,
  instructions: any[],
  payer: any
) {
  const { TransactionMessage, VersionedTransaction } = await import('@solana/web3.js');
  const { blockhash } = await connection.getLatestBlockhash();

  const messageV0 = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  const tx = new VersionedTransaction(messageV0);
  tx.sign([payer]);

  return tx;
}

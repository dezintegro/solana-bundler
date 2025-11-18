#!/usr/bin/env node

import { Command } from 'commander';
import dotenv from 'dotenv';
import { walletCommand } from './commands/wallet';
import { launchCommand } from './commands/launch';
import { sellCommand } from './commands/sell';
import { priceCommand } from './commands/price';
import { volumeCommand } from './commands/volume';

// Load environment variables
dotenv.config();

const program = new Command();

program
  .name('solana-bundler')
  .description('Automated Solana token launcher with Jito bundles for atomic execution')
  .version('0.1.0');

// Add commands
program.addCommand(walletCommand);
program.addCommand(launchCommand);
program.addCommand(sellCommand);
program.addCommand(priceCommand);
program.addCommand(volumeCommand);

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

#!/usr/bin/env node

import { Command } from 'commander';
import dotenv from 'dotenv';
import { walletCommand } from './commands/wallet';

// Load environment variables
dotenv.config();

const program = new Command();

program
  .name('solana-bundler')
  .description('Automated Solana token launcher with Jito bundles for atomic execution')
  .version('0.1.0');

// Add wallet command
program.addCommand(walletCommand);

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

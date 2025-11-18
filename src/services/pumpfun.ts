import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
  AccountMeta,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { CreateTokenParams, BuyParams } from '../types';
import logger from '../utils/logger';

// Pumpfun program ID (mainnet)
export const PUMPFUN_PROGRAM_ID = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');

// Metaplex Token Metadata Program ID
export const MPL_TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'
);

// Fee recipient for buy transactions
export const FEE_RECIPIENT = new PublicKey('CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM');

// PDA seeds
const GLOBAL_SEED = Buffer.from('global');
const MINT_AUTHORITY_SEED = Buffer.from('mint-authority');
const BONDING_CURVE_SEED = Buffer.from('bonding-curve');
const EVENT_AUTHORITY_SEED = Buffer.from('__event_authority');

/**
 * Pumpfun Service
 * Handles interaction with Pumpfun program for token creation and trading
 * Uses real instructions based on Pumpfun IDL
 */
export class PumpfunService {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
    logger.info('Pumpfun service initialized with real IDL-based instructions');
  }

  /**
   * Derive global PDA
   */
  private getGlobalPDA(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync([GLOBAL_SEED], PUMPFUN_PROGRAM_ID);
  }

  /**
   * Derive mint authority PDA
   */
  private getMintAuthorityPDA(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync([MINT_AUTHORITY_SEED], PUMPFUN_PROGRAM_ID);
  }

  /**
   * Derive bonding curve PDA for a mint
   */
  private getBondingCurvePDA(mint: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync([BONDING_CURVE_SEED, mint.toBuffer()], PUMPFUN_PROGRAM_ID);
  }

  /**
   * Derive metadata PDA for a mint
   */
  private getMetadataPDA(mint: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('metadata'), MPL_TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
      MPL_TOKEN_METADATA_PROGRAM_ID
    );
  }

  /**
   * Derive event authority PDA
   */
  private getEventAuthorityPDA(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync([EVENT_AUTHORITY_SEED], PUMPFUN_PROGRAM_ID);
  }

  /**
   * Encode Anchor string (4 bytes length + string bytes)
   */
  private encodeString(str: string): Buffer {
    const bytes = Buffer.from(str, 'utf8');
    const length = Buffer.alloc(4);
    length.writeUInt32LE(bytes.length);
    return Buffer.concat([length, bytes]);
  }

  /**
   * Create instruction to create a new token
   * Based on actual Pumpfun IDL
   */
  async createTokenInstruction(
    creator: Keypair,
    params: CreateTokenParams
  ): Promise<{ instruction: TransactionInstruction; mint: Keypair }> {
    try {
      logger.info(`Creating token: ${params.metadata.name} (${params.metadata.symbol})`);

      // Generate new mint keypair
      const mint = Keypair.generate();

      // Derive PDAs
      const [global] = this.getGlobalPDA();
      const [mintAuthority] = this.getMintAuthorityPDA();
      const [bondingCurve] = this.getBondingCurvePDA(mint.publicKey);
      const [metadata] = this.getMetadataPDA(mint.publicKey);
      const [eventAuthority] = this.getEventAuthorityPDA();

      // Get associated token account for bonding curve
      const associatedBondingCurve = getAssociatedTokenAddressSync(
        mint.publicKey,
        bondingCurve,
        true
      );

      // Create instruction data (based on IDL)
      // Discriminator for create: [24, 30, 200, 40, 5, 28, 7, 119]
      const discriminator = Buffer.from([24, 30, 200, 40, 5, 28, 7, 119]);

      // Encode args: name (string), symbol (string), uri (string), creator (pubkey)
      const nameEncoded = this.encodeString(params.metadata.name);
      const symbolEncoded = this.encodeString(params.metadata.symbol);
      const uriEncoded = this.encodeString(params.metadata.imageUri);

      const data = Buffer.concat([
        discriminator,
        nameEncoded,
        symbolEncoded,
        uriEncoded,
        creator.publicKey.toBuffer(),
      ]);

      // Build accounts array (based on IDL)
      const keys: AccountMeta[] = [
        { pubkey: mint.publicKey, isSigner: true, isWritable: true },
        { pubkey: mintAuthority, isSigner: false, isWritable: false },
        { pubkey: bondingCurve, isSigner: false, isWritable: true },
        { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
        { pubkey: global, isSigner: false, isWritable: false },
        { pubkey: MPL_TOKEN_METADATA_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: metadata, isSigner: false, isWritable: true },
        { pubkey: creator.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        { pubkey: eventAuthority, isSigner: false, isWritable: false },
        { pubkey: PUMPFUN_PROGRAM_ID, isSigner: false, isWritable: false },
      ];

      const instruction = new TransactionInstruction({
        keys,
        programId: PUMPFUN_PROGRAM_ID,
        data,
      });

      logger.info(`Token creation instruction built. Mint: ${mint.publicKey.toBase58()}`);

      return {
        instruction,
        mint,
      };
    } catch (error) {
      logger.error('Failed to create token instruction', error);
      throw new Error(
        `Failed to create token instruction: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Create instruction to buy tokens
   * Based on actual Pumpfun IDL
   */
  async buyTokenInstruction(buyer: Keypair, params: BuyParams): Promise<TransactionInstruction> {
    try {
      logger.info(`Building buy instruction for ${params.solAmount} lamports`);

      // Derive PDAs
      const [global] = this.getGlobalPDA();
      const [bondingCurve] = this.getBondingCurvePDA(params.mint);
      const [eventAuthority] = this.getEventAuthorityPDA();

      // Get associated token accounts
      const associatedBondingCurve = getAssociatedTokenAddressSync(
        params.mint,
        bondingCurve,
        true
      );

      const associatedUser = getAssociatedTokenAddressSync(params.mint, buyer.publicKey);

      // Create instruction data (based on IDL)
      // Discriminator for buy: [102, 6, 61, 18, 1, 218, 235, 234]
      const discriminator = Buffer.from([102, 6, 61, 18, 1, 218, 235, 234]);

      // Args: amount (u64), max_sol_cost (u64), track_volume (OptionBool)
      // Calculate token amount (simplified - production would query bonding curve)
      const amount = BigInt(params.solAmount * 1000); // Placeholder calculation

      const amountBytes = Buffer.alloc(8);
      amountBytes.writeBigUInt64LE(amount);

      const maxSolCostBytes = Buffer.alloc(8);
      maxSolCostBytes.writeBigUInt64LE(BigInt(params.solAmount));

      // track_volume: OptionBool (1 byte: 0=None, 1=Some(true), 2=Some(false))
      const trackVolumeBytes = Buffer.from([1]); // Some(true)

      const data = Buffer.concat([discriminator, amountBytes, maxSolCostBytes, trackVolumeBytes]);

      // Build accounts array (based on IDL)
      const keys: AccountMeta[] = [
        { pubkey: global, isSigner: false, isWritable: false },
        { pubkey: FEE_RECIPIENT, isSigner: false, isWritable: true },
        { pubkey: params.mint, isSigner: false, isWritable: false },
        { pubkey: bondingCurve, isSigner: false, isWritable: true },
        { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
        { pubkey: associatedUser, isSigner: false, isWritable: true },
        { pubkey: buyer.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        { pubkey: eventAuthority, isSigner: false, isWritable: false },
        { pubkey: PUMPFUN_PROGRAM_ID, isSigner: false, isWritable: false },
      ];

      const instruction = new TransactionInstruction({
        keys,
        programId: PUMPFUN_PROGRAM_ID,
        data,
      });

      logger.info('Buy instruction built successfully');

      return instruction;
    } catch (error) {
      logger.error('Failed to create buy instruction', error);
      throw new Error(
        `Failed to create buy instruction: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get token price from bonding curve
   */
  async getTokenPrice(mint: PublicKey): Promise<number> {
    try {
      const [bondingCurve] = this.getBondingCurvePDA(mint);

      // Fetch bonding curve account
      const bondingCurveAccount = await this.connection.getAccountInfo(bondingCurve);

      if (!bondingCurveAccount) {
        throw new Error('Bonding curve not found');
      }

      logger.info(`Fetching price for mint: ${mint.toBase58()}`);

      // TODO: Parse bonding curve data to get actual price
      // This would require understanding the bonding curve account structure
      return 0.0001;
    } catch (error) {
      logger.error('Failed to get token price', error);
      throw new Error(
        `Failed to get token price: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

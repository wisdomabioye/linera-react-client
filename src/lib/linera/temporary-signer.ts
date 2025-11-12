/**
 * Temporary Signer for Guest Mode
 *
 * Creates a signer for read-only operations when MetaMask is not connected.
 * Supports three modes:
 * 1. Constant address (most efficient - same wallet for all users)
 * 2. Persisted storage (wallet survives page reloads)
 * 3. Ephemeral random (new wallet each session)
 */

import { ethers } from 'ethers';
import { Signer as SignerInterface } from '@linera/client';
import { logger } from '../../utils/logger';

/**
 * Configuration options for TemporarySigner
 */
export interface TemporarySignerOptions {
  /**
   * Use a constant address for all read-only users.
   * This is the most efficient option - no overhead, same chain for everyone.
   *
   * Can be any valid Ethereum address, commonly:
   * - Zero address: "0x0000000000000000000000000000000000000000"
   * - Custom address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
   *
   * Takes precedence over storage option.
   */
  constantAddress?: string;

  /**
   * Persist wallet in browser storage.
   * Only used if constantAddress is not provided.
   *
   * @default 'none'
   */
  storage?: 'localStorage' | 'sessionStorage' | 'none';

  /**
   * Storage key for persisted wallet
   * @default 'linera_readonly_wallet'
   */
  storageKey?: string;
}

/**
 * A signer for read-only/guest mode
 *
 * This signer can be configured to use:
 * 1. Constant address (recommended for read-only - most efficient)
 * 2. Storage persistence (wallet survives reloads)
 * 3. Ephemeral random (new wallet each time)
 */
export class TemporarySigner implements SignerInterface {
  private wallet: ethers.Wallet | ethers.HDNodeWallet;
  private options: Required<TemporarySignerOptions>;

  constructor(options?: TemporarySignerOptions) {
    this.options = {
      storage: 'none',
      storageKey: 'linera_readonly_wallet',
      ...options,
    } as Required<TemporarySignerOptions>;

    this.wallet = this.initializeWallet();
    logger.debug('[TemporarySigner] Wallet initialized:', this.wallet.address);
  }

  /**
   * Initialize wallet based on configuration priority:
   * 1. Constant address (highest priority)
   * 2. Storage (if enabled)
   * 3. Random ephemeral (fallback)
   */
  private initializeWallet(): ethers.Wallet | ethers.HDNodeWallet {
    // Priority 1: Constant address (most efficient for read-only)
    if (this.options.constantAddress) {
      logger.info('[TemporarySigner] Using constant address:', this.options.constantAddress);
      return this.createWalletFromConstant(this.options.constantAddress);
    }

    // Priority 2: Storage persistence
    if (this.options.storage !== 'none') {
      const stored = this.loadFromStorage();
      if (stored) {
        logger.info('[TemporarySigner] Loaded wallet from storage:', stored.address);
        return stored;
      }
    }

    // Priority 3: Random ephemeral (fallback)
    logger.info('[TemporarySigner] Creating ephemeral random wallet');
    const wallet = ethers.Wallet.createRandom();

    // Save to storage if enabled
    if (this.options.storage !== 'none') {
      this.saveToStorage(wallet);
    }

    return wallet;
  }

  /**
   * Create a deterministic wallet from a constant address
   * Uses the address to derive a consistent private key
   */
  private createWalletFromConstant(address: string): ethers.Wallet {
    // Validate address format
    if (!ethers.isAddress(address)) {
      throw new Error(`Invalid constant address: ${address}`);
    }

    // Create a deterministic private key from the address
    // This ensures the same address always generates the same wallet
    const hash = ethers.keccak256(ethers.toUtf8Bytes(`linera-readonly-${address.toLowerCase()}`));
    return new ethers.Wallet(hash);
  }

  /**
   * Load wallet from browser storage
   */
  private loadFromStorage(): ethers.Wallet | null {
    if (typeof window === 'undefined') return null;

    const storage = this.options.storage === 'localStorage'
      ? localStorage
      : sessionStorage;

    try {
      const stored = storage.getItem(this.options.storageKey);
      if (stored) {
        const { privateKey } = JSON.parse(stored);
        return new ethers.Wallet(privateKey);
      }
    } catch (error) {
      logger.warn('[TemporarySigner] Failed to load from storage:', error);
    }

    return null;
  }

  /**
   * Save wallet to browser storage
   */
  private saveToStorage(wallet: ethers.HDNodeWallet | ethers.Wallet): void {
    if (typeof window === 'undefined') return;

    const storage = this.options.storage === 'localStorage'
      ? localStorage
      : sessionStorage;

    try {
      storage.setItem(
        this.options.storageKey,
        JSON.stringify({ privateKey: wallet.privateKey })
      );
      logger.debug('[TemporarySigner] Wallet saved to', this.options.storage);
    } catch (error) {
      logger.warn('[TemporarySigner] Failed to save to storage:', error);
    }
  }

  /**
   * Clear wallet from storage
   */
  clearStorage(): void {
    if (typeof window === 'undefined') return;

    const storage = this.options.storage === 'localStorage'
      ? localStorage
      : sessionStorage;

    try {
      storage.removeItem(this.options.storageKey);
      logger.debug('[TemporarySigner] Wallet cleared from storage');
    } catch (error) {
      logger.warn('[TemporarySigner] Failed to clear storage:', error);
    }
  }

  /**
   * Sign a message with the temporary private key
   */
  async sign(owner: string, value: Uint8Array): Promise<string> {
    // Verify the owner matches our temporary address
    if (owner.toLowerCase() !== this.wallet.address.toLowerCase()) {
      throw new Error(
        `Owner mismatch: expected ${this.wallet.address}, got ${owner}`
      );
    }

    // Convert Uint8Array to hex string
    const msgHex = `0x${uint8ArrayToHex(value)}`;

    try {
      // Sign using ethers personal sign (EIP-191)
      const signature = await this.wallet.signMessage(ethers.getBytes(msgHex));
      return signature;
    } catch (err) {
      throw new Error(
        `Temporary signer failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /**
   * Check if this signer contains a specific key
   */
  async containsKey(owner: string): Promise<boolean> {
    return owner.toLowerCase() === this.wallet.address.toLowerCase();
  }

  /**
   * Get the temporary wallet address
   */
  async address(): Promise<string> {
    return this.wallet.address;
  }

  /**
   * Get the private key (for debugging only - NEVER expose in production)
   */
  getPrivateKey(): string {
    return this.wallet.privateKey;
  }
}

/**
 * Convert Uint8Array to hex string
 */
function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b: number) => b.toString(16).padStart(2, '0'))
    .join('');
}

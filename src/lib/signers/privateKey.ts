import { ethers, Wallet } from "ethers";
import { Signer as SignerInterface } from "@linera/client";

/**
 * A signer implementation that holds the private key in memory.
 *
 * ⚠️ WARNING: This class is intended **only for testing or development** purposes.
 * It stores the private key directly in memory, which makes it unsuitable for
 * production environments due to security risks.
 *
 * The `PrivateKey` signer uses an in-memory `ethers.Wallet` to sign messages following
 * the EIP-191 scheme. It verifies that the provided owner matches the wallet
 * address before signing.
 *
 * Supports key creation from both a raw private key and a mnemonic phrase.
 */
export class PrivateKey implements SignerInterface{
    private wallet;
    constructor(privateKeyHex: string) {
        this.wallet = new Wallet(privateKeyHex);
    }
    static createRandom() {
        const mnemonic = ethers.Wallet.createRandom().mnemonic?.phrase;
        return PrivateKey.fromMnemonic(mnemonic as string);
    }
    static fromMnemonic(mnemonic: string) {
        const wallet = ethers.Wallet.fromPhrase(mnemonic);
        return new PrivateKey(wallet.privateKey);
    }
    address() {
        return this.wallet.address;
    }
    async sign(owner: string, value: Uint8Array) {
        if (typeof owner !== "string" ||
            !ethers.isAddress(owner) ||
            this.wallet.address.toLowerCase() !== owner.toLowerCase()) {
            throw new Error("Invalid owner address");
        }
        // ethers expects a string or Bytes for EIP-191
        const signature = await this.wallet.signMessage(value);
        return signature;
    }
    async getPublicKey(owner: string) {
        if (typeof owner !== "string" ||
            !ethers.isAddress(owner) ||
            this.wallet.address.toLowerCase() !== owner.toLowerCase()) {
            throw new Error("Invalid owner address");
        }
        return this.wallet.signingKey.publicKey;
    }
    async containsKey(owner: string) {
        // The owner for Linera's EIP-191 wallet is the wallet address.
        if (typeof owner !== "string" || !ethers.isAddress(owner)) {
            throw new Error("Invalid owner address");
        }
        if (this.wallet.address.toLowerCase() !== owner.toLowerCase()) {
            return false; // The wallet does not contain the key for this owner
        }
        return true;
    }
}
//# sourceMappingURL=PrivateKey.js.map
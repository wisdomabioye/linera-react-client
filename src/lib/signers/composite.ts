import { Signer as SignerInterface } from "@linera/client";

/**
 * A signer implementation that tries multiple signers in series.
 */
export class Composite implements SignerInterface{
    private signers: SignerInterface[];

    constructor(...signers: SignerInterface[]) {
        this.signers = signers;
    }
    async sign(owner: string, value: Uint16Array): Promise<string> {
        for (const signer of this.signers)
            if (await signer.containsKey(owner))
                return await signer.sign(owner, value);
        throw new Error(`no signer found for owner ${owner}`);
    }
    async containsKey(owner: string): Promise<boolean> {
        for (const signer of this.signers)
            if (await signer.containsKey(owner))
                return true;
        return false;
    }
}
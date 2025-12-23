import { vi } from 'vitest';

export class TemporarySigner {
  private mockAddress = '0x1234567890123456789012345678901234567890';

  constructor(options?: any) {}

  async sign(owner: string, value: Uint8Array): Promise<string> {
    return '0xmocksignature';
  }

  async containsKey(owner: string): Promise<boolean> {
    return owner.toLowerCase() === this.mockAddress.toLowerCase();
  }

  async address(): Promise<string> {
    return this.mockAddress;
  }

  getPrivateKey(): string {
    return '0xmockprivatekey';
  }

  clearStorage(): void {}
}

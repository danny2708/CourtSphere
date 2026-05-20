import crypto from "node:crypto";

import { env } from "../../config/env";

export class MockPaymentGateway {
  constructor(
    private readonly secret: string = env.MOCK_PAYMENT_SECRET,
    private readonly transactionIdGenerator: () => string = defaultGatewayTransactionId
  ) {}

  createTransaction(): { gatewayTransactionId: string; paymentUrl: string } {
    const gatewayTransactionId = this.transactionIdGenerator();

    return {
      gatewayTransactionId,
      paymentUrl: `/mock-payment/${gatewayTransactionId}`
    };
  }

  sign(input: { gatewayTransactionId: string; status: string }): string {
    return crypto
      .createHmac("sha256", this.secret)
      .update(`${input.gatewayTransactionId}:${input.status}`)
      .digest("hex");
  }

  verify(input: { gatewayTransactionId: string; status: string; signature: string }): boolean {
    const expectedSignature = this.sign(input);
    const expected = Buffer.from(expectedSignature, "hex");
    const actual = Buffer.from(input.signature, "hex");

    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  }
}

function defaultGatewayTransactionId(): string {
  return `mock_${crypto.randomUUID()}`;
}

export const mockPaymentGateway = new MockPaymentGateway();


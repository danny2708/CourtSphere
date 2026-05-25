import crypto from "node:crypto";

import { RefundStatus } from "@prisma/client";

export type MockRefundGatewayResult = {
  refundStatus: Extract<RefundStatus, "SUCCESS" | "FAILED" | "MANUAL_REVIEW">;
  gatewayRefundId?: string;
};

export class MockRefundGateway {
  constructor(private readonly refundIdGenerator: () => string = defaultGatewayRefundId) {}

  processRefund(input: {
    refundId: string;
    forcedStatus?: Extract<RefundStatus, "SUCCESS" | "FAILED" | "MANUAL_REVIEW">;
  }): MockRefundGatewayResult {
    const refundStatus = input.forcedStatus ?? RefundStatus.SUCCESS;

    return {
      refundStatus,
      ...(refundStatus === RefundStatus.SUCCESS
        ? { gatewayRefundId: this.refundIdGenerator() }
        : {})
    };
  }
}

function defaultGatewayRefundId(): string {
  return `mock_refund_${crypto.randomUUID()}`;
}

export const mockRefundGateway = new MockRefundGateway();

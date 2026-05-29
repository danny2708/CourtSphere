import crypto from "node:crypto";

import { env } from "../../config/env";
import { AppError } from "../../middlewares/error.middleware";

type MomoCreatePaymentInput = {
  orderId: string;
  amount: number;
  orderInfo: string;
  extraData: string;
  orderExpireMinutes?: number;
  userInfo?: {
    name?: string | null;
    phoneNumber?: string | null;
    email?: string | null;
  };
};

type MomoCreatePaymentResponse = {
  partnerCode?: string;
  requestId?: string;
  orderId?: string;
  amount?: number;
  responseTime?: number;
  message?: string;
  resultCode?: number;
  payUrl?: string;
  shortLink?: string;
  deeplink?: string;
  qrCodeUrl?: string;
};

export type MomoPaymentResultInput = {
  partnerCode: string;
  orderId: string;
  requestId: string;
  amount: string;
  orderInfo: string;
  orderType: string;
  transId: string;
  resultCode: string;
  message: string;
  payType: string;
  responseTime: string;
  extraData: string;
  signature: string;
  [key: string]: unknown;
};

export type MomoPaymentCreateResult = {
  gatewayTransactionId: string;
  paymentUrl: string;
  rawResponse: MomoCreatePaymentResponse;
};

function hmacSha256(rawSignature: string, secretKey: string): string {
  return crypto.createHmac("sha256", secretKey).update(rawSignature).digest("hex");
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/$/, "");
}

function base64Json(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

export class MomoPaymentGateway {
  createOrderId(): string {
    return `CS-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  }

  encodeExtraData(value: Record<string, unknown>): string {
    return base64Json(value);
  }

  async createPayment(input: MomoCreatePaymentInput): Promise<MomoPaymentCreateResult> {
    this.assertConfigured();

    const requestId = input.orderId;
    const redirectUrl = this.redirectUrl();
    const ipnUrl = this.ipnUrl();
    const requestType = env.MOMO_REQUEST_TYPE;
    const rawSignature = this.createRequestRawSignature({
      amount: input.amount,
      extraData: input.extraData,
      ipnUrl,
      orderId: input.orderId,
      orderInfo: input.orderInfo,
      partnerCode: env.MOMO_PARTNER_CODE,
      redirectUrl,
      requestId,
      requestType
    });

    const payload = {
      partnerCode: env.MOMO_PARTNER_CODE,
      partnerName: env.MOMO_PARTNER_NAME,
      storeId: env.MOMO_STORE_ID,
      requestId,
      amount: input.amount,
      orderId: input.orderId,
      orderInfo: input.orderInfo,
      redirectUrl,
      ipnUrl,
      requestType,
      extraData: input.extraData,
      autoCapture: true,
      lang: env.MOMO_LANG,
      ...(input.orderExpireMinutes ? { orderExpireTime: input.orderExpireMinutes } : {}),
      ...(input.userInfo ? { userInfo: input.userInfo } : {}),
      signature: hmacSha256(rawSignature, env.MOMO_SECRET_KEY)
    };

    const response = await fetch(env.MOMO_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8"
      },
      body: JSON.stringify(payload)
    });

    const responsePayload = (await response.json().catch(() => ({}))) as MomoCreatePaymentResponse;

    if (!response.ok) {
      throw new AppError(502, "MoMo payment gateway did not accept the request", "MOMO_GATEWAY_HTTP_ERROR", responsePayload);
    }

    if (responsePayload.resultCode !== 0 || !responsePayload.payUrl) {
      throw new AppError(
        502,
        responsePayload.message ?? "MoMo payment gateway failed to create payment",
        "MOMO_CREATE_PAYMENT_FAILED",
        responsePayload
      );
    }

    return {
      gatewayTransactionId: input.orderId,
      paymentUrl: responsePayload.payUrl,
      rawResponse: responsePayload
    };
  }

  verifyPaymentResult(input: MomoPaymentResultInput): boolean {
    if (!env.MOMO_SECRET_KEY || input.partnerCode !== env.MOMO_PARTNER_CODE) {
      return false;
    }

    const rawSignature = [
      `accessKey=${env.MOMO_ACCESS_KEY}`,
      `amount=${input.amount}`,
      `extraData=${input.extraData}`,
      `message=${input.message}`,
      `orderId=${input.orderId}`,
      `orderInfo=${input.orderInfo}`,
      `orderType=${input.orderType}`,
      `partnerCode=${input.partnerCode}`,
      `payType=${input.payType}`,
      `requestId=${input.requestId}`,
      `responseTime=${input.responseTime}`,
      `resultCode=${input.resultCode}`,
      `transId=${input.transId}`
    ].join("&");

    return hmacSha256(rawSignature, env.MOMO_SECRET_KEY) === input.signature;
  }

  paymentStatus(input: MomoPaymentResultInput): "SUCCESS" | "FAILED" | "CANCELLED" {
    const resultCode = Number(input.resultCode);

    if (resultCode === 0) {
      return "SUCCESS";
    }

    if (resultCode === 1006) {
      return "CANCELLED";
    }

    return "FAILED";
  }

  private assertConfigured(): void {
    const missingKeys = [
      ["MOMO_PARTNER_CODE", env.MOMO_PARTNER_CODE],
      ["MOMO_ACCESS_KEY", env.MOMO_ACCESS_KEY],
      ["MOMO_SECRET_KEY", env.MOMO_SECRET_KEY]
    ]
      .filter(([, value]) => !value)
      .map(([key]) => key);

    if (missingKeys.length > 0) {
      throw new AppError(
        500,
        `Missing MoMo configuration: ${missingKeys.join(", ")}`,
        "MOMO_CONFIGURATION_MISSING"
      );
    }
  }

  private redirectUrl(): string {
    return env.MOMO_REDIRECT_URL ?? `${trimTrailingSlash(env.FRONTEND_BASE_URL)}/payments/momo-return`;
  }

  private ipnUrl(): string {
    return env.MOMO_IPN_URL ?? `${trimTrailingSlash(env.BACKEND_PUBLIC_BASE_URL)}/api/payments/callback/momo`;
  }

  private createRequestRawSignature(input: {
    amount: number;
    extraData: string;
    ipnUrl: string;
    orderId: string;
    orderInfo: string;
    partnerCode: string;
    redirectUrl: string;
    requestId: string;
    requestType: string;
  }): string {
    return [
      `accessKey=${env.MOMO_ACCESS_KEY}`,
      `amount=${input.amount}`,
      `extraData=${input.extraData}`,
      `ipnUrl=${input.ipnUrl}`,
      `orderId=${input.orderId}`,
      `orderInfo=${input.orderInfo}`,
      `partnerCode=${input.partnerCode}`,
      `redirectUrl=${input.redirectUrl}`,
      `requestId=${input.requestId}`,
      `requestType=${input.requestType}`
    ].join("&");
  }
}

export const momoPaymentGateway = new MomoPaymentGateway();

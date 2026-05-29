import { ApiClientError, type ApiErrorResponse } from "../types/api.types";

type ApiClientConfig = {
  getAccessToken?: () => string | null;
  onUnauthorized?: () => void;
  onForbidden?: () => void;
};

type ApiRequestOptions = Omit<RequestInit, "body"> & {
  auth?: boolean;
  body?: BodyInit | Record<string, unknown> | null;
  skipAuthRedirect?: boolean;
};

let apiClientConfig: ApiClientConfig = {};

const DEFAULT_API_BASE_URL = "http://localhost:3000";

function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || DEFAULT_API_BASE_URL;
}

function buildUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}

function isRecordBody(body: ApiRequestOptions["body"]): body is Record<string, unknown> {
  return Boolean(body) && typeof body === "object" && !(body instanceof FormData) && !(body instanceof URLSearchParams);
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export function configureApiClient(config: ApiClientConfig): void {
  apiClientConfig = {
    ...apiClientConfig,
    ...config
  };
}

export async function apiRequest<TResponse>(path: string, options: ApiRequestOptions = {}): Promise<TResponse> {
  const headers = new Headers(options.headers);

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  let requestBody = options.body ?? null;

  if (isRecordBody(requestBody)) {
    requestBody = JSON.stringify(requestBody);
    headers.set("Content-Type", "application/json");
  }

  const accessToken = options.auth ? apiClientConfig.getAccessToken?.() : null;

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(buildUrl(path), {
    ...options,
    headers,
    body: requestBody
  });

  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    const apiError = (payload ?? {}) as ApiErrorResponse;
    const errorBody = apiError.error;
    const error = new ApiClientError({
      status: response.status,
      code: errorBody?.code ?? `HTTP_${response.status}`,
      message: errorBody?.message ?? "Đã có lỗi xảy ra. Vui lòng thử lại.",
      details: errorBody?.details
    });

    if (response.status === 401 && !options.skipAuthRedirect) {
      apiClientConfig.onUnauthorized?.();
    }

    if (response.status === 403) {
      apiClientConfig.onForbidden?.();
    }

    throw error;
  }

  return payload as TResponse;
}

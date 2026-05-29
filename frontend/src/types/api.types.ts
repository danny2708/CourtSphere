export type ApiErrorResponse = {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

type ApiClientErrorInput = {
  status: number;
  code: string;
  message: string;
  details?: unknown;
};

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor({ status, code, message, details }: ApiClientErrorInput) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

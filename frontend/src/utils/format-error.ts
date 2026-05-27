import { ApiClientError } from "../types/api.types";

type FriendlyError = {
  title: string;
  message: string;
  status?: number;
  code?: string;
};

const statusMessages: Record<number, FriendlyError> = {
  401: {
    title: "Phiên đăng nhập đã hết hạn",
    message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
  },
  403: {
    title: "Không đủ quyền",
    message: "Bạn không có quyền truy cập chức năng này."
  },
  404: {
    title: "Không tìm thấy dữ liệu",
    message: "Không tìm thấy dữ liệu cần hiển thị."
  },
  409: {
    title: "Dữ liệu bị trùng",
    message: "Dữ liệu đã tồn tại hoặc đang xung đột với dữ liệu khác."
  },
  422: {
    title: "Dữ liệu chưa hợp lệ",
    message: "Vui lòng kiểm tra lại thông tin đã nhập."
  }
};

const codeMessages: Record<string, string> = {
  UNAUTHENTICATED: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  INVALID_ACCESS_TOKEN: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  ACCOUNT_LOCKED: "Tài khoản đang bị khóa.",
  ACCOUNT_DISABLED: "Tài khoản đã bị vô hiệu hóa.",
  INVALID_CREDENTIALS: "Email hoặc mật khẩu không đúng.",
  FORBIDDEN: "Bạn không có quyền truy cập chức năng này.",
  NOT_FOUND: "Không tìm thấy dữ liệu cần hiển thị.",
  EMAIL_ALREADY_EXISTS: "Email này đã được đăng ký.",
  PHONE_ALREADY_EXISTS: "Số điện thoại này đã được đăng ký.",
  IDENTITY_CODE_ALREADY_EXISTS: "Mã định danh này đã được đăng ký.",
  PRIORITY_GROUP_NOT_CONFIGURED: "Nhóm người dùng chưa được cấu hình. Vui lòng liên hệ quản trị viên.",
  VALIDATION_ERROR: "Vui lòng kiểm tra lại thông tin đã nhập."
};

export function formatApiError(error: unknown): FriendlyError {
  if (error instanceof ApiClientError) {
    const fallback = statusMessages[error.status] ?? {
      title: "Đã có lỗi xảy ra",
      message: "Đã có lỗi xảy ra. Vui lòng thử lại."
    };

    return {
      title: fallback.title,
      message: codeMessages[error.code] ?? error.message ?? fallback.message,
      status: error.status,
      code: error.code
    };
  }

  if (error instanceof Error) {
    return {
      title: "Đã có lỗi xảy ra",
      message: error.message
    };
  }

  return {
    title: "Đã có lỗi xảy ra",
    message: "Đã có lỗi xảy ra. Vui lòng thử lại."
  };
}

export function getErrorMessage(error: unknown): string {
  return formatApiError(error).message;
}

export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 401;
}

export function isForbiddenError(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 403;
}

export function isValidationError(error: unknown): boolean {
  return error instanceof ApiClientError && (error.status === 400 || error.status === 422 || error.code === "VALIDATION_ERROR");
}

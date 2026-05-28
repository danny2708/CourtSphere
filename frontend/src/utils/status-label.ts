export const bookingOrderStatusLabel = {
  PENDING_PAYMENT: "Chờ thanh toán",
  PAYMENT_PROCESSING: "Đang xử lý thanh toán",
  PAYMENT_EXPIRED: "Hết hạn thanh toán",
  CONFIRMED: "Đã xác nhận",
  PARTIALLY_CANCELLED: "Đã hủy một phần",
  IN_USE: "Đang sử dụng",
  CANCELLED_BY_USER: "Người dùng đã hủy",
  CANCELLED_BY_MANAGER: "Quản lý đã hủy",
  CANCELLED_BY_ADMIN: "Quản trị viên đã hủy",
  COMPLETED: "Hoàn thành",
  CHECKIN_EXPIRED: "Quá giờ check-in",
  NO_SHOW: "Vắng mặt"
} as const;

export const bookingItemStatusLabel = {
  PENDING_PAYMENT: "Chờ thanh toán",
  PAYMENT_PROCESSING: "Đang xử lý thanh toán",
  PAYMENT_EXPIRED: "Hết hạn thanh toán",
  CONFIRMED: "Đã xác nhận",
  IN_USE: "Đang sử dụng",
  COMPLETED: "Hoàn thành",
  CANCELLED_BY_USER: "Người dùng đã hủy",
  CANCELLED_BY_MANAGER: "Quản lý đã hủy",
  CANCELLED_BY_ADMIN: "Quản trị viên đã hủy",
  CHECKIN_EXPIRED: "Quá giờ check-in",
  NO_SHOW: "Vắng mặt"
} as const;

export const courtStatusLabel = {
  ACTIVE: "Đang hoạt động",
  MAINTENANCE: "Bảo trì",
  TEMP_CLOSED: "Tạm đóng",
  RETIRED: "Ngừng sử dụng"
} as const;

export const paymentStatusLabel = {
  INITIATED: "Đã khởi tạo",
  PROCESSING: "Đang xử lý",
  SUCCESS: "Thành công",
  FAILED: "Thất bại",
  CANCELLED: "Đã hủy",
  EXPIRED: "Hết hạn"
} as const;

export const refundStatusLabel = {
  REQUESTED: "Đã yêu cầu",
  PROCESSING: "Đang xử lý",
  SUCCESS: "Hoàn tiền thành công",
  FAILED: "Hoàn tiền thất bại",
  MANUAL_REVIEW: "Cần xử lý thủ công",
  REJECTED: "Đã từ chối"
} as const;

export const accountStatusLabel = {
  ACTIVE: "Đang hoạt động",
  LOCKED: "Đã khóa",
  DISABLED: "Vô hiệu hóa"
} as const;

export const bookingPermissionStatusLabel = {
  ALLOWED: "Được đặt sân",
  RESTRICTED: "Bị hạn chế đặt sân"
} as const;

export const entityStatusLabel = {
  ACTIVE: "Đang hoạt động",
  INACTIVE: "Ngừng hoạt động"
} as const;

export const violationTypeLabel = {
  NO_SHOW: "Vắng mặt",
  LATE_CANCELLATION: "Hủy sát giờ",
  MANUAL: "Thủ công"
} as const;

export const availabilitySlotStatusLabel = {
  AVAILABLE: "Còn trống",
  PENDING_PAYMENT: "Đang giữ chỗ",
  PAYMENT_PROCESSING: "Đang xử lý thanh toán",
  CONFIRMED: "Đã đặt",
  IN_USE: "Đang sử dụng",
  UNAVAILABLE: "Không khả dụng"
} as const;

export function getStatusLabel<TStatusMap extends Record<string, string>>(statusMap: TStatusMap, status: string): string {
  return statusMap[status] ?? status;
}

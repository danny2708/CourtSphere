import { CalendarRange, Clock3, RotateCcw, ShieldAlert, WalletCards } from "lucide-react";

import { Card } from "../../../components/common/Card";
import type { AvailabilityPolicyViewModel } from "../types/availability.types";

type CourtPolicyPanelProps = {
  policy: AvailabilityPolicyViewModel;
};

function formatPercent(value: number | undefined): string {
  return value === undefined ? "Theo cấu hình" : `${value}%`;
}

function formatMinutes(value: number | undefined): string {
  return value === undefined ? "Theo cấu hình" : `${value} phút`;
}

function formatHours(value: number | undefined): string {
  return value === undefined ? "Theo cấu hình" : `${value} giờ`;
}

export function CourtPolicyPanel({ policy }: CourtPolicyPanelProps) {
  return (
    <Card as="section" className="detail-card policy-panel">
      <div>
        <p className="eyebrow">Chính sách đặt sân</p>
        <h2>Quy định hủy, check-in và hoàn tiền</h2>
      </div>

      <div className="policy-list">
        <div>
          <Clock3 aria-hidden="true" size={20} />
          <span>Giữ chỗ thanh toán</span>
          <strong>{formatMinutes(policy.holdMinutes)}</strong>
        </div>
        <div>
          <RotateCcw aria-hidden="true" size={20} />
          <span>Hạn hủy trước giờ chơi</span>
          <strong>{formatHours(policy.cancelBeforeHours)}</strong>
        </div>
        <div>
          <ShieldAlert aria-hidden="true" size={20} />
          <span>Cho phép check-in muộn</span>
          <strong>{formatMinutes(policy.lateCheckinMinutes)}</strong>
        </div>
        <div>
          <WalletCards aria-hidden="true" size={20} />
          <span>Hoàn tiền khi user hủy đúng hạn</span>
          <strong>{formatPercent(policy.refundRateUserOnTime)}</strong>
        </div>
        <div>
          <WalletCards aria-hidden="true" size={20} />
          <span>Hoàn tiền khi sân lỗi/quản lý hủy</span>
          <strong>{formatPercent(policy.refundRateManagerFault)}</strong>
        </div>
        <div>
          <CalendarRange aria-hidden="true" size={20} />
          <span>Đặt trước tối đa</span>
          <strong>{policy.advanceBookingDays === undefined ? "Theo nhóm ưu tiên" : `${policy.advanceBookingDays} ngày`}</strong>
        </div>
      </div>

      <p className="policy-note">
        Quá giờ check-in hoặc no-show không được hoàn tiền. Người dùng không tự check-in; quản lý sân hoặc admin sẽ xác nhận khi bạn đến sân.
      </p>
    </Card>
  );
}

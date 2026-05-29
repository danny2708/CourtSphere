import { type FormEvent, useState } from "react";

import { Button } from "../../../components/common/Button";
import { cancelBookingFormSchema } from "../schemas/bookingSchemas";

type CancelBookingDialogProps = {
  isOpen: boolean;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: (reason?: string) => Promise<void>;
};

export function CancelBookingDialog({ isOpen, isSubmitting, onCancel, onConfirm }: CancelBookingDialogProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const parsedValue = cancelBookingFormSchema.safeParse({ reason });
    if (!parsedValue.success) {
      setError(parsedValue.error.issues[0]?.message ?? "Lý do hủy chưa hợp lệ.");
      return;
    }

    await onConfirm(parsedValue.data.reason);
  };

  return (
    <div className="dialog-backdrop" role="presentation">
      <form className="dialog-panel" onSubmit={handleSubmit}>
        <h2>Hủy đơn đặt sân</h2>
        <p>Đơn hủy đúng hạn có thể được hoàn tiền theo chính sách. Hủy sát giờ có thể không được hoàn tiền.</p>
        <label className="form-field">
          <span>Lý do hủy</span>
          <textarea
            maxLength={500}
            rows={4}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          {error ? <small>{error}</small> : null}
        </label>
        <div className="dialog-actions">
          <Button disabled={isSubmitting} variant="ghost" onClick={onCancel}>
            Đóng
          </Button>
          <Button disabled={isSubmitting} variant="danger" type="submit">
            {isSubmitting ? "Đang hủy..." : "Xác nhận hủy"}
          </Button>
        </div>
      </form>
    </div>
  );
}

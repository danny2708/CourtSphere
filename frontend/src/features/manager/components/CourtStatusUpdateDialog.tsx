import { type FormEvent, useState } from "react";

import { Button } from "../../../components/common/Button";
import { courtStatusLabel } from "../../../utils/status-label";
import type { ManagerCourtStatus, ManagerCourtViewModel } from "../types/manager.types";

type CourtStatusUpdateDialogProps = {
  court: ManagerCourtViewModel;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (status: ManagerCourtStatus, reason: string) => Promise<void> | void;
};

const courtStatuses: ManagerCourtStatus[] = ["ACTIVE", "MAINTENANCE", "TEMP_CLOSED", "RETIRED"];

export function CourtStatusUpdateDialog({ court, isSubmitting = false, onClose, onSubmit }: CourtStatusUpdateDialogProps) {
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<ManagerCourtStatus>(court.status);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (status === court.status) {
      setError("Trạng thái mới phải khác trạng thái hiện tại.");
      return;
    }

    if (status !== "ACTIVE" && reason.trim().length === 0) {
      setError("Vui lòng nhập lý do khi chuyển sân sang trạng thái không hoạt động.");
      return;
    }

    setError(null);
    await onSubmit(status, reason.trim());
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <form className="dialog-panel" onSubmit={handleSubmit}>
        <h2>Cập nhật trạng thái sân</h2>
        <p>{court.name}</p>

        <label className="form-field">
          <span>Trạng thái mới</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as ManagerCourtStatus)}>
            {courtStatuses.map((courtStatus) => (
              <option key={courtStatus} value={courtStatus}>
                {courtStatusLabel[courtStatus]}
              </option>
            ))}
          </select>
        </label>

        <label className="form-field">
          <span>Lý do</span>
          <textarea rows={4} value={reason} onChange={(event) => setReason(event.target.value)} />
        </label>

        {error ? <div className="form-error">{error}</div> : null}

        <div className="dialog-actions">
          <Button disabled={isSubmitting} variant="secondary" onClick={onClose}>
            Đóng
          </Button>
          <Button disabled={isSubmitting} type="submit">
            {isSubmitting ? "Đang lưu..." : "Cập nhật"}
          </Button>
        </div>
      </form>
    </div>
  );
}

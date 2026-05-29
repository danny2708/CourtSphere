import { type FormEvent, useState } from "react";

import { Button } from "../../../components/common/Button";

type ManagerActionDialogProps = {
  title: string;
  description: string;
  confirmLabel: string;
  isSubmitting?: boolean;
  isReasonRequired?: boolean;
  warning?: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
};

export function ManagerActionDialog({
  confirmLabel,
  description,
  isReasonRequired = false,
  isSubmitting = false,
  onClose,
  onConfirm,
  title,
  warning
}: ManagerActionDialogProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isReasonRequired && reason.trim().length === 0) {
      setError("Vui lòng nhập lý do xử lý.");
      return;
    }

    setError(null);
    await onConfirm(reason.trim());
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <form className="dialog-panel" onSubmit={handleSubmit}>
        <h2>{title}</h2>
        <p>{description}</p>
        {warning ? <p className="dialog-warning">{warning}</p> : null}

        <label className="form-field">
          <span>Lý do / ghi chú</span>
          <textarea
            maxLength={500}
            rows={4}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>

        {error ? <div className="form-error">{error}</div> : null}

        <div className="dialog-actions">
          <Button disabled={isSubmitting} variant="secondary" onClick={onClose}>
            Đóng
          </Button>
          <Button disabled={isSubmitting} type="submit" variant="danger">
            {isSubmitting ? "Đang xử lý..." : confirmLabel}
          </Button>
        </div>
      </form>
    </div>
  );
}

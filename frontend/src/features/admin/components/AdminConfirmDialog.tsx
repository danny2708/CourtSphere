import { type FormEvent, useState } from "react";

import { Button } from "../../../components/common/Button";

type AdminConfirmDialogProps = {
  confirmLabel?: string;
  message: string;
  reasonRequired?: boolean;
  title: string;
  tone?: "danger" | "primary";
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
};

export function AdminConfirmDialog({
  confirmLabel = "Xác nhận",
  message,
  onClose,
  onConfirm,
  reasonRequired = false,
  title,
  tone = "primary"
}: AdminConfirmDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reason, setReason] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (reasonRequired && reason.trim().length === 0) {
      setError("Vui lòng nhập lý do.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await onConfirm(reason.trim());
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <form className="dialog-panel" onSubmit={handleSubmit}>
        <h2>{title}</h2>
        <p>{message}</p>
        <label className="form-field">
          <span>Lý do / ghi chú</span>
          <textarea rows={4} value={reason} onChange={(event) => setReason(event.target.value)} />
        </label>
        {error ? <div className="form-error">{error}</div> : null}
        <div className="dialog-actions">
          <Button disabled={isSubmitting} variant="secondary" onClick={onClose}>
            Đóng
          </Button>
          <Button disabled={isSubmitting} type="submit" variant={tone === "danger" ? "danger" : "primary"}>
            {isSubmitting ? "Đang xử lý..." : confirmLabel}
          </Button>
        </div>
      </form>
    </div>
  );
}

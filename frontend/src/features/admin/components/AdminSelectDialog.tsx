import { type FormEvent, useState } from "react";

import { Button } from "../../../components/common/Button";

type AdminSelectDialogProps<TValue extends string> = {
  label: string;
  options: Array<{ label: string; value: TValue }>;
  title: string;
  defaultValue?: TValue;
  reasonRequired?: boolean;
  onClose: () => void;
  onConfirm: (value: TValue, reason: string) => Promise<void> | void;
};

export function AdminSelectDialog<TValue extends string>({
  defaultValue,
  label,
  onClose,
  onConfirm,
  options,
  reasonRequired = false,
  title
}: AdminSelectDialogProps<TValue>) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reason, setReason] = useState("");
  const [value, setValue] = useState<TValue>(defaultValue ?? options[0]!.value);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (reasonRequired && reason.trim().length === 0) {
      setError("Vui lòng nhập lý do.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await onConfirm(value, reason.trim());
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <form className="dialog-panel" onSubmit={handleSubmit}>
        <h2>{title}</h2>
        <label className="form-field">
          <span>{label}</span>
          <select value={value} onChange={(event) => setValue(event.target.value as TValue)}>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>Lý do / ghi chú</span>
          <textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
        </label>
        {error ? <div className="form-error">{error}</div> : null}
        <div className="dialog-actions">
          <Button disabled={isSubmitting} variant="secondary" onClick={onClose}>
            Đóng
          </Button>
          <Button disabled={isSubmitting} type="submit">
            {isSubmitting ? "Đang lưu..." : "Lưu"}
          </Button>
        </div>
      </form>
    </div>
  );
}

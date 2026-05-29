import { type FormEvent, useState } from "react";

import { Button } from "../../../components/common/Button";

export type AdminTextField = {
  key: string;
  label: string;
  required?: boolean;
  type?: "number" | "text" | "time" | "url";
};

type AdminTextFormDialogProps = {
  fields: AdminTextField[];
  initialValues?: Record<string, string | number | null | undefined>;
  title: string;
  onClose: () => void;
  onSubmit: (values: Record<string, string>) => Promise<void> | void;
};

export function AdminTextFormDialog({ fields, initialValues = {}, onClose, onSubmit, title }: AdminTextFormDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((field) => [field.key, initialValues[field.key]?.toString() ?? ""]))
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const missingField = fields.find((field) => field.required && values[field.key].trim().length === 0);
    if (missingField) {
      setError(`Vui lòng nhập ${missingField.label}.`);
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <form className="dialog-panel" onSubmit={handleSubmit}>
        <h2>{title}</h2>
        {fields.map((field) => (
          <label className="form-field" key={field.key}>
            <span>{field.label}</span>
            <input
              type={field.type ?? "text"}
              value={values[field.key]}
              onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
            />
          </label>
        ))}
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

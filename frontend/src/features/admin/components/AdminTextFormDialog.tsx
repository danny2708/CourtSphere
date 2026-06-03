import { type FormEvent, useState } from "react";

import { Button } from "../../../components/common/Button";

export type AdminTextField = {
  key: string;
  label: string;
  required?: boolean;
  type?: "file" | "number" | "select" | "text" | "time" | "url";
  accept?: string;
  options?: Array<{ label: string; value: string }>;
  placeholder?: string;
};

type AdminTextFormDialogProps = {
  fields: AdminTextField[];
  initialValues?: Record<string, string | number | null | undefined>;
  title: string;
  onClose: () => void;
  onSubmit: (values: Record<string, string>, files: Record<string, File | null>) => Promise<void> | void;
};

export function AdminTextFormDialog({ fields, initialValues = {}, onClose, onSubmit, title }: AdminTextFormDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((field) => [field.key, initialValues[field.key]?.toString() ?? ""]))
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const missingField = fields.find((field) => {
      if (!field.required) {
        return false;
      }

      if (field.type === "file") {
        return !files[field.key];
      }

      return values[field.key].trim().length === 0;
    });
    if (missingField) {
      setError(`Vui lòng nhập ${missingField.label}.`);
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit(values, files);
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
            {field.type === "file" ? (
              <input
                accept={field.accept}
                type="file"
                onChange={(event) =>
                  setFiles((current) => ({ ...current, [field.key]: event.target.files?.[0] ?? null }))
                }
              />
            ) : field.type === "select" ? (
              <select
                value={values[field.key]}
                onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
              >
                <option value="">{field.placeholder ?? `Chọn ${field.label}`}</option>
                {field.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={field.type ?? "text"}
                value={values[field.key]}
                onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
              />
            )}
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

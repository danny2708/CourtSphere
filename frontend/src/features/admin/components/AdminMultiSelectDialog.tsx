import { type FormEvent, useState } from "react";

import { Button } from "../../../components/common/Button";

type AdminMultiSelectDialogProps<TValue extends string> = {
  defaultValues?: TValue[];
  emptyMessage?: string;
  label: string;
  options: Array<{ label: string; value: TValue }>;
  title: string;
  onClose: () => void;
  onConfirm: (values: TValue[]) => Promise<void> | void;
};

export function AdminMultiSelectDialog<TValue extends string>({
  defaultValues = [],
  emptyMessage = "Không có lựa chọn khả dụng.",
  label,
  onClose,
  onConfirm,
  options,
  title
}: AdminMultiSelectDialogProps<TValue>) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [values, setValues] = useState<TValue[]>(defaultValues);

  function toggleValue(value: TValue) {
    setValues((currentValues) =>
      currentValues.includes(value)
        ? currentValues.filter((currentValue) => currentValue !== value)
        : [...currentValues, value]
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (values.length === 0) {
      setError("Vui lòng chọn ít nhất một mục.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await onConfirm(values);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <form className="dialog-panel" onSubmit={handleSubmit}>
        <h2>{title}</h2>
        <fieldset className="admin-multi-select">
          <legend>{label}</legend>
          {options.length > 0 ? (
            options.map((option) => (
              <label className="admin-multi-select__option" key={option.value}>
                <input
                  checked={values.includes(option.value)}
                  disabled={isSubmitting}
                  type="checkbox"
                  onChange={() => toggleValue(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))
          ) : (
            <p>{emptyMessage}</p>
          )}
        </fieldset>
        {error ? <div className="form-error">{error}</div> : null}
        <div className="dialog-actions">
          <Button disabled={isSubmitting} variant="secondary" onClick={onClose}>
            Đóng
          </Button>
          <Button disabled={isSubmitting || options.length === 0} type="submit">
            {isSubmitting ? "Đang lưu..." : "Lưu"}
          </Button>
        </div>
      </form>
    </div>
  );
}

type ErrorStateProps = {
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
};

export function ErrorState({
  title = "Đã có lỗi xảy ra",
  compact = false,
  message = "Không tải được dữ liệu. Vui lòng thử lại.",
  actionLabel,
  onAction
}: ErrorStateProps) {
  return (
    <section className={compact ? "state-inline state-inline--error" : "state-panel state-panel--error"} role="alert">
      <h1>{title}</h1>
      <p>{message}</p>
      {actionLabel && onAction ? (
        <button className="ui-button ui-button--primary ui-button--md" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </section>
  );
}

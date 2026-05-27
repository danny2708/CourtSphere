type LoadingStateProps = {
  message?: string;
  title?: string;
  compact?: boolean;
};

export function LoadingState({ compact = false, message = "Đang tải dữ liệu...", title = "Đang tải" }: LoadingStateProps) {
  return (
    <section className={compact ? "state-inline" : "state-panel"} aria-live="polite" aria-busy="true">
      <div className="loading-spinner" aria-hidden="true" />
      {!compact ? <h1>{title}</h1> : null}
      <p>{message}</p>
    </section>
  );
}

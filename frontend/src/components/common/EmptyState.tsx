import type { ReactNode } from "react";

type EmptyStateProps = {
  title?: string;
  message?: string;
  action?: ReactNode;
  compact?: boolean;
};

export function EmptyState({
  action,
  compact = false,
  title = "Chưa có dữ liệu",
  message = "Không có dữ liệu cần hiển thị ở thời điểm này."
}: EmptyStateProps) {
  return (
    <section className={compact ? "state-inline" : "state-panel"}>
      <h1>{title}</h1>
      <p>{message}</p>
      {action}
    </section>
  );
}

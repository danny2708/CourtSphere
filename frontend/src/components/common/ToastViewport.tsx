import { X } from "lucide-react";

import { useToastStore } from "../../stores/toast.store";
import { cn } from "../../utils/cn";

export function ToastViewport() {
  const { dismissToast, toasts } = useToastStore();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="toast-viewport" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={cn("toast", `toast--${toast.type}`)}>
          <div>
            <strong>{toast.title}</strong>
            {toast.message ? <p>{toast.message}</p> : null}
          </div>
          <button type="button" className="toast__close" onClick={() => dismissToast(toast.id)} aria-label="Đóng thông báo">
            <X aria-hidden="true" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

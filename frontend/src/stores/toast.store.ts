import { create } from "zustand";

export type ToastType = "success" | "error" | "info" | "warning";

export type Toast = {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
};

type AddToastInput = Omit<Toast, "id"> & {
  durationMs?: number;
};

type ToastState = {
  toasts: Toast[];
  addToast: (toast: AddToastInput) => void;
  dismissToast: (id: string) => void;
};

let toastCounter = 0;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  addToast: ({ durationMs = 4200, ...toast }) => {
    toastCounter += 1;
    const id = `toast-${Date.now()}-${toastCounter}`;

    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }]
    }));

    window.setTimeout(() => {
      get().dismissToast(id);
    }, durationMs);
  },

  dismissToast: (id: string) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id)
    }));
  }
}));

import { useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  CalendarCheck,
  Clock3,
  Edit3,
  Eye,
  ListOrdered,
  MoreVertical,
  RotateCcw,
  Settings,
  ShieldMinus,
  ShieldPlus,
  SlidersHorizontal,
  Trash2,
  Trophy,
  XCircle,
  type LucideIcon
} from "lucide-react";

export type AdminRowAction = {
  label: string;
  disabled?: boolean;
  tone?: "primary" | "danger" | "neutral";
  onSelect: () => void;
};

type AdminRowActionsProps = {
  actions: AdminRowAction[];
};

type ActionVisual = {
  color: "blue" | "green" | "red" | "amber" | "purple" | "gray";
  Icon: LucideIcon;
};

function getActionVisual(action: AdminRowAction): ActionVisual {
  const label = action.label.toLowerCase();

  if (label.includes("xóa")) {
    return { color: "red", Icon: Trash2 };
  }

  if (label.includes("hủy")) {
    return { color: "red", Icon: XCircle };
  }

  if (label.includes("gỡ")) {
    return { color: "red", Icon: ShieldMinus };
  }

  if (label.includes("xem lịch")) {
    return { color: "amber", Icon: Clock3 };
  }

  if (label.includes("xem")) {
    return { color: "green", Icon: Eye };
  }

  if (label.includes("xử lý lại")) {
    return { color: "amber", Icon: RotateCcw };
  }

  if (label.includes("miễn")) {
    return { color: "green", Icon: BadgeCheck };
  }

  if (label.includes("điều chỉnh")) {
    return { color: "amber", Icon: SlidersHorizontal };
  }

  if (label.includes("phiên bản")) {
    return { color: "red", Icon: ListOrdered };
  }

  if (label.includes("vai trò") && label.includes("gán")) {
    return { color: "blue", Icon: ShieldPlus };
  }

  if (label.includes("đặt sân") || label.includes("quyền")) {
    return { color: "green", Icon: CalendarCheck };
  }

  if (label.includes("ưu tiên")) {
    return { color: "purple", Icon: Trophy };
  }

  if (label.includes("trạng thái") || label.includes("tài khoản")) {
    return { color: "amber", Icon: Settings };
  }

  if (label.includes("sửa") || label.includes("cập nhật")) {
    return { color: "blue", Icon: Edit3 };
  }

  return { color: action.tone === "danger" ? "red" : action.tone === "primary" ? "blue" : "gray", Icon: Settings };
}

export function AdminRowActions({ actions }: AdminRowActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [placement, setPlacement] = useState<"bottom" | "top">("bottom");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function openPopover() {
    const rect = triggerRef.current?.getBoundingClientRect();

    if (rect) {
      const estimatedHeight = Math.min(actions.length * 42 + 18, window.innerHeight - 24);
      setPlacement(window.innerHeight - rect.bottom < estimatedHeight + 12 ? "top" : "bottom");
    }

    setIsOpen((current) => !current);
  }

  return (
    <div className="admin-row-actions" ref={rootRef}>
      <button
        aria-label="Mở thao tác"
        className="admin-row-actions__trigger"
        ref={triggerRef}
        type="button"
        onClick={openPopover}
      >
        <MoreVertical aria-hidden="true" size={18} />
      </button>

      {isOpen ? (
        <div aria-label="Thao tác dòng" className={`admin-action-popover admin-action-popover--${placement}`} role="menu">
          {actions.map((action) => {
            const { color, Icon } = getActionVisual(action);

            return (
              <button
                className="admin-action-popover__item"
                disabled={action.disabled}
                key={action.label}
                role="menuitem"
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  action.onSelect();
                }}
              >
                <Icon aria-hidden="true" className={`admin-action-popover__icon admin-action-popover__icon--${color}`} size={16} />
                <span>{action.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

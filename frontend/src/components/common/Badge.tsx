import type { ReactNode } from "react";

import { cn } from "../../utils/cn";

type BadgeTone = "primary" | "success" | "warning" | "danger" | "neutral";

type BadgeProps = {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
};

export function Badge({ children, className, tone = "primary" }: BadgeProps) {
  return <span className={cn("ui-badge", `ui-badge--${tone}`, className)}>{children}</span>;
}

import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "../../utils/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "icon";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({ children, className, size = "md", type = "button", variant = "primary", ...props }: ButtonProps) {
  return (
    <button className={cn("ui-button", `ui-button--${variant}`, `ui-button--${size}`, className)} type={type} {...props}>
      {children}
    </button>
  );
}

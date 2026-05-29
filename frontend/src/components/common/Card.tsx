import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../../utils/cn";

type CardProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  as?: "article" | "section" | "div";
};

export function Card({ as: Component = "div", children, className, ...props }: CardProps) {
  return (
    <Component className={cn("ui-card", className)} {...props}>
      {children}
    </Component>
  );
}

import type { ReactNode } from "react";

type AdminPageHeaderProps = {
  title: string;
  description: string;
  actions?: ReactNode;
};

export function AdminPageHeader({ actions, description, title }: AdminPageHeaderProps) {
  return (
    <section className="listing-header admin-header">
      <div>
        <p className="eyebrow">Admin</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions}
    </section>
  );
}

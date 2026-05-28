import type { ReactNode } from "react";

import { Card } from "../../../components/common/Card";

type AdminStatCardProps = {
  icon?: ReactNode;
  label: string;
  value: string | number;
  helper?: string;
};

export function AdminStatCard({ helper, icon, label, value }: AdminStatCardProps) {
  return (
    <Card as="article" className="admin-stat-card">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      {icon ? <div className="admin-stat-card__icon">{icon}</div> : null}
      {helper ? <p>{helper}</p> : null}
    </Card>
  );
}

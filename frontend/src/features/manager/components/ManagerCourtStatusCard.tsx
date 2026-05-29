import { MapPinned } from "lucide-react";

import { Button } from "../../../components/common/Button";
import { Card } from "../../../components/common/Card";
import { CourtStatusBadge } from "../../../components/courts/CourtStatusBadge";
import type { ManagerCourtViewModel } from "../types/manager.types";

type ManagerCourtStatusCardProps = {
  court: ManagerCourtViewModel;
  onUpdateStatus: (court: ManagerCourtViewModel) => void;
};

export function ManagerCourtStatusCard({ court, onUpdateStatus }: ManagerCourtStatusCardProps) {
  return (
    <Card as="article" className="manager-court-card">
      <div className="manager-court-card__media">
        {court.imageUrl ? <img alt="" src={court.imageUrl} /> : <MapPinned aria-hidden="true" size={34} />}
      </div>
      <div className="manager-court-card__body">
        <div>
          <h3>{court.name}</h3>
          <p>{court.courtTypeName ?? "Sân thể thao"}</p>
        </div>
        <CourtStatusBadge status={court.status} />
        {court.description ? <p>{court.description}</p> : null}
        <Button size="sm" onClick={() => onUpdateStatus(court)}>
          Cập nhật trạng thái
        </Button>
      </div>
    </Card>
  );
}

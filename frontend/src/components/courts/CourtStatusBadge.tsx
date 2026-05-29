import { Badge } from "../common/Badge";
import { courtStatusLabel } from "../../utils/status-label";
import type { CourtStatus } from "../../types/court.types";

const statusTone: Record<CourtStatus, "success" | "warning" | "danger" | "neutral"> = {
  ACTIVE: "success",
  MAINTENANCE: "warning",
  TEMP_CLOSED: "danger",
  RETIRED: "neutral"
};

type CourtStatusBadgeProps = {
  status: CourtStatus;
};

export function CourtStatusBadge({ status }: CourtStatusBadgeProps) {
  return <Badge tone={statusTone[status]}>{courtStatusLabel[status]}</Badge>;
}

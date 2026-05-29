import { Badge } from "../common/Badge";

type CourtTagBadgeProps = {
  tag: string;
};

export function CourtTagBadge({ tag }: CourtTagBadgeProps) {
  return <Badge tone="primary">{tag}</Badge>;
}

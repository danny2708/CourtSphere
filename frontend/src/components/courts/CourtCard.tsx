import { Clock, MapPin, Star } from "lucide-react";

import { Button } from "../common/Button";
import { Badge } from "../common/Badge";
import { Card } from "../common/Card";
import { CourtStatusBadge } from "./CourtStatusBadge";
import { CourtTagBadge } from "./CourtTagBadge";
import { FavoriteButton } from "./FavoriteButton";
import { ShareButton } from "./ShareButton";
import type { CourtCardViewModel, CourtStatus } from "../../types/court.types";

type CourtCardProps = {
  court: CourtCardViewModel;
  onBook?: (courtId: string) => void;
  onShare?: (courtId: string) => void;
  onToggleFavorite?: (courtId: string) => void;
};

const bookingButtonText: Record<CourtStatus, string> = {
  ACTIVE: "Đặt lịch",
  MAINTENANCE: "Bảo trì",
  TEMP_CLOSED: "Tạm đóng",
  RETIRED: "Ngừng sử dụng"
};

function getOpenHours(court: CourtCardViewModel): string | null {
  if (!court.openTime || !court.closeTime) {
    return null;
  }

  return `${court.openTime} - ${court.closeTime}`;
}

export function CourtCard({ court, onBook, onShare, onToggleFavorite }: CourtCardProps) {
  const openHours = getOpenHours(court);
  const canBook = court.status === "ACTIVE";

  return (
    <Card as="article" className="court-card">
      <div className="court-card__media">
        {court.imageUrl ? (
          <img alt={`Ảnh sân ${court.name}`} src={court.imageUrl} />
        ) : (
          <div className="court-card__placeholder" aria-hidden="true">
            <span>{court.name.slice(0, 2).toUpperCase()}</span>
          </div>
        )}

        <div className="court-card__top-badges">
          {typeof court.rating === "number" ? (
            <Badge className="rating-badge" tone="neutral">
              <Star aria-hidden="true" fill="currentColor" size={14} />
              {court.rating.toFixed(1)}
            </Badge>
          ) : null}
          {court.hasPromotion ? <Badge tone="warning">Ưu đãi</Badge> : null}
        </div>

        <div className="court-card__media-actions">
          <FavoriteButton isFavorite={court.isFavorite} onClick={() => onToggleFavorite?.(court.id)} />
          <ShareButton onClick={() => onShare?.(court.id)} />
        </div>
      </div>

      <div className="court-card__body">
        <div className="court-card__status-row">
          <CourtStatusBadge status={court.status} />
          {court.distanceText ? <span className="court-distance">{court.distanceText}</span> : null}
        </div>

        <div>
          <h2>{court.name}</h2>
          {court.address ? (
            <p className="court-meta">
              <MapPin aria-hidden="true" size={16} />
              <span>{court.address}</span>
            </p>
          ) : null}
          {openHours ? (
            <p className="court-meta">
              <Clock aria-hidden="true" size={16} />
              <span>{openHours}</span>
            </p>
          ) : null}
        </div>

        <div className="court-card__tags">
          {court.tags.slice(0, 4).map((tag) => (
            <CourtTagBadge key={tag} tag={tag} />
          ))}
        </div>

        <Button className="court-card__cta" disabled={!canBook} onClick={() => onBook?.(court.id)}>
          {bookingButtonText[court.status]}
        </Button>
      </div>
    </Card>
  );
}

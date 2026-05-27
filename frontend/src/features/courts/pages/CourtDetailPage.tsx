import { useEffect, useState } from "react";
import { ArrowLeft, Clock, MapPin, UsersRound } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { Badge } from "../../../components/common/Badge";
import { Button } from "../../../components/common/Button";
import { Card } from "../../../components/common/Card";
import { ErrorState } from "../../../components/common/ErrorState";
import { LoadingState } from "../../../components/common/LoadingState";
import { CourtStatusBadge } from "../../../components/courts/CourtStatusBadge";
import { CourtTagBadge } from "../../../components/courts/CourtTagBadge";
import { FavoriteButton } from "../../../components/courts/FavoriteButton";
import { ShareButton } from "../../../components/courts/ShareButton";
import { ROUTE_PATHS } from "../../../routes/route-paths";
import { useToastStore } from "../../../stores/toast.store";
import { getCourtById } from "../services/courtService";
import type { CourtDetailViewModel } from "../types/court-detail.types";

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  currency: "VND",
  maximumFractionDigits: 0,
  style: "currency"
});

function getAvailabilityText(court: CourtDetailViewModel): string {
  if (court.status === "ACTIVE") {
    return "Đặt sân";
  }

  if (court.status === "MAINTENANCE") {
    return "Bảo trì";
  }

  if (court.status === "TEMP_CLOSED") {
    return "Tạm đóng";
  }

  return "Ngừng sử dụng";
}

export function CourtDetailPage() {
  const navigate = useNavigate();
  const { courtId } = useParams<{ courtId: string }>();
  const { addToast } = useToastStore();
  const [court, setCourt] = useState<CourtDetailViewModel | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadCourt() {
      if (!courtId) {
        setNotFound(true);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const loadedCourt = await getCourtById(courtId);

      if (!isMounted) {
        return;
      }

      setCourt(loadedCourt);
      setIsFavorite(Boolean(loadedCourt?.isFavorite));
      setNotFound(!loadedCourt);
      setIsLoading(false);
    }

    void loadCourt();

    return () => {
      isMounted = false;
    };
  }, [courtId]);

  if (isLoading) {
    return <LoadingState message="Đang tải chi tiết sân..." title="Chi tiết sân" />;
  }

  if (notFound || !court) {
    return (
      <ErrorState
        actionLabel="Về danh sách sân"
        message="Không tìm thấy sân cần hiển thị hoặc sân đã được gỡ khỏi danh sách."
        title="Không tìm thấy sân"
        onAction={() => navigate(ROUTE_PATHS.courts)}
      />
    );
  }

  const canBook = court.status === "ACTIVE";

  return (
    <section className="page-stack">
      <div className="detail-topbar">
        <Link className="ui-button ui-button--ghost ui-button--md" to={ROUTE_PATHS.courts}>
          <ArrowLeft aria-hidden="true" size={18} />
          Quay lại
        </Link>
        <div className="detail-actions">
          <FavoriteButton isFavorite={isFavorite} onClick={() => setIsFavorite((current) => !current)} />
          <ShareButton
            onClick={() =>
              addToast({
                type: "info",
                title: "Chia sẻ sân",
                message: `Đã chọn chia sẻ ${court.name}.`
              })
            }
          />
        </div>
      </div>

      <div className="court-detail-hero">
        <div className="court-detail-hero__media">
          {court.imageUrl ? (
            <img alt={`Ảnh sân ${court.name}`} src={court.imageUrl} />
          ) : (
            <div className="court-detail-hero__placeholder" aria-hidden="true">
              <span>{court.name.slice(0, 2).toUpperCase()}</span>
            </div>
          )}
        </div>

        <div className="court-detail-hero__content">
          <div className="court-detail-hero__badges">
            <CourtStatusBadge status={court.status} />
            {court.hasPromotion ? <Badge tone="warning">Ưu đãi</Badge> : null}
          </div>
          <p className="eyebrow">{court.courtType}</p>
          <h1>{court.name}</h1>
          <p>{court.description}</p>

          <div className="detail-meta-grid">
            <div>
              <MapPin aria-hidden="true" size={20} />
              <span>Vị trí</span>
              <strong>{court.address}</strong>
            </div>
            <div>
              <UsersRound aria-hidden="true" size={20} />
              <span>Sức chứa</span>
              <strong>{court.capacity} người</strong>
            </div>
            <div>
              <Clock aria-hidden="true" size={20} />
              <span>Giờ mở cửa</span>
              <strong>
                {court.openTime} - {court.closeTime}
              </strong>
            </div>
          </div>

          <Button disabled={!canBook} onClick={() => addToast({ type: "info", title: "Đặt sân", message: "Luồng đặt sân sẽ được triển khai ở module booking." })}>
            {getAvailabilityText(court)}
          </Button>
        </div>
      </div>

      <div className="court-detail-grid">
        <Card as="section" className="detail-card">
          <h2>Thông tin sân</h2>
          <dl className="detail-list">
            <div>
              <dt>Loại sân</dt>
              <dd>{court.courtType}</dd>
            </div>
            <div>
              <dt>Khu vực</dt>
              <dd>{court.area}</dd>
            </div>
            <div>
              <dt>Giá tham khảo</dt>
              <dd>{court.startingPrice ? `Từ ${currencyFormatter.format(court.startingPrice)}` : "Chưa có dữ liệu"}</dd>
            </div>
            <div>
              <dt>Trạng thái</dt>
              <dd>
                <CourtStatusBadge status={court.status} />
              </dd>
            </div>
          </dl>
        </Card>

        <Card as="section" className="detail-card">
          <h2>Khung giờ hoạt động</h2>
          <div className="operating-hours-list">
            {court.operatingHours.map((hour) => (
              <div key={`${hour.weekday}-${hour.openTime}`}>
                <span>{hour.weekday}</span>
                <strong>
                  {hour.openTime} - {hour.closeTime}
                </strong>
              </div>
            ))}
          </div>
        </Card>

        <Card as="section" className="detail-card detail-card--wide">
          <h2>Tiện ích và tag</h2>
          <div className="amenity-list">
            {court.amenities.map((amenity) => (
              <Badge key={amenity} tone="neutral">
                {amenity}
              </Badge>
            ))}
          </div>
          <div className="court-card__tags">
            {court.tags.map((tag) => (
              <CourtTagBadge key={tag} tag={tag} />
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}

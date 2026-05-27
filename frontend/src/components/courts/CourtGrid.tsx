import { EmptyState } from "../common/EmptyState";
import { CourtCard } from "./CourtCard";
import type { CourtCardViewModel } from "../../types/court.types";

type CourtGridProps = {
  courts: CourtCardViewModel[];
  onBook?: (courtId: string) => void;
  onShare?: (courtId: string) => void;
  onToggleFavorite?: (courtId: string) => void;
};

export function CourtGrid({ courts, onBook, onShare, onToggleFavorite }: CourtGridProps) {
  if (courts.length === 0) {
    return <EmptyState title="Chưa có sân nào phù hợp" message="Chưa có sân nào phù hợp với bộ lọc." />;
  }

  return (
    <div className="court-grid">
      {courts.map((court) => (
        <CourtCard
          key={court.id}
          court={court}
          onBook={onBook}
          onShare={onShare}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
    </div>
  );
}

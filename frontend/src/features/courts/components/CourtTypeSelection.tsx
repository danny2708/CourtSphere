import { Dumbbell, Grid2X2, Trophy } from "lucide-react";

import { Badge } from "../../../components/common/Badge";
import { Card } from "../../../components/common/Card";
import type { CourtDetailViewModel } from "../types/court-detail.types";

export type CourtTypeSummary = {
  typeName: string;
  totalCourts: number;
  activeCourts: number;
  imageUrl?: string;
  sampleCourtNames: string[];
};

type CourtTypeSelectionProps = {
  courtTypes: CourtTypeSummary[];
  onSelect: (courtType: string) => void;
};

export function buildCourtTypeSummaries(courts: CourtDetailViewModel[]): CourtTypeSummary[] {
  const summaries = new Map<string, CourtTypeSummary>();

  courts.forEach((court) => {
    const currentSummary = summaries.get(court.courtType) ?? {
      typeName: court.courtType,
      totalCourts: 0,
      activeCourts: 0,
      imageUrl: undefined,
      sampleCourtNames: []
    };

    currentSummary.totalCourts += 1;
    currentSummary.activeCourts += court.status === "ACTIVE" ? 1 : 0;
    currentSummary.imageUrl ??= court.imageUrl;

    if (currentSummary.sampleCourtNames.length < 3) {
      currentSummary.sampleCourtNames.push(court.name);
    }

    summaries.set(court.courtType, currentSummary);
  });

  return Array.from(summaries.values()).sort((first, second) => first.typeName.localeCompare(second.typeName, "vi"));
}

export function filterCourtTypes(courtTypes: CourtTypeSummary[], searchKeyword: string): CourtTypeSummary[] {
  const keyword = searchKeyword.trim().toLowerCase();

  if (!keyword) {
    return courtTypes;
  }

  return courtTypes.filter((courtType) => {
    const searchableText = [courtType.typeName, ...courtType.sampleCourtNames].join(" ").toLowerCase();
    return searchableText.includes(keyword);
  });
}

export function CourtTypeSelection({ courtTypes, onSelect }: CourtTypeSelectionProps) {
  return (
    <div className="court-type-grid">
      {courtTypes.map((courtType) => (
        <Card as="article" className="court-type-card" key={courtType.typeName}>
          <button className="court-type-card__button" type="button" onClick={() => onSelect(courtType.typeName)}>
            <div className="court-type-card__media">
              {courtType.imageUrl ? (
                <img alt={`Ảnh loại sân ${courtType.typeName}`} src={courtType.imageUrl} />
              ) : (
                <div className="court-type-card__placeholder" aria-hidden="true">
                  <Trophy size={34} />
                </div>
              )}
              <Badge className="court-type-card__badge" tone={courtType.activeCourts > 0 ? "success" : "warning"}>
                {courtType.activeCourts} sân hoạt động
              </Badge>
            </div>

            <div className="court-type-card__body">
              <div>
                <span className="court-type-card__icon" aria-hidden="true">
                  {courtType.typeName.toLowerCase().includes("gym") ? <Dumbbell size={20} /> : <Grid2X2 size={20} />}
                </span>
                <h2>{courtType.typeName}</h2>
              </div>
              <p>{courtType.totalCourts} sân trong hệ thống</p>
              {courtType.sampleCourtNames.length ? (
                <span className="court-type-card__sample">{courtType.sampleCourtNames.join(", ")}</span>
              ) : null}
            </div>
          </button>
        </Card>
      ))}
    </div>
  );
}

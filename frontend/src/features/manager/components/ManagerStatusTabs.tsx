import { Button } from "../../../components/common/Button";
import { bookingItemStatusLabel } from "../../../utils/status-label";
import type { ManagerBookingItemStatus } from "../types/manager.types";

export type ManagerStatusTabValue = "ALL" | ManagerBookingItemStatus;

const tabs: Array<{ label: string; value: ManagerStatusTabValue }> = [
  { label: "Tất cả", value: "ALL" },
  { label: bookingItemStatusLabel.CONFIRMED, value: "CONFIRMED" },
  { label: bookingItemStatusLabel.IN_USE, value: "IN_USE" },
  { label: bookingItemStatusLabel.CHECKIN_EXPIRED, value: "CHECKIN_EXPIRED" },
  { label: bookingItemStatusLabel.COMPLETED, value: "COMPLETED" },
  { label: bookingItemStatusLabel.NO_SHOW, value: "NO_SHOW" }
];

type ManagerStatusTabsProps = {
  value: ManagerStatusTabValue;
  onChange: (value: ManagerStatusTabValue) => void;
};

export function ManagerStatusTabs({ onChange, value }: ManagerStatusTabsProps) {
  return (
    <div className="manager-tabs" role="tablist" aria-label="Lọc trạng thái booking item">
      {tabs.map((tab) => (
        <Button
          aria-selected={value === tab.value}
          key={tab.value}
          role="tab"
          size="sm"
          variant={value === tab.value ? "primary" : "secondary"}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
        </Button>
      ))}
    </div>
  );
}

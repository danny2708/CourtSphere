import type { BookingStatusHistory } from "../types/booking.types";
import { bookingOrderStatusLabel, getStatusLabel } from "../../../utils/status-label";

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
  month: "2-digit",
  year: "numeric"
});

export function BookingTimeline({ histories }: { histories: BookingStatusHistory[] }) {
  if (histories.length === 0) {
    return <p className="empty-copy">Chưa có lịch sử trạng thái.</p>;
  }

  return (
    <ol className="booking-timeline">
      {histories.map((history, index) => (
        <li key={history.id ?? `${history.actionType}-${index}`}>
          <span aria-hidden="true" />
          <div>
            <strong>{getStatusLabel(bookingOrderStatusLabel, history.newStatus)}</strong>
            <p>{history.note ?? history.actionType}</p>
            {history.changedAt ? <time>{dateTimeFormatter.format(new Date(history.changedAt))}</time> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

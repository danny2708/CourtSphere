import { ManagerScheduleView } from "./ManagerScheduleView";

export function ManagerCheckinPage() {
  return (
    <ManagerScheduleView
      description="Danh sách booking đã xác nhận và đã thanh toán, chờ manager xác nhận người đặt đã đến sân."
      emptyDescription="Không có booking nào cần check-in lúc này."
      emptyTitle="Không có booking chờ check-in"
      fixedStatus="CONFIRMED"
      title="Check-in booking"
    />
  );
}

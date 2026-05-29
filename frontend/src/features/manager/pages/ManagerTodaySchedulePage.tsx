import { ManagerScheduleView } from "./ManagerScheduleView";

export function ManagerTodaySchedulePage() {
  return (
    <ManagerScheduleView
      description="Theo dõi booking item trong ngày, lọc theo sân, người đặt, trạng thái và khung giờ."
      emptyDescription="Không có booking nào phù hợp với bộ lọc hiện tại."
      emptyTitle="Chưa có lịch vận hành"
      title="Lịch sân hôm nay"
    />
  );
}

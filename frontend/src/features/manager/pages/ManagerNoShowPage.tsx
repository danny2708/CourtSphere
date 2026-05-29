import { ManagerScheduleView } from "./ManagerScheduleView";

export function ManagerNoShowPage() {
  return (
    <ManagerScheduleView
      description="Xử lý booking đã quá giờ check-in bằng xác nhận no-show hoặc cho phép check-in muộn có lý do."
      emptyDescription="Không có booking quá giờ check-in cần xử lý."
      emptyTitle="Không có no-show cần xử lý"
      fixedStatus="CHECKIN_EXPIRED"
      title="Xử lý no-show"
    />
  );
}

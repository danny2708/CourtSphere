import { ManagerScheduleView } from "./ManagerScheduleView";

export function ManagerUsageHistoryPage() {
  return (
    <ManagerScheduleView
      description="Lịch sử sử dụng hiện dùng dữ liệu lịch hôm nay từ backend vì chưa có endpoint history riêng."
      emptyDescription="Chưa có dữ liệu sử dụng phù hợp trong ngày."
      emptyTitle="Chưa có lịch sử sử dụng"
      title="Lịch sử sử dụng sân"
    />
  );
}

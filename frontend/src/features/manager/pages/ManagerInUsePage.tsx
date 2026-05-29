import { ManagerScheduleView } from "./ManagerScheduleView";

export function ManagerInUsePage() {
  return (
    <ManagerScheduleView
      description="Theo dõi booking đang sử dụng. Override complete chỉ dùng cho ngoại lệ, không phải luồng mặc định."
      emptyDescription="Không có booking nào đang sử dụng."
      emptyTitle="Chưa có booking đang sử dụng"
      fixedStatus="IN_USE"
      title="Booking đang sử dụng"
    />
  );
}

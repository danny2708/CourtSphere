import { Link } from "react-router-dom";
import { CalendarCheck, ClipboardCheck, History, MapPinned, Timer, UserX } from "lucide-react";

import { Card } from "../../../components/common/Card";
import { ROUTE_PATHS } from "../../../routes/route-paths";
import { ManagerNavigation } from "../components/ManagerNavigation";

const dashboardItems = [
  {
    description: "Xem toàn bộ booking item trong ngày theo sân, giờ và trạng thái.",
    icon: CalendarCheck,
    title: "Lịch hôm nay",
    to: ROUTE_PATHS.managerToday
  },
  {
    description: "Xác nhận người đặt đã đến sân. Người dùng không tự check-in.",
    icon: ClipboardCheck,
    title: "Check-in",
    to: ROUTE_PATHS.managerCheckIn
  },
  {
    description: "Theo dõi booking đang sử dụng và chỉ override complete khi có ngoại lệ.",
    icon: Timer,
    title: "Đang sử dụng",
    to: ROUTE_PATHS.managerInUse
  },
  {
    description: "Xử lý CHECKIN_EXPIRED bằng no-show hoặc override check-in muộn.",
    icon: UserX,
    title: "No-show",
    to: ROUTE_PATHS.managerNoShow
  },
  {
    description: "Cập nhật trạng thái sân khi bảo trì, tạm đóng hoặc hoạt động lại.",
    icon: MapPinned,
    title: "Trạng thái sân",
    to: ROUTE_PATHS.managerCourts
  },
  {
    description: "Xem lịch sử sử dụng theo dữ liệu vận hành hiện có.",
    icon: History,
    title: "Lịch sử sử dụng",
    to: ROUTE_PATHS.managerHistory
  }
];

export function ManagerDashboardPage() {
  return (
    <div className="manager-page">
      <ManagerNavigation />
      <section className="listing-header manager-header">
        <div>
          <p className="eyebrow">Field Manager</p>
          <h1>Khu vực quản lý sân</h1>
          <p>Vận hành check-in, no-show, hủy do sự cố và cập nhật trạng thái sân.</p>
        </div>
      </section>

      <div className="manager-dashboard-grid">
        {dashboardItems.map((item) => {
          const Icon = item.icon;

          return (
            <Link key={item.to} to={item.to}>
              <Card as="article" className="manager-dashboard-card">
                <Icon aria-hidden="true" size={24} />
                <h2>{item.title}</h2>
                <p>{item.description}</p>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

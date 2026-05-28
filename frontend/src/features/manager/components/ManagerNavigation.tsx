import { NavLink } from "react-router-dom";
import { CalendarCheck, ClipboardCheck, History, MapPinned, Timer, UserX } from "lucide-react";

import { ROUTE_PATHS } from "../../../routes/route-paths";

const managerNavItems = [
  { icon: CalendarCheck, label: "Hôm nay", to: ROUTE_PATHS.managerToday },
  { icon: ClipboardCheck, label: "Check-in", to: ROUTE_PATHS.managerCheckIn },
  { icon: Timer, label: "Đang sử dụng", to: ROUTE_PATHS.managerInUse },
  { icon: UserX, label: "No-show", to: ROUTE_PATHS.managerNoShow },
  { icon: MapPinned, label: "Trạng thái sân", to: ROUTE_PATHS.managerCourts },
  { icon: History, label: "Lịch sử", to: ROUTE_PATHS.managerHistory }
];

export function ManagerNavigation() {
  return (
    <nav className="manager-nav" aria-label="Điều hướng quản lý sân">
      {managerNavItems.map((item) => {
        const Icon = item.icon;

        return (
          <NavLink
            className={({ isActive }) => `manager-nav__link${isActive ? " manager-nav__link--active" : ""}`}
            key={item.to}
            to={item.to}
          >
            <Icon aria-hidden="true" size={17} />
            {item.label}
          </NavLink>
        );
      })}
    </nav>
  );
}

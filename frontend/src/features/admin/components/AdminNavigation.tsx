import { NavLink, useLocation } from "react-router-dom";
import {
  BarChart3,
  ClipboardList,
  CreditCard,
  FileWarning,
  Gauge,
  MapPinned,
  ShieldCheck,
  SlidersHorizontal,
  Trophy,
  Undo2,
  UsersRound
} from "lucide-react";

import { ROUTE_PATHS } from "../../../routes/route-paths";

const navItems = [
  { icon: Gauge, label: "Tổng quan", to: ROUTE_PATHS.adminDashboard },
  { icon: UsersRound, label: "Người dùng", to: ROUTE_PATHS.adminUsers },
  { icon: ShieldCheck, label: "Vai trò", to: ROUTE_PATHS.adminRoles },
  { icon: Trophy, label: "Nhóm ưu tiên", to: ROUTE_PATHS.adminPriorityGroups },
  { icon: MapPinned, label: "Loại sân", to: ROUTE_PATHS.adminCourtTypes },
  { icon: MapPinned, label: "Sân", to: ROUTE_PATHS.adminCourts },
  { icon: SlidersHorizontal, label: "Quy tắc", to: ROUTE_PATHS.adminBookingRules },
  { icon: ClipboardList, label: "Chính sách", to: ROUTE_PATHS.adminPriorityPolicies },
  { icon: CreditCard, label: "Thanh toán", to: ROUTE_PATHS.adminPayments },
  { icon: Undo2, label: "Hoàn tiền", to: ROUTE_PATHS.adminRefunds },
  { icon: FileWarning, label: "Vi phạm", to: ROUTE_PATHS.adminViolations },
  { icon: BarChart3, label: "Báo cáo", to: ROUTE_PATHS.adminReports }
];

export function AdminNavigation() {
  const location = useLocation();

  return (
    <nav className="admin-nav" aria-label="Điều hướng quản trị">
      {navItems.map((item) => {
        const Icon = item.icon;

        return (
          <NavLink
            className={({ isActive }) => {
              const isDashboardAlias = item.to === ROUTE_PATHS.adminDashboard && location.pathname === ROUTE_PATHS.adminHome;

              return `admin-nav__link${isActive || isDashboardAlias ? " admin-nav__link--active" : ""}`;
            }}
            key={item.to}
            to={item.to}
          >
            <Icon aria-hidden="true" size={16} />
            {item.label}
          </NavLink>
        );
      })}
    </nav>
  );
}

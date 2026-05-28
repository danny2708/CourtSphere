import { NavLink } from "react-router-dom";
import {
  BadgeDollarSign,
  BarChart3,
  CalendarClock,
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
  { icon: Gauge, label: "Dashboard", to: ROUTE_PATHS.adminDashboard },
  { icon: UsersRound, label: "Users", to: ROUTE_PATHS.adminUsers },
  { icon: ShieldCheck, label: "Roles", to: ROUTE_PATHS.adminRoles },
  { icon: Trophy, label: "Priority", to: ROUTE_PATHS.adminPriorityGroups },
  { icon: MapPinned, label: "Loại sân", to: ROUTE_PATHS.adminCourtTypes },
  { icon: MapPinned, label: "Sân", to: ROUTE_PATHS.adminCourts },
  { icon: CalendarClock, label: "Giờ mở", to: ROUTE_PATHS.adminOperatingHours },
  { icon: BadgeDollarSign, label: "Bảng giá", to: ROUTE_PATHS.adminPricingRules },
  { icon: SlidersHorizontal, label: "Rules", to: ROUTE_PATHS.adminBookingRules },
  { icon: ClipboardList, label: "Policies", to: ROUTE_PATHS.adminPriorityPolicies },
  { icon: CreditCard, label: "Payments", to: ROUTE_PATHS.adminPayments },
  { icon: Undo2, label: "Refunds", to: ROUTE_PATHS.adminRefunds },
  { icon: FileWarning, label: "Violations", to: ROUTE_PATHS.adminViolations },
  { icon: BarChart3, label: "Reports", to: ROUTE_PATHS.adminReports }
];

export function AdminNavigation() {
  return (
    <nav className="admin-nav" aria-label="Điều hướng quản trị">
      {navItems.map((item) => {
        const Icon = item.icon;

        return (
          <NavLink
            className={({ isActive }) => `admin-nav__link${isActive ? " admin-nav__link--active" : ""}`}
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

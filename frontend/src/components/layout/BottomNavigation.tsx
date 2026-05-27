import { Home, Map, Search, Sparkles, UserRound } from "lucide-react";
import { NavLink } from "react-router-dom";

import { ROUTE_PATHS } from "../../routes/route-paths";
import { cn } from "../../utils/cn";

const bottomNavItems = [
  { label: "Trang chủ", to: ROUTE_PATHS.home, icon: Home, end: true },
  { label: "Bản đồ", to: ROUTE_PATHS.map, icon: Map, end: false },
  { label: "Khám phá", to: ROUTE_PATHS.courts, icon: Search, end: false },
  { label: "Nổi bật", to: ROUTE_PATHS.featured, icon: Sparkles, end: false },
  { label: "Tài khoản", to: ROUTE_PATHS.account, icon: UserRound, end: false }
] as const;

export function BottomNavigation() {
  return (
    <nav className="bottom-nav" aria-label="Điều hướng nhanh">
      {bottomNavItems.map((item) => {
        const Icon = item.icon;

        return (
          <NavLink
            key={`${item.label}-${item.to}`}
            className={({ isActive }) => cn("bottom-nav__item", isActive && "bottom-nav__item--active")}
            to={item.to}
            end={item.end}
          >
            <Icon aria-hidden="true" size={20} />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

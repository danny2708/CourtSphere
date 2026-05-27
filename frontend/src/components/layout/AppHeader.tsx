import { CalendarDays, LogIn, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router-dom";

import { ROUTE_PATHS } from "../../routes/route-paths";
import { useAuthStore } from "../../stores/auth.store";
import { useToastStore } from "../../stores/toast.store";
import { cn } from "../../utils/cn";
import { getErrorMessage } from "../../utils/format-error";
import { Button } from "../common/Button";

const navItems = [
  { label: "Trang chủ", to: ROUTE_PATHS.home },
  { label: "Khám phá", to: ROUTE_PATHS.userHome },
  { label: "Quản lý", to: ROUTE_PATHS.managerHome },
  { label: "Admin", to: ROUTE_PATHS.adminHome }
] as const;

const todayFormatter = new Intl.DateTimeFormat("vi-VN", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});

export function AppHeader() {
  const navigate = useNavigate();
  const { addToast } = useToastStore();
  const { isAuthenticated, logout, user } = useAuthStore();
  const todayText = todayFormatter.format(new Date());

  const handleLogout = async () => {
    try {
      await logout();
      addToast({ type: "success", title: "Đã đăng xuất" });
      navigate(ROUTE_PATHS.login, { replace: true });
    } catch (error) {
      addToast({
        type: "error",
        title: "Không thể đăng xuất",
        message: getErrorMessage(error)
      });
    }
  };

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <Link className="brand-link" to={ROUTE_PATHS.home} aria-label="CourtSphere">
          <span className="brand-mark">CS</span>
          <span className="brand-text">CourtSphere</span>
        </Link>

        <div className="header-date" aria-label={`Hôm nay ${todayText}`}>
          <CalendarDays aria-hidden="true" size={16} />
          <span>{todayText}</span>
        </div>

        <nav className="top-nav" aria-label="Điều hướng chính">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              className={({ isActive }) => cn("top-nav__link", isActive && "top-nav__link--active")}
              to={item.to}
              end={item.to === ROUTE_PATHS.home}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="header-actions">
          {isAuthenticated && user ? (
            <>
              <div className="user-chip" title={user.email}>
                {user.roles.includes("ADMIN") ? <ShieldCheck aria-hidden="true" size={16} /> : <UserRound aria-hidden="true" size={16} />}
                <span>{user.fullName}</span>
              </div>
              <Button className="header-icon-button" size="sm" variant="icon" onClick={handleLogout} aria-label="Đăng xuất">
                <LogOut aria-hidden="true" size={18} />
              </Button>
            </>
          ) : (
            <>
              <Link className="ui-button ui-button--secondary ui-button--md" to={ROUTE_PATHS.login}>
                <LogIn aria-hidden="true" size={16} />
                Đăng nhập
              </Link>
              <Link className="ui-button ui-button--primary ui-button--md primary-button--compact" to={ROUTE_PATHS.register}>
                Đăng ký
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

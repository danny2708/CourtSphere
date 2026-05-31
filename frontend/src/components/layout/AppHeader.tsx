import { useEffect, useState } from "react";
import {
  CalendarCheck,
  CalendarDays,
  Home,
  LogIn,
  LogOut,
  Map,
  Menu,
  Search,
  ShieldCheck,
  UserRound,
  X
} from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router-dom";

import { ROUTE_PATHS } from "../../routes/route-paths";
import { NotificationBell } from "../../features/notifications/components/NotificationBell";
import { useAuthStore } from "../../stores/auth.store";
import { useToastStore } from "../../stores/toast.store";
import type { RoleName } from "../../types/auth.types";
import { cn } from "../../utils/cn";
import { getErrorMessage } from "../../utils/format-error";
import { Button } from "../common/Button";

type HeaderNavItem = {
  end?: boolean;
  icon: typeof Home;
  label: string;
  to: string;
};

const todayFormatter = new Intl.DateTimeFormat("vi-VN", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});

const timeFormatter = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  hour12: false,
  minute: "2-digit"
});

function getPrimaryRoleLabel(roles: RoleName[]): string {
  if (roles.includes("ADMIN")) {
    return "Admin";
  }

  if (roles.includes("FIELD_MANAGER") || roles.includes("MANAGER")) {
    return "Quản lý";
  }

  return "User";
}

function hasAnyRole(roles: RoleName[] | undefined, allowedRoles: RoleName[]): boolean {
  return Boolean(roles?.some((role) => allowedRoles.includes(role)));
}

export function AppHeader() {
  const navigate = useNavigate();
  const { addToast } = useToastStore();
  const { isAuthenticated, logout, user } = useAuthStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const todayText = todayFormatter.format(currentTime);
  const timeText = timeFormatter.format(currentTime);
  const canAccessManager = hasAnyRole(user?.roles, ["FIELD_MANAGER", "MANAGER", "ADMIN"]);
  const canAccessAdmin = hasAnyRole(user?.roles, ["ADMIN"]);
  const navItems: HeaderNavItem[] = [
    { end: true, icon: Home, label: "Trang chủ", to: ROUTE_PATHS.home },
    { icon: Search, label: "Khám phá", to: ROUTE_PATHS.courts },
    ...(isAuthenticated ? [{ icon: CalendarCheck, label: "Đơn của tôi", to: ROUTE_PATHS.myBookings }] : []),
    ...(canAccessManager ? [{ icon: UserRound, label: "Quản lý", to: ROUTE_PATHS.managerHome }] : []),
    ...(canAccessAdmin ? [{ icon: ShieldCheck, label: "Admin", to: ROUTE_PATHS.adminHome }] : [])
  ];
  const mobileNavItems: HeaderNavItem[] = [
    ...navItems,
    { icon: Map, label: "Bản đồ", to: ROUTE_PATHS.map },
    ...(isAuthenticated ? [{ icon: UserRound, label: "Tài khoản", to: ROUTE_PATHS.account }] : [])
  ];

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => window.clearInterval(timerId);
  }, []);

  const executeLogout = async () => {
    try {
      await logout();
      setIsLogoutModalOpen(false);
      setIsMobileMenuOpen(false);
      addToast({ type: "success", title: "Đã đăng xuất" });
      navigate(ROUTE_PATHS.login, { replace: true });
    } catch (error) {
      setIsLogoutModalOpen(false);
      addToast({
        type: "error",
        title: "Không thể đăng xuất",
        message: getErrorMessage(error)
      });
    }
  };

  const handleLogoutClick = () => {
    setIsLogoutModalOpen(true);
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <Link className="brand-link" to={ROUTE_PATHS.home} aria-label="CourtSphere">
          <span className="brand-mark">CS</span>
          <span className="brand-text">CourtSphere</span>
        </Link>

        <div className="header-date" aria-label={`Hôm nay ${todayText}, ${timeText}`}>
          <CalendarDays aria-hidden="true" size={16} />
          <span>{todayText}</span>
          <span className="header-date__time">{timeText}</span>
        </div>

        <nav className="top-nav" aria-label="Điều hướng chính">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              className={({ isActive }) => cn("top-nav__link", isActive && "top-nav__link--active")}
              to={item.to}
              end={item.end}
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
                <span className="user-chip__name">{user.fullName}</span>
                <span className="user-chip__role">{getPrimaryRoleLabel(user.roles)}</span>
              </div>
              <NotificationBell />
              <Button className="header-icon-button" size="sm" variant="icon" onClick={handleLogoutClick} aria-label="Đăng xuất">
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
          <Button
            aria-expanded={isMobileMenuOpen}
            aria-label={isMobileMenuOpen ? "Đóng menu" : "Mở menu"}
            className="mobile-menu-button"
            size="sm"
            variant="icon"
            onClick={() => setIsMobileMenuOpen((current) => !current)}
          >
            {isMobileMenuOpen ? <X aria-hidden="true" size={18} /> : <Menu aria-hidden="true" size={18} />}
          </Button>
        </div>
      </div>

      {isMobileMenuOpen ? (
        <div className="mobile-menu" role="dialog" aria-label="Menu điều hướng">
          <button className="mobile-menu__backdrop" type="button" aria-label="Đóng menu" onClick={closeMobileMenu} />
          <div className="mobile-menu__panel">
            <div className="mobile-menu__date">
              <CalendarDays aria-hidden="true" size={18} />
              <span>
                {todayText}
                <span className="header-date__time">{timeText}</span>
              </span>
            </div>

            {isAuthenticated && user ? (
              <div className="mobile-menu__user">
                {user.roles.includes("ADMIN") ? <ShieldCheck aria-hidden="true" size={18} /> : <UserRound aria-hidden="true" size={18} />}
                <div>
                  <strong>{user.fullName}</strong>
                  <span>{getPrimaryRoleLabel(user.roles)}</span>
                </div>
              </div>
            ) : null}

            <nav className="mobile-menu__nav" aria-label="Điều hướng mobile">
              {mobileNavItems.map((item) => {
                const Icon = item.icon;

                return (
                  <NavLink
                    className={({ isActive }) => cn("mobile-menu__link", isActive && "mobile-menu__link--active")}
                    end={item.end}
                    key={`${item.label}-${item.to}`}
                    to={item.to}
                    onClick={closeMobileMenu}
                  >
                    <Icon aria-hidden="true" size={18} />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>

            <div className="mobile-menu__actions">
              {isAuthenticated ? (
                <Button variant="ghost" onClick={handleLogoutClick}>
                  <LogOut aria-hidden="true" size={18} />
                  Đăng xuất
                </Button>
              ) : (
                <>
                  <Link className="ui-button ui-button--secondary ui-button--md" to={ROUTE_PATHS.login} onClick={closeMobileMenu}>
                    <LogIn aria-hidden="true" size={16} />
                    Đăng nhập
                  </Link>
                  <Link className="ui-button ui-button--primary ui-button--md" to={ROUTE_PATHS.register} onClick={closeMobileMenu}>
                    Đăng ký
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {isLogoutModalOpen ? (
        <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="logout-dialog-title">
          <div className="dialog-panel">
            <h2 id="logout-dialog-title">Xác nhận đăng xuất</h2>
            <p>Bạn có chắc muốn đăng xuất khỏi hệ thống không?</p>
            <div className="dialog-actions">
              <Button variant="secondary" onClick={() => setIsLogoutModalOpen(false)}>
                Hủy
              </Button>
              <Button variant="danger" onClick={executeLogout}>
                Xác nhận
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}

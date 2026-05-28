import { Link } from "react-router-dom";
import { CreditCard, FileWarning, MapPinned, Undo2, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "../../../components/common/Button";
import { Card } from "../../../components/common/Card";
import { ErrorState } from "../../../components/common/ErrorState";
import { LoadingState } from "../../../components/common/LoadingState";
import { ROUTE_PATHS } from "../../../routes/route-paths";
import { getErrorMessage } from "../../../utils/format-error";
import { AdminNavigation } from "../components/AdminNavigation";
import { AdminPageHeader } from "../components/AdminPageHeader";
import { AdminStatCard } from "../components/AdminStatCard";
import { getAdminOverview } from "../services/adminService";
import type { AdminOverviewReport } from "../types/admin.types";
import { formatMoney } from "../utils/adminFormat";

const quickLinks = [
  { icon: UsersRound, label: "Users", to: ROUTE_PATHS.adminUsers },
  { icon: MapPinned, label: "Courts", to: ROUTE_PATHS.adminCourts },
  { icon: CreditCard, label: "Payments", to: ROUTE_PATHS.adminPayments },
  { icon: Undo2, label: "Refunds", to: ROUTE_PATHS.adminRefunds },
  { icon: FileWarning, label: "Violations", to: ROUTE_PATHS.adminViolations }
];

export function AdminDashboardPage() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [overview, setOverview] = useState<AdminOverviewReport | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadOverview() {
      setError(null);
      setIsLoading(true);
      try {
        const data = await getAdminOverview();
        if (isMounted) {
          setOverview(data);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(getErrorMessage(loadError));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadOverview();

    return () => {
      isMounted = false;
    };
  }, [reloadKey]);

  return (
    <div className="admin-page">
      <AdminNavigation />
      <AdminPageHeader
        title="Admin dashboard"
        description="Theo dõi booking, doanh thu, refund, no-show và dữ liệu vận hành cốt lõi."
        actions={<Button onClick={() => setReloadKey((value) => value + 1)}>Tải lại</Button>}
      />

      {isLoading ? <LoadingState message="Đang tải dashboard..." /> : null}
      {error && !isLoading ? <ErrorState actionLabel="Tải lại" message={error} title="Không tải được dashboard" onAction={() => setReloadKey((value) => value + 1)} /> : null}

      {overview && !isLoading && !error ? (
        <>
          <div className="admin-stat-grid">
            <AdminStatCard label="Tổng đơn" value={overview.totalBookingOrders ?? 0} />
            <AdminStatCard label="Booking items" value={overview.totalBookingItems ?? 0} />
            <AdminStatCard label="Doanh thu" value={formatMoney(overview.totalRevenue)} />
            <AdminStatCard label="Refund success" value={formatMoney(overview.totalRefundAmount)} />
            <AdminStatCard label="No-show" value={overview.totalNoShow ?? 0} />
            <AdminStatCard label="Sân active" value={overview.activeCourts ?? 0} />
          </div>

          <div className="admin-dashboard-links">
            {quickLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link key={link.to} to={link.to}>
                  <Card as="article" className="admin-dashboard-link">
                    <Icon aria-hidden="true" size={22} />
                    <strong>{link.label}</strong>
                  </Card>
                </Link>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}

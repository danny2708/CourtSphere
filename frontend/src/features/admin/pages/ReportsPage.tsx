import { useEffect, useState } from "react";

import { Button } from "../../../components/common/Button";
import { Card } from "../../../components/common/Card";
import { ErrorState } from "../../../components/common/ErrorState";
import { LoadingState } from "../../../components/common/LoadingState";
import { AdminNavigation } from "../components/AdminNavigation";
import { AdminPageHeader } from "../components/AdminPageHeader";
import { AdminStatCard } from "../components/AdminStatCard";
import { getAdminReportsBundle } from "../services/adminService";
import type { AdminReportBundle } from "../types/admin.types";
import { formatMoney, stringifyCompact } from "../utils/adminFormat";
import { getErrorMessage } from "../../../utils/format-error";

export function ReportsPage() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [reports, setReports] = useState<AdminReportBundle | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadReports() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getAdminReportsBundle();
        if (isMounted) setReports(data);
      } catch (loadError) {
        if (isMounted) setError(getErrorMessage(loadError));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    void loadReports();
    return () => {
      isMounted = false;
    };
  }, [reloadKey]);

  return (
    <div className="admin-page">
      <AdminNavigation />
      <AdminPageHeader title="Reports" description="Báo cáo booking, doanh thu, sử dụng sân, tỷ lệ và vi phạm." actions={<Button onClick={() => setReloadKey((value) => value + 1)}>Tải lại</Button>} />
      {isLoading ? <LoadingState message="Đang tải reports..." /> : null}
      {error && !isLoading ? <ErrorState actionLabel="Tải lại" message={error} title="Không tải được reports" onAction={() => setReloadKey((value) => value + 1)} /> : null}
      {reports && !isLoading && !error ? (
        <>
          <div className="admin-stat-grid">
            <AdminStatCard label="Booking orders" value={reports.overview?.totalBookingOrders ?? 0} />
            <AdminStatCard label="Revenue" value={formatMoney(reports.overview?.totalRevenue)} />
            <AdminStatCard label="Refunded" value={formatMoney(reports.overview?.totalRefundAmount)} />
            <AdminStatCard label="Violations" value={reports.overview?.violationCount ?? 0} />
          </div>
          <div className="admin-report-grid">
            {[
              ["Booking report", reports.bookings],
              ["Revenue report", reports.revenue],
              ["Court usage", reports.courtUsage],
              ["Rates", reports.rates],
              ["Violating users", reports.violations]
            ].map(([title, value]) => (
              <Card as="section" className="admin-report-card" key={title as string}>
                <h2>{title as string}</h2>
                <pre>{stringifyCompact(value)}</pre>
              </Card>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

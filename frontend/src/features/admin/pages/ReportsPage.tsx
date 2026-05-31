import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { Badge } from "../../../components/common/Badge";
import { Button } from "../../../components/common/Button";
import { Card } from "../../../components/common/Card";
import { ErrorState } from "../../../components/common/ErrorState";
import { LoadingState } from "../../../components/common/LoadingState";
import { getErrorMessage } from "../../../utils/format-error";
import { AdminNavigation } from "../components/AdminNavigation";
import { AdminPageHeader } from "../components/AdminPageHeader";
import { AdminStatCard } from "../components/AdminStatCard";
import { getAdminReportsBundle } from "../services/adminService";
import type {
  AdminBookingReport,
  AdminCourtUsageReport,
  AdminOverviewReport,
  AdminRatesReport,
  AdminReportBundle,
  AdminRevenueReport,
  AdminViolatingUsersReport
} from "../types/admin.types";
import { formatMoney } from "../utils/adminFormat";

const percentFormatter = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0
});

type TrendRange = "week" | "month" | "year";
type OperationalTab = "courtUsage" | "rates" | "violations";

type SegmentOption<T extends string> = {
  label: string;
  value: T;
};

const trendRangeOptions: Array<SegmentOption<TrendRange>> = [
  { label: "Tuần", value: "week" },
  { label: "Tháng", value: "month" },
  { label: "Năm", value: "year" }
];

const operationalTabOptions: Array<SegmentOption<OperationalTab>> = [
  { label: "Sử dụng sân", value: "courtUsage" },
  { label: "Tỷ lệ", value: "rates" },
  { label: "Vi phạm", value: "violations" }
];

function FluidSegmentedControl<T extends string>({
  ariaLabel,
  onChange,
  options,
  value
}: {
  ariaLabel: string;
  onChange: (value: T) => void;
  options: Array<SegmentOption<T>>;
  value: T;
}) {
  const activeIndex = Math.max(0, options.findIndex((option) => option.value === value));

  return (
    <div
      className="admin-fluid-segmented"
      role="group"
      aria-label={ariaLabel}
      style={{ "--active-index": activeIndex, "--segment-count": options.length } as CSSProperties}
    >
      {options.map((option) => (
        <button
          aria-pressed={value === option.value}
          className={value === option.value ? "admin-fluid-segmented__item admin-fluid-segmented__item--active" : "admin-fluid-segmented__item"}
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function buildTrendQuery(range: TrendRange): { fromDate: string; toDate: string; groupBy: "day" | "month" } {
  const toDate = new Date();
  const fromDate = new Date(toDate);

  if (range === "week") {
    fromDate.setDate(toDate.getDate() - 6);
  } else if (range === "month") {
    fromDate.setDate(1);
    fromDate.setHours(0, 0, 0, 0);
  } else {
    fromDate.setMonth(0, 1);
    fromDate.setHours(0, 0, 0, 0);
  }

  return {
    fromDate: fromDate.toISOString(),
    groupBy: range === "year" ? "month" : "day",
    toDate: toDate.toISOString()
  };
}

function getNetRevenue(overview: AdminOverviewReport | undefined): number | undefined {
  if (!overview) {
    return undefined;
  }

  if (typeof overview.netRevenue === "number") {
    return overview.netRevenue;
  }

  if (typeof overview.totalRevenue === "number" && typeof overview.totalRefundAmount === "number") {
    return overview.totalRevenue - overview.totalRefundAmount;
  }

  return overview.totalRevenue;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function formatPercent(value: number | undefined): string {
  return `${percentFormatter.format(value ?? 0)}%`;
}

function formatMinutes(value: number): string {
  if (value < 60) {
    return `${value}m`;
  }

  const hours = Math.floor(value / 60);
  const minutes = value % 60;

  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

function getBookingPermissionLabel(status: string): string {
  if (status === "RESTRICTED") {
    return "Bị hạn chế";
  }

  if (status === "ALLOWED") {
    return "Được đặt sân";
  }

  return status;
}

function getSeriesMax(values: number[]): number {
  return Math.max(1, ...values);
}

function EmptyReportState({ message = "Không có dữ liệu trong khoảng thời gian này." }: { message?: string }) {
  return <p className="admin-chart-empty">{message}</p>;
}

function RevenueTrendChart({ report }: { report: AdminRevenueReport | undefined }) {
  const buckets = report?.buckets ?? [];
  const values = buckets.map((bucket) => bucket.netRevenue);
  const maxValue = getSeriesMax(values);
  const width = 640;
  const height = 220;
  const paddingX = 28;
  const paddingTop = 18;
  const paddingBottom = 42;
  const plotHeight = height - paddingTop - paddingBottom;
  const step = buckets.length > 1 ? (width - paddingX * 2) / (buckets.length - 1) : 0;
  const points = buckets.map((bucket, index) => {
    const x = buckets.length > 1 ? paddingX + index * step : width / 2;
    const y = paddingTop + plotHeight - (bucket.netRevenue / maxValue) * plotHeight;

    return { bucket, x, y };
  });

  return (
    <Card as="section" className="admin-report-card admin-chart-card admin-chart-card--wide">
      <div className="admin-report-card__header">
        <div>
          <h2>Xu hướng doanh thu</h2>
          <p>Doanh thu ròng theo thời gian sau khi trừ các khoản hoàn tiền thành công.</p>
        </div>
        <strong>{formatMoney(report?.totals?.netRevenue)}</strong>
      </div>

      {points.length === 0 ? (
        <EmptyReportState />
      ) : (
        <div className="admin-chart-scroll">
          <svg className="admin-line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Xu hướng doanh thu ròng">
            <line className="admin-chart-grid-line" x1={paddingX} x2={width - paddingX} y1={paddingTop + plotHeight} y2={paddingTop + plotHeight} />
            <polyline className="admin-line-chart__line" points={points.map((point) => `${point.x},${point.y}`).join(" ")} />
            {points.map((point) => (
              <g key={point.bucket.period}>
                <circle className="admin-line-chart__point" cx={point.x} cy={point.y} r="5" />
                <text className="admin-chart-axis-label" textAnchor="middle" x={point.x} y={height - 16}>
                  {point.bucket.period}
                </text>
              </g>
            ))}
          </svg>
        </div>
      )}
    </Card>
  );
}

function BookingTrendChart({ report }: { report: AdminBookingReport | undefined }) {
  const buckets = report?.buckets ?? [];
  const maxValue = getSeriesMax(buckets.flatMap((bucket) => [bucket.bookingOrdersCount, bucket.bookingItemsCount]));
  const width = 640;
  const height = 260;
  const paddingX = 28;
  const paddingTop = 34;
  const paddingBottom = 46;
  const plotHeight = height - paddingTop - paddingBottom;
  const groupWidth = buckets.length > 0 ? (width - paddingX * 2) / buckets.length : 0;
  const barWidth = Math.max(8, Math.min(26, groupWidth * 0.24));
  const labelOffset = 8;

  return (
    <Card as="section" className="admin-report-card admin-chart-card admin-chart-card--wide">
      <div className="admin-report-card__header">
        <div>
          <h2>Xu hướng đặt sân</h2>
          <p>Số đơn được tạo và số lượt sân đã đặt theo từng mốc thời gian.</p>
        </div>
        <div className="admin-chart-legend">
          <span><i className="admin-chart-legend__mark admin-chart-legend__mark--primary" /> Đơn</span>
          <span><i className="admin-chart-legend__mark admin-chart-legend__mark--accent" /> Lượt sân</span>
        </div>
      </div>

      {buckets.length === 0 ? (
        <EmptyReportState />
      ) : (
        <div className="admin-chart-scroll">
          <svg className="admin-bar-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Xu hướng đặt sân">
            <line className="admin-chart-grid-line" x1={paddingX} x2={width - paddingX} y1={paddingTop + plotHeight} y2={paddingTop + plotHeight} />
            {buckets.map((bucket, index) => {
              const groupX = paddingX + index * groupWidth + groupWidth / 2;
              const orderHeight = (bucket.bookingOrdersCount / maxValue) * plotHeight;
              const itemHeight = (bucket.bookingItemsCount / maxValue) * plotHeight;
              const baseY = paddingTop + plotHeight;
              const orderX = groupX - barWidth - 3;
              const itemX = groupX + 3;
              const orderLabelY = Math.max(14, baseY - orderHeight - labelOffset);
              const itemLabelY = Math.max(14, baseY - itemHeight - labelOffset);

              return (
                <g key={bucket.period}>
                  <g
                    aria-label={`${bucket.period}: ${bucket.bookingOrdersCount} đơn`}
                    className="admin-bar-chart__series"
                    tabIndex={0}
                  >
                    <title>{`${bucket.period}: ${bucket.bookingOrdersCount} đơn`}</title>
                    <rect className="admin-bar-chart__bar admin-bar-chart__bar--primary" height={orderHeight} rx="4" width={barWidth} x={orderX} y={baseY - orderHeight} />
                    <text className="admin-bar-chart__value admin-bar-chart__value--primary" textAnchor="middle" x={orderX + barWidth / 2} y={orderLabelY}>
                      {bucket.bookingOrdersCount}
                    </text>
                  </g>
                  <g
                    aria-label={`${bucket.period}: ${bucket.bookingItemsCount} lượt sân`}
                    className="admin-bar-chart__series"
                    tabIndex={0}
                  >
                    <title>{`${bucket.period}: ${bucket.bookingItemsCount} lượt sân`}</title>
                    <rect className="admin-bar-chart__bar admin-bar-chart__bar--accent" height={itemHeight} rx="4" width={barWidth} x={itemX} y={baseY - itemHeight} />
                    <text className="admin-bar-chart__value admin-bar-chart__value--accent" textAnchor="middle" x={itemX + barWidth / 2} y={itemLabelY}>
                      {bucket.bookingItemsCount}
                    </text>
                  </g>
                  <text className="admin-chart-axis-label" textAnchor="middle" x={groupX} y={height - 16}>
                    {bucket.period}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </Card>
  );
}

function CourtUsageRanking({ report }: { report: AdminCourtUsageReport | undefined }) {
  const courts = (report?.courts ?? []).slice(0, 8);
  const maxMinutes = getSeriesMax(courts.map((court) => court.totalBookedMinutes));

  return (
    <div className="admin-operational-panel">
      <div className="admin-report-card__header">
        <div>
          <h2>Xếp hạng sử dụng sân</h2>
          <p>Xếp hạng theo từng sân cụ thể từ dữ liệu lượt đặt, chưa gộp theo loại sân.</p>
        </div>
      </div>

      {courts.length === 0 ? (
        <EmptyReportState />
      ) : (
        <div className="admin-ranking-list">
          {courts.map((court) => {
            const usagePercent = (court.totalBookedMinutes / maxMinutes) * 100;

            return (
              <div className="admin-ranking-item" key={court.courtId}>
                <div className="admin-ranking-item__meta">
                  <strong>{court.courtName}</strong>
                  <span>{court.bookingItemCount} lượt / {formatMinutes(court.totalBookedMinutes)}</span>
                </div>
                <div className="admin-progress" aria-label={`${court.courtName} sử dụng ${formatMinutes(court.totalBookedMinutes)}`}>
                  <span style={{ width: `${clampPercent(usagePercent)}%` }} />
                </div>
                <div className="admin-ranking-item__badges">
                  <Badge tone="success">{court.completedCount} hoàn thành</Badge>
                  <Badge tone="warning">{court.noShowCount} no-show</Badge>
                  <Badge tone="danger">{court.cancelledCount} đã hủy</Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RatesSummary({ report }: { report: AdminRatesReport | undefined }) {
  const rates = [
    {
      count: `${report?.counts?.cancelledBookingItems ?? 0}/${report?.counts?.totalBookingItems ?? 0}`,
      label: "Tỷ lệ hủy",
      value: report?.cancellationRate ?? 0
    },
    {
      count: `${report?.counts?.noShowBookingItems ?? 0}/${report?.counts?.totalBookingItems ?? 0}`,
      label: "No-show",
      value: report?.noShowRate ?? 0
    },
    {
      count: `${report?.counts?.successRefunds ?? 0}/${report?.counts?.successPayments ?? 0}`,
      label: "Hoàn tiền",
      value: report?.refundRate ?? 0
    },
    {
      count: `${report?.counts?.paymentExpiredOrders ?? 0}/${report?.counts?.totalBookingOrders ?? 0}`,
      label: "Hết hạn thanh toán",
      value: report?.paymentExpiredRate ?? 0
    },
    {
      count: `${report?.counts?.expiredWaitlistEntries ?? 0}/${report?.counts?.totalWaitlistEntries ?? 0}`,
      label: "Hết hạn waitlist",
      value: report?.waitlistExpiredRate ?? 0
    }
  ];

  return (
    <div className="admin-operational-panel">
      <div className="admin-report-card__header">
        <div>
          <h2>Tỷ lệ vận hành</h2>
          <p>Các tỷ lệ rủi ro vận hành trong khoảng thời gian hiện tại.</p>
        </div>
      </div>

      <div className="admin-rate-list">
        {rates.map((rate) => (
          <div className="admin-rate-item" key={rate.label}>
            <div className="admin-rate-item__header">
              <strong>{rate.label}</strong>
              <span>{formatPercent(rate.value)} ({rate.count})</span>
            </div>
            <div className="admin-progress">
              <span style={{ width: `${clampPercent(rate.value)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ViolatingUsersTable({ report }: { report: AdminViolatingUsersReport | undefined }) {
  const users = report?.users ?? [];

  return (
    <div className="admin-operational-panel">
      <div className="admin-report-card__header">
        <div>
          <h2>Người dùng vi phạm</h2>
          <p>Theo dõi người dùng vi phạm.</p>
        </div>
      </div>

      {users.length === 0 ? (
        <EmptyReportState message="Không có người dùng vi phạm trong khoảng thời gian này." />
      ) : (
        <div className="admin-table-wrap admin-report-table-wrap">
          <table className="admin-table admin-report-table">
            <thead>
              <tr>
                <th>Người dùng</th>
                <th>Vi phạm</th>
                <th>Điểm phạt</th>
                <th>Điểm hiện tại</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.userId}>
                  <td>
                    <strong>{user.fullName}</strong>
                    <p className="admin-muted">{user.email}</p>
                  </td>
                  <td>{user.violationCount}</td>
                  <td>{user.totalPenaltyPoints}</td>
                  <td>{user.currentViolationPoints}</td>
                  <td>
                    <Badge tone={user.bookingPermissionStatus === "RESTRICTED" ? "danger" : "success"}>
                      {getBookingPermissionLabel(user.bookingPermissionStatus)}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function OperationalInsights({
  activeTab,
  courtUsage,
  onTabChange,
  rates,
  violations
}: {
  activeTab: OperationalTab;
  courtUsage: AdminCourtUsageReport | undefined;
  onTabChange: (tab: OperationalTab) => void;
  rates: AdminRatesReport | undefined;
  violations: AdminViolatingUsersReport | undefined;
}) {
  return (
    <Card as="section" className="admin-report-card admin-chart-card admin-chart-card--wide admin-operational-card">
      <div className="admin-report-card__header admin-operational-card__header">
        <FluidSegmentedControl
          ariaLabel="Chọn nhóm báo cáo vận hành"
          onChange={onTabChange}
          options={operationalTabOptions}
          value={activeTab}
        />
      </div>

      <div className="admin-operational-card__body">
        {activeTab === "courtUsage" ? <CourtUsageRanking report={courtUsage} /> : null}
        {activeTab === "rates" ? <RatesSummary report={rates} /> : null}
        {activeTab === "violations" ? <ViolatingUsersTable report={violations} /> : null}
      </div>
    </Card>
  );
}

export function ReportsPage() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [reports, setReports] = useState<AdminReportBundle | null>(null);
  const [trendRange, setTrendRange] = useState<TrendRange>("month");
  const [operationalTab, setOperationalTab] = useState<OperationalTab>("courtUsage");
  const hasLoadedReports = useRef(false);

  useEffect(() => {
    let isMounted = true;
    async function loadReports() {
      if (hasLoadedReports.current) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);
      try {
        const data = await getAdminReportsBundle({ trend: buildTrendQuery(trendRange) });
        if (isMounted) {
          setReports(data);
          hasLoadedReports.current = true;
        }
      } catch (loadError) {
        if (isMounted) setError(getErrorMessage(loadError));
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    }
    void loadReports();
    return () => {
      isMounted = false;
    };
  }, [reloadKey, trendRange]);

  const netRevenue = useMemo(() => getNetRevenue(reports?.overview), [reports?.overview]);

  return (
    <div className="admin-page">
      <AdminNavigation />
      <AdminPageHeader
        title="Báo cáo"
        description="Thống kê đặt sân, doanh thu, mức sử dụng sân, tỷ lệ vận hành và vi phạm."
        actions={<Button onClick={() => setReloadKey((value) => value + 1)}>Tải lại</Button>}
      />
      {isLoading && !reports ? <LoadingState message="Đang tải báo cáo..." /> : null}
      {error && !reports && !isLoading ? <ErrorState actionLabel="Tải lại" message={error} title="Không tải được báo cáo" onAction={() => setReloadKey((value) => value + 1)} /> : null}
      {reports ? (
        <>
          <div className="admin-stat-grid">
            <AdminStatCard label="Tổng đơn" value={reports.overview?.totalBookingOrders ?? 0} />
            <AdminStatCard label="Lượt sân" value={reports.overview?.totalBookingItems ?? 0} />
            <AdminStatCard label="Doanh thu ròng" value={formatMoney(netRevenue)} />
            <AdminStatCard label="Đã hoàn tiền" value={formatMoney(reports.overview?.totalRefundAmount)} />
            <AdminStatCard label="No-show" value={reports.overview?.totalNoShow ?? 0} />
            <AdminStatCard label="Vi phạm" value={reports.overview?.violationCount ?? 0} />
          </div>

          <Card as="section" className="admin-trend-toolbar">
            <div>
              <strong>Khoảng thời gian xu hướng</strong>
              <span>{isRefreshing ? "Đang cập nhật dữ liệu..." : "Áp dụng cho biểu đồ doanh thu và đặt sân."}</span>
            </div>
            <FluidSegmentedControl
              ariaLabel="Chọn khoảng thời gian xu hướng"
              onChange={setTrendRange}
              options={trendRangeOptions}
              value={trendRange}
            />
          </Card>

          <div className="admin-report-grid admin-report-grid--dashboard">
            <RevenueTrendChart report={reports.revenue} />
            <BookingTrendChart report={reports.bookings} />
            <OperationalInsights
              activeTab={operationalTab}
              courtUsage={reports.courtUsage}
              onTabChange={setOperationalTab}
              rates={reports.rates}
              violations={reports.violations}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

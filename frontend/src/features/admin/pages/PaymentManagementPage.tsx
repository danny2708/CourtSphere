import { useEffect, useState } from "react";

import { Badge } from "../../../components/common/Badge";
import { Button } from "../../../components/common/Button";
import { ErrorState } from "../../../components/common/ErrorState";
import { LoadingState } from "../../../components/common/LoadingState";
import { paymentStatusLabel, getStatusLabel } from "../../../utils/status-label";
import { getErrorMessage } from "../../../utils/format-error";
import { AdminDataTable, type AdminAdvancedFilter, type AdminColumn } from "../components/AdminDataTable";
import { AdminNavigation } from "../components/AdminNavigation";
import { AdminPageHeader } from "../components/AdminPageHeader";
import { listPayments } from "../services/adminService";
import type { AdminPayment, PaymentStatus } from "../types/admin.types";
import { formatMoney } from "../utils/adminFormat";

const paymentStatusOptions: Array<{ label: string; value: PaymentStatus }> = [
  { label: paymentStatusLabel.INITIATED, value: "INITIATED" },
  { label: paymentStatusLabel.PROCESSING, value: "PROCESSING" },
  { label: paymentStatusLabel.SUCCESS, value: "SUCCESS" },
  { label: paymentStatusLabel.FAILED, value: "FAILED" },
  { label: paymentStatusLabel.CANCELLED, value: "CANCELLED" },
  { label: paymentStatusLabel.EXPIRED, value: "EXPIRED" }
];

export function PaymentManagementPage() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    async function loadPayments() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await listPayments();
        if (isMounted) setPayments(data);
      } catch (loadError) {
        if (isMounted) setError(getErrorMessage(loadError));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    void loadPayments();
    return () => {
      isMounted = false;
    };
  }, [reloadKey]);

  const columns: Array<AdminColumn<AdminPayment>> = [
    { header: "Thanh toán", key: "payment", render: (payment) => <strong>{payment.id.slice(0, 8)}</strong> },
    { header: "Đơn đặt sân", key: "booking", render: (payment) => payment.bookingOrder?.bookingCode ?? "Chưa có" },
    { header: "Người dùng", key: "user", render: (payment) => payment.user?.email ?? "Chưa có" },
    { header: "Số tiền", key: "amount", render: (payment) => formatMoney(payment.amount) },
    {
      header: "Trạng thái",
      key: "status",
      render: (payment) => <Badge tone={payment.paymentStatus === "SUCCESS" ? "success" : "warning"}>{getStatusLabel(paymentStatusLabel, payment.paymentStatus)}</Badge>
    }
  ];
  const paymentMethodOptions = [...new Set(payments.map((payment) => payment.paymentMethod).filter((method): method is string => Boolean(method)))]
    .sort((left, right) => left.localeCompare(right))
    .map((method) => ({ label: method, value: method }));
  const advancedFilters: Array<AdminAdvancedFilter<AdminPayment>> = [
    {
      key: "paymentStatus",
      label: "Trạng thái thanh toán",
      options: paymentStatusOptions,
      getValue: (payment) => payment.paymentStatus
    },
    {
      key: "paymentMethod",
      label: "Phương thức thanh toán",
      options: paymentMethodOptions,
      getValue: (payment) => payment.paymentMethod
    }
  ];

  return (
    <div className="admin-page">
      <AdminNavigation />
      <AdminPageHeader title="Quản lý thanh toán" description="Theo dõi giao dịch thanh toán thử nghiệm." actions={<Button onClick={() => setReloadKey((value) => value + 1)}>Tải lại</Button>} />
      {isLoading ? <LoadingState message="Đang tải thanh toán..." /> : null}
      {error && !isLoading ? <ErrorState actionLabel="Tải lại" message={error} title="Không tải được thanh toán" onAction={() => setReloadKey((value) => value + 1)} /> : null}
      {!isLoading && !error ? <AdminDataTable advancedFilters={advancedFilters} columns={columns} getRowKey={(payment) => payment.id} rows={payments} /> : null}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";

import { Badge } from "../../../components/common/Badge";
import { Button } from "../../../components/common/Button";
import { ErrorState } from "../../../components/common/ErrorState";
import { LoadingState } from "../../../components/common/LoadingState";
import { paymentStatusLabel, getStatusLabel } from "../../../utils/status-label";
import { getErrorMessage } from "../../../utils/format-error";
import { AdminDataTable, type AdminColumn } from "../components/AdminDataTable";
import { AdminNavigation } from "../components/AdminNavigation";
import { AdminPageHeader } from "../components/AdminPageHeader";
import { listPayments } from "../services/adminService";
import type { AdminPayment } from "../types/admin.types";
import { formatMoney } from "../utils/adminFormat";

export function PaymentManagementPage() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
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

  const filtered = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    return normalized
      ? payments.filter((payment) =>
          [payment.id, payment.bookingOrder?.bookingCode, payment.user?.email, payment.user?.fullName, payment.paymentStatus]
            .filter(Boolean)
            .some((value) => value!.toLowerCase().includes(normalized))
        )
      : payments;
  }, [keyword, payments]);

  const columns: Array<AdminColumn<AdminPayment>> = [
    { header: "Payment", key: "payment", render: (payment) => <strong>{payment.id.slice(0, 8)}</strong> },
    { header: "Booking", key: "booking", render: (payment) => payment.bookingOrder?.bookingCode ?? "Chưa có" },
    { header: "User", key: "user", render: (payment) => payment.user?.email ?? "Chưa có" },
    { header: "Amount", key: "amount", render: (payment) => formatMoney(payment.amount) },
    {
      header: "Status",
      key: "status",
      render: (payment) => <Badge tone={payment.paymentStatus === "SUCCESS" ? "success" : "warning"}>{getStatusLabel(paymentStatusLabel, payment.paymentStatus)}</Badge>
    }
  ];

  return (
    <div className="admin-page">
      <AdminNavigation />
      <AdminPageHeader title="Payment management" description="Theo dõi giao dịch thanh toán sandbox/mock." actions={<Button onClick={() => setReloadKey((value) => value + 1)}>Tải lại</Button>} />
      <div className="admin-filter-bar">
        <input placeholder="Tìm payment, booking code, user..." value={keyword} onChange={(event) => setKeyword(event.target.value)} />
      </div>
      {isLoading ? <LoadingState message="Đang tải payments..." /> : null}
      {error && !isLoading ? <ErrorState actionLabel="Tải lại" message={error} title="Không tải được payments" onAction={() => setReloadKey((value) => value + 1)} /> : null}
      {!isLoading && !error ? <AdminDataTable columns={columns} getRowKey={(payment) => payment.id} rows={filtered} /> : null}
    </div>
  );
}

import { useEffect, useState } from "react";

import { Badge } from "../../../components/common/Badge";
import { Button } from "../../../components/common/Button";
import { ErrorState } from "../../../components/common/ErrorState";
import { LoadingState } from "../../../components/common/LoadingState";
import { useToastStore } from "../../../stores/toast.store";
import { getErrorMessage } from "../../../utils/format-error";
import { getStatusLabel, refundStatusLabel } from "../../../utils/status-label";
import { AdminDataTable, type AdminColumn } from "../components/AdminDataTable";
import { AdminNavigation } from "../components/AdminNavigation";
import { AdminPageHeader } from "../components/AdminPageHeader";
import { AdminRowActions } from "../components/AdminRowActions";
import { AdminSelectDialog } from "../components/AdminSelectDialog";
import { listRefunds, retryRefund } from "../services/adminService";
import type { AdminRefund, RefundStatus } from "../types/admin.types";
import { formatDateTime, formatMoney } from "../utils/adminFormat";

type RetryResult = Extract<RefundStatus, "SUCCESS" | "FAILED" | "MANUAL_REVIEW">;

const retryOptions: Array<{ label: string; value: RetryResult }> = [
  { label: "Hoàn tiền thành công", value: "SUCCESS" },
  { label: "Hoàn tiền thất bại", value: "FAILED" },
  { label: "Cần xử lý thủ công", value: "MANUAL_REVIEW" }
];

export function RefundManagementPage() {
  const { addToast } = useToastStore();
  const [activeRefund, setActiveRefund] = useState<AdminRefund | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refunds, setRefunds] = useState<AdminRefund[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    async function loadRefunds() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await listRefunds();
        if (isMounted) setRefunds(data);
      } catch (loadError) {
        if (isMounted) setError(getErrorMessage(loadError));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    void loadRefunds();
    return () => {
      isMounted = false;
    };
  }, [reloadKey]);

  async function handleRetry(mockResult: RetryResult, reason: string) {
    if (!activeRefund) return;
    try {
      await retryRefund(activeRefund.id, mockResult, reason);
      addToast({ message: "Refund đã được xử lý lại.", title: "Retry thành công", type: "success" });
      setActiveRefund(null);
      setReloadKey((value) => value + 1);
    } catch (retryError) {
      addToast({ message: getErrorMessage(retryError), title: "Không retry được refund", type: "error" });
    }
  }

  const columns: Array<AdminColumn<AdminRefund>> = [
    { header: "Refund", key: "refund", render: (refund) => <strong>{refund.id.slice(0, 8)}</strong> },
    { header: "Booking", key: "booking", render: (refund) => refund.bookingOrder?.bookingCode ?? refund.bookingOrderId ?? "Chưa có" },
    { header: "Amount", key: "amount", render: (refund) => formatMoney(refund.refundAmount) },
    { header: "Requested", key: "date", render: (refund) => formatDateTime(refund.requestedAt) },
    {
      header: "Status",
      key: "status",
      render: (refund) => <Badge tone={refund.refundStatus === "SUCCESS" ? "success" : "warning"}>{getStatusLabel(refundStatusLabel, refund.refundStatus)}</Badge>
    },
    {
      header: "Thao tác",
      key: "actions",
      render: (refund) => (
        <AdminRowActions
          actions={[
            {
              disabled: !["REQUESTED", "FAILED", "MANUAL_REVIEW"].includes(refund.refundStatus),
              label: "Retry refund",
              onSelect: () => setActiveRefund(refund),
              tone: "primary"
            }
          ]}
        />
      )
    }
  ];

  return (
    <div className="admin-page">
      <AdminNavigation />
      <AdminPageHeader title="Refund management" description="Theo dõi và retry các refund sandbox." actions={<Button onClick={() => setReloadKey((value) => value + 1)}>Tải lại</Button>} />
      {isLoading ? <LoadingState message="Đang tải refunds..." /> : null}
      {error && !isLoading ? <ErrorState actionLabel="Tải lại" message={error} title="Không tải được refunds" onAction={() => setReloadKey((value) => value + 1)} /> : null}
      {!isLoading && !error ? <AdminDataTable columns={columns} getRowKey={(refund) => refund.id} rows={refunds} /> : null}
      {activeRefund ? (
        <AdminSelectDialog
          label="Kết quả retry"
          options={retryOptions}
          reasonRequired
          title="Retry refund"
          onClose={() => setActiveRefund(null)}
          onConfirm={handleRetry}
        />
      ) : null}
    </div>
  );
}

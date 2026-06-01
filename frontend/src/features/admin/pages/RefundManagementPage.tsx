import { useEffect, useState } from "react";

import { Badge } from "../../../components/common/Badge";
import { Button } from "../../../components/common/Button";
import { ErrorState } from "../../../components/common/ErrorState";
import { LoadingState } from "../../../components/common/LoadingState";
import { useToastStore } from "../../../stores/toast.store";
import { getErrorMessage } from "../../../utils/format-error";
import { getStatusLabel, refundStatusLabel } from "../../../utils/status-label";
import { AdminDataTable, type AdminAdvancedFilter, type AdminColumn } from "../components/AdminDataTable";
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

const refundStatusOptions: Array<{ label: string; value: RefundStatus }> = [
  { label: refundStatusLabel.REQUESTED, value: "REQUESTED" },
  { label: refundStatusLabel.PROCESSING, value: "PROCESSING" },
  { label: refundStatusLabel.SUCCESS, value: "SUCCESS" },
  { label: refundStatusLabel.FAILED, value: "FAILED" },
  { label: refundStatusLabel.MANUAL_REVIEW, value: "MANUAL_REVIEW" },
  { label: refundStatusLabel.REJECTED, value: "REJECTED" }
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
      addToast({ message: "Yêu cầu hoàn tiền đã được xử lý lại.", title: "Xử lý lại thành công", type: "success" });
      setActiveRefund(null);
      setReloadKey((value) => value + 1);
    } catch (retryError) {
      addToast({ message: getErrorMessage(retryError), title: "Không xử lý lại được yêu cầu hoàn tiền", type: "error" });
    }
  }

  const columns: Array<AdminColumn<AdminRefund>> = [
    { header: "Hoàn tiền", key: "refund", render: (refund) => <strong>{refund.id.slice(0, 8)}</strong> },
    { header: "Đơn đặt sân", key: "booking", render: (refund) => refund.bookingOrder?.bookingCode ?? refund.bookingOrderId ?? "Chưa có" },
    { header: "Số tiền", key: "amount", render: (refund) => formatMoney(refund.refundAmount) },
    { header: "Ngày yêu cầu", key: "date", render: (refund) => formatDateTime(refund.requestedAt) },
    {
      header: "Trạng thái",
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
              label: "Xử lý lại",
              onSelect: () => setActiveRefund(refund),
              tone: "primary"
            }
          ]}
        />
      )
    }
  ];
  const advancedFilters: Array<AdminAdvancedFilter<AdminRefund>> = [
    {
      key: "refundStatus",
      label: "Trạng thái hoàn tiền",
      options: refundStatusOptions,
      getValue: (refund) => refund.refundStatus
    }
  ];

  return (
    <div className="admin-page">
      <AdminNavigation />
      <AdminPageHeader title="Quản lý hoàn tiền" description="Theo dõi và xử lý lại các yêu cầu hoàn tiền thử nghiệm." actions={<Button onClick={() => setReloadKey((value) => value + 1)}>Tải lại</Button>} />
      {isLoading ? <LoadingState message="Đang tải hoàn tiền..." /> : null}
      {error && !isLoading ? <ErrorState actionLabel="Tải lại" message={error} title="Không tải được hoàn tiền" onAction={() => setReloadKey((value) => value + 1)} /> : null}
      {!isLoading && !error ? <AdminDataTable advancedFilters={advancedFilters} columns={columns} getRowKey={(refund) => refund.id} rows={refunds} /> : null}
      {activeRefund ? (
        <AdminSelectDialog
          label="Kết quả retry"
          options={retryOptions}
          reasonRequired
          title="Xử lý lại hoàn tiền"
          onClose={() => setActiveRefund(null)}
          onConfirm={handleRetry}
        />
      ) : null}
    </div>
  );
}

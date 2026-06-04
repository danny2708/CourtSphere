import { useEffect, useState } from "react";

import { Badge } from "../../../components/common/Badge";
import { Button } from "../../../components/common/Button";
import { ErrorState } from "../../../components/common/ErrorState";
import { LoadingState } from "../../../components/common/LoadingState";
import { useToastStore } from "../../../stores/toast.store";
import { getErrorMessage } from "../../../utils/format-error";
import { getStatusLabel, violationTypeLabel } from "../../../utils/status-label";
import { AdminConfirmDialog } from "../components/AdminConfirmDialog";
import { AdminDataTable, type AdminAdvancedFilter, type AdminColumn } from "../components/AdminDataTable";
import { AdminNavigation } from "../components/AdminNavigation";
import { AdminPageHeader } from "../components/AdminPageHeader";
import { AdminRowActions } from "../components/AdminRowActions";
import { AdminTextFormDialog } from "../components/AdminTextFormDialog";
import { adjustViolationPoints, listViolations, waiveViolation } from "../services/adminService";
import type { AdminViolation } from "../types/admin.types";
import { formatDateTime } from "../utils/adminFormat";

type DialogState = { type: "waive"; violation: AdminViolation } | { type: "adjust"; violation: AdminViolation } | null;

export function ViolationManagementPage() {
  const { addToast } = useToastStore();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [violations, setViolations] = useState<AdminViolation[]>([]);

  useEffect(() => {
    let isMounted = true;
    async function loadViolations() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await listViolations();
        if (isMounted) setViolations(data);
      } catch (loadError) {
        if (isMounted) setError(getErrorMessage(loadError));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    void loadViolations();
    return () => {
      isMounted = false;
    };
  }, [reloadKey]);

  async function runAction(action: () => Promise<unknown>) {
    try {
      await action();
      addToast({ message: "Vi phạm đã được cập nhật.", title: "Thành công", type: "success" });
      setDialog(null);
      setReloadKey((value) => value + 1);
    } catch (actionError) {
      addToast({ message: getErrorMessage(actionError), title: "Không thể xử lý vi phạm", type: "error" });
    }
  }

  const columns: Array<AdminColumn<AdminViolation>> = [
    { header: "Người dùng", key: "user", render: (violation) => violation.user?.email ?? "Chưa có" },
    { header: "Đơn đặt sân", key: "booking", render: (violation) => violation.bookingItem?.bookingOrder?.bookingCode ?? "Chưa có" },
    { header: "Loại vi phạm", key: "type", render: (violation) => getStatusLabel(violationTypeLabel, violation.violationType) },
    { header: "Điểm phạt", key: "points", render: (violation) => violation.penaltyPoints },
    { header: "Ngày ghi nhận", key: "recorded", render: (violation) => formatDateTime(violation.recordedAt) },
    {
      header: "Trạng thái",
      key: "status",
      render: (violation) => <Badge tone={violation.isWaived ? "neutral" : "danger"}>{violation.isWaived ? "Đã miễn" : "Đang tính điểm"}</Badge>
    },
    {
      header: "Thao tác",
      key: "actions",
      render: (violation) => (
        <AdminRowActions
          actions={[
            {
              disabled: violation.isWaived,
              label: "Miễn vi phạm",
              onSelect: () => setDialog({ type: "waive", violation }),
              tone: "primary"
            },
            { label: "Điều chỉnh điểm", onSelect: () => setDialog({ type: "adjust", violation }) }
          ]}
        />
      )
    }
  ];
  const violationTypeOptions = [...new Set(violations.map((violation) => violation.violationType))]
    .sort((left, right) => left.localeCompare(right))
    .map((violationType) => ({ label: getStatusLabel(violationTypeLabel, violationType), value: violationType }));
  const advancedFilters: Array<AdminAdvancedFilter<AdminViolation>> = [
    {
      key: "violationType",
      label: "Loại vi phạm",
      options: violationTypeOptions,
      getValue: (violation) => violation.violationType
    },
    {
      key: "isWaived",
      label: "Trạng thái điểm",
      options: [
        { label: "Đang tính điểm", value: "false" },
        { label: "Đã miễn", value: "true" }
      ],
      getValue: (violation) => violation.isWaived
    }
  ];

  return (
    <div className="admin-page">
      <AdminNavigation />
      <AdminPageHeader title="Quản lý vi phạm" description="Theo dõi vi phạm, miễn vi phạm và điều chỉnh điểm có nhật ký kiểm toán." actions={<Button onClick={() => setReloadKey((value) => value + 1)}>Tải lại</Button>} />
      {isLoading ? <LoadingState message="Đang tải vi phạm..." /> : null}
      {error && !isLoading ? <ErrorState actionLabel="Tải lại" message={error} title="Không tải được vi phạm" onAction={() => setReloadKey((value) => value + 1)} /> : null}
      {!isLoading && !error ? <AdminDataTable advancedFilters={advancedFilters} columns={columns} getRowKey={(violation) => violation.id} rows={violations} /> : null}
      {dialog?.type === "waive" ? (
        <AdminConfirmDialog
          message="Miễn vi phạm sẽ trừ điểm phạt khỏi người dùng và ghi nhật ký kiểm toán."
          reasonRequired
          title="Miễn vi phạm"
          onClose={() => setDialog(null)}
          onConfirm={(reason) => runAction(() => waiveViolation(dialog.violation.id, reason))}
        />
      ) : null}
      {dialog?.type === "adjust" ? (
        <AdminTextFormDialog
          fields={[{ key: "penaltyPoints", label: "Điểm phạt", required: true, type: "number" }]}
          initialValues={{ penaltyPoints: dialog.violation.penaltyPoints }}
          title="Điều chỉnh điểm vi phạm"
          onClose={() => setDialog(null)}
          onSubmit={(values) => runAction(() => adjustViolationPoints(dialog.violation.id, Number(values.penaltyPoints), "Điều chỉnh từ giao diện quản trị"))}
        />
      ) : null}
    </div>
  );
}

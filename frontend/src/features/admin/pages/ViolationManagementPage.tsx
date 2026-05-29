import { useEffect, useMemo, useState } from "react";

import { Badge } from "../../../components/common/Badge";
import { Button } from "../../../components/common/Button";
import { ErrorState } from "../../../components/common/ErrorState";
import { LoadingState } from "../../../components/common/LoadingState";
import { useToastStore } from "../../../stores/toast.store";
import { getErrorMessage } from "../../../utils/format-error";
import { getStatusLabel, violationTypeLabel } from "../../../utils/status-label";
import { AdminConfirmDialog } from "../components/AdminConfirmDialog";
import { AdminDataTable, type AdminColumn } from "../components/AdminDataTable";
import { AdminNavigation } from "../components/AdminNavigation";
import { AdminPageHeader } from "../components/AdminPageHeader";
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
  const [keyword, setKeyword] = useState("");
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

  const filtered = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    return normalized
      ? violations.filter((violation) =>
          [violation.id, violation.user?.email, violation.user?.fullName, violation.violationType, violation.bookingItem?.bookingOrder?.bookingCode]
            .filter(Boolean)
            .some((value) => value!.toLowerCase().includes(normalized))
        )
      : violations;
  }, [keyword, violations]);

  async function runAction(action: () => Promise<unknown>) {
    try {
      await action();
      addToast({ message: "Violation đã được cập nhật.", title: "Thành công", type: "success" });
      setDialog(null);
      setReloadKey((value) => value + 1);
    } catch (actionError) {
      addToast({ message: getErrorMessage(actionError), title: "Không thể xử lý violation", type: "error" });
    }
  }

  const columns: Array<AdminColumn<AdminViolation>> = [
    { header: "User", key: "user", render: (violation) => violation.user?.email ?? "Chưa có" },
    { header: "Booking", key: "booking", render: (violation) => violation.bookingItem?.bookingOrder?.bookingCode ?? "Chưa có" },
    { header: "Type", key: "type", render: (violation) => getStatusLabel(violationTypeLabel, violation.violationType) },
    { header: "Points", key: "points", render: (violation) => violation.penaltyPoints },
    { header: "Recorded", key: "recorded", render: (violation) => formatDateTime(violation.recordedAt) },
    {
      header: "Status",
      key: "status",
      render: (violation) => <Badge tone={violation.isWaived ? "neutral" : "danger"}>{violation.isWaived ? "Đã miễn" : "Đang tính điểm"}</Badge>
    },
    {
      header: "Thao tác",
      key: "actions",
      render: (violation) => (
        <div className="admin-action-row">
          <Button disabled={violation.isWaived} size="sm" variant="secondary" onClick={() => setDialog({ type: "waive", violation })}>
            Waive
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDialog({ type: "adjust", violation })}>
            Adjust
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="admin-page">
      <AdminNavigation />
      <AdminPageHeader title="Violation management" description="Theo dõi vi phạm, miễn vi phạm và điều chỉnh điểm có audit." actions={<Button onClick={() => setReloadKey((value) => value + 1)}>Tải lại</Button>} />
      <div className="admin-filter-bar">
        <input placeholder="Tìm user, booking, loại vi phạm..." value={keyword} onChange={(event) => setKeyword(event.target.value)} />
      </div>
      {isLoading ? <LoadingState message="Đang tải violations..." /> : null}
      {error && !isLoading ? <ErrorState actionLabel="Tải lại" message={error} title="Không tải được violations" onAction={() => setReloadKey((value) => value + 1)} /> : null}
      {!isLoading && !error ? <AdminDataTable columns={columns} getRowKey={(violation) => violation.id} rows={filtered} /> : null}
      {dialog?.type === "waive" ? (
        <AdminConfirmDialog
          message="Miễn vi phạm sẽ trừ điểm penalty khỏi user và ghi audit log."
          reasonRequired
          title="Waive violation"
          onClose={() => setDialog(null)}
          onConfirm={(reason) => runAction(() => waiveViolation(dialog.violation.id, reason))}
        />
      ) : null}
      {dialog?.type === "adjust" ? (
        <AdminTextFormDialog
          fields={[{ key: "penaltyPoints", label: "Penalty points", required: true, type: "number" }]}
          initialValues={{ penaltyPoints: dialog.violation.penaltyPoints }}
          title="Adjust violation points"
          onClose={() => setDialog(null)}
          onSubmit={(values) => runAction(() => adjustViolationPoints(dialog.violation.id, Number(values.penaltyPoints), "Adjusted from admin UI"))}
        />
      ) : null}
    </div>
  );
}

import { useEffect, useState } from "react";

import { Badge } from "../../../components/common/Badge";
import { Button } from "../../../components/common/Button";
import { ErrorState } from "../../../components/common/ErrorState";
import { LoadingState } from "../../../components/common/LoadingState";
import { useToastStore } from "../../../stores/toast.store";
import { getErrorMessage } from "../../../utils/format-error";
import { entityStatusLabel, getStatusLabel } from "../../../utils/status-label";
import { AdminDataTable, type AdminColumn } from "../components/AdminDataTable";
import { AdminNavigation } from "../components/AdminNavigation";
import { AdminPageHeader } from "../components/AdminPageHeader";
import { AdminRowActions } from "../components/AdminRowActions";
import { AdminTextFormDialog } from "../components/AdminTextFormDialog";
import { listPriorityPolicies, updatePriorityPolicy } from "../services/adminService";
import type { AdminPriorityPolicy } from "../types/admin.types";

export function PriorityPoliciesPage() {
  const { addToast } = useToastStore();
  const [activePolicy, setActivePolicy] = useState<AdminPriorityPolicy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [policies, setPolicies] = useState<AdminPriorityPolicy[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    async function loadPolicies() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await listPriorityPolicies();
        if (isMounted) setPolicies(data);
      } catch (loadError) {
        if (isMounted) setError(getErrorMessage(loadError));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    void loadPolicies();
    return () => {
      isMounted = false;
    };
  }, [reloadKey]);

  async function handleSave(values: Record<string, string>) {
    if (!activePolicy) return;
    try {
      await updatePriorityPolicy(activePolicy.id, {
        advanceBookingDays: Number(values.advanceBookingDays),
        maxBookingsPerDay: Number(values.maxBookingsPerDay),
        priorityRank: Number(values.priorityRank)
      });
      addToast({ message: "Priority policy đã được cập nhật.", title: "Thành công", type: "success" });
      setActivePolicy(null);
      setReloadKey((value) => value + 1);
    } catch (saveError) {
      addToast({ message: getErrorMessage(saveError), title: "Không thể lưu", type: "error" });
    }
  }

  const columns: Array<AdminColumn<AdminPriorityPolicy>> = [
    { header: "Policy", key: "policy", render: (policy) => <strong>{policy.policyName ?? policy.id.slice(0, 8)}</strong> },
    { header: "Group", key: "group", render: (policy) => policy.priorityGroup?.groupName ?? policy.priorityGroupId },
    { header: "Rank", key: "rank", render: (policy) => policy.priorityRank },
    { header: "Advance", key: "advance", render: (policy) => policy.advanceBookingDays },
    { header: "Quota", key: "quota", render: (policy) => policy.maxBookingsPerDay ?? "N/A" },
    {
      header: "Status",
      key: "status",
      render: (policy) => <Badge tone={policy.status === "ACTIVE" ? "success" : "neutral"}>{getStatusLabel(entityStatusLabel, policy.status ?? "ACTIVE")}</Badge>
    },
    {
      header: "Thao tác",
      key: "actions",
      render: (policy) => (
        <AdminRowActions
          actions={[
            { label: "Sửa", onSelect: () => setActivePolicy(policy), tone: "primary" }
          ]}
        />
      )
    }
  ];

  return (
    <div className="admin-page">
      <AdminNavigation />
      <AdminPageHeader title="Priority policies" description="Cấu hình quota và khả năng đặt trước theo nhóm ưu tiên." actions={<Button onClick={() => setReloadKey((value) => value + 1)}>Tải lại</Button>} />
      {isLoading ? <LoadingState message="Đang tải priority policies..." /> : null}
      {error && !isLoading ? <ErrorState actionLabel="Tải lại" message={error} title="Không tải được priority policies" onAction={() => setReloadKey((value) => value + 1)} /> : null}
      {!isLoading && !error ? <AdminDataTable columns={columns} getRowKey={(policy) => policy.id} rows={policies} /> : null}
      {activePolicy ? (
        <AdminTextFormDialog
          fields={[
            { key: "priorityRank", label: "Priority rank", required: true, type: "number" },
            { key: "advanceBookingDays", label: "Số ngày đặt trước", required: true, type: "number" },
            { key: "maxBookingsPerDay", label: "Quota/ngày", required: true, type: "number" }
          ]}
          initialValues={{
            advanceBookingDays: activePolicy.advanceBookingDays,
            maxBookingsPerDay: activePolicy.maxBookingsPerDay,
            priorityRank: activePolicy.priorityRank
          }}
          title="Cập nhật priority policy"
          onClose={() => setActivePolicy(null)}
          onSubmit={handleSave}
        />
      ) : null}
    </div>
  );
}

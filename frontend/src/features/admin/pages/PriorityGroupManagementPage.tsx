import { useEffect, useState } from "react";

import { Badge } from "../../../components/common/Badge";
import { Button } from "../../../components/common/Button";
import { ErrorState } from "../../../components/common/ErrorState";
import { LoadingState } from "../../../components/common/LoadingState";
import { useToastStore } from "../../../stores/toast.store";
import { entityStatusLabel, getStatusLabel } from "../../../utils/status-label";
import { getErrorMessage } from "../../../utils/format-error";
import { AdminDataTable, type AdminColumn } from "../components/AdminDataTable";
import { AdminNavigation } from "../components/AdminNavigation";
import { AdminPageHeader } from "../components/AdminPageHeader";
import { AdminTextFormDialog } from "../components/AdminTextFormDialog";
import { listPriorityGroups, updatePriorityGroup } from "../services/adminService";
import type { AdminPriorityGroup } from "../types/admin.types";

export function PriorityGroupManagementPage() {
  const { addToast } = useToastStore();
  const [activeGroup, setActiveGroup] = useState<AdminPriorityGroup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<AdminPriorityGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    async function loadGroups() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await listPriorityGroups();
        if (isMounted) setGroups(data);
      } catch (loadError) {
        if (isMounted) setError(getErrorMessage(loadError));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    void loadGroups();
    return () => {
      isMounted = false;
    };
  }, [reloadKey]);

  async function handleSave(values: Record<string, string>) {
    if (!activeGroup) return;
    try {
      await updatePriorityGroup(activeGroup.id, {
        advanceBookingDays: Number(values.advanceBookingDays),
        description: values.description,
        groupName: values.groupName,
        priorityLevel: Number(values.priorityLevel)
      });
      addToast({ message: "Priority group đã được cập nhật.", title: "Thành công", type: "success" });
      setActiveGroup(null);
      setReloadKey((value) => value + 1);
    } catch (saveError) {
      addToast({ message: getErrorMessage(saveError), title: "Không thể lưu", type: "error" });
    }
  }

  const columns: Array<AdminColumn<AdminPriorityGroup>> = [
    { header: "Code", key: "code", render: (group) => <strong>{group.groupCode}</strong> },
    { header: "Name", key: "name", render: (group) => group.groupName },
    { header: "Priority", key: "priority", render: (group) => group.priorityLevel },
    { header: "Advance days", key: "days", render: (group) => group.advanceBookingDays },
    { header: "Users", key: "users", render: (group) => group.userCount ?? 0 },
    {
      header: "Status",
      key: "status",
      render: (group) => <Badge tone={group.status === "ACTIVE" ? "success" : "neutral"}>{getStatusLabel(entityStatusLabel, group.status ?? "ACTIVE")}</Badge>
    },
    { header: "Thao tác", key: "actions", render: (group) => <Button size="sm" onClick={() => setActiveGroup(group)}>Sửa</Button> }
  ];

  return (
    <div className="admin-page">
      <AdminNavigation />
      <AdminPageHeader title="Priority groups" description="Cấu hình nhóm ưu tiên và số ngày được đặt trước." actions={<Button onClick={() => setReloadKey((value) => value + 1)}>Tải lại</Button>} />
      {isLoading ? <LoadingState message="Đang tải priority groups..." /> : null}
      {error && !isLoading ? <ErrorState actionLabel="Tải lại" message={error} title="Không tải được priority groups" onAction={() => setReloadKey((value) => value + 1)} /> : null}
      {!isLoading && !error ? <AdminDataTable columns={columns} getRowKey={(group) => group.id} rows={groups} /> : null}
      {activeGroup ? (
        <AdminTextFormDialog
          fields={[
            { key: "groupName", label: "Tên nhóm", required: true },
            { key: "priorityLevel", label: "Priority level", required: true, type: "number" },
            { key: "advanceBookingDays", label: "Số ngày đặt trước", required: true, type: "number" },
            { key: "description", label: "Mô tả" }
          ]}
          initialValues={activeGroup}
          title="Cập nhật priority group"
          onClose={() => setActiveGroup(null)}
          onSubmit={handleSave}
        />
      ) : null}
    </div>
  );
}

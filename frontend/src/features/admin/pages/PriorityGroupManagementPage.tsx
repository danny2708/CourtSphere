import { useEffect, useState } from "react";

import { Badge } from "../../../components/common/Badge";
import { Button } from "../../../components/common/Button";
import { ErrorState } from "../../../components/common/ErrorState";
import { LoadingState } from "../../../components/common/LoadingState";
import { useToastStore } from "../../../stores/toast.store";
import { entityStatusLabel, getStatusLabel } from "../../../utils/status-label";
import { getErrorMessage } from "../../../utils/format-error";
import { AdminDataTable, type AdminAdvancedFilter, type AdminColumn } from "../components/AdminDataTable";
import { AdminNavigation } from "../components/AdminNavigation";
import { AdminPageHeader } from "../components/AdminPageHeader";
import { AdminRowActions } from "../components/AdminRowActions";
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
      addToast({ message: "Nhóm ưu tiên đã được cập nhật.", title: "Thành công", type: "success" });
      setActiveGroup(null);
      setReloadKey((value) => value + 1);
    } catch (saveError) {
      addToast({ message: getErrorMessage(saveError), title: "Không thể lưu", type: "error" });
    }
  }

  const columns: Array<AdminColumn<AdminPriorityGroup>> = [
    { header: "Mã nhóm", key: "code", render: (group) => <strong>{group.groupCode}</strong> },
    { header: "Tên nhóm", key: "name", render: (group) => group.groupName },
    { header: "Mức ưu tiên", key: "priority", render: (group) => group.priorityLevel },
    { header: "Số ngày đặt trước", key: "days", render: (group) => group.advanceBookingDays },
    { header: "Người dùng", key: "users", render: (group) => group.userCount ?? 0 },
    {
      header: "Trạng thái",
      key: "status",
      render: (group) => <Badge tone={group.status === "ACTIVE" ? "success" : "neutral"}>{getStatusLabel(entityStatusLabel, group.status ?? "ACTIVE")}</Badge>
    },
    {
      header: "Thao tác",
      key: "actions",
      render: (group) => (
        <AdminRowActions
          actions={[
            { label: "Sửa", onSelect: () => setActiveGroup(group), tone: "primary" }
          ]}
        />
      )
    }
  ];
  const advancedFilters: Array<AdminAdvancedFilter<AdminPriorityGroup>> = [
    {
      key: "status",
      label: "Trạng thái",
      options: [
        { label: entityStatusLabel.ACTIVE, value: "ACTIVE" },
        { label: entityStatusLabel.INACTIVE, value: "INACTIVE" }
      ],
      getValue: (group) => group.status ?? "ACTIVE"
    }
  ];

  return (
    <div className="admin-page">
      <AdminNavigation />
      <AdminPageHeader title="Nhóm ưu tiên" description="Cấu hình nhóm ưu tiên và số ngày được đặt trước." actions={<Button onClick={() => setReloadKey((value) => value + 1)}>Tải lại</Button>} />
      {isLoading ? <LoadingState message="Đang tải nhóm ưu tiên..." /> : null}
      {error && !isLoading ? <ErrorState actionLabel="Tải lại" message={error} title="Không tải được nhóm ưu tiên" onAction={() => setReloadKey((value) => value + 1)} /> : null}
      {!isLoading && !error ? <AdminDataTable advancedFilters={advancedFilters} columns={columns} getRowKey={(group) => group.id} rows={groups} /> : null}
      {activeGroup ? (
        <AdminTextFormDialog
          fields={[
            { key: "groupName", label: "Tên nhóm", required: true },
            { key: "priorityLevel", label: "Mức ưu tiên", required: true, type: "number" },
            { key: "advanceBookingDays", label: "Số ngày đặt trước", required: true, type: "number" },
            { key: "description", label: "Mô tả" }
          ]}
          initialValues={activeGroup}
          title="Cập nhật nhóm ưu tiên"
          onClose={() => setActiveGroup(null)}
          onSubmit={handleSave}
        />
      ) : null}
    </div>
  );
}

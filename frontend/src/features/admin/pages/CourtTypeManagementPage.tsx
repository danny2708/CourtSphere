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
import { AdminSelectDialog } from "../components/AdminSelectDialog";
import { AdminTextFormDialog } from "../components/AdminTextFormDialog";
import { createCourtType, listCourtTypes, updateCourtType, updateCourtTypeStatus } from "../services/adminService";
import type { AdminCourtType, EntityStatus } from "../types/admin.types";

type DialogState = { type: "create" } | { type: "edit"; courtType: AdminCourtType } | { type: "status"; courtType: AdminCourtType } | null;

const entityStatusOptions: Array<{ label: string; value: EntityStatus }> = [
  { label: entityStatusLabel.ACTIVE, value: "ACTIVE" },
  { label: entityStatusLabel.INACTIVE, value: "INACTIVE" }
];

export function CourtTypeManagementPage() {
  const { addToast } = useToastStore();
  const [courtTypes, setCourtTypes] = useState<AdminCourtType[]>([]);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await listCourtTypes();
        if (isMounted) setCourtTypes(data);
      } catch (loadError) {
        if (isMounted) setError(getErrorMessage(loadError));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    void loadData();
    return () => {
      isMounted = false;
    };
  }, [reloadKey]);

  async function runAction(action: () => Promise<unknown>) {
    try {
      await action();
      addToast({ message: "Loại sân đã được cập nhật.", title: "Thành công", type: "success" });
      setDialog(null);
      setReloadKey((value) => value + 1);
    } catch (actionError) {
      addToast({ message: getErrorMessage(actionError), title: "Không thể xử lý", type: "error" });
    }
  }

  const columns: Array<AdminColumn<AdminCourtType>> = [
    { header: "Tên loại", key: "name", render: (type) => <strong>{type.typeName}</strong> },
    { header: "Mô tả", key: "description", render: (type) => type.description ?? "Chưa có" },
    { header: "Status", key: "status", render: (type) => <Badge tone={type.status === "ACTIVE" ? "success" : "neutral"}>{getStatusLabel(entityStatusLabel, type.status)}</Badge> },
    {
      header: "Thao tác",
      key: "actions",
      render: (type) => (
        <div className="admin-action-row">
          <Button size="sm" onClick={() => setDialog({ type: "edit", courtType: type })}>Sửa</Button>
          <Button size="sm" variant="ghost" onClick={() => setDialog({ type: "status", courtType: type })}>Status</Button>
        </div>
      )
    }
  ];

  return (
    <div className="admin-page">
      <AdminNavigation />
      <AdminPageHeader title="Court types" description="Quản lý danh mục loại sân." actions={<Button onClick={() => setDialog({ type: "create" })}>Tạo loại sân</Button>} />
      {isLoading ? <LoadingState message="Đang tải loại sân..." /> : null}
      {error && !isLoading ? <ErrorState actionLabel="Tải lại" message={error} title="Không tải được loại sân" onAction={() => setReloadKey((value) => value + 1)} /> : null}
      {!isLoading && !error ? <AdminDataTable columns={columns} getRowKey={(type) => type.id} rows={courtTypes} /> : null}

      {dialog?.type === "create" || dialog?.type === "edit" ? (
        <AdminTextFormDialog
          fields={[
            { key: "typeName", label: "Tên loại sân", required: true },
            { key: "description", label: "Mô tả" }
          ]}
          initialValues={dialog.type === "edit" ? dialog.courtType : undefined}
          title={dialog.type === "create" ? "Tạo loại sân" : "Sửa loại sân"}
          onClose={() => setDialog(null)}
          onSubmit={(values) =>
            runAction(() =>
              dialog.type === "create"
                ? createCourtType({ description: values.description, typeName: values.typeName })
                : updateCourtType(dialog.courtType.id, { description: values.description, typeName: values.typeName })
            )
          }
        />
      ) : null}
      {dialog?.type === "status" ? (
        <AdminSelectDialog
          defaultValue={dialog.courtType.status}
          label="Trạng thái"
          options={entityStatusOptions}
          title="Cập nhật trạng thái loại sân"
          onClose={() => setDialog(null)}
          onConfirm={(status) => runAction(() => updateCourtTypeStatus(dialog.courtType.id, status))}
        />
      ) : null}
    </div>
  );
}

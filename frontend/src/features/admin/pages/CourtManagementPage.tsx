import { useEffect, useState } from "react";

import { Button } from "../../../components/common/Button";
import { CourtStatusBadge } from "../../../components/courts/CourtStatusBadge";
import { ErrorState } from "../../../components/common/ErrorState";
import { LoadingState } from "../../../components/common/LoadingState";
import { useToastStore } from "../../../stores/toast.store";
import { courtStatusLabel } from "../../../utils/status-label";
import { getErrorMessage } from "../../../utils/format-error";
import { AdminDataTable, type AdminColumn } from "../components/AdminDataTable";
import { AdminNavigation } from "../components/AdminNavigation";
import { AdminPageHeader } from "../components/AdminPageHeader";
import { AdminRowActions } from "../components/AdminRowActions";
import { AdminSelectDialog } from "../components/AdminSelectDialog";
import { AdminTextFormDialog } from "../components/AdminTextFormDialog";
import { createCourt, listAdminCourts, listCourtTypes, updateCourt, updateCourtStatus } from "../services/adminService";
import type { AdminCourt, AdminCourtType, CourtStatus } from "../types/admin.types";

type DialogState = { type: "create" } | { type: "edit"; court: AdminCourt } | { type: "status"; court: AdminCourt } | null;

const courtStatusOptions: Array<{ label: string; value: CourtStatus }> = [
  { label: courtStatusLabel.ACTIVE, value: "ACTIVE" },
  { label: courtStatusLabel.MAINTENANCE, value: "MAINTENANCE" },
  { label: courtStatusLabel.TEMP_CLOSED, value: "TEMP_CLOSED" },
  { label: courtStatusLabel.RETIRED, value: "RETIRED" }
];

export function CourtManagementPage() {
  const { addToast } = useToastStore();
  const [courtTypes, setCourtTypes] = useState<AdminCourtType[]>([]);
  const [courts, setCourts] = useState<AdminCourt[]>([]);
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
        const [loadedCourts, loadedTypes] = await Promise.all([listAdminCourts(), listCourtTypes()]);
        if (isMounted) {
          setCourts(loadedCourts);
          setCourtTypes(loadedTypes);
        }
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
      addToast({ message: "Sân đã được cập nhật.", title: "Thành công", type: "success" });
      setDialog(null);
      setReloadKey((value) => value + 1);
    } catch (actionError) {
      addToast({ message: getErrorMessage(actionError), title: "Không thể xử lý", type: "error" });
    }
  }

  const columns: Array<AdminColumn<AdminCourt>> = [
    { header: "Sân", key: "name", render: (court) => <strong>{court.courtName}</strong> },
    { header: "Loại", key: "type", render: (court) => court.courtType?.typeName ?? "Chưa có" },
    { header: "Status", key: "status", render: (court) => <CourtStatusBadge status={court.status} /> },
    { header: "Mô tả", key: "description", render: (court) => court.description ?? "Chưa có" },
    {
      header: "Thao tác",
      key: "actions",
      render: (court) => (
        <AdminRowActions
          actions={[
            { label: "Sửa", onSelect: () => setDialog({ type: "edit", court }), tone: "primary" },
            { label: "Cập nhật status", onSelect: () => setDialog({ type: "status", court }) }
          ]}
        />
      )
    }
  ];

  return (
    <div className="admin-page">
      <AdminNavigation />
      <AdminPageHeader title="Courts" description="Quản lý sân, loại sân và trạng thái vận hành." actions={<Button onClick={() => setDialog({ type: "create" })}>Tạo sân</Button>} />
      {isLoading ? <LoadingState message="Đang tải sân..." /> : null}
      {error && !isLoading ? <ErrorState actionLabel="Tải lại" message={error} title="Không tải được sân" onAction={() => setReloadKey((value) => value + 1)} /> : null}
      {!isLoading && !error ? <AdminDataTable columns={columns} getRowKey={(court) => court.id} rows={courts} /> : null}

      {dialog?.type === "create" || dialog?.type === "edit" ? (
        <AdminTextFormDialog
          fields={[
            { key: "courtName", label: "Tên sân", required: true },
            { key: "courtTypeId", label: `Court type ID (${courtTypes.map((type) => `${type.typeName}: ${type.id}`).join(" | ")})`, required: true },
            { key: "description", label: "Mô tả" },
            { key: "imageUrl", label: "Image URL", type: "url" }
          ]}
          initialValues={
            dialog.type === "edit"
              ? {
                  courtName: dialog.court.courtName,
                  courtTypeId: dialog.court.courtType?.id ?? "",
                  description: dialog.court.description,
                  imageUrl: dialog.court.imageUrl
                }
              : undefined
          }
          title={dialog.type === "create" ? "Tạo sân" : "Sửa sân"}
          onClose={() => setDialog(null)}
          onSubmit={(values) =>
            runAction(() =>
              dialog.type === "create"
                ? createCourt({ courtName: values.courtName, courtTypeId: values.courtTypeId, description: values.description, imageUrl: values.imageUrl })
                : updateCourt(dialog.court.id, { courtName: values.courtName, courtTypeId: values.courtTypeId, description: values.description, imageUrl: values.imageUrl })
            )
          }
        />
      ) : null}
      {dialog?.type === "status" ? (
        <AdminSelectDialog
          defaultValue={dialog.court.status}
          label="Trạng thái sân"
          options={courtStatusOptions}
          reasonRequired
          title="Cập nhật trạng thái sân"
          onClose={() => setDialog(null)}
          onConfirm={(status, reason) => runAction(() => updateCourtStatus(dialog.court.id, status, reason))}
        />
      ) : null}
    </div>
  );
}

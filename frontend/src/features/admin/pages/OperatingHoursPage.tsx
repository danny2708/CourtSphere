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
import { createOperatingHour, listAdminCourts, listOperatingHours, updateOperatingHourStatus } from "../services/adminService";
import type { AdminCourt, AdminOperatingHour, EntityStatus } from "../types/admin.types";

type DialogState = { type: "create" } | { type: "status"; item: AdminOperatingHour } | null;

const statusOptions: Array<{ label: string; value: EntityStatus }> = [
  { label: entityStatusLabel.ACTIVE, value: "ACTIVE" },
  { label: entityStatusLabel.INACTIVE, value: "INACTIVE" }
];

export function OperatingHoursPage() {
  const { addToast } = useToastStore();
  const [courts, setCourts] = useState<AdminCourt[]>([]);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [error, setError] = useState<string | null>(null);
  const [hours, setHours] = useState<AdminOperatingHour[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedCourtId, setSelectedCourtId] = useState("");

  useEffect(() => {
    let isMounted = true;
    async function loadCourts() {
      const loadedCourts = await listAdminCourts();
      if (!isMounted) return;
      setCourts(loadedCourts);
      setSelectedCourtId((current) => current || loadedCourts[0]?.id || "");
    }
    void loadCourts();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function loadHours() {
      if (!selectedCourtId) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const data = await listOperatingHours(selectedCourtId);
        if (isMounted) setHours(data);
      } catch (loadError) {
        if (isMounted) setError(getErrorMessage(loadError));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    void loadHours();
    return () => {
      isMounted = false;
    };
  }, [reloadKey, selectedCourtId]);

  async function runAction(action: () => Promise<unknown>) {
    try {
      await action();
      addToast({ message: "Operating hours đã được cập nhật.", title: "Thành công", type: "success" });
      setDialog(null);
      setReloadKey((value) => value + 1);
    } catch (actionError) {
      addToast({ message: getErrorMessage(actionError), title: "Không thể lưu", type: "error" });
    }
  }

  const columns: Array<AdminColumn<AdminOperatingHour>> = [
    { header: "Weekday", key: "weekday", render: (item) => item.weekday },
    { header: "Open", key: "open", render: (item) => item.openTime },
    { header: "Close", key: "close", render: (item) => item.closeTime },
    { header: "Slot", key: "slot", render: (item) => `${item.slotDurationMinutes} phút` },
    { header: "Status", key: "status", render: (item) => <Badge tone={item.status === "ACTIVE" ? "success" : "neutral"}>{getStatusLabel(entityStatusLabel, item.status)}</Badge> },
    { header: "Thao tác", key: "actions", render: (item) => <Button size="sm" onClick={() => setDialog({ type: "status", item })}>Status</Button> }
  ];

  return (
    <div className="admin-page">
      <AdminNavigation />
      <AdminPageHeader title="Operating hours" description="Quản lý khung giờ hoạt động theo từng sân." actions={<Button disabled={!selectedCourtId} onClick={() => setDialog({ type: "create" })}>Tạo khung giờ</Button>} />
      <div className="admin-filter-bar">
        <select value={selectedCourtId} onChange={(event) => setSelectedCourtId(event.target.value)}>
          {courts.map((court) => <option key={court.id} value={court.id}>{court.courtName}</option>)}
        </select>
      </div>
      {isLoading ? <LoadingState message="Đang tải giờ hoạt động..." /> : null}
      {error && !isLoading ? <ErrorState actionLabel="Tải lại" message={error} title="Không tải được giờ hoạt động" onAction={() => setReloadKey((value) => value + 1)} /> : null}
      {!isLoading && !error ? <AdminDataTable columns={columns} getRowKey={(item) => item.id} rows={hours} /> : null}
      {dialog?.type === "create" ? (
        <AdminTextFormDialog
          fields={[
            { key: "weekday", label: "Weekday 1-7", required: true, type: "number" },
            { key: "openTime", label: "Open time", required: true, type: "time" },
            { key: "closeTime", label: "Close time", required: true, type: "time" },
            { key: "slotDurationMinutes", label: "Slot duration minutes", required: true, type: "number" }
          ]}
          title="Tạo operating hour"
          onClose={() => setDialog(null)}
          onSubmit={(values) =>
            runAction(() => createOperatingHour(selectedCourtId, {
              weekday: Number(values.weekday),
              openTime: values.openTime,
              closeTime: values.closeTime,
              slotDurationMinutes: Number(values.slotDurationMinutes)
            }))
          }
        />
      ) : null}
      {dialog?.type === "status" ? (
        <AdminSelectDialog
          defaultValue={dialog.item.status}
          label="Trạng thái"
          options={statusOptions}
          title="Cập nhật trạng thái operating hour"
          onClose={() => setDialog(null)}
          onConfirm={(status) => runAction(() => updateOperatingHourStatus(dialog.item.id, status))}
        />
      ) : null}
    </div>
  );
}

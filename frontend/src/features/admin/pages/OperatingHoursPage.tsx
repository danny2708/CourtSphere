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
import { ManagerNavigation } from "../../manager/components/ManagerNavigation";
import { createOperatingHour, listAdminCourts, listOperatingHours, updateOperatingHour, updateOperatingHourStatus } from "../services/adminService";
import type { AdminCourt, AdminOperatingHour, EntityStatus } from "../types/admin.types";

type OperatingHoursPageProps = {
  variant?: "admin" | "manager";
};

type DialogState =
  | { type: "create" }
  | { type: "edit"; item: AdminOperatingHour }
  | { type: "status"; item: AdminOperatingHour }
  | null;

const statusOptions: Array<{ label: string; value: EntityStatus }> = [
  { label: entityStatusLabel.ACTIVE, value: "ACTIVE" },
  { label: entityStatusLabel.INACTIVE, value: "INACTIVE" }
];

const weekdayLabels: Record<number, string> = {
  1: "Thứ 2",
  2: "Thứ 3",
  3: "Thứ 4",
  4: "Thứ 5",
  5: "Thứ 6",
  6: "Thứ 7",
  7: "Chủ nhật"
};

const operatingHourFields = [
  { key: "weekday", label: "Thứ trong tuần (1-7)", required: true, type: "number" as const },
  { key: "openTime", label: "Giờ mở cửa", required: true, type: "time" as const },
  { key: "closeTime", label: "Giờ đóng cửa", required: true, type: "time" as const },
  { key: "slotDurationMinutes", label: "Độ dài mỗi slot (phút)", required: true, type: "number" as const }
];

export function OperatingHoursPage({ variant = "admin" }: OperatingHoursPageProps) {
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

  const Navigation = variant === "manager" ? ManagerNavigation : AdminNavigation;

  const columns: Array<AdminColumn<AdminOperatingHour>> = [
    { header: "Thứ", key: "weekday", render: (item) => weekdayLabels[item.weekday] ?? item.weekday },
    { header: "Mở cửa", key: "open", render: (item) => item.openTime },
    { header: "Đóng cửa", key: "close", render: (item) => item.closeTime },
    { header: "Slot", key: "slot", render: (item) => `${item.slotDurationMinutes} phút/slot` },
    { header: "Status", key: "status", render: (item) => <Badge tone={item.status === "ACTIVE" ? "success" : "neutral"}>{getStatusLabel(entityStatusLabel, item.status)}</Badge> },
    {
      header: "Thao tác",
      key: "actions",
      render: (item) => (
        <div className="admin-action-row">
          <Button size="sm" onClick={() => setDialog({ type: "edit", item })}>
            Sửa giờ
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDialog({ type: "status", item })}>
            Status
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="admin-page">
      <Navigation />
      <AdminPageHeader
        title={variant === "manager" ? "Giờ mở sân" : "Operating hours"}
        description="Quản lý giờ mở cửa, giờ đóng cửa và độ dài slot theo từng sân."
        actions={<Button disabled={!selectedCourtId} onClick={() => setDialog({ type: "create" })}>Tạo khung giờ</Button>}
      />
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
          fields={operatingHourFields}
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
      {dialog?.type === "edit" ? (
        <AdminTextFormDialog
          fields={operatingHourFields}
          initialValues={dialog.item}
          title={`Sửa giờ mở ${weekdayLabels[dialog.item.weekday] ?? dialog.item.weekday}`}
          onClose={() => setDialog(null)}
          onSubmit={(values) =>
            runAction(() => updateOperatingHour(dialog.item.id, {
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

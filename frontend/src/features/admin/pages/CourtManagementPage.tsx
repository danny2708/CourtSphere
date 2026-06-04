import { useEffect, useState, type FormEvent } from "react";
import { GripVertical, Plus, RotateCcw, Trash2 } from "lucide-react";

import { Badge } from "../../../components/common/Badge";
import { Button } from "../../../components/common/Button";
import { CourtStatusBadge } from "../../../components/courts/CourtStatusBadge";
import { ErrorState } from "../../../components/common/ErrorState";
import { LoadingState } from "../../../components/common/LoadingState";
import { useToastStore } from "../../../stores/toast.store";
import { courtStatusLabel } from "../../../utils/status-label";
import { getErrorMessage } from "../../../utils/format-error";
import { AdminDataTable, type AdminAdvancedFilter, type AdminColumn } from "../components/AdminDataTable";
import { AdminNavigation } from "../components/AdminNavigation";
import { AdminPageHeader } from "../components/AdminPageHeader";
import { AdminMultiSelectDialog } from "../components/AdminMultiSelectDialog";
import { AdminRowActions } from "../components/AdminRowActions";
import { AdminSelectDialog } from "../components/AdminSelectDialog";
import { ManagerNavigation } from "../../manager/components/ManagerNavigation";
import {
  createCourt,
  createOperatingHour,
  createPricingRule,
  deleteOperatingHour,
  deletePricingRule,
  listAdminCourts,
  listAdminUsers,
  listCourtTypes,
  updateCourt,
  updateCourtManagers,
  updateCourtStatus,
  updateOperatingHour,
  updateOperatingHourStatus,
  updatePricingRule,
  updatePricingRuleStatus,
  uploadCourtImage
} from "../services/adminService";
import type { AdminCourt, AdminCourtType, AdminOperatingHour, AdminPricingRule, AdminUser, CourtStatus, EntityStatus } from "../types/admin.types";
import { formatMoney } from "../utils/adminFormat";

type CourtManagementPageProps = {
  variant?: "admin" | "manager";
};

type DialogState =
  | { type: "create" }
  | { type: "edit"; court: AdminCourt }
  | { type: "status"; court: AdminCourt }
  | { type: "managers"; court: AdminCourt }
  | null;

type CourtFormValues = {
  courtName: string;
  courtTypeId: string;
  description: string;
};

type OperatingHourDraft = {
  clientId: string;
  id?: string;
  weekday: string;
  openTime: string;
  closeTime: string;
  slotDurationMinutes: string;
  status: EntityStatus;
};

type PricingRuleDraft = {
  clientId: string;
  id?: string;
  applicableDay: string;
  startTime: string;
  endTime: string;
  priceAmount: string;
  priorityOrder: number;
  status: EntityStatus;
};

type CourtFormSubmitInput = {
  deletedOperatingHourIds: string[];
  deletedPricingRuleIds: string[];
  imageFile: File | null;
  managerUserIds?: string[];
  operatingHours: OperatingHourDraft[];
  pricingRules: PricingRuleDraft[];
  values: CourtFormValues;
};

const courtStatusOptions: Array<{ label: string; value: CourtStatus }> = [
  { label: courtStatusLabel.ACTIVE, value: "ACTIVE" },
  { label: courtStatusLabel.MAINTENANCE, value: "MAINTENANCE" },
  { label: courtStatusLabel.TEMP_CLOSED, value: "TEMP_CLOSED" },
  { label: courtStatusLabel.RETIRED, value: "RETIRED" }
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

const weekdayOptions = Object.entries(weekdayLabels).map(([value, label]) => ({ label, value }));

function createClientId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function toPriceNumber(value: number | string): number {
  return typeof value === "number" ? value : Number(value);
}

function getWeekdayLabel(value: number | string): string {
  return weekdayLabels[Number(value)] ?? String(value);
}

function getPricingDayLabel(value: number | string | null | undefined): string {
  return value === null || value === undefined || value === "" ? "Tất cả ngày" : getWeekdayLabel(value);
}

function compareOperatingHourDrafts(left: OperatingHourDraft, right: OperatingHourDraft): number {
  const weekdayDiff = Number(left.weekday) - Number(right.weekday);

  if (weekdayDiff !== 0) {
    return weekdayDiff;
  }

  return left.openTime.localeCompare(right.openTime);
}

function comparePricingRuleDrafts(left: PricingRuleDraft, right: PricingRuleDraft): number {
  if (left.priorityOrder !== right.priorityOrder) {
    return left.priorityOrder - right.priorityOrder;
  }

  const leftDay = left.applicableDay ? Number(left.applicableDay) : 0;
  const rightDay = right.applicableDay ? Number(right.applicableDay) : 0;

  if (leftDay !== rightDay) {
    return leftDay - rightDay;
  }

  const startDiff = left.startTime.localeCompare(right.startTime);
  if (startDiff !== 0) {
    return startDiff;
  }

  return left.endTime.localeCompare(right.endTime);
}

function toOperatingHourDraft(hour: AdminOperatingHour): OperatingHourDraft {
  return {
    clientId: hour.id,
    id: hour.id,
    weekday: String(hour.weekday),
    openTime: hour.openTime,
    closeTime: hour.closeTime,
    slotDurationMinutes: String(hour.slotDurationMinutes),
    status: hour.status
  };
}

function toPricingRuleDraft(rule: AdminPricingRule): PricingRuleDraft {
  return {
    clientId: rule.id,
    id: rule.id,
    applicableDay: rule.applicableDay === null || rule.applicableDay === undefined ? "" : String(rule.applicableDay),
    startTime: rule.startTime,
    endTime: rule.endTime,
    priceAmount: String(rule.priceAmount),
    priorityOrder: rule.priorityOrder ?? 1000,
    status: rule.status
  };
}

function createEmptyOperatingHour(): OperatingHourDraft {
  return {
    clientId: createClientId(),
    weekday: "1",
    openTime: "07:00",
    closeTime: "22:00",
    slotDurationMinutes: "60",
    status: "ACTIVE"
  };
}

function createEmptyPricingRule(priorityOrder: number): PricingRuleDraft {
  return {
    clientId: createClientId(),
    applicableDay: "",
    startTime: "07:00",
    endTime: "17:00",
    priceAmount: "100000",
    priorityOrder,
    status: "ACTIVE"
  };
}

function isOperatingHourEmpty(row: OperatingHourDraft): boolean {
  return !row.id && !row.weekday && !row.openTime && !row.closeTime && !row.slotDurationMinutes;
}

function isPricingRuleEmpty(row: PricingRuleDraft): boolean {
  return !row.id && !row.applicableDay && !row.startTime && !row.endTime && !row.priceAmount;
}

function validateCourtConfiguration(values: CourtFormValues, operatingHours: OperatingHourDraft[], pricingRules: PricingRuleDraft[]): string | null {
  if (!values.courtName.trim()) {
    return "Vui lòng nhập tên sân.";
  }

  if (!values.courtTypeId) {
    return "Vui lòng chọn loại sân.";
  }

  const usedWeekdays = new Set<string>();
  for (const row of operatingHours.filter((item) => !isOperatingHourEmpty(item))) {
    const weekday = Number(row.weekday);
    const slotDurationMinutes = Number(row.slotDurationMinutes);

    if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) {
      return "Thứ trong tuần của giờ mở phải nằm trong khoảng 1-7.";
    }

    if (usedWeekdays.has(row.weekday)) {
      return "Mỗi sân chỉ có một cấu hình giờ mở cho mỗi ngày.";
    }
    usedWeekdays.add(row.weekday);

    if (!row.openTime || !row.closeTime || row.openTime >= row.closeTime) {
      return "Giờ mở phải sớm hơn giờ đóng.";
    }

    if (!Number.isInteger(slotDurationMinutes) || slotDurationMinutes <= 0) {
      return "Độ dài slot phải là số phút dương.";
    }
  }

  for (const row of pricingRules.filter((item) => !isPricingRuleEmpty(item))) {
    const applicableDay = row.applicableDay ? Number(row.applicableDay) : null;
    const priceAmount = Number(row.priceAmount);

    if (applicableDay !== null && (!Number.isInteger(applicableDay) || applicableDay < 1 || applicableDay > 7)) {
      return "Ngày áp dụng của bảng giá phải nằm trong khoảng 1-7.";
    }

    if (!row.startTime || !row.endTime || row.startTime >= row.endTime) {
      return "Giờ bắt đầu của bảng giá phải sớm hơn giờ kết thúc.";
    }

    if (!Number.isFinite(priceAmount) || priceAmount < 0) {
      return "Giá tiền phải là số không âm.";
    }
  }

  return null;
}

function summarizeOperatingHours(court: AdminCourt): string[] {
  const activeHours = [...(court.operatingHours ?? [])]
    .filter((hour) => hour.status === "ACTIVE")
    .sort((left, right) => left.weekday - right.weekday);

  const lines = activeHours.slice(0, 3).map((hour) => `${getWeekdayLabel(hour.weekday)} ${hour.openTime}-${hour.closeTime}, ${hour.slotDurationMinutes}p`);

  if (activeHours.length > 3) {
    lines.push(`+${activeHours.length - 3} ngày khác`);
  }

  return lines;
}

function summarizePricingRules(court: AdminCourt): string[] {
  const activeRules = [...(court.pricingRules ?? [])]
    .filter((rule) => rule.status === "ACTIVE")
    .sort((left, right) => {
      const priorityDiff = (left.priorityOrder ?? 1000) - (right.priorityOrder ?? 1000);

      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      const leftDay = left.applicableDay ?? 0;
      const rightDay = right.applicableDay ?? 0;

      if (leftDay !== rightDay) {
        return leftDay - rightDay;
      }

      return left.startTime.localeCompare(right.startTime);
    });

  const lines = activeRules.slice(0, 3).map((rule) => {
    const price = formatMoney(toPriceNumber(rule.priceAmount));
    return `${getPricingDayLabel(rule.applicableDay)} ${rule.startTime}-${rule.endTime}: ${price}`;
  });

  if (activeRules.length > 3) {
    lines.push(`+${activeRules.length - 3} mức giá khác`);
  }

  return lines;
}

function summarizeAssignedManagers(court: AdminCourt): string[] {
  return (court.assignedManagers ?? []).map((manager) => `${manager.fullName} (${manager.email})`);
}

function renderSummaryLines(lines: string[]) {
  if (lines.length === 0) {
    return <span className="admin-muted">Chưa có</span>;
  }

  return (
    <div className="admin-inline-list">
      {lines.map((line) => (
        <span key={line}>{line}</span>
      ))}
    </div>
  );
}

function CourtFormDialog({ court, courtTypes, managerUsers = [], onClose, onSubmit, title }: {
  court?: AdminCourt;
  courtTypes: AdminCourtType[];
  managerUsers?: AdminUser[];
  onClose: () => void;
  onSubmit: (input: CourtFormSubmitInput) => Promise<void>;
  title: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletedOperatingHourIds, setDeletedOperatingHourIds] = useState<string[]>([]);
  const [deletedPricingRuleIds, setDeletedPricingRuleIds] = useState<string[]>([]);
  const [draggedPricingRuleClientId, setDraggedPricingRuleClientId] = useState<string | null>(null);
  const [operatingHours, setOperatingHours] = useState<OperatingHourDraft[]>(() =>
    (court?.operatingHours ?? []).map(toOperatingHourDraft).sort(compareOperatingHourDrafts)
  );
  const [pricingRules, setPricingRules] = useState<PricingRuleDraft[]>(() =>
    (court?.pricingRules ?? []).map(toPricingRuleDraft).sort(comparePricingRuleDrafts)
  );
  const [managerUserIds, setManagerUserIds] = useState<string[]>(() =>
    (court?.assignedManagers ?? []).map((manager) => manager.id)
  );
  const [values, setValues] = useState<CourtFormValues>(() => ({
    courtName: court?.courtName ?? "",
    courtTypeId: court?.courtType?.id ?? "",
    description: court?.description ?? ""
  }));

  function updateOperatingHour(clientId: string, patch: Partial<OperatingHourDraft>) {
    setOperatingHours((current) => current.map((row) => (row.clientId === clientId ? { ...row, ...patch } : row)));
  }

  function updatePricingRule(clientId: string, patch: Partial<PricingRuleDraft>) {
    setPricingRules((current) => current.map((row) => (row.clientId === clientId ? { ...row, ...patch } : row)));
  }

  function removeOperatingHour(row: OperatingHourDraft) {
    const id = row.id;

    if (id) {
      setDeletedOperatingHourIds((current) => (current.includes(id) ? current : [...current, id]));
    }

    setOperatingHours((current) => current.filter((item) => item.clientId !== row.clientId));
  }

  function removePricingRule(row: PricingRuleDraft) {
    const id = row.id;

    if (id) {
      setDeletedPricingRuleIds((current) => (current.includes(id) ? current : [...current, id]));
    }

    setPricingRules((current) => current.filter((item) => item.clientId !== row.clientId));
  }

  function movePricingRule(sourceClientId: string, targetClientId: string) {
    if (sourceClientId === targetClientId) {
      return;
    }

    setPricingRules((current) => {
      const sourceIndex = current.findIndex((row) => row.clientId === sourceClientId);
      const targetIndex = current.findIndex((row) => row.clientId === targetClientId);

      if (sourceIndex < 0 || targetIndex < 0) {
        return current;
      }

      const nextRows = [...current];
      const [movedRow] = nextRows.splice(sourceIndex, 1);
      nextRows.splice(targetIndex, 0, movedRow);

      return nextRows;
    });
  }

  function toggleManagerUser(managerUserId: string) {
    setManagerUserIds((current) =>
      current.includes(managerUserId)
        ? current.filter((currentManagerUserId) => currentManagerUserId !== managerUserId)
        : [...current, managerUserId]
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validateCourtConfiguration(values, operatingHours, pricingRules);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit({
        deletedOperatingHourIds,
        deletedPricingRuleIds,
        imageFile,
        managerUserIds,
        operatingHours: operatingHours.filter((row) => !isOperatingHourEmpty(row)),
        pricingRules: pricingRules.filter((row) => !isPricingRuleEmpty(row)),
        values
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <form className="dialog-panel court-config-dialog" onSubmit={handleSubmit}>
        <div>
          <h2>{title}</h2>
          <p>Thiết lập thông tin sân, giờ mở và mức giá theo khung giờ</p>
        </div>

        <div className="court-config-grid">
          <label className="form-field">
            <span>Tên sân</span>
            <input value={values.courtName} onChange={(event) => setValues((current) => ({ ...current, courtName: event.target.value }))} />
          </label>
          <label className="form-field">
            <span>Loại sân</span>
            <select value={values.courtTypeId} onChange={(event) => setValues((current) => ({ ...current, courtTypeId: event.target.value }))}>
              <option value="">Chọn loại sân</option>
              {courtTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.typeName}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field court-config-grid__wide">
            <span>Mô tả</span>
            <input value={values.description} onChange={(event) => setValues((current) => ({ ...current, description: event.target.value }))} />
          </label>
          <label className="form-field court-config-grid__wide">
            <span>Ảnh sân</span>
            <input accept="image/png,image/jpeg,image/webp,image/gif" type="file" onChange={(event) => setImageFile(event.target.files?.[0] ?? null)} />
          </label>
        </div>

        {managerUsers.length > 0 ? (
          <fieldset className="admin-multi-select">
            <legend>Quản lý sân</legend>
            {managerUsers.map((manager) => (
              <label className="admin-multi-select__option" key={manager.id}>
                <input
                  checked={managerUserIds.includes(manager.id)}
                  disabled={isSubmitting}
                  type="checkbox"
                  onChange={() => toggleManagerUser(manager.id)}
                />
                <span>{manager.fullName} ({manager.email})</span>
              </label>
            ))}
          </fieldset>
        ) : null}

        <section className="court-config-section">
          <div className="court-config-section__header">
            <h3>Giờ mở sân</h3>
            <Button size="sm" variant="secondary" onClick={() => setOperatingHours((current) => [...current, createEmptyOperatingHour()])}>
              <Plus aria-hidden="true" size={16} />
              Thêm giờ
            </Button>
          </div>
          {operatingHours.length === 0 ? (
            <p className="admin-muted">Chưa có giờ mở.</p>
          ) : (
            <div className="court-config-table-wrap">
              <table className="court-config-table">
                <thead>
                  <tr>
                    <th>Ngày</th>
                    <th>Mở</th>
                    <th>Đóng</th>
                    <th>Slot</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {[...operatingHours].sort(compareOperatingHourDrafts).map((row) => (
                    <tr className={row.status === "INACTIVE" ? "court-config-row--muted" : undefined} key={row.clientId}>
                      <td>
                        <select value={row.weekday} onChange={(event) => updateOperatingHour(row.clientId, { weekday: event.target.value })}>
                          {weekdayOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input type="time" value={row.openTime} onChange={(event) => updateOperatingHour(row.clientId, { openTime: event.target.value })} />
                      </td>
                      <td>
                        <input type="time" value={row.closeTime} onChange={(event) => updateOperatingHour(row.clientId, { closeTime: event.target.value })} />
                      </td>
                      <td>
                        <input min="1" type="number" value={row.slotDurationMinutes} onChange={(event) => updateOperatingHour(row.clientId, { slotDurationMinutes: event.target.value })} />
                      </td>
                      <td>
                        <Badge tone={row.status === "ACTIVE" ? "success" : "neutral"}>{row.status === "ACTIVE" ? "Đang dùng" : "Đã tắt"}</Badge>
                      </td>
                      <td>
                        {row.id ? (
                          <div className="court-config-actions">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => updateOperatingHour(row.clientId, { status: row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" })}
                            >
                              {row.status === "ACTIVE" ? <Trash2 aria-hidden="true" size={15} /> : <RotateCcw aria-hidden="true" size={15} />}
                              {row.status === "ACTIVE" ? "Tắt" : "Bật lại"}
                            </Button>
                            <Button size="sm" variant="danger" onClick={() => removeOperatingHour(row)}>
                              <Trash2 aria-hidden="true" size={15} />
                              Xóa hẳn
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => removeOperatingHour(row)}>
                            <Trash2 aria-hidden="true" size={15} />
                            Xóa
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="court-config-section">
          <div className="court-config-section__header">
            <h3>Bảng giá theo khung giờ</h3>
            <Button size="sm" variant="secondary" onClick={() => setPricingRules((current) => [...current, createEmptyPricingRule(current.length + 1)])}>
              <Plus aria-hidden="true" size={16} />
              Thêm giá
            </Button>
          </div>
          {pricingRules.length === 0 ? (
            <p className="admin-muted">Chưa có bảng giá.</p>
          ) : (
            <div className="court-config-table-wrap">
              <table className="court-config-table court-config-table--pricing">
                <thead>
                  <tr>
                    <th>Ưu tiên</th>
                    <th>Ngày áp dụng</th>
                    <th>Bắt đầu</th>
                    <th>Kết thúc</th>
                    <th>Giá</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {pricingRules.map((row, index) => (
                    <tr
                      className={`${row.status === "INACTIVE" ? "court-config-row--muted" : ""}${draggedPricingRuleClientId === row.clientId ? " court-config-row--dragging" : ""}`}
                      draggable
                      key={row.clientId}
                      onDragEnd={() => setDraggedPricingRuleClientId(null)}
                      onDragOver={(event) => event.preventDefault()}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        setDraggedPricingRuleClientId(row.clientId);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (draggedPricingRuleClientId) {
                          movePricingRule(draggedPricingRuleClientId, row.clientId);
                        }
                        setDraggedPricingRuleClientId(null);
                      }}
                    >
                      <td>
                        <span className="court-config-priority-cell">
                          <GripVertical aria-hidden="true" size={16} />
                          {index + 1}
                        </span>
                      </td>
                      <td>
                        <select value={row.applicableDay} onChange={(event) => updatePricingRule(row.clientId, { applicableDay: event.target.value })}>
                          <option value="">Tất cả ngày</option>
                          {weekdayOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input type="time" value={row.startTime} onChange={(event) => updatePricingRule(row.clientId, { startTime: event.target.value })} />
                      </td>
                      <td>
                        <input type="time" value={row.endTime} onChange={(event) => updatePricingRule(row.clientId, { endTime: event.target.value })} />
                      </td>
                      <td>
                        <input min="0" type="number" value={row.priceAmount} onChange={(event) => updatePricingRule(row.clientId, { priceAmount: event.target.value })} />
                      </td>
                      <td>
                        <Badge tone={row.status === "ACTIVE" ? "success" : "neutral"}>{row.status === "ACTIVE" ? "Đang dùng" : "Đã tắt"}</Badge>
                      </td>
                      <td>
                        {row.id ? (
                          <div className="court-config-actions">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => updatePricingRule(row.clientId, { status: row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" })}
                            >
                              {row.status === "ACTIVE" ? <Trash2 aria-hidden="true" size={15} /> : <RotateCcw aria-hidden="true" size={15} />}
                              {row.status === "ACTIVE" ? "Tắt" : "Bật lại"}
                            </Button>
                            <Button size="sm" variant="danger" onClick={() => removePricingRule(row)}>
                              <Trash2 aria-hidden="true" size={15} />
                              Xóa hẳn
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => removePricingRule(row)}>
                            <Trash2 aria-hidden="true" size={15} />
                            Xóa
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {error ? <div className="form-error">{error}</div> : null}
        <div className="dialog-actions">
          <Button disabled={isSubmitting} variant="secondary" onClick={onClose}>
            Đóng
          </Button>
          <Button disabled={isSubmitting} type="submit">
            {isSubmitting ? "Đang lưu..." : "Lưu"}
          </Button>
        </div>
      </form>
    </div>
  );
}

async function syncOperatingHours(courtId: string, rows: OperatingHourDraft[], deletedIds: string[]) {
  for (const id of deletedIds) {
    await deleteOperatingHour(id);
  }

  for (const row of rows) {
    const payload = {
      weekday: Number(row.weekday),
      openTime: row.openTime,
      closeTime: row.closeTime,
      slotDurationMinutes: Number(row.slotDurationMinutes)
    };

    if (row.id) {
      await updateOperatingHour(row.id, payload);
      await updateOperatingHourStatus(row.id, row.status);
    } else if (row.status === "ACTIVE") {
      await createOperatingHour(courtId, payload);
    }
  }
}

async function syncPricingRules(courtId: string, rows: PricingRuleDraft[], deletedIds: string[]) {
  for (const id of deletedIds) {
    await deletePricingRule(id);
  }

  for (const [index, row] of rows.entries()) {
    const payload = {
      startTime: row.startTime,
      endTime: row.endTime,
      applicableDay: row.applicableDay ? Number(row.applicableDay) : null,
      priceAmount: Number(row.priceAmount),
      priorityOrder: index + 1
    };

    if (row.id) {
      await updatePricingRule(row.id, payload);
      await updatePricingRuleStatus(row.id, row.status);
    } else if (row.status === "ACTIVE") {
      await createPricingRule(courtId, payload);
    }
  }
}

export function CourtManagementPage({ variant = "admin" }: CourtManagementPageProps) {
  const { addToast } = useToastStore();
  const [courtTypes, setCourtTypes] = useState<AdminCourtType[]>([]);
  const [courts, setCourts] = useState<AdminCourt[]>([]);
  const [fieldManagers, setFieldManagers] = useState<AdminUser[]>([]);
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
        const [loadedCourts, loadedTypes, loadedUsers] = await Promise.all([
          listAdminCourts(variant === "manager" ? { managedOnly: true } : {}),
          listCourtTypes(),
          variant === "admin" ? listAdminUsers() : Promise.resolve([])
        ]);
        if (isMounted) {
          setCourts(loadedCourts);
          setCourtTypes(loadedTypes);
          setFieldManagers(loadedUsers.filter((user) => user.roles.includes("FIELD_MANAGER")));
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
  }, [reloadKey, variant]);

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

  async function submitCourtForm(input: CourtFormSubmitInput) {
    await runAction(async () => {
      const uploadedImageUrl = input.imageFile ? await uploadCourtImage(input.imageFile) : undefined;
      const payload = {
        courtName: input.values.courtName.trim(),
        courtTypeId: input.values.courtTypeId,
        description: input.values.description.trim(),
        ...(uploadedImageUrl ? { imageUrl: uploadedImageUrl } : {})
      };

      if (dialog?.type === "create") {
        const createdCourt = await createCourt(payload);
        await syncOperatingHours(createdCourt.id, input.operatingHours, input.deletedOperatingHourIds);
        await syncPricingRules(createdCourt.id, input.pricingRules, input.deletedPricingRuleIds);
        if (input.managerUserIds) {
          await updateCourtManagers(createdCourt.id, input.managerUserIds);
        }
        return;
      }

      if (dialog?.type === "edit") {
        await updateCourt(dialog.court.id, payload);
        await syncOperatingHours(dialog.court.id, input.operatingHours, input.deletedOperatingHourIds);
        await syncPricingRules(dialog.court.id, input.pricingRules, input.deletedPricingRuleIds);
        if (input.managerUserIds) {
          await updateCourtManagers(dialog.court.id, input.managerUserIds);
        }
      }
    });
  }

  const columns: Array<AdminColumn<AdminCourt>> = [
    ...(variant === "admin"
      ? [
          {
            header: "Quản lý sân",
            key: "managers",
            render: (court) => renderSummaryLines(summarizeAssignedManagers(court))
          } satisfies AdminColumn<AdminCourt>
        ]
      : []),
    { header: "Sân", key: "name", render: (court) => <strong>{court.courtName}</strong> },
    { header: "Loại", key: "type", render: (court) => court.courtType?.typeName ?? "Chưa có" },
    { header: "Trạng thái", key: "status", render: (court) => <CourtStatusBadge status={court.status} /> },
    { header: "Giờ mở", key: "hours", render: (court) => renderSummaryLines(summarizeOperatingHours(court)) },
    { header: "Giá theo khung giờ", key: "pricing", render: (court) => renderSummaryLines(summarizePricingRules(court)) },
    { header: "Mô tả", key: "description", render: (court) => court.description || "Chưa có" },
    {
      header: "Thao tác",
      key: "actions",
      render: (court) => (
        <AdminRowActions
          actions={[
            ...(variant === "admin"
              ? [{ label: "Gán quản lý sân", onSelect: () => setDialog({ type: "managers", court }) }]
              : []),
            ...(variant === "admin"
              ? [{ label: "Sửa thông tin, giá và giờ", onSelect: () => setDialog({ type: "edit", court }), tone: "primary" as const }]
              : []),
            { label: "Cập nhật trạng thái", onSelect: () => setDialog({ type: "status", court }) }
          ]}
        />
      )
    }
  ];

  const advancedFilters: Array<AdminAdvancedFilter<AdminCourt>> = [
    {
      key: "status",
      label: "Trạng thái",
      options: courtStatusOptions,
      getValue: (court) => court.status
    },
    {
      key: "courtType",
      label: "Loại sân",
      options: courtTypes.map((type) => ({ label: type.typeName, value: type.id })),
      getValue: (court) => court.courtType?.id
    }
  ];

  const Navigation = variant === "manager" ? ManagerNavigation : AdminNavigation;

  return (
    <div className="admin-page">
      <Navigation />
      <AdminPageHeader
        title={variant === "manager" ? "Giờ mở sân" : "Sân"}
        description="Quản lý thông tin sân, giờ mở sân và giá theo khung giờ"
        actions={variant === "admin" ? <Button onClick={() => setDialog({ type: "create" })}>Tạo sân</Button> : undefined}
      />

      {isLoading ? <LoadingState message="Đang tải sân..." /> : null}
      {error && !isLoading ? <ErrorState actionLabel="Tải lại" message={error} title="Không tải được sân" onAction={() => setReloadKey((value) => value + 1)} /> : null}
      {!isLoading && !error ? <AdminDataTable advancedFilters={advancedFilters} columns={columns} getRowKey={(court) => court.id} rows={courts} /> : null}

      {dialog?.type === "create" || dialog?.type === "edit" ? (
        <CourtFormDialog
          court={dialog.type === "edit" ? dialog.court : undefined}
          courtTypes={courtTypes}
          managerUsers={variant === "admin" ? fieldManagers : []}
          title={dialog.type === "create" ? "Tạo sân" : "Sửa sân"}
          onClose={() => setDialog(null)}
          onSubmit={submitCourtForm}
        />
      ) : null}

      {dialog?.type === "managers" ? (
        <AdminMultiSelectDialog
          allowEmpty
          defaultValues={(dialog.court.assignedManagers ?? []).map((manager) => manager.id)}
          emptyMessage="Chưa có tài khoản quản lý sân."
          label="Quản lý sân"
          options={fieldManagers.map((manager) => ({
            label: `${manager.fullName} (${manager.email})`,
            value: manager.id
          }))}
          title="Gán quản lý sân"
          onClose={() => setDialog(null)}
          onConfirm={(managerUserIds) => runAction(() => updateCourtManagers(dialog.court.id, managerUserIds))}
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
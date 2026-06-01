import { useEffect, useState } from "react";

import { Badge } from "../../../components/common/Badge";
import { Button } from "../../../components/common/Button";
import { ErrorState } from "../../../components/common/ErrorState";
import { LoadingState } from "../../../components/common/LoadingState";
import { useToastStore } from "../../../stores/toast.store";
import { getErrorMessage } from "../../../utils/format-error";
import { entityStatusLabel, getStatusLabel } from "../../../utils/status-label";
import { AdminDataTable, type AdminAdvancedFilter, type AdminColumn } from "../components/AdminDataTable";
import { AdminNavigation } from "../components/AdminNavigation";
import { AdminPageHeader } from "../components/AdminPageHeader";
import { AdminRowActions } from "../components/AdminRowActions";
import { AdminSelectDialog } from "../components/AdminSelectDialog";
import { AdminTextFormDialog } from "../components/AdminTextFormDialog";
import { createPricingRule, listAdminCourts, listPricingRules, updatePricingRuleStatus } from "../services/adminService";
import type { AdminCourt, AdminPricingRule, EntityStatus } from "../types/admin.types";
import { formatMoney } from "../utils/adminFormat";

type DialogState = { type: "create" } | { type: "status"; item: AdminPricingRule } | null;

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

export function PricingRulesPage() {
  const { addToast } = useToastStore();
  const [courts, setCourts] = useState<AdminCourt[]>([]);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pricingRules, setPricingRules] = useState<AdminPricingRule[]>([]);
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
    async function loadRules() {
      if (!selectedCourtId) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const data = await listPricingRules(selectedCourtId);
        if (isMounted) setPricingRules(data);
      } catch (loadError) {
        if (isMounted) setError(getErrorMessage(loadError));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    void loadRules();
    return () => {
      isMounted = false;
    };
  }, [reloadKey, selectedCourtId]);

  async function runAction(action: () => Promise<unknown>) {
    try {
      await action();
      addToast({ message: "Quy tắc giá đã được cập nhật.", title: "Thành công", type: "success" });
      setDialog(null);
      setReloadKey((value) => value + 1);
    } catch (actionError) {
      addToast({ message: getErrorMessage(actionError), title: "Không thể lưu", type: "error" });
    }
  }

  const columns: Array<AdminColumn<AdminPricingRule>> = [
    { header: "Khung giờ", key: "time", render: (rule) => `${rule.startTime} - ${rule.endTime}` },
    { header: "Ngày", key: "day", render: (rule) => rule.applicableDay ?? "Tất cả" },
    { header: "Giá", key: "price", render: (rule) => formatMoney(rule.priceAmount) },
    { header: "Trạng thái", key: "status", render: (rule) => <Badge tone={rule.status === "ACTIVE" ? "success" : "neutral"}>{getStatusLabel(entityStatusLabel, rule.status)}</Badge> },
    {
      header: "Thao tác",
      key: "actions",
      render: (rule) => (
        <AdminRowActions
          actions={[
            { label: "Cập nhật trạng thái", onSelect: () => setDialog({ type: "status", item: rule }), tone: "primary" }
          ]}
        />
      )
    }
  ];
  const applicableDayOptions = [...new Set(
    pricingRules.map((rule) => rule.applicableDay).filter((day): day is number => day !== null && day !== undefined)
  )]
    .sort((left, right) => left - right)
    .map((day) => ({ label: weekdayLabels[day] ?? String(day), value: String(day) }));
  const advancedFilters: Array<AdminAdvancedFilter<AdminPricingRule>> = [
    {
      key: "status",
      label: "Trạng thái",
      options: statusOptions,
      getValue: (rule) => rule.status
    },
    {
      key: "applicableDay",
      label: "Ngày áp dụng",
      options: [
        { label: "Tất cả ngày", value: "ALL_DAYS" },
        ...applicableDayOptions
      ],
      getValue: (rule) => rule.applicableDay === null || rule.applicableDay === undefined ? "ALL_DAYS" : String(rule.applicableDay)
    }
  ];

  return (
    <div className="admin-page">
      <AdminNavigation />
      <AdminPageHeader title="Bảng giá" description="Quản lý bảng giá theo sân và khung giờ." actions={<Button disabled={!selectedCourtId} onClick={() => setDialog({ type: "create" })}>Tạo giá</Button>} />
      <div className="admin-filter-bar">
        <select value={selectedCourtId} onChange={(event) => setSelectedCourtId(event.target.value)}>
          {courts.map((court) => <option key={court.id} value={court.id}>{court.courtName}</option>)}
        </select>
      </div>
      {isLoading ? <LoadingState message="Đang tải bảng giá..." /> : null}
      {error && !isLoading ? <ErrorState actionLabel="Tải lại" message={error} title="Không tải được bảng giá" onAction={() => setReloadKey((value) => value + 1)} /> : null}
      {!isLoading && !error ? <AdminDataTable advancedFilters={advancedFilters} columns={columns} getRowKey={(rule) => rule.id} rows={pricingRules} /> : null}
      {dialog?.type === "create" ? (
        <AdminTextFormDialog
          fields={[
            { key: "startTime", label: "Giờ bắt đầu", required: true, type: "time" },
            { key: "endTime", label: "Giờ kết thúc", required: true, type: "time" },
            { key: "applicableDay", label: "Ngày áp dụng 1-7", type: "number" },
            { key: "priceAmount", label: "Giá tiền", required: true, type: "number" }
          ]}
          title="Tạo quy tắc giá"
          onClose={() => setDialog(null)}
          onSubmit={(values) =>
            runAction(() => createPricingRule(selectedCourtId, {
              startTime: values.startTime,
              endTime: values.endTime,
              applicableDay: values.applicableDay ? Number(values.applicableDay) : null,
              priceAmount: Number(values.priceAmount)
            }))
          }
        />
      ) : null}
      {dialog?.type === "status" ? (
        <AdminSelectDialog
          defaultValue={dialog.item.status}
          label="Trạng thái"
          options={statusOptions}
          title="Cập nhật trạng thái quy tắc giá"
          onClose={() => setDialog(null)}
          onConfirm={(status) => runAction(() => updatePricingRuleStatus(dialog.item.id, status))}
        />
      ) : null}
    </div>
  );
}

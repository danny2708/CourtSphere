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
import { createPricingRule, listAdminCourts, listPricingRules, updatePricingRuleStatus } from "../services/adminService";
import type { AdminCourt, AdminPricingRule, EntityStatus } from "../types/admin.types";
import { formatMoney } from "../utils/adminFormat";

type DialogState = { type: "create" } | { type: "status"; item: AdminPricingRule } | null;

const statusOptions: Array<{ label: string; value: EntityStatus }> = [
  { label: entityStatusLabel.ACTIVE, value: "ACTIVE" },
  { label: entityStatusLabel.INACTIVE, value: "INACTIVE" }
];

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
      addToast({ message: "Pricing rule đã được cập nhật.", title: "Thành công", type: "success" });
      setDialog(null);
      setReloadKey((value) => value + 1);
    } catch (actionError) {
      addToast({ message: getErrorMessage(actionError), title: "Không thể lưu", type: "error" });
    }
  }

  const columns: Array<AdminColumn<AdminPricingRule>> = [
    { header: "Time", key: "time", render: (rule) => `${rule.startTime} - ${rule.endTime}` },
    { header: "Day", key: "day", render: (rule) => rule.applicableDay ?? "Tất cả" },
    { header: "Price", key: "price", render: (rule) => formatMoney(rule.priceAmount) },
    { header: "Status", key: "status", render: (rule) => <Badge tone={rule.status === "ACTIVE" ? "success" : "neutral"}>{getStatusLabel(entityStatusLabel, rule.status)}</Badge> },
    { header: "Thao tác", key: "actions", render: (rule) => <Button size="sm" onClick={() => setDialog({ type: "status", item: rule })}>Status</Button> }
  ];

  return (
    <div className="admin-page">
      <AdminNavigation />
      <AdminPageHeader title="Pricing rules" description="Quản lý bảng giá theo sân và khung giờ." actions={<Button disabled={!selectedCourtId} onClick={() => setDialog({ type: "create" })}>Tạo giá</Button>} />
      <div className="admin-filter-bar">
        <select value={selectedCourtId} onChange={(event) => setSelectedCourtId(event.target.value)}>
          {courts.map((court) => <option key={court.id} value={court.id}>{court.courtName}</option>)}
        </select>
      </div>
      {isLoading ? <LoadingState message="Đang tải bảng giá..." /> : null}
      {error && !isLoading ? <ErrorState actionLabel="Tải lại" message={error} title="Không tải được bảng giá" onAction={() => setReloadKey((value) => value + 1)} /> : null}
      {!isLoading && !error ? <AdminDataTable columns={columns} getRowKey={(rule) => rule.id} rows={pricingRules} /> : null}
      {dialog?.type === "create" ? (
        <AdminTextFormDialog
          fields={[
            { key: "startTime", label: "Start time", required: true, type: "time" },
            { key: "endTime", label: "End time", required: true, type: "time" },
            { key: "applicableDay", label: "Applicable day 1-7", type: "number" },
            { key: "priceAmount", label: "Price amount", required: true, type: "number" }
          ]}
          title="Tạo pricing rule"
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
          title="Cập nhật trạng thái pricing rule"
          onClose={() => setDialog(null)}
          onConfirm={(status) => runAction(() => updatePricingRuleStatus(dialog.item.id, status))}
        />
      ) : null}
    </div>
  );
}

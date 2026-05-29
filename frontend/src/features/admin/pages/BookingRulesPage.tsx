import { useEffect, useState } from "react";

import { Button } from "../../../components/common/Button";
import { Card } from "../../../components/common/Card";
import { ErrorState } from "../../../components/common/ErrorState";
import { LoadingState } from "../../../components/common/LoadingState";
import { useToastStore } from "../../../stores/toast.store";
import { getErrorMessage } from "../../../utils/format-error";
import { AdminNavigation } from "../components/AdminNavigation";
import { AdminPageHeader } from "../components/AdminPageHeader";
import { getBookingRules, updateBookingRules } from "../services/adminService";
import type { AdminBookingRules } from "../types/admin.types";

const numericFields: Array<{ key: keyof AdminBookingRules; label: string; min: number }> = [
  { key: "maxBookingsPerDay", label: "Max bookings per day", min: 1 },
  { key: "maxDurationMinutes", label: "Max duration minutes", min: 1 },
  { key: "holdMinutes", label: "Hold minutes", min: 1 },
  { key: "cancelBeforeHours", label: "Cancel before hours", min: 0 },
  { key: "lateCheckinMinutes", label: "Late check-in minutes", min: 0 },
  { key: "violationThreshold", label: "Violation threshold", min: 0 },
  { key: "bookingBanDays", label: "Booking ban days", min: 0 },
  { key: "refundRateUserOnTime", label: "User on-time refund rate", min: 0 },
  { key: "refundRateManagerFault", label: "Manager fault refund rate", min: 0 }
];

export function BookingRulesPage() {
  const { addToast } = useToastStore();
  const [error, setError] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    async function loadRules() {
      setIsLoading(true);
      setError(null);
      try {
        const rules = await getBookingRules();
        if (isMounted && rules) {
          setFormValues(Object.fromEntries(numericFields.map((field) => [field.key, String(rules[field.key] ?? "")])));
        }
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
  }, [reloadKey]);

  async function handleSubmit() {
    const invalidField = numericFields.find((field) => Number(formValues[field.key] ?? "") < field.min || Number.isNaN(Number(formValues[field.key] ?? "")));
    if (invalidField) {
      addToast({ message: `${invalidField.label} không hợp lệ.`, title: "Dữ liệu chưa hợp lệ", type: "error" });
      return;
    }

    setIsSaving(true);
    try {
      await updateBookingRules(Object.fromEntries(numericFields.map((field) => [field.key, Number(formValues[field.key])])));
      addToast({ message: "Booking rules đã được cập nhật.", title: "Thành công", type: "success" });
      setReloadKey((value) => value + 1);
    } catch (saveError) {
      addToast({ message: getErrorMessage(saveError), title: "Không thể lưu rules", type: "error" });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="admin-page">
      <AdminNavigation />
      <AdminPageHeader title="Booking rules" description="Cấu hình giới hạn đặt sân, giữ chỗ, hủy, check-in muộn, refund và vi phạm." actions={<Button onClick={() => setReloadKey((value) => value + 1)}>Tải lại</Button>} />
      {isLoading ? <LoadingState message="Đang tải booking rules..." /> : null}
      {error && !isLoading ? <ErrorState actionLabel="Tải lại" message={error} title="Không tải được booking rules" onAction={() => setReloadKey((value) => value + 1)} /> : null}
      {!isLoading && !error ? (
        <Card as="section" className="admin-form-card">
          <div className="admin-form-grid">
            {numericFields.map((field) => (
              <label className="form-field" key={field.key}>
                <span>{field.label}</span>
                <input
                  min={field.min}
                  type="number"
                  value={formValues[field.key] ?? ""}
                  onChange={(event) => setFormValues((current) => ({ ...current, [field.key]: event.target.value }))}
                />
              </label>
            ))}
          </div>
          <Button disabled={isSaving} onClick={handleSubmit}>
            {isSaving ? "Đang lưu..." : "Lưu booking rules"}
          </Button>
        </Card>
      ) : null}
    </div>
  );
}

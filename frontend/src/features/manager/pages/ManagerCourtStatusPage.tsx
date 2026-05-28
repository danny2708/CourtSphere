import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "../../../components/common/Button";
import { EmptyState } from "../../../components/common/EmptyState";
import { ErrorState } from "../../../components/common/ErrorState";
import { LoadingState } from "../../../components/common/LoadingState";
import { useToastStore } from "../../../stores/toast.store";
import { getErrorMessage } from "../../../utils/format-error";
import { CourtStatusUpdateDialog } from "../components/CourtStatusUpdateDialog";
import { ManagerCourtStatusCard } from "../components/ManagerCourtStatusCard";
import { ManagerNavigation } from "../components/ManagerNavigation";
import { listManagerCourts, updateCourtStatus } from "../services/managerService";
import type { ManagerCourtStatus, ManagerCourtViewModel } from "../types/manager.types";

export function ManagerCourtStatusPage() {
  const { addToast } = useToastStore();
  const [courts, setCourts] = useState<ManagerCourtViewModel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCourt, setSelectedCourt] = useState<ManagerCourtViewModel | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadCourts() {
      setIsLoading(true);
      setError(null);

      try {
        const loadedCourts = await listManagerCourts();
        if (isMounted) {
          setCourts(loadedCourts);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(getErrorMessage(loadError));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadCourts();

    return () => {
      isMounted = false;
    };
  }, [reloadKey]);

  async function handleUpdateStatus(status: ManagerCourtStatus, reason: string) {
    if (!selectedCourt) {
      return;
    }

    setIsSubmitting(true);
    try {
      await updateCourtStatus({ courtId: selectedCourt.id, reason, status });
      addToast({
        message: "Trạng thái sân đã được cập nhật.",
        title: "Cập nhật thành công",
        type: "success"
      });
      setSelectedCourt(null);
      setReloadKey((value) => value + 1);
    } catch (updateError) {
      addToast({
        message: getErrorMessage(updateError),
        title: "Không thể cập nhật sân",
        type: "error"
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="manager-page">
      <ManagerNavigation />
      <section className="listing-header manager-header">
        <div>
          <p className="eyebrow">Field Manager</p>
          <h1>Trạng thái sân</h1>
          <p>Cập nhật trạng thái vận hành sân khi bảo trì, tạm đóng hoặc hoạt động lại.</p>
        </div>
        <Button variant="secondary" onClick={() => setReloadKey((value) => value + 1)}>
          <RefreshCw aria-hidden="true" size={16} />
          Tải lại
        </Button>
      </section>

      {isLoading ? <LoadingState message="Đang tải danh sách sân..." /> : null}
      {error && !isLoading ? (
        <ErrorState
          actionLabel="Tải lại"
          message={error}
          title="Không tải được sân"
          onAction={() => setReloadKey((value) => value + 1)}
        />
      ) : null}
      {!isLoading && !error && courts.length === 0 ? <EmptyState title="Chưa có sân" message="Không có sân nào để cập nhật trạng thái." /> : null}

      {!isLoading && !error && courts.length > 0 ? (
        <div className="manager-court-grid">
          {courts.map((court) => (
            <ManagerCourtStatusCard court={court} key={court.id} onUpdateStatus={setSelectedCourt} />
          ))}
        </div>
      ) : null}

      {selectedCourt ? (
        <CourtStatusUpdateDialog
          court={selectedCourt}
          isSubmitting={isSubmitting}
          onClose={() => setSelectedCourt(null)}
          onSubmit={handleUpdateStatus}
        />
      ) : null}
    </div>
  );
}

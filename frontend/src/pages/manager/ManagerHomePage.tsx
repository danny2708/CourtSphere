import { ClipboardCheck, ShieldAlert } from "lucide-react";

import { useAuthStore } from "../../stores/auth.store";

export function ManagerHomePage() {
  const user = useAuthStore((state) => state.user);

  return (
    <section className="page-stack">
      <div className="page-hero">
        <p className="eyebrow">Field Manager</p>
        <h1>Vận hành sân</h1>
        <p>
          {user?.fullName ?? "Quản lý"} có thể vào khu vực manager. Các thao tác check-in/no-show thật sẽ được triển khai ở module manager operations.
        </p>
      </div>

      <div className="feature-list">
        <article>
          <ClipboardCheck aria-hidden="true" size={24} />
          <div>
            <h2>Check-in ở cấp booking item</h2>
            <p>Người dùng không tự check-in; manager hoặc admin xác nhận khi người đặt đến sân.</p>
          </div>
        </article>
        <article>
          <ShieldAlert aria-hidden="true" size={24} />
          <div>
            <h2>Xử lý ngoại lệ</h2>
            <p>Quá giờ check-in và no-show được xử lý theo trạng thái backend, không tạo hoàn tiền cho no-show.</p>
          </div>
        </article>
      </div>
    </section>
  );
}

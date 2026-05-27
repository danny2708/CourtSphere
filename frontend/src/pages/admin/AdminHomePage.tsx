import { BarChart3, Settings, UsersRound } from "lucide-react";

export function AdminHomePage() {
  return (
    <section className="page-stack">
      <div className="page-hero">
        <p className="eyebrow">Admin</p>
        <h1>Quản trị hệ thống</h1>
        <p>Nền route ADMIN đã sẵn sàng cho dashboard, quản lý người dùng, cấu hình sân và báo cáo.</p>
      </div>

      <div className="feature-list">
        <article>
          <UsersRound aria-hidden="true" size={24} />
          <div>
            <h2>Người dùng và RBAC</h2>
            <p>User có thể có nhiều role qua roles array; route admin chỉ cho role ADMIN.</p>
          </div>
        </article>
        <article>
          <Settings aria-hidden="true" size={24} />
          <div>
            <h2>Cấu hình nghiệp vụ</h2>
            <p>Booking rules, priority policies, operating hours và pricing sẽ dùng API contract backend.</p>
          </div>
        </article>
        <article>
          <BarChart3 aria-hidden="true" size={24} />
          <div>
            <h2>Báo cáo</h2>
            <p>Các màn hình reports sẽ được tích hợp bằng API admin reports ở module sau.</p>
          </div>
        </article>
      </div>
    </section>
  );
}

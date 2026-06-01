import { BarChart3, Settings, UsersRound } from "lucide-react";

export function AdminHomePage() {
  return (
    <section className="page-stack">
      <div className="page-hero">
        <p className="eyebrow">Quản trị</p>
        <h1>Quản trị hệ thống</h1>
        <p>Nền tảng quản trị đã sẵn sàng cho tổng quan, quản lý người dùng, cấu hình sân và báo cáo.</p>
      </div>

      <div className="feature-list">
        <article>
          <UsersRound aria-hidden="true" size={24} />
          <div>
            <h2>Người dùng và phân quyền</h2>
            <p>Người dùng có thể có nhiều vai trò; khu vực quản trị chỉ dành cho quản trị viên.</p>
          </div>
        </article>
        <article>
          <Settings aria-hidden="true" size={24} />
          <div>
            <h2>Cấu hình nghiệp vụ</h2>
            <p>Quy tắc đặt sân, chính sách ưu tiên, giờ mở sân và bảng giá dùng dữ liệu từ API quản trị.</p>
          </div>
        </article>
        <article>
          <BarChart3 aria-hidden="true" size={24} />
          <div>
            <h2>Báo cáo</h2>
            <p>Các màn hình báo cáo tổng hợp dữ liệu đặt sân, doanh thu, vận hành và vi phạm.</p>
          </div>
        </article>
      </div>
    </section>
  );
}

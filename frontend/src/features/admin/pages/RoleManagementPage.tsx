import { Card } from "../../../components/common/Card";
import { AdminNavigation } from "../components/AdminNavigation";
import { AdminPageHeader } from "../components/AdminPageHeader";

const roles = [
  {
    description: "Người đặt sân, xem sân, tạo booking hold, thanh toán và xem đơn cá nhân.",
    name: "USER"
  },
  {
    description: "Ban quản lý sân, check-in, xử lý no-show, override ngoại lệ và cập nhật trạng thái sân.",
    name: "FIELD_MANAGER"
  },
  {
    description: "Quản trị hệ thống, quản lý người dùng, cấu hình, thanh toán, refund, vi phạm và báo cáo.",
    name: "ADMIN"
  }
];

export function RoleManagementPage() {
  return (
    <div className="admin-page">
      <AdminNavigation />
      <AdminPageHeader
        title="Role management"
        description="Backend hiện chưa có endpoint list roles riêng; role được gán/gỡ trực tiếp trong User management."
      />
      <div className="admin-card-grid">
        {roles.map((role) => (
          <Card as="article" className="admin-info-card" key={role.name}>
            <h2>{role.name}</h2>
            <p>{role.description}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

import { Card } from "../../../components/common/Card";
import { AdminNavigation } from "../components/AdminNavigation";
import { AdminPageHeader } from "../components/AdminPageHeader";

const roles = [
  {
    description: "Người đặt sân, xem sân, tạo giữ chỗ, thanh toán và xem đơn cá nhân.",
    name: "Người dùng"
  },
  {
    description: "Ban quản lý sân, check-in, xử lý vắng mặt, xử lý ngoại lệ và cập nhật trạng thái sân.",
    name: "Quản lý sân"
  },
  {
    description: "Quản trị hệ thống, quản lý người dùng, cấu hình, thanh toán, hoàn tiền, vi phạm và báo cáo.",
    name: "Quản trị viên"
  }
];

export function RoleManagementPage() {
  return (
    <div className="admin-page">
      <AdminNavigation />
      <AdminPageHeader
        title="Vai trò"
        description="Hệ thống hiện gán và gỡ vai trò trực tiếp trong trang quản lý người dùng."
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

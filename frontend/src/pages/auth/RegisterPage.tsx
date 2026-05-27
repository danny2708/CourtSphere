import { Link } from "react-router-dom";

import { ROUTE_PATHS } from "../../routes/route-paths";

export function RegisterPage() {
  return (
    <section className="auth-page">
      <div className="auth-panel">
        <p className="eyebrow">CourtSphere</p>
        <h1>Đăng ký</h1>
        <p>
          Tài khoản mới sẽ nhận role mặc định USER và priority group theo contract backend. Form đăng ký đầy đủ sẽ được triển khai trong module auth pages.
        </p>
        <div className="auth-actions">
          <Link className="primary-button" to={ROUTE_PATHS.login}>
            Đăng nhập
          </Link>
          <Link className="text-button" to={ROUTE_PATHS.home}>
            Về trang chủ
          </Link>
        </div>
      </div>
    </section>
  );
}

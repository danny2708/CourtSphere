import { Link, useLocation } from "react-router-dom";

import { ROUTE_PATHS } from "../../routes/route-paths";

export function LoginPage() {
  const location = useLocation();
  const redirectTo = new URLSearchParams(location.search).get("redirectTo");

  return (
    <section className="auth-page">
      <div className="auth-panel">
        <p className="eyebrow">CourtSphere</p>
        <h1>Đăng nhập</h1>
        <p>
          Phiên đăng nhập dùng JWT Bearer token từ backend. Form đăng nhập đầy đủ sẽ được triển khai trong module auth pages.
        </p>
        {redirectTo ? <p className="hint-text">Sau khi đăng nhập, hệ thống sẽ quay lại trang bạn vừa mở.</p> : null}
        <div className="auth-actions">
          <Link className="primary-button" to={ROUTE_PATHS.register}>
            Tạo tài khoản
          </Link>
          <Link className="text-button" to={ROUTE_PATHS.home}>
            Về trang chủ
          </Link>
        </div>
      </div>
    </section>
  );
}

import { Link } from "react-router-dom";

import { ROUTE_PATHS } from "../../routes/route-paths";

export function ForbiddenState() {
  return (
    <section className="state-panel state-panel--error">
      <h1>Không đủ quyền truy cập</h1>
      <p>Bạn không có quyền truy cập chức năng này.</p>
      <Link className="primary-button" to={ROUTE_PATHS.home}>
        Về trang chủ
      </Link>
    </section>
  );
}

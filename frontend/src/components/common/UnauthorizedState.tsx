import { Link } from "react-router-dom";

import { ROUTE_PATHS } from "../../routes/route-paths";

export function UnauthorizedState() {
  return (
    <section className="state-panel state-panel--error">
      <h1>Phiên đăng nhập đã hết hạn</h1>
      <p>Vui lòng đăng nhập lại để tiếp tục.</p>
      <Link className="primary-button" to={ROUTE_PATHS.login}>
        Đăng nhập
      </Link>
    </section>
  );
}

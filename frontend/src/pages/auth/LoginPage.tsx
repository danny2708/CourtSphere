import { type FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import { Button } from "../../components/common/Button";
import { LoadingState } from "../../components/common/LoadingState";
import { getDefaultRouteForUser } from "../../features/auth/utils/roleRedirect";
import { loginFormSchema, type FormErrors, type LoginFormValues, toFormErrors } from "../../features/auth/schemas/authSchemas";
import { ROUTE_PATHS } from "../../routes/route-paths";
import { useAuthStore } from "../../stores/auth.store";
import { useToastStore } from "../../stores/toast.store";
import { getErrorMessage } from "../../utils/format-error";

const initialFormValues: LoginFormValues = {
  email: "",
  password: ""
};

export function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { addToast } = useToastStore();
  const { accessToken, error, isAuthenticated, isLoading, loadCurrentUser, login, user } = useAuthStore();
  const [formErrors, setFormErrors] = useState<FormErrors<LoginFormValues>>({});
  const [formValues, setFormValues] = useState<LoginFormValues>(initialFormValues);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (accessToken && !user && !isLoading && !error) {
      void loadCurrentUser();
    }
  }, [accessToken, error, isLoading, loadCurrentUser, user]);

  if (isAuthenticated && user) {
    return <Navigate to={getDefaultRouteForUser(user)} replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);

    const parsedValues = loginFormSchema.safeParse(formValues);

    if (!parsedValues.success) {
      setFormErrors(toFormErrors(parsedValues.error));
      return;
    }

    setFormErrors({});

    try {
      const authenticatedUser = await login({
        email: parsedValues.data.email,
        password: parsedValues.data.password
      });

      addToast({ type: "success", title: "Đăng nhập thành công" });
      navigate(getDefaultRouteForUser(authenticatedUser), { replace: true });
    } catch (submitErrorValue) {
      setSubmitError(getErrorMessage(submitErrorValue));
    }
  };

  if (accessToken && !user && isLoading) {
    return <LoadingState message="Đang kiểm tra phiên đăng nhập..." />;
  }

  return (
    <section className="auth-page">
      <div className="auth-panel auth-panel--form">
        <div className="auth-panel__header">
          <p className="eyebrow">CourtSphere</p>
          <h1>Đăng nhập</h1>
          <p>Đăng nhập để đặt sân, xem lịch của bạn và truy cập khu vực quản lý theo role.</p>
        </div>

        {location.state ? <p className="hint-text">Vui lòng đăng nhập để tiếp tục.</p> : null}
        {submitError ? <p className="form-alert" role="alert">{submitError}</p> : null}

        <form className="auth-form" noValidate onSubmit={handleSubmit}>
          <label className="form-field">
            <span>Email</span>
            <div className="input-shell">
              <Mail aria-hidden="true" size={18} />
              <input
                autoComplete="email"
                inputMode="email"
                type="email"
                value={formValues.email}
                onChange={(event) => setFormValues((values) => ({ ...values, email: event.target.value }))}
              />
            </div>
            {formErrors.email ? <small>{formErrors.email}</small> : null}
          </label>

          <label className="form-field">
            <span>Mật khẩu</span>
            <div className="input-shell">
              <LockKeyhole aria-hidden="true" size={18} />
              <input
                autoComplete="current-password"
                type={showPassword ? "text" : "password"}
                value={formValues.password}
                onChange={(event) => setFormValues((values) => ({ ...values, password: event.target.value }))}
              />
              <button type="button" aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"} onClick={() => setShowPassword((value) => !value)}>
                {showPassword ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
              </button>
            </div>
            {formErrors.password ? <small>{formErrors.password}</small> : null}
          </label>

          <Button disabled={isLoading} size="lg" type="submit">
            {isLoading ? "Đang đăng nhập..." : "Đăng nhập"}
          </Button>
        </form>

        <div className="auth-switch">
          <span>Chưa có tài khoản?</span>
          <Link to={ROUTE_PATHS.register}>Tạo tài khoản</Link>
        </div>
      </div>
    </section>
  );
}

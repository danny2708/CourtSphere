import { type FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff, IdCard, LockKeyhole, Mail, Phone, UserRound } from "lucide-react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { Button } from "../../components/common/Button";
import { LoadingState } from "../../components/common/LoadingState";
import { registerFormSchema, type FormErrors, type RegisterFormValues, toFormErrors } from "../../features/auth/schemas/authSchemas";
import { getDefaultRouteForUser } from "../../features/auth/utils/roleRedirect";
import { ROUTE_PATHS } from "../../routes/route-paths";
import { useAuthStore } from "../../stores/auth.store";
import { useToastStore } from "../../stores/toast.store";
import { getErrorMessage } from "../../utils/format-error";

const initialFormValues: RegisterFormValues = {
  fullName: "",
  email: "",
  phoneNumber: "",
  password: "",
  confirmPassword: "",
  priorityGroupCode: "STUDENT",
  identityCode: ""
};

export function RegisterPage() {
  const navigate = useNavigate();
  const { addToast } = useToastStore();
  const { accessToken, error, isAuthenticated, isLoading, loadCurrentUser, register, user } = useAuthStore();
  const [formErrors, setFormErrors] = useState<FormErrors<RegisterFormValues>>({});
  const [formValues, setFormValues] = useState<RegisterFormValues>(initialFormValues);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

    const parsedValues = registerFormSchema.safeParse(formValues);

    if (!parsedValues.success) {
      setFormErrors(toFormErrors(parsedValues.error));
      return;
    }

    setFormErrors({});

    try {
      const authenticatedUser = await register({
        fullName: parsedValues.data.fullName,
        email: parsedValues.data.email,
        phoneNumber: parsedValues.data.phoneNumber,
        password: parsedValues.data.password,
        confirmPassword: parsedValues.data.confirmPassword,
        priorityGroupCode: parsedValues.data.priorityGroupCode,
        identityCode: parsedValues.data.identityCode
      });

      addToast({ type: "success", title: "Đăng ký thành công" });
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
      <div className="auth-panel auth-panel--form auth-panel--wide">
        <div className="auth-panel__header">
          <p className="eyebrow">CourtSphere</p>
          <h1>Đăng ký</h1>
          <p>Tạo tài khoản USER để tìm sân, đặt sân và theo dõi lịch sử đặt sân trong hệ thống.</p>
        </div>

        {submitError ? <p className="form-alert" role="alert">{submitError}</p> : null}

        <form className="auth-form" noValidate onSubmit={handleSubmit}>
          <div className="form-grid">
            <label className="form-field">
              <span>Họ tên</span>
              <div className="input-shell">
                <UserRound aria-hidden="true" size={18} />
                <input
                  autoComplete="name"
                  value={formValues.fullName}
                  onChange={(event) => setFormValues((values) => ({ ...values, fullName: event.target.value }))}
                />
              </div>
              {formErrors.fullName ? <small>{formErrors.fullName}</small> : null}
            </label>

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
              <span>Số điện thoại</span>
              <div className="input-shell">
                <Phone aria-hidden="true" size={18} />
                <input
                  autoComplete="tel"
                  inputMode="tel"
                  value={formValues.phoneNumber ?? ""}
                  onChange={(event) => setFormValues((values) => ({ ...values, phoneNumber: event.target.value }))}
                />
              </div>
              {formErrors.phoneNumber ? <small>{formErrors.phoneNumber}</small> : null}
            </label>

            <label className="form-field">
              <span>Nhóm người dùng</span>
              <div className="input-shell">
                <IdCard aria-hidden="true" size={18} />
                <select
                  value={formValues.priorityGroupCode}
                  onChange={(event) =>
                    setFormValues((values) => ({
                      ...values,
                      priorityGroupCode: event.target.value as RegisterFormValues["priorityGroupCode"]
                    }))
                  }
                >
                  <option value="STUDENT">Sinh viên</option>
                  <option value="STAFF">Cán bộ/Giảng viên</option>
                  <option value="EXTERNAL">Người ngoài trường</option>
                </select>
              </div>
              {formErrors.priorityGroupCode ? <small>{formErrors.priorityGroupCode}</small> : null}
            </label>

            <label className="form-field">
              <span>Mã định danh</span>
              <div className="input-shell">
                <IdCard aria-hidden="true" size={18} />
                <input
                  value={formValues.identityCode ?? ""}
                  onChange={(event) => setFormValues((values) => ({ ...values, identityCode: event.target.value }))}
                />
              </div>
              {formErrors.identityCode ? <small>{formErrors.identityCode}</small> : null}
            </label>

            <label className="form-field">
              <span>Mật khẩu</span>
              <div className="input-shell">
                <LockKeyhole aria-hidden="true" size={18} />
                <input
                  autoComplete="new-password"
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

            <label className="form-field">
              <span>Xác nhận mật khẩu</span>
              <div className="input-shell">
                <LockKeyhole aria-hidden="true" size={18} />
                <input
                  autoComplete="new-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={formValues.confirmPassword}
                  onChange={(event) => setFormValues((values) => ({ ...values, confirmPassword: event.target.value }))}
                />
                <button
                  type="button"
                  aria-label={showConfirmPassword ? "Ẩn mật khẩu xác nhận" : "Hiện mật khẩu xác nhận"}
                  onClick={() => setShowConfirmPassword((value) => !value)}
                >
                  {showConfirmPassword ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
                </button>
              </div>
              {formErrors.confirmPassword ? <small>{formErrors.confirmPassword}</small> : null}
            </label>
          </div>

          <Button disabled={isLoading} size="lg" type="submit">
            {isLoading ? "Đang tạo tài khoản..." : "Tạo tài khoản"}
          </Button>
        </form>

        <div className="auth-switch">
          <span>Đã có tài khoản?</span>
          <Link to={ROUTE_PATHS.login}>Đăng nhập</Link>
        </div>
      </div>
    </section>
  );
}

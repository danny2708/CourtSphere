import { BrowserRouter, Route, Routes } from "react-router-dom";

import { AppLayout } from "./components/layout/AppLayout";
import { ForbiddenState } from "./components/common/ForbiddenState";
import { CourtDetailPage } from "./features/courts/pages/CourtDetailPage";
import { CourtListPage } from "./features/courts/pages/CourtListPage";
import { BookingCreatePage } from "./features/bookings/pages/BookingCreatePage";
import { BookingDetailPage } from "./features/bookings/pages/BookingDetailPage";
import { MyBookingsPage } from "./features/bookings/pages/MyBookingsPage";
import { PaymentPage } from "./features/bookings/pages/PaymentPage";
import { NotFoundPage } from "./pages/misc/NotFoundPage";
import { PlaceholderPage } from "./pages/misc/PlaceholderPage";
import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";
import { HomePage } from "./pages/user/HomePage";
import { AdminDashboardPage } from "./features/admin/pages/AdminDashboardPage";
import { BookingRulesPage } from "./features/admin/pages/BookingRulesPage";
import { CourtManagementPage } from "./features/admin/pages/CourtManagementPage";
import { CourtTypeManagementPage } from "./features/admin/pages/CourtTypeManagementPage";
import { OperatingHoursPage } from "./features/admin/pages/OperatingHoursPage";
import { PaymentManagementPage } from "./features/admin/pages/PaymentManagementPage";
import { PricingRulesPage } from "./features/admin/pages/PricingRulesPage";
import { PriorityGroupManagementPage } from "./features/admin/pages/PriorityGroupManagementPage";
import { PriorityPoliciesPage } from "./features/admin/pages/PriorityPoliciesPage";
import { RefundManagementPage } from "./features/admin/pages/RefundManagementPage";
import { ReportsPage } from "./features/admin/pages/ReportsPage";
import { RoleManagementPage } from "./features/admin/pages/RoleManagementPage";
import { UserManagementPage } from "./features/admin/pages/UserManagementPage";
import { ViolationManagementPage } from "./features/admin/pages/ViolationManagementPage";
import { ManagerCheckinPage } from "./features/manager/pages/ManagerCheckinPage";
import { ManagerCourtStatusPage } from "./features/manager/pages/ManagerCourtStatusPage";
import { ManagerDashboardPage } from "./features/manager/pages/ManagerDashboardPage";
import { ManagerInUsePage } from "./features/manager/pages/ManagerInUsePage";
import { ManagerNoShowPage } from "./features/manager/pages/ManagerNoShowPage";
import { ManagerTodaySchedulePage } from "./features/manager/pages/ManagerTodaySchedulePage";
import { ManagerUsageHistoryPage } from "./features/manager/pages/ManagerUsageHistoryPage";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { RoleRoute } from "./routes/RoleRoute";
import { ROUTE_PATHS } from "./routes/route-paths";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path={ROUTE_PATHS.login} element={<LoginPage />} />
          <Route path={ROUTE_PATHS.register} element={<RegisterPage />} />
          <Route path={ROUTE_PATHS.forbidden} element={<ForbiddenState />} />
          <Route index element={<HomePage />} />
          <Route path={ROUTE_PATHS.courts} element={<CourtListPage />} />
          <Route path={ROUTE_PATHS.courtDetail} element={<CourtDetailPage />} />
          <Route path={ROUTE_PATHS.map} element={<PlaceholderPage title="Bản đồ sân" message="Map view sẽ được triển khai sau khi có dữ liệu vị trí thật." />} />
          <Route path={ROUTE_PATHS.featured} element={<PlaceholderPage title="Sân nổi bật" message="Danh sách sân nổi bật sẽ được kết nối ở module court browsing nâng cao." />} />
          <Route path={ROUTE_PATHS.account} element={<PlaceholderPage title="Tài khoản" message="Trang tài khoản sẽ được triển khai trong module auth/user profile." />} />

          <Route element={<ProtectedRoute />}>
            <Route path={ROUTE_PATHS.userHome} element={<HomePage />} />
            <Route path={ROUTE_PATHS.bookingCreate} element={<BookingCreatePage />} />
            <Route path={ROUTE_PATHS.myBookings} element={<MyBookingsPage />} />
            <Route path={ROUTE_PATHS.bookingDetail} element={<BookingDetailPage />} />
            <Route path={ROUTE_PATHS.bookingPayment} element={<PaymentPage />} />

            <Route element={<RoleRoute roles={["FIELD_MANAGER", "ADMIN"]} />}>
              <Route path={ROUTE_PATHS.managerHome} element={<ManagerDashboardPage />} />
              <Route path={ROUTE_PATHS.managerToday} element={<ManagerTodaySchedulePage />} />
              <Route path={ROUTE_PATHS.managerCheckIn} element={<ManagerCheckinPage />} />
              <Route path={ROUTE_PATHS.managerInUse} element={<ManagerInUsePage />} />
              <Route path={ROUTE_PATHS.managerNoShow} element={<ManagerNoShowPage />} />
              <Route path={ROUTE_PATHS.managerCourts} element={<ManagerCourtStatusPage />} />
              <Route path={ROUTE_PATHS.managerHistory} element={<ManagerUsageHistoryPage />} />
            </Route>

            <Route element={<RoleRoute roles="ADMIN" />}>
              <Route path={ROUTE_PATHS.adminHome} element={<AdminDashboardPage />} />
              <Route path={ROUTE_PATHS.adminDashboard} element={<AdminDashboardPage />} />
              <Route path={ROUTE_PATHS.adminUsers} element={<UserManagementPage />} />
              <Route path={ROUTE_PATHS.adminRoles} element={<RoleManagementPage />} />
              <Route path={ROUTE_PATHS.adminPriorityGroups} element={<PriorityGroupManagementPage />} />
              <Route path={ROUTE_PATHS.adminCourtTypes} element={<CourtTypeManagementPage />} />
              <Route path={ROUTE_PATHS.adminCourts} element={<CourtManagementPage />} />
              <Route path={ROUTE_PATHS.adminOperatingHours} element={<OperatingHoursPage />} />
              <Route path={ROUTE_PATHS.adminPricingRules} element={<PricingRulesPage />} />
              <Route path={ROUTE_PATHS.adminBookingRules} element={<BookingRulesPage />} />
              <Route path={ROUTE_PATHS.adminPriorityPolicies} element={<PriorityPoliciesPage />} />
              <Route path={ROUTE_PATHS.adminPayments} element={<PaymentManagementPage />} />
              <Route path={ROUTE_PATHS.adminRefunds} element={<RefundManagementPage />} />
              <Route path={ROUTE_PATHS.adminViolations} element={<ViolationManagementPage />} />
              <Route path={ROUTE_PATHS.adminReports} element={<ReportsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

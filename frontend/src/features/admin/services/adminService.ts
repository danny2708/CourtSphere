import { apiRequest } from "../../../api/client";
import type {
  AccountStatus,
  AdminBookingRules,
  AdminCourt,
  AdminCourtType,
  AdminOperatingHour,
  AdminOverviewReport,
  AdminPayment,
  AdminPricingRule,
  AdminPriorityGroup,
  AdminPriorityPolicy,
  AdminRefund,
  AdminReportBundle,
  AdminRoleName,
  AdminUser,
  AdminViolation,
  BookingPermissionStatus,
  CourtStatus,
  EntityStatus,
  RefundStatus
} from "../types/admin.types";

type RecordValue = string | number | boolean | null | undefined;

function toQueryString(query: Record<string, RecordValue>): string {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });

  return params.toString() ? `?${params.toString()}` : "";
}

function pickArray<T>(response: Record<string, unknown>, keys: string[]): T[] {
  for (const key of keys) {
    const value = response[key];
    if (Array.isArray(value)) {
      return value as T[];
    }
  }

  return [];
}

function pickObject<T>(response: Record<string, unknown>, keys: string[]): T | null {
  for (const key of keys) {
    const value = response[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as T;
    }
  }

  return null;
}

async function getRecord(path: string): Promise<Record<string, unknown>> {
  return apiRequest<Record<string, unknown>>(path, { auth: true, method: "GET" });
}

export async function listAdminUsers(query: Record<string, RecordValue> = {}): Promise<AdminUser[]> {
  const response = await getRecord(`/api/admin/users${toQueryString(query)}`);
  return pickArray<AdminUser>(response, ["users"]);
}

export function updateAdminUser(userId: string, payload: Partial<Pick<AdminUser, "email" | "fullName" | "identityCode" | "phoneNumber">>) {
  return apiRequest(`/api/admin/users/${userId}`, { auth: true, body: payload, method: "PUT" });
}

export function assignUserRole(userId: string, roleName: AdminRoleName) {
  return apiRequest(`/api/admin/users/${userId}/roles`, { auth: true, body: { roleName }, method: "POST" });
}

export function removeUserRole(userId: string, roleName: AdminRoleName) {
  return apiRequest(`/api/admin/users/${userId}/roles/${roleName}`, { auth: true, method: "DELETE" });
}

export function updateUserAccountStatus(userId: string, accountStatus: AccountStatus, reason: string) {
  return apiRequest(`/api/admin/users/${userId}/account-status`, {
    auth: true,
    body: { accountStatus, reason },
    method: "PATCH"
  });
}

export function updateUserBookingPermission(userId: string, bookingPermissionStatus: BookingPermissionStatus, reason: string) {
  return apiRequest(`/api/admin/users/${userId}/booking-permission`, {
    auth: true,
    body: { bookingPermissionStatus, reason },
    method: "PATCH"
  });
}

export function updateUserPriorityGroup(userId: string, priorityGroupId: string, reason: string) {
  return apiRequest(`/api/admin/users/${userId}/priority-group`, {
    auth: true,
    body: { priorityGroupId, reason },
    method: "PATCH"
  });
}

export async function getAdminOverview(): Promise<AdminOverviewReport> {
  const response = await getRecord("/api/admin/reports/overview");
  return pickObject<AdminOverviewReport>(response, ["overview"]) ?? {};
}

export async function getAdminReportsBundle(): Promise<AdminReportBundle> {
  const [overview, bookings, revenue, courtUsage, rates, violations] = await Promise.all([
    getRecord("/api/admin/reports/overview"),
    getRecord("/api/admin/reports/bookings"),
    getRecord("/api/admin/reports/revenue"),
    getRecord("/api/admin/reports/courts/usage"),
    getRecord("/api/admin/reports/rates"),
    getRecord("/api/admin/reports/violations")
  ]);

  return {
    overview: pickObject<AdminOverviewReport>(overview, ["overview"]) ?? undefined,
    bookings: bookings.report,
    revenue: revenue.report,
    courtUsage: courtUsage.report,
    rates: rates.report,
    violations: violations.report
  };
}

export async function listPriorityGroups(): Promise<AdminPriorityGroup[]> {
  const response = await getRecord("/api/admin/priority-groups");
  return pickArray<AdminPriorityGroup>(response, ["priorityGroups"]);
}

export function updatePriorityGroup(id: string, payload: Partial<AdminPriorityGroup>) {
  return apiRequest(`/api/admin/priority-groups/${id}`, { auth: true, body: payload, method: "PUT" });
}

export async function listPriorityPolicies(): Promise<AdminPriorityPolicy[]> {
  const response = await getRecord("/api/admin/priority-policies");
  return pickArray<AdminPriorityPolicy>(response, ["priorityPolicies"]);
}

export function updatePriorityPolicy(id: string, payload: Partial<AdminPriorityPolicy>) {
  return apiRequest(`/api/admin/priority-policies/${id}`, { auth: true, body: payload, method: "PUT" });
}

export async function listCourtTypes(): Promise<AdminCourtType[]> {
  const response = await getRecord("/api/court-types");
  return pickArray<AdminCourtType>(response, ["courtTypes"]);
}

export function createCourtType(payload: Pick<AdminCourtType, "description" | "typeName">) {
  return apiRequest("/api/admin/court-types", { auth: true, body: payload, method: "POST" });
}

export function updateCourtType(id: string, payload: Partial<Pick<AdminCourtType, "description" | "typeName">>) {
  return apiRequest(`/api/admin/court-types/${id}`, { auth: true, body: payload, method: "PUT" });
}

export function updateCourtTypeStatus(id: string, status: EntityStatus) {
  return apiRequest(`/api/admin/court-types/${id}/status`, { auth: true, body: { status }, method: "PATCH" });
}

export async function listAdminCourts(query: Record<string, RecordValue> = {}): Promise<AdminCourt[]> {
  const response = await getRecord(`/api/courts${toQueryString(query)}`);
  return pickArray<AdminCourt>(response, ["courts"]);
}

export function createCourt(payload: { courtName: string; courtTypeId: string; description?: string; imageUrl?: string }) {
  return apiRequest("/api/admin/courts", { auth: true, body: payload, method: "POST" });
}

export function updateCourt(id: string, payload: Partial<{ courtName: string; courtTypeId: string; description: string; imageUrl: string }>) {
  return apiRequest(`/api/admin/courts/${id}`, { auth: true, body: payload, method: "PUT" });
}

export function updateCourtStatus(id: string, status: CourtStatus, reason: string) {
  return apiRequest(`/api/admin/courts/${id}/status`, { auth: true, body: { reason, status }, method: "PATCH" });
}

export async function listOperatingHours(courtId: string): Promise<AdminOperatingHour[]> {
  const response = await getRecord(`/api/admin/courts/${courtId}/operating-hours`);
  return pickArray<AdminOperatingHour>(response, ["operatingHours"]);
}

export function createOperatingHour(courtId: string, payload: Omit<AdminOperatingHour, "id" | "status">) {
  return apiRequest(`/api/admin/courts/${courtId}/operating-hours`, { auth: true, body: payload, method: "POST" });
}

export function updateOperatingHour(id: string, payload: Partial<Omit<AdminOperatingHour, "id">>) {
  return apiRequest(`/api/admin/operating-hours/${id}`, { auth: true, body: payload, method: "PUT" });
}

export function updateOperatingHourStatus(id: string, status: EntityStatus) {
  return apiRequest(`/api/admin/operating-hours/${id}/status`, { auth: true, body: { status }, method: "PATCH" });
}

export async function listPricingRules(courtId: string): Promise<AdminPricingRule[]> {
  const response = await getRecord(`/api/admin/courts/${courtId}/pricing-rules`);
  return pickArray<AdminPricingRule>(response, ["pricingRules"]);
}

export function createPricingRule(courtId: string, payload: Omit<AdminPricingRule, "id" | "status">) {
  return apiRequest(`/api/admin/courts/${courtId}/pricing-rules`, { auth: true, body: payload, method: "POST" });
}

export function updatePricingRule(id: string, payload: Partial<Omit<AdminPricingRule, "id">>) {
  return apiRequest(`/api/admin/pricing-rules/${id}`, { auth: true, body: payload, method: "PUT" });
}

export function updatePricingRuleStatus(id: string, status: EntityStatus) {
  return apiRequest(`/api/admin/pricing-rules/${id}/status`, { auth: true, body: { status }, method: "PATCH" });
}

export async function getBookingRules(): Promise<AdminBookingRules | null> {
  const response = await getRecord("/api/admin/booking-rules");
  return pickObject<AdminBookingRules>(response, ["bookingRules"]);
}

export function updateBookingRules(payload: Partial<AdminBookingRules>) {
  return apiRequest("/api/admin/booking-rules", { auth: true, body: payload, method: "PUT" });
}

export async function listPayments(query: Record<string, RecordValue> = {}): Promise<AdminPayment[]> {
  const response = await getRecord(`/api/admin/payments${toQueryString(query)}`);
  return pickArray<AdminPayment>(response, ["payments"]);
}

export async function listRefunds(query: Record<string, RecordValue> = {}): Promise<AdminRefund[]> {
  const response = await getRecord(`/api/admin/refunds${toQueryString(query)}`);
  return pickArray<AdminRefund>(response, ["refunds"]);
}

export function retryRefund(id: string, mockResult: Extract<RefundStatus, "SUCCESS" | "FAILED" | "MANUAL_REVIEW">, reason: string) {
  return apiRequest(`/api/admin/refunds/${id}/retry`, { auth: true, body: { mockResult, reason }, method: "POST" });
}

export async function listViolations(query: Record<string, RecordValue> = {}): Promise<AdminViolation[]> {
  const response = await getRecord(`/api/admin/violations${toQueryString(query)}`);
  return pickArray<AdminViolation>(response, ["violations"]);
}

export function waiveViolation(id: string, reason: string) {
  return apiRequest(`/api/admin/violations/${id}/waive`, { auth: true, body: { reason }, method: "POST" });
}

export function adjustViolationPoints(id: string, penaltyPoints: number, reason: string) {
  return apiRequest(`/api/admin/violations/${id}/adjust-points`, {
    auth: true,
    body: { penaltyPoints, reason },
    method: "POST"
  });
}

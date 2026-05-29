import { apiRequest } from "./client";
import type {
  AuthApiResponse,
  AuthApiUser,
  AuthResponse,
  AuthUser,
  LoginRequest,
  RefreshRequest,
  RegisterRequest
} from "../types/auth.types";

function mapAuthUser(user: AuthApiUser): AuthUser {
  return {
    userId: user.id,
    fullName: user.fullName,
    email: user.email,
    phoneNumber: user.phoneNumber,
    identityCode: user.identityCode,
    accountStatus: user.accountStatus,
    bookingPermissionStatus: user.bookingPermissionStatus,
    roles: user.roles,
    priorityGroup: user.priorityGroup
  };
}

function mapAuthResponse(response: AuthApiResponse): AuthResponse {
  return {
    accessToken: response.accessToken,
    tokenType: response.tokenType,
    user: mapAuthUser(response.user)
  };
}

export async function getCurrentUser(): Promise<AuthUser> {
  const response = await apiRequest<{ user: AuthApiUser }>("/api/auth/me", {
    method: "GET",
    auth: true
  });

  return mapAuthUser(response.user);
}

export async function login(payload: LoginRequest): Promise<AuthResponse> {
  const response = await apiRequest<AuthApiResponse>("/api/auth/login", {
    method: "POST",
    body: payload
  });

  return mapAuthResponse(response);
}

export async function register(payload: RegisterRequest): Promise<AuthResponse> {
  const response = await apiRequest<AuthApiResponse>("/api/auth/register", {
    method: "POST",
    body: payload
  });

  return mapAuthResponse(response);
}

export async function refresh(payload: RefreshRequest = {}): Promise<AuthResponse> {
  const response = await apiRequest<AuthApiResponse>("/api/auth/refresh", {
    method: "POST",
    body: payload
  });

  return mapAuthResponse(response);
}

export async function logoutRequest(): Promise<void> {
  await apiRequest<{ success: boolean; message: string }>("/api/auth/logout", {
    method: "POST",
    auth: true,
    skipAuthRedirect: true
  });
}

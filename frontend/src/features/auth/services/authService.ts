import {
  getCurrentUser as getCurrentUserRequest,
  login as loginRequest,
  logoutRequest,
  register as registerRequest
} from "../../../api/auth.api";
import type { AuthResponse, AuthUser, LoginRequest, RegisterRequest } from "../../../types/auth.types";

export type AuthService = {
  getCurrentUser: () => Promise<AuthUser>;
  login: (payload: LoginRequest) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  register: (payload: RegisterRequest) => Promise<AuthResponse>;
};

export const authService: AuthService = {
  getCurrentUser: getCurrentUserRequest,
  login: loginRequest,
  logout: logoutRequest,
  register: registerRequest
};

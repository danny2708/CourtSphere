import { create } from "zustand";

import { configureApiClient } from "../api/client";
import { authService } from "../features/auth/services/authService";
import { ROUTE_PATHS, PUBLIC_ROUTE_PATHS } from "../routes/route-paths";
import { ApiClientError } from "../types/api.types";
import type { AuthState, AuthUser, LoginRequest, RegisterRequest, RoleName } from "../types/auth.types";
import { getErrorMessage } from "../utils/format-error";

const ACCESS_TOKEN_STORAGE_KEY = "courtsphere.accessToken";

function readStoredToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
}

function writeStoredToken(token: string | null): void {
  if (typeof window === "undefined") {
    return;
  }

  if (token) {
    window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
    return;
  }

  window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
}

function normalizeRoles(roles: RoleName | RoleName[]): RoleName[] {
  return Array.isArray(roles) ? roles : [roles];
}

function isPublicPath(pathname: string): boolean {
  return PUBLIC_ROUTE_PATHS.some((path) => path === pathname);
}

type InternalAuthState = AuthState & {
  error: string | null;
  clearAuth: () => void;
};

export const useAuthStore = create<InternalAuthState>((set, get) => ({
  user: null,
  accessToken: readStoredToken(),
  isAuthenticated: Boolean(readStoredToken()),
  isLoading: false,
  error: null,

  login: async (payload: LoginRequest) => {
    set({ isLoading: true, error: null });

    try {
      const response = await authService.login(payload);

      writeStoredToken(response.accessToken);
      set({
        accessToken: response.accessToken,
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        error: null
      });

      return response.user;
    } catch (error) {
      set({
        isLoading: false,
        error: getErrorMessage(error)
      });
      throw error;
    }
  },

  register: async (payload: RegisterRequest) => {
    set({ isLoading: true, error: null });

    try {
      const response = await authService.register(payload);

      writeStoredToken(response.accessToken);
      set({
        accessToken: response.accessToken,
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        error: null
      });

      return response.user;
    } catch (error) {
      set({
        isLoading: false,
        error: getErrorMessage(error)
      });
      throw error;
    }
  },

  setToken: (token: string | null) => {
    writeStoredToken(token);
    set({
      accessToken: token,
      isAuthenticated: Boolean(token),
      error: null
    });
  },

  setUser: (user: AuthUser | null) => {
    set({
      user,
      isAuthenticated: Boolean(user && get().accessToken),
      error: null
    });
  },

  clearAuth: () => {
    writeStoredToken(null);
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null
    });
  },

  loadCurrentUser: async () => {
    const accessToken = get().accessToken;

    if (!accessToken) {
      get().clearAuth();
      return;
    }

    if (get().isLoading) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const user = await authService.getCurrentUser();
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null
      });
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        get().clearAuth();
        return;
      }

      set({
        isLoading: false,
        error: getErrorMessage(error)
      });
    }
  },

  logout: async () => {
    try {
      if (get().accessToken) {
        await authService.logout();
      }
    } catch {
      // Local auth state must be cleared even when the stateless backend logout request fails.
    } finally {
      get().clearAuth();
    }
  },

  hasRole: (roles: RoleName | RoleName[]) => {
    const requiredRoles = normalizeRoles(roles);
    const currentRoles = get().user?.roles ?? [];

    return requiredRoles.some((role) => currentRoles.includes(role));
  }
}));

configureApiClient({
  getAccessToken: () => useAuthStore.getState().accessToken,
  onUnauthorized: () => {
    useAuthStore.getState().clearAuth();

    if (typeof window === "undefined" || isPublicPath(window.location.pathname)) {
      return;
    }

    const redirectTo = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
    window.location.assign(`${ROUTE_PATHS.login}?redirectTo=${redirectTo}`);
  }
});

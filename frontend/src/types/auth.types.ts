export type RoleName = "USER" | "FIELD_MANAGER" | "ADMIN" | (string & {});

export type AccountStatus = "ACTIVE" | "LOCKED" | "DISABLED" | (string & {});

export type BookingPermissionStatus = "ALLOWED" | "RESTRICTED" | (string & {});

export type PriorityGroup = {
  id: string;
  code: string;
  name: string;
  priorityLevel: number;
  advanceBookingDays: number;
};

export type AuthApiUser = {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  identityCode: string | null;
  accountStatus: AccountStatus;
  bookingPermissionStatus: BookingPermissionStatus;
  roles: RoleName[];
  priorityGroup: PriorityGroup | null;
};

export type AuthUser = {
  userId: string;
  fullName: string;
  email: string;
  roles: RoleName[];
  accountStatus?: AccountStatus;
  bookingPermissionStatus?: BookingPermissionStatus;
  phoneNumber?: string | null;
  identityCode?: string | null;
  priorityGroup?: PriorityGroup | null;
};

export type AuthApiResponse = {
  accessToken: string;
  tokenType: "Bearer";
  user: AuthApiUser;
};

export type AuthResponse = {
  accessToken: string;
  tokenType: "Bearer";
  user: AuthUser;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = {
  fullName: string;
  email: string;
  phoneNumber?: string;
  password: string;
  confirmPassword: string;
  priorityGroupCode: "STAFF" | "STUDENT" | "EXTERNAL";
  identityCode?: string;
};

export type RefreshRequest = {
  refreshToken?: string;
};

export type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginRequest) => Promise<AuthUser>;
  register: (payload: RegisterRequest) => Promise<AuthUser>;
  setToken: (token: string | null) => void;
  setUser: (user: AuthUser | null) => void;
  loadCurrentUser: () => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (roles: RoleName | RoleName[]) => boolean;
};

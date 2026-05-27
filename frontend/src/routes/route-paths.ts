export const ROUTE_PATHS = {
  home: "/",
  login: "/login",
  register: "/register",
  userHome: "/user",
  managerHome: "/manager",
  adminHome: "/admin",
  map: "/map",
  featured: "/featured",
  account: "/account",
  forbidden: "/403"
} as const;

export const PUBLIC_ROUTE_PATHS = [ROUTE_PATHS.login, ROUTE_PATHS.register, ROUTE_PATHS.forbidden] as const;

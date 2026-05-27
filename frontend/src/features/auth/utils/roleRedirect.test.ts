import { describe, expect, it } from "vitest";

import { ROUTE_PATHS } from "../../../routes/route-paths";
import { getDefaultRouteByRole } from "./roleRedirect";

describe("getDefaultRouteByRole", () => {
  it("prioritizes admin route", () => {
    expect(getDefaultRouteByRole(["USER", "ADMIN"])).toBe(ROUTE_PATHS.adminHome);
  });

  it("routes field managers to manager home", () => {
    expect(getDefaultRouteByRole(["FIELD_MANAGER"])).toBe(ROUTE_PATHS.managerHome);
  });

  it("supports legacy manager role label", () => {
    expect(getDefaultRouteByRole(["MANAGER"])).toBe(ROUTE_PATHS.managerHome);
  });

  it("routes users to user home", () => {
    expect(getDefaultRouteByRole(["USER"])).toBe(ROUTE_PATHS.userHome);
  });

  it("falls back to home for unknown roles", () => {
    expect(getDefaultRouteByRole(["UNKNOWN"])).toBe(ROUTE_PATHS.home);
  });
});

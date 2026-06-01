import { useEffect, useState } from "react";

import { Badge } from "../../../components/common/Badge";
import { Button } from "../../../components/common/Button";
import { ErrorState } from "../../../components/common/ErrorState";
import { LoadingState } from "../../../components/common/LoadingState";
import { useToastStore } from "../../../stores/toast.store";
import {
  accountStatusLabel,
  bookingPermissionStatusLabel,
  getStatusLabel
} from "../../../utils/status-label";
import { getErrorMessage } from "../../../utils/format-error";
import { AdminDataTable, type AdminAdvancedFilter, type AdminColumn } from "../components/AdminDataTable";
import { AdminMultiSelectDialog } from "../components/AdminMultiSelectDialog";
import { AdminNavigation } from "../components/AdminNavigation";
import { AdminPageHeader } from "../components/AdminPageHeader";
import { AdminRowActions } from "../components/AdminRowActions";
import { AdminSelectDialog } from "../components/AdminSelectDialog";
import {
  assignUserRole,
  listAdminUsers,
  listPriorityGroups,
  removeUserRole,
  updateUserAccountStatus,
  updateUserBookingPermission,
  updateUserPriorityGroup
} from "../services/adminService";
import type {
  AccountStatus,
  AdminPriorityGroup,
  AdminRoleName,
  AdminUser,
  BookingPermissionStatus
} from "../types/admin.types";

type DialogState =
  | { type: "assignRole"; user: AdminUser }
  | { type: "removeRole"; user: AdminUser }
  | { type: "accountStatus"; user: AdminUser }
  | { type: "bookingPermission"; user: AdminUser }
  | { type: "priority"; user: AdminUser }
  | null;

const roleLabel: Record<AdminRoleName, string> = {
  ADMIN: "Quản trị viên",
  FIELD_MANAGER: "Quản lý sân",
  USER: "Người dùng"
};

const roleOptions: Array<{ label: string; value: AdminRoleName }> = [
  { label: roleLabel.USER, value: "USER" },
  { label: roleLabel.FIELD_MANAGER, value: "FIELD_MANAGER" },
  { label: roleLabel.ADMIN, value: "ADMIN" }
];

const accountStatusOptions: Array<{ label: string; value: AccountStatus }> = [
  { label: accountStatusLabel.ACTIVE, value: "ACTIVE" },
  { label: accountStatusLabel.LOCKED, value: "LOCKED" },
  { label: accountStatusLabel.DISABLED, value: "DISABLED" }
];

const bookingPermissionOptions: Array<{ label: string; value: BookingPermissionStatus }> = [
  { label: bookingPermissionStatusLabel.ALLOWED, value: "ALLOWED" },
  { label: bookingPermissionStatusLabel.RESTRICTED, value: "RESTRICTED" }
];

export function UserManagementPage() {
  const { addToast } = useToastStore();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [priorityGroups, setPriorityGroups] = useState<AdminPriorityGroup[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [users, setUsers] = useState<AdminUser[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setError(null);
      setIsLoading(true);
      try {
        const [loadedUsers, loadedGroups] = await Promise.all([
          listAdminUsers(),
          listPriorityGroups()
        ]);
        if (isMounted) {
          setUsers(loadedUsers);
          setPriorityGroups(loadedGroups);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(getErrorMessage(loadError));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [reloadKey]);

  async function runAction(action: () => Promise<unknown>) {
    try {
      await action();
      addToast({ message: "Dữ liệu người dùng đã được tải lại.", title: "Thao tác thành công", type: "success" });
      setDialog(null);
      setReloadKey((value) => value + 1);
    } catch (actionError) {
      addToast({ message: getErrorMessage(actionError), title: "Không thể xử lý", type: "error" });
    }
  }

  function assignSelectedRoles(user: AdminUser, roleNames: AdminRoleName[]) {
    return runAction(async () => {
      await Promise.all(roleNames.map((roleName) => assignUserRole(user.id, roleName)));
    });
  }

  const columns: Array<AdminColumn<AdminUser>> = [
    {
      header: "Người dùng",
      key: "user",
      render: (user) => (
        <div>
          <strong>{user.fullName}</strong>
          <p className="admin-muted">{user.email}</p>
        </div>
      )
    },
    {
      header: "Trạng thái",
      key: "status",
      render: (user) => (
        <div className="admin-badge-row">
          <Badge tone={user.accountStatus === "ACTIVE" ? "success" : "danger"}>
            {getStatusLabel(accountStatusLabel, user.accountStatus)}
          </Badge>
          <Badge tone={user.bookingPermissionStatus === "ALLOWED" ? "success" : "warning"}>
            {getStatusLabel(bookingPermissionStatusLabel, user.bookingPermissionStatus)}
          </Badge>
        </div>
      )
    },
    {
      header: "Vai trò",
      key: "roles",
      render: (user) => (
        <div className="admin-badge-row">
          {user.roles.map((role) => (
            <Badge key={role} tone={role === "ADMIN" ? "danger" : role === "FIELD_MANAGER" ? "primary" : "neutral"}>
              {roleLabel[role]}
            </Badge>
          ))}
        </div>
      )
    },
    {
      header: "Nhóm ưu tiên",
      key: "priority",
      render: (user) => user.priorityGroup?.name ?? user.priorityGroup?.groupName ?? user.priorityGroup?.code ?? "Chưa có"
    },
    {
      header: "Thao tác",
      key: "actions",
      render: (user) => (
        <AdminRowActions
          actions={[
            { label: "Gán vai trò", onSelect: () => setDialog({ type: "assignRole", user }), tone: "primary" },
            { label: "Gỡ vai trò", onSelect: () => setDialog({ type: "removeRole", user }) },
            { label: "Trạng thái tài khoản", onSelect: () => setDialog({ type: "accountStatus", user }) },
            { label: "Quyền đặt sân", onSelect: () => setDialog({ type: "bookingPermission", user }) },
            { label: "Nhóm ưu tiên", onSelect: () => setDialog({ type: "priority", user }) }
          ]}
        />
      )
    }
  ];
  const advancedFilters: Array<AdminAdvancedFilter<AdminUser>> = [
    {
      key: "accountStatus",
      label: "Trạng thái tài khoản",
      options: accountStatusOptions,
      getValue: (user) => user.accountStatus
    },
    {
      key: "bookingPermissionStatus",
      label: "Quyền đặt sân",
      options: bookingPermissionOptions,
      getValue: (user) => user.bookingPermissionStatus
    },
    {
      key: "role",
      label: "Vai trò",
      options: roleOptions,
      getValue: (user) => user.roles
    },
    {
      key: "priorityGroup",
      label: "Nhóm ưu tiên",
      options: priorityGroups.map((group) => ({ label: `${group.groupCode} - ${group.groupName}`, value: group.id })),
      getValue: (user) => user.priorityGroup?.id
    }
  ];

  return (
    <div className="admin-page">
      <AdminNavigation />
      <AdminPageHeader
        title="Quản lý người dùng"
        description="Quản lý tài khoản, vai trò, quyền đặt sân và nhóm ưu tiên."
        actions={<Button onClick={() => setReloadKey((value) => value + 1)}>Tải lại</Button>}
      />

      {isLoading ? <LoadingState message="Đang tải người dùng..." /> : null}
      {error && !isLoading ? <ErrorState actionLabel="Tải lại" message={error} title="Không tải được người dùng" onAction={() => setReloadKey((value) => value + 1)} /> : null}
      {!isLoading && !error ? <AdminDataTable advancedFilters={advancedFilters} columns={columns} getRowKey={(user) => user.id} rows={users} /> : null}

      {dialog?.type === "assignRole" ? (
        <AdminMultiSelectDialog
          emptyMessage="Người dùng này đã có toàn bộ vai trò."
          label="Vai trò cần gán"
          options={roleOptions.filter((option) => !dialog.user.roles.includes(option.value))}
          title={`Gán vai trò cho ${dialog.user.fullName}`}
          onClose={() => setDialog(null)}
          onConfirm={(roleNames) => assignSelectedRoles(dialog.user, roleNames)}
        />
      ) : null}
      {dialog?.type === "removeRole" ? (
        <AdminSelectDialog
          label="Vai trò cần gỡ"
          options={dialog.user.roles.map((role) => ({ label: roleLabel[role], value: role }))}
          title={`Gỡ vai trò của ${dialog.user.fullName}`}
          onClose={() => setDialog(null)}
          onConfirm={(roleName) => runAction(() => removeUserRole(dialog.user.id, roleName))}
        />
      ) : null}
      {dialog?.type === "accountStatus" ? (
        <AdminSelectDialog
          defaultValue={dialog.user.accountStatus}
          label="Trạng thái tài khoản"
          options={accountStatusOptions}
          reasonRequired
          title={`Cập nhật tài khoản ${dialog.user.fullName}`}
          onClose={() => setDialog(null)}
          onConfirm={(status, reason) => runAction(() => updateUserAccountStatus(dialog.user.id, status, reason))}
        />
      ) : null}
      {dialog?.type === "bookingPermission" ? (
        <AdminSelectDialog
          defaultValue={dialog.user.bookingPermissionStatus}
          label="Quyền đặt sân"
          options={bookingPermissionOptions}
          reasonRequired
          title={`Cập nhật quyền đặt sân ${dialog.user.fullName}`}
          onClose={() => setDialog(null)}
          onConfirm={(status, reason) => runAction(() => updateUserBookingPermission(dialog.user.id, status, reason))}
        />
      ) : null}
      {dialog?.type === "priority" ? (
        <AdminSelectDialog
          label="Nhóm ưu tiên"
          options={priorityGroups.map((group) => ({ label: `${group.groupCode} - ${group.groupName}`, value: group.id }))}
          reasonRequired
          title={`Cập nhật nhóm ưu tiên ${dialog.user.fullName}`}
          onClose={() => setDialog(null)}
          onConfirm={(priorityGroupId, reason) => runAction(() => updateUserPriorityGroup(dialog.user.id, priorityGroupId, reason))}
        />
      ) : null}
    </div>
  );
}

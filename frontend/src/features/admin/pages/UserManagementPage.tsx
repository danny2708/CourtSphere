import { useEffect, useMemo, useState } from "react";

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
import { AdminDataTable, type AdminColumn } from "../components/AdminDataTable";
import { AdminMultiSelectDialog } from "../components/AdminMultiSelectDialog";
import { AdminNavigation } from "../components/AdminNavigation";
import { AdminPageHeader } from "../components/AdminPageHeader";
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

const roleOptions: Array<{ label: string; value: AdminRoleName }> = [
  { label: "USER", value: "USER" },
  { label: "FIELD_MANAGER", value: "FIELD_MANAGER" },
  { label: "ADMIN", value: "ADMIN" }
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
  const [keyword, setKeyword] = useState("");
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

  const filteredUsers = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    if (!normalizedKeyword) {
      return users;
    }

    return users.filter((user) =>
      [user.fullName, user.email, user.phoneNumber, user.identityCode, user.roles.join(" ")]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedKeyword))
    );
  }, [keyword, users]);

  async function runAction(action: () => Promise<unknown>) {
    try {
      await action();
      addToast({ message: "Dữ liệu user đã được tải lại.", title: "Thao tác thành công", type: "success" });
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
      header: "User",
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
      header: "Roles",
      key: "roles",
      render: (user) => (
        <div className="admin-badge-row">
          {user.roles.map((role) => (
            <Badge key={role} tone={role === "ADMIN" ? "danger" : role === "FIELD_MANAGER" ? "primary" : "neutral"}>
              {role}
            </Badge>
          ))}
        </div>
      )
    },
    {
      header: "Priority",
      key: "priority",
      render: (user) => user.priorityGroup?.name ?? user.priorityGroup?.groupName ?? user.priorityGroup?.code ?? "Chưa có"
    },
    {
      header: "Thao tác",
      key: "actions",
      render: (user) => (
        <div className="admin-action-row">
          <Button size="sm" variant="secondary" onClick={() => setDialog({ type: "assignRole", user })}>
            Gán role
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDialog({ type: "removeRole", user })}>
            Gỡ role
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDialog({ type: "accountStatus", user })}>
            Account
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDialog({ type: "bookingPermission", user })}>
            Booking
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDialog({ type: "priority", user })}>
            Priority
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="admin-page">
      <AdminNavigation />
      <AdminPageHeader
        title="User management"
        description="Quản lý tài khoản, role, quyền đặt sân và priority group."
        actions={<Button onClick={() => setReloadKey((value) => value + 1)}>Tải lại</Button>}
      />

      <div className="admin-filter-bar">
        <input placeholder="Tìm theo tên, email, role..." value={keyword} onChange={(event) => setKeyword(event.target.value)} />
      </div>

      {isLoading ? <LoadingState message="Đang tải users..." /> : null}
      {error && !isLoading ? <ErrorState actionLabel="Tải lại" message={error} title="Không tải được users" onAction={() => setReloadKey((value) => value + 1)} /> : null}
      {!isLoading && !error ? <AdminDataTable columns={columns} getRowKey={(user) => user.id} rows={filteredUsers} /> : null}

      {dialog?.type === "assignRole" ? (
        <AdminMultiSelectDialog
          emptyMessage="User này đã có toàn bộ role."
          label="Role cần gán"
          options={roleOptions.filter((option) => !dialog.user.roles.includes(option.value))}
          title={`Gán role cho ${dialog.user.fullName}`}
          onClose={() => setDialog(null)}
          onConfirm={(roleNames) => assignSelectedRoles(dialog.user, roleNames)}
        />
      ) : null}
      {dialog?.type === "removeRole" ? (
        <AdminSelectDialog
          label="Role cần gỡ"
          options={dialog.user.roles.map((role) => ({ label: role, value: role }))}
          title={`Gỡ role của ${dialog.user.fullName}`}
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
          title={`Cập nhật account ${dialog.user.fullName}`}
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
          label="Priority group"
          options={priorityGroups.map((group) => ({ label: `${group.groupCode} - ${group.groupName}`, value: group.id }))}
          reasonRequired
          title={`Cập nhật priority ${dialog.user.fullName}`}
          onClose={() => setDialog(null)}
          onConfirm={(priorityGroupId, reason) => runAction(() => updateUserPriorityGroup(dialog.user.id, priorityGroupId, reason))}
        />
      ) : null}
    </div>
  );
}

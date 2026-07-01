// Shared authentication types
export interface User {
  id: string;
  username: string;
  role: string;
  isMasterAdmin: boolean;
  isAdmin: boolean;
  userType: "global" | "branch_specific" | "customer";
  avatar?: string;
  employeeName?: string;
  branchName?: string;
  employee_id?: string;
  branch_id?: string;
  lastLogin?: string;
  permissions?: UserPermissions;
  customerId?: string; // For customer users
}

export interface UserPermissions {
  [functionCode: string]: {
    can_view: boolean;
    can_add: boolean;
    can_edit: boolean;
    can_delete: boolean;
    can_export: boolean;
  };
}

export interface AuthSession {
  token: string;
  user: User;
  loginMethod: "username" | "quickAccess" | "customerAccess";
  loginTime: string;
  expiresAt: string;
}

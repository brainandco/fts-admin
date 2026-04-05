export type UserStatus = "PENDING_ACCESS" | "ACTIVE" | "DISABLED";
export type TaskStatus =
  | "Draft"
  | "Assigned_to_PM"
  | "Assigned_to_User"
  | "In_Progress"
  | "Blocked"
  | "Completed"
  | "Verified"
  | "Closed";
export type ApprovalStatus =
  | "Submitted"
  | "PM_Approved"
  | "PM_Rejected"
  | "Admin_Approved"
  | "Admin_Rejected"
  | "Completed";
export type ApprovalType =
  | "leave_request"
  | "asset_request"
  | "vehicle_request"
  | "asset_return"
  | "maintenance_request";
export type AssetStatus =
  | "Available"
  | "Assigned"
  | "Under_Maintenance"
  | "Damaged"
  | "Pending_Return"
  | "With_QC";
export type ProjectType = "MS" | "Rollout" | "Huawei Minor";

export interface Region {
  id: string;
  name: string;
  code: string | null;
  created_at: string;
  updated_at: string;
}

export interface UsersProfile {
  id: string;
  email: string;
  full_name: string | null;
  /** Public Supabase Storage URL for profile image. */
  avatar_url?: string | null;
  status: UserStatus;
  is_super_user: boolean;
  created_at: string;
  updated_at: string;
  /** Set when Super User invites; cleared after acceptance. Legacy users have null. */
  invitation_token?: string | null;
  invitation_sent_at?: string | null;
  invitation_expires_at?: string | null;
  invitation_accepted_at?: string | null;
}

/** Not used (PM is employee role only; region/project on employee). Kept for type compatibility. */
export type UsersProfileWithRegion = UsersProfile & { region_id?: string | null };

export interface Role {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Permission {
  id: string;
  code: string;
  name: string | null;
  module: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  project_type: ProjectType;
  pm_user_id: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  project_id: string;
  name: string;
  max_size: number | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  region_id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: number;
  due_date: string | null;
  assigned_to_pm_id: string | null;
  assigned_to_user_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

export interface Approval {
  id: string;
  approval_type: ApprovalType;
  status: ApprovalStatus;
  requester_id: string;
  region_id: string | null;
  asset_id: string | null;
  vehicle_id: string | null;
  payload_json: Record<string, unknown> | null;
  pm_acted_at: string | null;
  pm_acted_by: string | null;
  pm_comment: string | null;
  admin_acted_at: string | null;
  admin_acted_by: string | null;
  admin_comment: string | null;
  admin_final_approver_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Asset {
  id: string;
  asset_id: string | null;
  category: string;
  name: string;
  serial: string | null;
  purchase_date: string | null;
  warranty_end: string | null;
  condition: string | null;
  status: AssetStatus;
  assigned_to_user_id: string | null;
  assigned_to_employee_id: string | null;
  assigned_region_id: string | null;
  assigned_project_id: string | null;
  assigned_by: string | null;
  assigned_at: string | null;
  specs: Record<string, unknown> | null;
  /** Public URLs for intake condition photos (min 2 for new/edited assets via UI). */
  purchase_image_urls?: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface AssetAssignmentHistoryRow {
  id: string;
  asset_id: string;
  to_employee_id: string;
  assigned_by_user_id: string | null;
  assigned_at: string;
  notes: string | null;
}

export interface Vehicle {
  id: string;
  plate_number: string;
  registration_number: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  vin: string | null;
  mileage: number;
  fuel_type: string | null;
  insurance_expiry: string | null;
  license_expiry: string | null;
  status: AssetStatus;
  assigned_to_user_id: string | null;
  assigned_region_id: string | null;
  assigned_by: string | null;
  assigned_at: string | null;
  next_service_due_date: string | null;
  next_service_due_mileage: number | null;
  /** Public URLs for intake condition photos (min 2 for new/edited vehicles via UI). */
  purchase_image_urls?: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actor_user_id: string | null;
  actor_email: string | null;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  old_value_json: Record<string, unknown> | null;
  new_value_json: Record<string, unknown> | null;
  description: string | null;
  ip_address: string | null;
  user_agent: string | null;
  meta: Record<string, unknown> | null;
}

export interface RegionPmAssignment {
  id: string;
  region_id: string;
  user_id: string;
  assigned_at: string;
  assigned_by: string | null;
  ended_at: string | null;
  is_current: boolean;
}

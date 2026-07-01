export interface Task {
  id: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  status: "pending" | "in_progress" | "completed" | "cancelled";
  due_date: string; // YYYY-MM-DD format
  due_time: string; // HH:MM:SS format
  created_at: string;
  updated_at: string;
  created_by: string;
  assigned_to?: string;
  image_url?: string;

  // Additional options
  can_escalate: boolean;
  can_reassign: boolean;

  // Optional relationships
  completion?: TaskCompletion;
  creator?: {
    id: string;
    name: string;
    email: string;
  };
  assignee?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface TaskCompletion {
  id: string;
  task_id: string;
  completed_by: string;
  completed_at: string;

  // Completion status for each criteria
  task_finished: boolean;
  photo_uploaded: boolean;
  erp_reference_provided: boolean;

  // Optional completion data
  completion_photo_url?: string;
  erp_reference_number?: string;
  completion_notes?: string;

  // Optional relationships
  completed_by_user?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface TaskStats {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  overdue: number;
}

export interface TaskSearchResult {
  tasks: Task[];
  total: number;
  page: number;
  limit: number;
}

export interface TaskFilter {
  status?: string[];
  priority?: string[];
  assigned_to?: string;
  created_by?: string;
  due_date_from?: string;
  due_date_to?: string;
  search_query?: string;
  page?: number;
  limit?: number;
}

export interface TaskAssignment {
  id?: string;
  task_id: string;
  assigned_to_user_id: string;
  assigned_by: string;
  assigned_at: string;
  status: string;
  notes?: string;
  deadline_date?: string;
  deadline_time?: string;
  is_reassignable?: boolean;
  require_task_finished: boolean;
  require_photo_upload: boolean;
  require_erp_reference: boolean;
}

export interface TaskEscalation {
  id: string;
  task_id: string;
  escalated_by: string;
  escalated_to: string;
  escalated_at: string;
  reason: string;
  status: "pending" | "acknowledged" | "resolved";
  resolution_notes?: string;
  resolved_at?: string;
}

// Form interfaces for creating/updating tasks
export interface CreateTaskRequest {
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  due_date: string;
  due_time: string;
  assigned_to?: string;
  image_url?: string;
  can_escalate: boolean;
  can_reassign: boolean;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  priority?: "low" | "medium" | "high";
  status?: "pending" | "in_progress" | "completed" | "cancelled";
  due_date?: string;
  due_time?: string;
  assigned_to?: string;
  image_url?: string;
  can_escalate?: boolean;
  can_reassign?: boolean;
}

export interface CompleteTaskRequest {
  task_finished: boolean;
  photo_uploaded: boolean;
  erp_reference_provided: boolean;
  completion_photo_url?: string;
  erp_reference_number?: string;
  completion_notes?: string;
}

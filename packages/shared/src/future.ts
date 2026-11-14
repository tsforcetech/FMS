/** Future-phase architecture contracts. Operational Phase 1 models live in operations.ts. */
import type { Timestamp } from 'firebase/firestore';
import type { CompanyRole } from './index';
export interface TenantRecord {
  id: string;
  companyId: string;
  schemaVersion: 1;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
  archivedAt?: Timestamp;
}
export interface Assignment extends TenantRecord {
  taskId: string;
  uid: string;
  source: 'rule' | 'manual';
  shiftId?: string;
  replacedAssignmentId?: string;
}
export type TaskStatus =
  | 'scheduled'
  | 'pending'
  | 'assigned'
  | 'in_progress'
  | 'paused'
  | 'submitted'
  | 'awaiting_approval'
  | 'rejected'
  | 'rework'
  | 'completed'
  | 'cancelled';
// Overdue is a derived flag (dueAt < now && not terminal); never destroys workflow state.
export interface Task extends TenantRecord {
  siteId: string;
  locationId?: string;
  assetId?: string;
  templateVersionId: string;
  scheduleId?: string;
  occurrenceKey: string;
  dueAt: Timestamp;
  status: TaskStatus;
}
export interface ChecklistQuestion {
  id: string;
  label: string;
  kind: 'text' | 'yes_no' | 'number' | 'photo' | 'gps' | 'qr';
  required: boolean;
  min?: number;
  max?: number;
}
export interface TemplateVersion extends TenantRecord {
  templateId: string;
  version: number;
  title: string;
  instructions: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedMinutes: number;
  requiresApproval: boolean;
}
// Checklist questions, role/site assignments and RACI participants are bounded child documents, not unbounded arrays.
export interface Schedule extends TenantRecord {
  templateVersionId: string;
  siteId: string;
  timeZone: string;
  frequency:
    'once' | 'daily' | 'alternate_day' | 'weekly' | 'monthly' | 'custom';
  interval: number;
  localTime: string;
  startAt: Timestamp;
  endAt?: Timestamp;
  assignmentRole?: CompanyRole;
  shiftId?: string;
  nextRunAt: Timestamp;
  workingDaysOnly: boolean;
}
export interface TaskEvent extends TenantRecord {
  taskId: string;
  eventType: string;
  actorUid: string;
  occurredAt: Timestamp;
  fromStatus?: TaskStatus;
  toStatus?: TaskStatus;
}
export interface Submission extends TenantRecord {
  taskId: string;
  attempt: number;
  submittedBy: string;
  submittedAt: Timestamp;
  templateVersionId: string;
}
export interface Approval extends TenantRecord {
  taskId: string;
  submissionId: string;
  approverUid: string;
  sequence: number;
  decision: 'pending' | 'approved' | 'rejected';
  reason?: string;
  decidedAt?: Timestamp;
}
export interface WorkOrder extends TenantRecord {
  siteId: string;
  assetId?: string;
  originTaskId?: string;
  originComplaintId?: string;
  title: string;
  status: 'open' | 'assigned' | 'in_progress' | 'awaiting_approval' | 'closed';
  dueAt: Timestamp;
}
export interface Complaint extends TenantRecord {
  clientId: string;
  siteId: string;
  title: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  dueAt: Timestamp;
}
export interface Escalation extends TenantRecord {
  taskId?: string;
  workOrderId?: string;
  fromDepartmentId: string;
  toDepartmentId: string;
  reason: string;
  dueAt: Timestamp;
}
export interface Notification extends TenantRecord {
  recipientUid: string;
  eventId: string;
  type: string;
  readAt?: Timestamp;
  dispatchStatus: 'disabled' | 'pending' | 'sent' | 'failed';
}
export interface AuditEvent extends TenantRecord {
  actorUid: string;
  action: string;
  subjectPath: string;
}

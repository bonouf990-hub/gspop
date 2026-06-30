// Core domain types shared between web and mobile apps.
// Mirrors the multi-tenant Postgres schema in database/migrations.

export type UserRole =
  | "super_admin"      // GSPOP owner/operator across all tenants
  | "tenant_admin"      // Owns one client/portfolio
  | "property_manager"  // Manages one or more properties within a tenant
  | "supervisor"         // Reviews/approves technician work, quality rating
  | "technician"         // Field staff executing work orders
  | "vendor"             // External vendor/contractor user
  | "resident";          // Occupant submitting requests, confirming completion

export type WorkOrderStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "assigned"
  | "in_progress"
  | "paused"
  | "completed_by_technician"
  | "verified_by_supervisor"
  | "confirmed_by_resident"
  | "closed"
  | "cancelled";

export type WorkOrderPriority = "low" | "medium" | "high" | "emergency";

export type WorkOrderType = "preventive" | "corrective" | "inspection" | "incident";

export interface Tenant {
  id: string;
  name: string;
  createdAt: string;
}

export interface Property {
  id: string;
  tenantId: string;
  name: string;
  address: string;
}

export interface Unit {
  id: string;
  propertyId: string;
  label: string; // e.g. "GS5-1203"
  floor: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sizeSqm: number | null;
  maxOccupancy: number | null;
}

export type AssetStatus =
  | "in_service"
  | "removed"
  | "under_repair"
  | "spare_backup"
  | "redeployed"
  | "disposed";

export type AssetCondition = "new" | "refurbished" | "used" | "damaged";

export interface Asset {
  id: string;
  propertyId: string;
  unitId: string | null;
  name: string;
  category: string;
  qrCode: string | null;
  rfidTag: string | null;
  installedAt: string | null;
  expectedLifeMonths: number | null;
  status: AssetStatus;
  condition: AssetCondition;
  replacedByAssetId: string | null;
  maintenanceCycleMonths: number | null;
  nextMaintenanceDue: string | null;
  storageLocation: string | null;
}

export type AssetLifecycleEventType =
  | "installed"
  | "removed"
  | "sent_for_repair"
  | "repaired"
  | "moved_to_spare"
  | "redeployed"
  | "disposed"
  | "maintenance_completed";

export interface AssetLifecycleEvent {
  id: string;
  assetId: string;
  eventType: AssetLifecycleEventType;
  workOrderId: string | null;
  performedBy: string;
  notes: string | null;
  eventDate: string;
}

export type ComplaintStatus =
  | "submitted"
  | "acknowledged"
  | "assigned"
  | "in_progress"
  | "resolved"
  | "closed"
  | "rejected";

export interface Complaint {
  id: string;
  tenantId: string;
  propertyId: string;
  unitId: string | null;
  commonAreaId: string | null;
  assetId: string | null;
  residentId: string;
  title: string;
  description: string;
  status: ComplaintStatus;
  priority: WorkOrderPriority;
  submittedAt: string;
  slaMinutes: number;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  workOrderId: string | null;
  resolvedAt: string | null;
}

export type CommonAreaCategory =
  | "lobby" | "basement" | "parking" | "corridor" | "elevator" | "staircase"
  | "rooftop" | "pool" | "gym" | "electrical_room" | "pump_room" | "fire_system"
  | "garden" | "waste_area" | "other";

export interface CommonArea {
  id: string;
  propertyId: string;
  name: string;
  category: CommonAreaCategory;
  floor: string | null;
  notes: string | null;
}

// Read model backing the "AI recognizes this happened before" complaint view.
// Sourced from the complaint_context SQL view (asset_issue_history join).
export interface ComplaintContext {
  complaintId: string;
  title: string;
  description: string;
  status: ComplaintStatus;
  submittedAt: string;
  assetId: string | null;
  unitId: string | null;
  commonAreaId: string | null;
  unitLabel: string | null;
  residentName: string | null;
  occupantCount: number | null;
  leaseStartDate: string | null;
  leaseEndDate: string | null;
  assetName: string | null;
  correctiveWorkOrderCount: number;
  priorComplaintCountOnAsset: number;
  lastWorkOrderOnAssetAt: string | null;
  isRecurringIssue: boolean;
}

export interface ComplaintPhoto {
  id: string;
  complaintId: string;
  storagePath: string;
  uploadedAt: string;
}

export interface Lease {
  id: string;
  unitId: string;
  primaryResidentId: string | null;
  tenantFullName: string;
  startDate: string;
  endDate: string | null;
  occupantCount: number;
  status: "active" | "ended" | "terminated" | "pending";
  rentAmount: number | null;
  rentFrequency: "monthly" | "quarterly" | "yearly" | null;
  depositAmount: number | null;
  depositStatus: "held" | "partially_refunded" | "refunded" | "forfeited";
  parkingSpaceLabel: string | null;
}

export type RentInvoiceStatus = "pending" | "paid" | "overdue" | "waived";

export interface RentInvoice {
  id: string;
  leaseId: string;
  amount: number;
  dueDate: string;
  status: RentInvoiceStatus;
  paidAt: string | null;
  paymentMethod: string | null;
}

export type MoveChecklistType = "move_in" | "move_out";
export type ItemCondition = "good" | "fair" | "damaged" | "missing";

export interface MoveChecklist {
  id: string;
  leaseId: string;
  checklistType: MoveChecklistType;
  performedBy: string;
  performedAt: string;
  notes: string | null;
}

export interface MoveChecklistItem {
  id: string;
  checklistId: string;
  itemName: string;
  condition: ItemCondition;
  photoPath: string | null;
  notes: string | null;
}

export type Trade = "hvac" | "plumbing" | "carpentry" | "electrical" | "general";

export interface TradeCaseCounts {
  trade: Trade;
  openCases: number;
  pendingApproval: number;
  activeCases: number;
  totalCases: number;
}

export interface TradeTechnicianUtilization {
  trade: Trade;
  totalTechnicians: number;
  busyTechnicians: number;
  idleTechnicians: number;
  utilizationPct: number;
}

export interface TechnicianCurrentStatus {
  technicianId: string;
  fullName: string;
  trade: Trade;
  status: "busy" | "idle";
  currentWorkOrderId: string | null;
  currentWorkOrderTitle: string | null;
}

export interface ComplaintCategory {
  id: string;
  tenantId: string;
  name: string;
  defaultPriority: WorkOrderPriority;
  active: boolean;
  sortOrder: number;
}

export interface ComplaintSubissue {
  id: string;
  categoryId: string;
  name: string;
  sortOrder: number;
  active: boolean;
}

export interface UnitPhoto {
  id: string;
  unitId: string;
  storagePath: string;
  isPrimary: boolean;
  caption: string | null;
}

export interface BuildingNotice {
  id: string;
  tenantId: string;
  propertyId: string;
  title: string;
  body: string;
  postedBy: string;
  postedAt: string;
  expiresAt: string | null;
}

export interface LeaseOccupant {
  id: string;
  leaseId: string;
  fullName: string;
  relationshipToPrimary: string | null;
  isPrimary: boolean;
}

export type NotificationType =
  | "complaint_new"
  | "complaint_sla_breach"
  | "work_order_assigned"
  | "approval_pending"
  | "approval_escalated";

export interface AppNotification {
  id: string;
  recipientId: string;
  type: NotificationType;
  entityType: string;
  entityId: string;
  message: string;
  readAt: string | null;
  createdAt: string;
}

// ── Visitor management ────────────────────────────────────────────────
export type VisitorPurpose = "guest" | "delivery" | "contractor" | "vendor" | "inspection" | "other";
export type VisitorStatus = "invited" | "checked_in" | "checked_out" | "declined" | "expired";

export interface Visitor {
  id: string;
  tenantId: string;
  propertyId: string;
  unitId: string | null;
  fullName: string;
  idPhotoPath: string | null;
  purpose: VisitorPurpose;
  hostResidentId: string | null;
  hostedByApproved: boolean;
  checkedInAt: string | null;
  checkedInBy: string | null;
  checkedOutAt: string | null;
  vehiclePlate: string | null;
  expectedWindowStart: string | null;
  expectedWindowEnd: string | null;
  brandName: string | null;
  leaveWithSecurity: boolean;
  status: VisitorStatus;
  emiratesIdNumber: string | null;
}

// ── Access / key control ────────────────────────────────────────────────
export type AccessCredentialType = "physical_key" | "key_card" | "fob" | "mobile_credential" | "code";
export type AccessCredentialStatus = "issued" | "returned" | "lost" | "revoked" | "disabled";

export interface AccessCredential {
  id: string;
  tenantId: string;
  propertyId: string;
  credentialType: AccessCredentialType;
  credentialLabel: string;
  assignedTo: string | null;
  unitId: string | null;
  commonAreaId: string | null;
  status: AccessCredentialStatus;
  issuedAt: string;
  issuedBy: string;
  returnedAt: string | null;
  notes: string | null;
}

export interface AccessEvent {
  id: string;
  credentialId: string;
  eventType: "entry" | "exit" | "denied" | "door_forced";
  doorOrLocation: string;
  occurredAt: string;
}

// ── Preventive maintenance scheduling ─────────────────────────────────
export interface MaintenanceSchedule {
  id: string;
  assetId: string;
  frequencyMonths: number;
  lastGeneratedAt: string | null;
  nextDueDate: string;
  checklist: string | null;
  autoAssignTechnicianId: string | null;
  active: boolean;
}

// ── Utility metering ────────────────────────────────────────────────────
export type MeterType = "electricity" | "water" | "gas" | "chilled_water" | "other";

export interface UtilityMeter {
  id: string;
  propertyId: string;
  unitId: string | null;
  meterType: MeterType;
  meterNumber: string;
  installedAt: string | null;
}

export interface UtilityReading {
  id: string;
  meterId: string;
  readingValue: number;
  readingDate: string;
  recordedBy: string | null;
  isAnomalous: boolean;
}

// ── Compliance / document expiry ───────────────────────────────────────
export type ComplianceDocumentType =
  | "fire_safety_certificate" | "elevator_inspection" | "insurance_policy"
  | "vendor_license" | "trade_license" | "warranty" | "other";

export interface ComplianceDocument {
  id: string;
  tenantId: string;
  propertyId: string | null;
  vendorId: string | null;
  documentType: ComplianceDocumentType;
  title: string;
  storagePath: string | null;
  issuedDate: string | null;
  expiryDate: string;
  reminderDaysBefore: number;
  status: "valid" | "expiring_soon" | "expired";
}

// ── Common-area bookings ────────────────────────────────────────────────
export interface CommonAreaBooking {
  id: string;
  commonAreaId: string;
  residentId: string;
  startTime: string;
  endTime: string;
  status: "confirmed" | "cancelled" | "no_show";
}

// ── Budget / cost-center tracking ──────────────────────────────────────
export type BudgetCategory = "maintenance" | "utilities" | "purchasing" | "staffing" | "other";

export interface Budget {
  id: string;
  tenantId: string;
  propertyId: string;
  category: BudgetCategory;
  fiscalYear: number;
  fiscalMonth: number;
  budgetedAmount: number;
}

export interface BudgetActual {
  budgetId: string;
  propertyId: string;
  category: BudgetCategory;
  fiscalYear: number;
  fiscalMonth: number;
  budgetedAmount: number;
  actualAmount: number;
}

// ── Staff KPI dashboard ─────────────────────────────────────────────────
export interface KpiDefinition {
  id: string;
  tenantId: string;
  role: "technician" | "supervisor" | "property_manager" | "tenant_admin";
  metricName: string;
  targetValue: number;
  weightPct: number;
  active: boolean;
}

export interface KpiScore {
  id: string;
  userId: string;
  kpiDefinitionId: string;
  periodStart: string;
  periodEnd: string;
  actualValue: number;
  scorePct: number;
  ratedBy: string;
  ratedAt: string;
  comments: string | null;
}

// Read model backing the manager dashboard — sourced from the
// technician_job_stats / technician_hours_summary SQL views.
export interface TechnicianJobStats {
  technicianId: string;
  fullName: string;
  department: string | null;
  reportsToId: string | null;
  jobsInProgress: number;
  jobsCompleted: number;
  jobsTotal: number;
  totalSpend: number;
  avgSupervisorRating: number;
  avgResidentRating: number;
  totalHoursLogged: number;
}

export interface WorkOrder {
  id: string;
  tenantId: string;
  propertyId: string;
  unitId: string | null;
  assetId: string | null;
  type: WorkOrderType;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  title: string;
  description: string;
  createdBy: string;
  assignedTechnicianId: string | null;
  estimatedCost: number | null;
  actualCost: number | null;
  createdAt: string;
}

export interface CheckIn {
  id: string;
  workOrderId: string;
  technicianId: string;
  latitude: number;
  longitude: number;
  type: "check_in" | "check_out";
  timestamp: string;
}

export interface WorkOrderPhoto {
  id: string;
  workOrderId: string;
  stage: "before" | "after";
  url: string;
  takenAt: string;
}

export interface Approval {
  id: string;
  entityType: "work_order" | "purchase_order";
  entityId: string;
  approverId: string;
  level: number;
  decision: "pending" | "approved" | "rejected" | "escalated";
  spendLimitAtDecision: number | null;
  comment: string | null;
  decidedAt: string | null;
}

export interface AuditLogEntry {
  id: string;
  entityType: string;
  entityId: string;
  actorId: string;
  action: string;
  before: unknown;
  after: unknown;
  createdAt: string;
}

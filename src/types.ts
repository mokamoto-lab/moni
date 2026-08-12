/**
 * Data contract for the Enterprise Admin usage & governance dashboard.
 *
 * This file is the single source of truth for the shapes that every metric in
 * the dashboard consumes (approval gate §1) and the schema that a future real
 * data source would need to supply (approval gate §2). The prototype fulfils
 * this contract with synthetic mock data only — no real usage logs, message
 * content, or PII are ever loaded.
 */

/** Viewer roles that drive access control (NFR-001, approval gate §3). */
export type Role =
  | "workspace_admin" // 組織全体を閲覧可能
  | "security_admin" // IT / Security Admin: 組織全体を閲覧可能
  | "dept_manager" // 部門管理者: 自部門のみ
  | "member"; // 非管理者: 閲覧不可

/** Period filter (FR-007). */
export type PeriodKey = "7d" | "30d" | "90d";

/** A single point in a trend series. */
export interface TrendPoint {
  /** ISO date (bucket start). */
  date: string;
  value: number;
}

/** Custom Agent counts (FR-001 / FR-003). */
export interface AgentCounts {
  enabled: number;
  disabled: number;
  total: number;
}

/** Top-level usage summary (FR-001, US-001). */
export interface UsageSummary {
  activeAiUsers: number;
  targetUsers: number;
  /** Adoption = activeAiUsers / targetUsers, precomputed for a consistent definition (NFR-004). */
  adoptionRate: number;
  aiActionsInPeriod: number;
  agentRunsTotal: number;
  agentCounts: AgentCounts;
  wauTrend: TrendPoint[];
  mauTrend: TrendPoint[];
  /** Adoption in the immediately preceding comparable period, for QBR deltas (FR-006, US-003). */
  previousAdoptionRate: number;
}

/** Per-department / group usage (FR-002, US-004). */
export interface DepartmentUsage {
  id: string;
  name: string;
  activeUsers: number;
  targetUsers: number;
  adoptionRate: number;
  aiActions: number;
  /** True when the department could not be resolved from org data (Edge Case: 部門情報が未設定). */
  unassigned?: boolean;
}

/** Access scope classification for an agent (FR-004). */
export type AgentAccessScope = "workspace_wide" | "broad" | "scoped";

/** Per-agent usage and configuration (FR-003 / FR-004). */
export interface AgentUsage {
  id: string;
  name: string;
  creator: string;
  /** Department the agent primarily serves (used for dept-manager scoping). */
  departmentId: string;
  runs: number;
  users: number;
  /** ISO date of last run, or null when never used. */
  lastUsedDate: string | null;
  enabled: boolean;
  accessScope: AgentAccessScope;
  hasExternalConnections: boolean;
  usesMcp: boolean;
  /** True when this agent's run data is partially missing (Edge Case: Agentデータ欠損). */
  dataIncomplete?: boolean;
}

/** Aggregated permission & audit posture (FR-004 / FR-005). */
export interface PermissionsAudit {
  workspaceWideAgents: number;
  broadAccessAgents: number;
  externalIntegrationAgents: number;
  mcpAgents: number;
  adminCount: number;
  /** Whether any guest/external identity used AI in the period (FR-004/005, P1). */
  guestExternalAiUsage: boolean;
  guestExternalActiveUsers: number;
}

/** Severity buckets for governance signals. */
export type SignalSeverity = "info" | "attention" | "critical";

/**
 * A governance signal (FR-005). Only *defined* signals appear here; undefined /
 * tentative signals are intentionally omitted (Edge Case: シグナル定義が未確定 →
 * 仮のシグナルを表示しない).
 */
export interface GovernanceSignal {
  id: string;
  name: string;
  description: string;
  count: number;
  severity: SignalSeverity;
}

/** Freshness / completeness metadata (NFR-005). */
export interface DatasetMeta {
  /** ISO timestamp of the last successful aggregation. */
  lastAggregatedAt: string;
  /** True while an aggregation is in progress (Edge Case: 集計中). */
  aggregating: boolean;
  /** Human-readable notes about known data gaps (Edge Case: データ欠損). */
  dataGaps: string[];
}

/** The full dataset for a single (scope, period) combination. */
export interface DashboardDataset {
  meta: DatasetMeta;
  summary: UsageSummary;
  departments: DepartmentUsage[];
  agents: AgentUsage[];
  permissions: PermissionsAudit;
  governanceSignals: GovernanceSignal[];
}

import type {
  AgentAccessScope,
  DashboardDataset,
  PeriodKey,
  Role,
} from "../types";
import mock from "../mock/mockData.json";

/**
 * Scenario toggles let a reviewer exercise the empty / aggregating edge cases
 * (FR-008) without needing a separate data source.
 */
export type Scenario = "normal" | "empty" | "aggregating";

export interface RoleMeta {
  label: string;
  description: string;
  /** Department a role is scoped to, if any. */
  departmentId?: string;
}

/** The department a demo "部門管理者" is scoped to. */
const DEPT_MANAGER_DEPT = "sales";

export const ROLES: Record<Role, RoleMeta> = {
  workspace_admin: {
    label: "Workspace Admin",
    description: "組織全体の利用状況・権限・監査・ガバナンスを閲覧できます。",
  },
  security_admin: {
    label: "IT / Security Admin",
    description: "組織全体の権限・監査・ガバナンス観点を中心に閲覧できます。",
  },
  dept_manager: {
    label: "部門管理者（営業部）",
    description: "自部門（営業部）の利用状況のみを閲覧できます。",
    departmentId: DEPT_MANAGER_DEPT,
  },
  member: {
    label: "一般メンバー（非管理者）",
    description: "管理者向けデータの閲覧権限がありません。",
  },
};

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  "7d": "直近7日",
  "30d": "直近30日",
  "90d": "直近90日",
};

export type PermissionsScope = "org" | "department";

export interface ResolvedView {
  role: Role;
  scopeKind: PermissionsScope;
  scopeLabel: string;
  dataset: DashboardDataset;
  /** QBR / adoption deltas are only meaningful at org scope for this prototype. */
  showQbrDelta: boolean;
  /** Org-wide permission aggregates (admin count, guest AI) are admin-only. */
  permissionsScope: PermissionsScope;
  /** Governance signals are org-level and hidden from department managers. */
  governanceVisible: boolean;
}

function scopeToDepartment(
  dataset: DashboardDataset,
  departmentId: string,
): DashboardDataset {
  const departments = dataset.departments.filter((d) => d.id === departmentId);
  const agents = dataset.agents.filter((a) => a.departmentId === departmentId);
  const dept = departments[0];

  const countScope = (scope: AgentAccessScope) =>
    agents.filter((a) => a.accessScope === scope).length;

  return {
    meta: dataset.meta,
    summary: {
      activeAiUsers: dept ? dept.activeUsers : 0,
      targetUsers: dept ? dept.targetUsers : 0,
      adoptionRate: dept ? dept.adoptionRate : 0,
      aiActionsInPeriod: dept ? dept.aiActions : 0,
      agentRunsTotal: agents.reduce((sum, a) => sum + a.runs, 0),
      agentCounts: {
        enabled: agents.filter((a) => a.enabled).length,
        disabled: agents.filter((a) => !a.enabled).length,
        total: agents.length,
      },
      // Department-level period-over-period deltas are not modeled in the prototype.
      previousAdoptionRate: dept ? dept.adoptionRate : 0,
      wauTrend: [],
      mauTrend: [],
    },
    departments,
    agents,
    permissions: {
      workspaceWideAgents: countScope("workspace_wide"),
      broadAccessAgents: countScope("broad"),
      externalIntegrationAgents: agents.filter((a) => a.hasExternalConnections)
        .length,
      mcpAgents: agents.filter((a) => a.usesMcp).length,
      // Org-wide admin / guest posture is intentionally withheld at department scope.
      adminCount: 0,
      guestExternalAiUsage: false,
      guestExternalActiveUsers: 0,
    },
    // Governance signals are org-level; hidden from department managers.
    governanceSignals: [],
  };
}

function readNormal(period: PeriodKey): DashboardDataset {
  return mock.scenarios.normal[period] as unknown as DashboardDataset;
}

function readEmpty(): DashboardDataset {
  return mock.scenarios.empty as unknown as DashboardDataset;
}

/**
 * Resolve the dataset a given viewer should see. Access control (NFR-001) and
 * scenario / period selection (FR-007, FR-008) are all applied here so the UI
 * never has to reason about raw data it is not entitled to.
 */
export function resolveView(
  role: Role,
  period: PeriodKey,
  scenario: Scenario,
): ResolvedView | null {
  // Non-admins cannot see any admin data (Edge Case: 管理者に閲覧権限がない).
  if (role === "member") {
    return null;
  }

  let base: DashboardDataset =
    scenario === "empty" ? readEmpty() : readNormal(period);

  // The "aggregating" scenario reuses live data but flags freshness (NFR-005).
  if (scenario === "aggregating") {
    base = { ...base, meta: { ...base.meta, aggregating: true } };
  }

  const meta = ROLES[role];
  if (meta.departmentId) {
    const scoped = scopeToDepartment(base, meta.departmentId);
    return {
      role,
      scopeKind: "department",
      scopeLabel: meta.label,
      dataset: scoped,
      showQbrDelta: false,
      permissionsScope: "department",
      governanceVisible: false,
    };
  }

  return {
    role,
    scopeKind: "org",
    scopeLabel: "組織全体",
    dataset: base,
    showQbrDelta: true,
    permissionsScope: "org",
    governanceVisible: true,
  };
}

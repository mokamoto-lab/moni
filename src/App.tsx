import { useMemo, useState } from "react";
import type { PeriodKey, Role } from "./types";
import {
  PERIOD_LABELS,
  ROLES,
  resolveView,
  type Scenario,
} from "./data/store";
import { formatDateTime } from "./util/format";
import {
  AgentSection,
  DepartmentSection,
  DeniedState,
  EmptyState,
  GovernanceSection,
  PermissionsSection,
  UsageSummarySection,
} from "./components/sections";

const ROLE_ORDER: Role[] = [
  "workspace_admin",
  "security_admin",
  "dept_manager",
  "member",
];
const PERIOD_ORDER: PeriodKey[] = ["7d", "30d", "90d"];
const SCENARIO_LABELS: Record<Scenario, string> = {
  normal: "通常",
  empty: "データなし",
  aggregating: "集計中",
};
const SCENARIO_ORDER: Scenario[] = ["normal", "empty", "aggregating"];

export default function App() {
  const [role, setRole] = useState<Role>("workspace_admin");
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [scenario, setScenario] = useState<Scenario>("normal");

  const view = useMemo(
    () => resolveView(role, period, scenario),
    [role, period, scenario],
  );

  const hasData = view !== null && view.dataset.summary.targetUsers > 0;

  return (
    <div className="app">
      <div className="proto-banner">
        <span>🧪</span>
        <span>
          <strong>プロトタイプ</strong>：これは承認ゲート §5 に基づく管理者ダッシュボードの試作です。
          表示データはすべて<strong>合成モックデータ</strong>で、実際の利用ログ・権限・監査・個人情報は含みません。
        </span>
      </div>

      <div className="header">
        <div>
          <h1>Enterprise Admin 利用状況・ガバナンス可視化</h1>
          <p className="subtitle">
            Notion AI / Custom Agent の利用・権限・監査・ガバナンスを一元把握（PRD: FR-001〜008）
          </p>
        </div>
      </div>

      {/* Controls: role switch (NFR-001), period filter (FR-007), edge-case scenarios (FR-008) */}
      <div className="controls">
        <div className="control-group">
          <label>閲覧ロール</label>
          <div className="segmented">
            {ROLE_ORDER.map((r) => (
              <button
                key={r}
                className={r === role ? "active" : ""}
                onClick={() => setRole(r)}
              >
                {ROLES[r].label}
              </button>
            ))}
          </div>
        </div>

        <div className="control-group">
          <label>期間</label>
          <div className="segmented">
            {PERIOD_ORDER.map((p) => (
              <button
                key={p}
                className={p === period ? "active" : ""}
                onClick={() => setPeriod(p)}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        <div className="control-group">
          <label>シナリオ（検証用）</label>
          <div className="segmented">
            {SCENARIO_ORDER.map((s) => (
              <button
                key={s}
                className={s === scenario ? "active" : ""}
                onClick={() => setScenario(s)}
              >
                {SCENARIO_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {view && <div className="scope-pill">スコープ: {view.scopeLabel}</div>}
      </div>

      <p className="role-desc">{ROLES[role].description}</p>

      {/* Access control gate */}
      {view === null ? (
        <DeniedState />
      ) : (
        <>
          {/* Freshness & data-gap indicators (NFR-005, Edge Cases) */}
          <div className="meta-row">
            {view.dataset.meta.aggregating ? (
              <span className="badge attention">● 集計中</span>
            ) : (
              <span className="badge ok">● 最新</span>
            )}
            <span>最終集計時刻: {formatDateTime(view.dataset.meta.lastAggregatedAt)}</span>
            {view.dataset.meta.aggregating && (
              <span>最新の集計を実行中です。表示値は暫定です。</span>
            )}
          </div>

          {hasData &&
            view.dataset.meta.dataGaps.map((g, i) => (
              <div className="gap-note" key={i}>
                <span>⚠️</span>
                <span>データ欠損: {g} 該当指標は実際より少なく表示される可能性があります。</span>
              </div>
            ))}

          {!hasData ? (
            <EmptyState />
          ) : (
            <>
              <UsageSummarySection
                summary={view.dataset.summary}
                showQbrDelta={view.showQbrDelta}
                scopeKind={view.scopeKind}
              />
              <DepartmentSection departments={view.dataset.departments} />
              <AgentSection agents={view.dataset.agents} />
              <PermissionsSection
                permissions={view.dataset.permissions}
                scope={view.permissionsScope}
              />
              <GovernanceSection
                signals={view.dataset.governanceSignals}
                visible={view.governanceVisible}
              />
            </>
          )}
        </>
      )}

      <div className="footer">
        プロトタイプ / モックデータ駆動 ・ 指標定義は <code>src/types.ts</code>（データ契約）に準拠 ・
        実データ接続と Security / Legal の正式承認は別途保留中です。
      </div>
    </div>
  );
}

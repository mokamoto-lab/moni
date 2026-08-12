import type {
  AgentUsage,
  DepartmentUsage,
  GovernanceSignal,
  PermissionsAudit,
  UsageSummary,
} from "../types";
import type { PermissionsScope } from "../data/store";
import {
  daysSince,
  deltaDirection,
  formatDate,
  formatDeltaPoints,
  formatInt,
  formatPercent,
} from "../util/format";
import { Sparkline } from "./Sparkline";

/* ----------------------------- Usage summary ---------------------------- */

export function UsageSummarySection(props: {
  summary: UsageSummary;
  showQbrDelta: boolean;
  scopeKind: PermissionsScope;
}) {
  const { summary, showQbrDelta } = props;
  const dir = deltaDirection(summary.adoptionRate, summary.previousAdoptionRate);

  return (
    <section className="section">
      <h2>利用サマリー</h2>
      <p className="section-sub">
        対象期間の主要な利用指標です（FR-001）。利用率 = アクティブ利用者 ÷ 対象ユーザー。
      </p>

      <div className="grid kpi">
        <div className="card kpi-card">
          <p className="kpi-label">AI 利用率（Adoption）</p>
          <div className="kpi-value">
            {formatPercent(summary.adoptionRate)}
            {showQbrDelta && (
              <span className={`delta ${dir}`}>
                {formatDeltaPoints(summary.adoptionRate, summary.previousAdoptionRate)}
              </span>
            )}
          </div>
          <p className="kpi-sub">
            {formatInt(summary.activeAiUsers)} / {formatInt(summary.targetUsers)} 人がアクティブ
            {showQbrDelta && "（前期間比）"}
          </p>
        </div>

        <div className="card kpi-card">
          <p className="kpi-label">期間内の AI アクション数</p>
          <div className="kpi-value">{formatInt(summary.aiActionsInPeriod)}</div>
          <p className="kpi-sub">Notion AI の実行回数（対象期間）</p>
        </div>

        <div className="card kpi-card">
          <p className="kpi-label">Custom Agent 数</p>
          <div className="kpi-value">{formatInt(summary.agentCounts.total)}</div>
          <p className="kpi-sub">
            有効 {formatInt(summary.agentCounts.enabled)} / 無効 {formatInt(summary.agentCounts.disabled)}
          </p>
        </div>

        <div className="card kpi-card">
          <p className="kpi-label">Agent 総実行回数</p>
          <div className="kpi-value">{formatInt(summary.agentRunsTotal)}</div>
          <p className="kpi-sub">全 Agent の実行回数合計（対象期間）</p>
        </div>
      </div>

      <div className="grid cols-2" style={{ marginTop: 14 }}>
        <div className="card">
          <p className="kpi-label">WAU トレンド</p>
          {summary.wauTrend.length >= 2 ? (
            <>
              <Sparkline points={summary.wauTrend} />
              <p className="kpi-sub">
                直近: {formatInt(summary.wauTrend[summary.wauTrend.length - 1].value)} 週次アクティブ
              </p>
            </>
          ) : (
            <p className="kpi-sub">この表示範囲ではトレンドは提供されません。</p>
          )}
        </div>
        <div className="card">
          <p className="kpi-label">MAU トレンド</p>
          {summary.mauTrend.length >= 2 ? (
            <>
              <Sparkline points={summary.mauTrend} color="#1f9d55" />
              <p className="kpi-sub">
                直近: {formatInt(summary.mauTrend[summary.mauTrend.length - 1].value)} 月次アクティブ
              </p>
            </>
          ) : (
            <p className="kpi-sub">この表示範囲ではトレンドは提供されません。</p>
          )}
        </div>
      </div>
    </section>
  );
}

/* --------------------------- Department usage --------------------------- */

function barClass(rate: number): string {
  if (rate >= 0.6) return "bar-fill high";
  if (rate < 0.3) return "bar-fill low";
  return "bar-fill";
}

export function DepartmentSection(props: { departments: DepartmentUsage[] }) {
  const departments = [...props.departments].sort(
    (a, b) => b.adoptionRate - a.adoptionRate,
  );
  const ranked = departments.filter((d) => !d.unassigned);
  const top = ranked[0];
  const bottom = ranked[ranked.length - 1];

  return (
    <section className="section">
      <h2>部門別の利用状況</h2>
      <p className="section-sub">
        部門・グループ単位の利用率比較です（FR-002）。
        {top && bottom && top.id !== bottom.id && (
          <>
            {" "}
            上位: <strong>{top.name}</strong>（{formatPercent(top.adoptionRate)}） / 未活用:{" "}
            <strong>{bottom.name}</strong>（{formatPercent(bottom.adoptionRate)}）。
          </>
        )}
      </p>

      <div className="card">
        <div className="bars">
          {departments.map((d) => (
            <div className="bar-row" key={d.id}>
              <div className="bar-label">
                {d.name}
                {d.unassigned && <span className="muted">（部門情報未設定）</span>}
                <br />
                <span className="muted">
                  {formatInt(d.activeUsers)} / {formatInt(d.targetUsers)} 人
                </span>
              </div>
              <div className="bar-track">
                <div
                  className={barClass(d.adoptionRate)}
                  style={{ width: `${Math.min(100, d.adoptionRate * 100)}%` }}
                />
              </div>
              <div className="bar-value">
                {formatPercent(d.adoptionRate)}
                <br />
                <span className="muted">{formatInt(d.aiActions)} アクション</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ Agent usage ----------------------------- */

const SCOPE_LABELS: Record<AgentUsage["accessScope"], string> = {
  workspace_wide: "全体公開",
  broad: "広範囲",
  scoped: "限定",
};

export function AgentSection(props: { agents: AgentUsage[] }) {
  const agents = [...props.agents].sort((a, b) => b.runs - a.runs);

  return (
    <section className="section">
      <h2>Agent 別の利用状況</h2>
      <p className="section-sub">
        主要 Custom Agent の実行回数・利用者・直近利用日・作成者と、公開範囲・連携の状態です（FR-003 / FR-004）。
      </p>

      <div className="card" style={{ overflowX: "auto" }}>
        <table className="data">
          <thead>
            <tr>
              <th>Agent</th>
              <th>作成者</th>
              <th className="num">実行回数</th>
              <th className="num">利用者数</th>
              <th>直近利用</th>
              <th>公開範囲</th>
              <th>連携</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((a) => {
              const idle = daysSince(a.lastUsedDate);
              return (
                <tr key={a.id}>
                  <td>
                    {a.name}
                    {!a.enabled && <span className="tag off" style={{ marginLeft: 6 }}>無効</span>}
                    {a.dataIncomplete && (
                      <span className="chip" style={{ marginLeft: 6 }} title="実行ログが一部欠損">
                        データ一部欠損
                      </span>
                    )}
                  </td>
                  <td>{a.creator}</td>
                  <td className="num">{formatInt(a.runs)}</td>
                  <td className="num">{formatInt(a.users)}</td>
                  <td>
                    {formatDate(a.lastUsedDate)}
                    {idle !== null && idle >= 30 && (
                      <span className="chip" style={{ marginLeft: 6 }}>
                        {idle}日未利用
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={`tag scope-${a.accessScope}`}>{SCOPE_LABELS[a.accessScope]}</span>
                  </td>
                  <td>
                    {a.hasExternalConnections && <span className="chip">外部連携</span>}
                    {a.usesMcp && <span className="chip">MCP</span>}
                    {!a.hasExternalConnections && !a.usesMcp && <span className="muted">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* --------------------------- Permissions / audit ------------------------ */

export function PermissionsSection(props: {
  permissions: PermissionsAudit;
  scope: PermissionsScope;
}) {
  const { permissions, scope } = props;

  return (
    <section className="section">
      <h2>権限・監査の確認ポイント</h2>
      <p className="section-sub">
        集計・設定情報のみを表示します。メッセージ内容や生の監査ログ、個人特定情報は含みません（FR-004 / NFR-002）。
      </p>

      <div className="grid cols-3">
        <div className="card kpi-card">
          <p className="kpi-label">Workspace 全体公開の Agent</p>
          <div className="kpi-value">{formatInt(permissions.workspaceWideAgents)}</div>
          <p className="kpi-sub">公開範囲の妥当性を確認</p>
        </div>
        <div className="card kpi-card">
          <p className="kpi-label">広範囲アクセスの Agent</p>
          <div className="kpi-value">{formatInt(permissions.broadAccessAgents)}</div>
          <p className="kpi-sub">アクセス範囲を確認</p>
        </div>
        <div className="card kpi-card">
          <p className="kpi-label">外部連携を持つ Agent</p>
          <div className="kpi-value">{formatInt(permissions.externalIntegrationAgents)}</div>
          <p className="kpi-sub">連携先・付与権限を確認</p>
        </div>
        <div className="card kpi-card">
          <p className="kpi-label">MCP 利用 Agent</p>
          <div className="kpi-value">{formatInt(permissions.mcpAgents)}</div>
          <p className="kpi-sub">接続先の MCP サーバーを確認</p>
        </div>

        {scope === "org" ? (
          <>
            <div className="card kpi-card">
              <p className="kpi-label">管理者権限保有者数</p>
              <div className="kpi-value">{formatInt(permissions.adminCount)}</div>
              <p className="kpi-sub">最小権限の原則を確認（P1）</p>
            </div>
            <div className="card kpi-card">
              <p className="kpi-label">Guest / External の AI 利用</p>
              <div className="kpi-value">
                {permissions.guestExternalAiUsage
                  ? `${formatInt(permissions.guestExternalActiveUsers)} 人`
                  : "なし"}
              </div>
              <p className="kpi-sub">想定内かを確認（P1）</p>
            </div>
          </>
        ) : (
          <div className="card" style={{ gridColumn: "span 2" }}>
            <p className="restricted-note">
              管理者権限保有者数や Guest / External の AI 利用など、組織全体の権限サマリーは
              Workspace / Security Admin のみ閲覧できます。
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

/* ----------------------------- Governance ------------------------------ */

export function GovernanceSection(props: {
  signals: GovernanceSignal[];
  visible: boolean;
}) {
  const { signals, visible } = props;

  return (
    <section className="section">
      <h2>ガバナンス シグナル</h2>
      <p className="section-sub">
        定義済みのシグナルのみを表示します。未定義・仮のシグナルは表示しません（FR-005 / Edge Case 準拠）。
      </p>

      <div className="card">
        {!visible ? (
          <p className="restricted-note">
            ガバナンス シグナルは組織全体の情報のため、Workspace / Security Admin のみ閲覧できます。
          </p>
        ) : signals.length === 0 ? (
          <div className="state" style={{ border: 0, padding: "18px 8px" }}>
            <div className="state-icon">✅</div>
            <h3>該当するシグナルはありません</h3>
            <p>定義済みシグナルに該当する項目はありません。未定義のシグナルは表示していません。</p>
          </div>
        ) : (
          signals.map((s) => (
            <div className="signal" key={s.id}>
              <div className={`signal-count`}>{formatInt(s.count)}</div>
              <div className="signal-body">
                <h4>
                  {s.name}{" "}
                  <span className={`badge ${s.severity === "critical" ? "critical" : s.severity === "attention" ? "attention" : "info"}`}>
                    {s.severity === "critical" ? "要対応" : s.severity === "attention" ? "要確認" : "情報"}
                  </span>
                </h4>
                <p>{s.description}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

/* ------------------------------- States -------------------------------- */

export function DeniedState() {
  return (
    <div className="state denied">
      <div className="state-icon">🔒</div>
      <h3>この画面を表示する権限がありません</h3>
      <p>
        利用状況・ガバナンス ダッシュボードは管理者向けの機能です。閲覧には Workspace Admin
        または IT / Security Admin の権限が必要です。アクセスが必要な場合は管理者に権限付与を依頼してください。
      </p>
    </div>
  );
}

export function EmptyState() {
  return (
    <div className="state">
      <div className="state-icon">📭</div>
      <h3>表示できる利用データがありません</h3>
      <p>
        選択中の期間・スコープに該当する AI / Agent の利用データが見つかりませんでした。
        次のいずれかをご確認ください。
      </p>
      <ul>
        <li>対象期間を広げる（直近30日・90日）</li>
        <li>対象ユーザー・部門が正しく設定されているか</li>
        <li>集計がまだ実行されていない可能性（下部の最終集計時刻を確認）</li>
      </ul>
    </div>
  );
}

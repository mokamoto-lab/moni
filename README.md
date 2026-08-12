# moni — Enterprise Admin 利用状況・ガバナンス可視化（プロトタイプ）

Enterprise Admin 向けに、Notion AI / Custom Agent の **利用状況・部門別活用・Agent別活用・権限・監査・ガバナンス** を一元把握するための管理者ダッシュボードの**プロトタイプ**です。

> [!IMPORTANT]
> これは承認ゲート提案 §5 に基づく試作です。表示データはすべて**合成モックデータ**で、実際の利用ログ・権限・監査記録・個人情報（PII）は一切含みません。実データ接続と Security / Legal の正式承認は**別途保留中**です。

関連ドキュメント:
- ソース PRD: Enterprise Admin向け利用状況・ガバナンス可視化（Stage: Approved / P1）
- 承認ゲート提案: Human Approval Gate（MVP指標 / データ可用性 / 表示範囲 / Security・Legal）

## できること

| 領域 | 内容 | 対応 |
| --- | --- | --- |
| 利用サマリー | AI利用率(adoption)、期間内AIアクション数、Custom Agent数、Agent総実行回数、WAU/MAUトレンド | FR-001 / US-001 |
| 部門別 | 部門・グループ別のアクティブ利用率比較、上位/未活用部門 | FR-002 / US-004 |
| Agent別 | Agent別 実行回数・利用者数・直近利用日・作成者・公開範囲・連携 | FR-003 |
| 権限・監査 | 全体公開/広範囲アクセスAgent数、外部連携・MCP利用Agent数、管理者数、Guest/External利用 | FR-004 / FR-005 |
| ガバナンス | 定義済みシグナルのみ表示（未定義シグナルは非表示） | FR-005 |
| QBR/定着 | 前期間比 adoption デルタ | FR-006 / US-003 |
| 期間フィルタ | 直近 7 / 30 / 90 日 | FR-007 |
| 空状態・例外 | データなし / 権限不足 / 部門未設定 / データ欠損 / 集計中 | FR-008 / NFR-005 / Edge Cases |
| 権限制御 | ロール別の表示スコープ（組織全体 / 自部門 / 閲覧不可） | NFR-001 |

## 使い方

```bash
npm install
npm run dev        # 開発サーバ (http://localhost:5173)
npm run build      # 型チェック + 本番ビルド (dist/)
npm run typecheck  # 型チェックのみ
npm run preview    # ビルド成果物のプレビュー (http://localhost:4173)
```

画面上部のコントロールで以下を切り替えて挙動を検証できます。

- **閲覧ロール**: Workspace Admin / IT・Security Admin / 部門管理者(営業部) / 一般メンバー
- **期間**: 直近 7 / 30 / 90 日
- **シナリオ（検証用）**: 通常 / データなし / 集計中

## 構成

```
src/
  types.ts              データ契約（全指標のスキーマ / 承認ゲート §1・§2 の基準）
  data/store.ts         スコープ解決・権限制御・期間/シナリオ選択（NFR-001 の実装箇所）
  mock/mockData.json    合成モックデータ（normal / empty シナリオ × 3期間）
  util/format.ts        数値・日付・デルタの整形
  components/
    Sparkline.tsx       依存なしの SVG スパークライン
    sections.tsx        各セクション UI と 空状態 / 権限不足状態
  App.tsx               コントロール + セクションの組み立て
  main.tsx              エントリポイント
```

## 権限制御（NFR-001）

`src/data/store.ts` の `resolveView()` に集約しています。UI は自分に権限のない生データを一切受け取りません。

- **Workspace / Security Admin** → 組織全体を閲覧。
- **部門管理者** → 自部門のみにスコープ（サマリー・Agent が自部門に限定、組織全体の権限サマリーとガバナンスシグナルは非表示）。
- **一般メンバー** → 権限不足画面のみ。

## 実データ接続について

本プロトタイプは `src/types.ts` の**データ契約**に対してモックデータを供給しています。実運用では、この契約を満たす Admin API / 分析テーブルを接続する必要があります（どのソースが各指標を供給するかは Engineering / Data 側の依存として別途確定）。集計指標のみを扱い、生ログ・メッセージ内容・個人 PII は表示しない方針です。

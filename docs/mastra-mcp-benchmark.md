---
title: Mastra v1 の 5 アプリを 7 モデル × 3 条件(MCP なし / mastra-mcp / Context7)で実装して比べた
tags:
  - Mastra
  - MCP
  - GitHubCopilot
  - Context7
  - LLM
private: false
updated_at: ''
id: null
organization_url_name: null
slide: false
ignorePublish: false
---

## はじめに

コーディングエージェントに最新の Mastra ドキュメントを渡す MCP サーバー [mastra-mcp](https://github.com/nahisaho/mastra-mcp) を作りました。Context7 のように検索できて、インストール済みの `@mastra/*` のドキュメントや公式スキルの guide も引けます。

「ドキュメント系 MCP は本当に実装の助けになるのか」を確かめるために、Mastra v1 のアプリ 5 種類を、7 モデル × 3 条件 = 21 構成で GitHub Copilot CLI に実装させ、隠しテストの合格数・AI クレジット・所要時間を比べました。

- 条件 A: MCP なし
- 条件 B: mastra-mcp(ローカル起動、`node dist/index.js`)
- 条件 C: Context7(`@upstash/context7-mcp`)

## 結論

- 5 アプリ × 21 構成 = 105 回の実行のうち、**103 回が全テスト合格**でした。
- 失敗は 1 件だけで、gpt-5.6-luna + Context7 のアプリ 5(2/4 合格)です。原因は `log` を配列として export しなかったことで、Mastra API の誤りではありません。
- 条件別の合計(7 モデル × 5 アプリ)は次のとおりで、**MCP の有無で成否にほぼ差はありません**。コストと時間の差も一貫した傾向とは言えません。

| 条件 | 合格テスト | AI クレジット合計 | 所要時間合計 |
|---|--:|--:|--:|
| MCP なし | 161/161 | 884.2 | 52:08 |
| mastra-mcp | 161/161 | 870.7 | 46:34 |
| Context7 | 159/161 | 793.7 | 53:23 |

- 今回のように型定義が読めて、課題文が詳細な場合は、現行モデルは MCP なしでも Mastra v1 を正しく書けます。MCP が効くのは、型だけでは分からない仕様(たとえば MCPServer に載せるワークフローに `description` が必須、など)と、軽量・旧世代のモデルを使う場面だと考えています。

## 検証環境と方法

- 実行: GitHub Copilot CLI(`copilot -p`、`--allow-all-tools`)。各条件・各アプリで 1 回ずつ実行。
- 依存: `@mastra/core` 1.76、`@mastra/memory`、`@mastra/libsql`、`@mastra/mcp`、`@mastra/rag`、`@mastra/evals`、`ai`、`zod`、`tsx`。LLM と API キーは使わず、モック言語モデル(`ai/test` の `MockLanguageModelV3`)で動かします。
- 公平性のための措置:
  - `node_modules/@mastra/*/dist/docs`(パッケージ同梱のドキュメント)を削除しました。
  - Web 取得ツール(`web_fetch`)を無効化し、組み込み MCP と他の MCP も無効化しました。
  - 各アプリの実装は、課題文を読んで `src/app.ts` を作る方式で、事前に私が書いた模範解答が全テストに合格することを確認してあります。
- 採点: 私が書いた隠しテスト(アプリ 1 が 6 件、アプリ 2 が 5 件、アプリ 3〜5 が各 4 件、計 23 件)を、実行後に `node --import tsx --test` で走らせて集計しました。
- 計測: AI クレジットと所要時間は、Copilot CLI が出力した値(所要時間は壁時計)です。実行は最大 14 並列で行ったため、時間は目安です。

使ったモデルは次の 7 つです。

- claude-haiku-5.5
- claude-sonnet-5.5
- gpt-5.3-codex
- gpt-5.6-terra
- gpt-5.6-luna
- gpt-5.6-sol
- gpt-6-sol

## 5 つのアプリ

### アプリ 1: サポートチケット処理(ワークフロー + Memory + MCPServer)

もっとも大きい課題です。

- ツール `classify-ticket`(件名と本文に `outage` / `down` / `urgent` / `障害` を含めば urgent)。
- ワークフロー `ticketFlow`:
  - `foreach`(同時実行数 3)で各チケットを分類し、結果をワークフロー共有 state に集める。
  - `count` → 分岐(urgent があれば `escalation` で `suspend`、なければ `routine`)。
  - `notify` は 1 回リトライし、`dismissed` のときは `bail` で早期終了。
  - 別の `buildApp()` インスタンスから `createRun({ runId })` して `resume` できること(LibSQL 永続化)。
- Memory: チケットごとにスレッド、`resource` スコープの working memory を全チケットで共有。
- `MCPServer` にツールとワークフローを公開(`description` が必須)。

使う API: `createTool`、`createStep`、`createWorkflow().foreach().branch().map()`、`suspend`/`resume`、`bail`、`stateSchema`/`setState`、`Memory`、`LibSQLStore`、`MCPServer`。

### アプリ 2: RAG 検索(`@mastra/rag` + `LibSQLVector`)

- `embed`: 単語ハッシュの決定的な 16 次元ベクトル(L2 正規化)。
- `chunkText`: `MDocument.fromText` と `chunk({ strategy: 'recursive', maxSize: 80, overlap: 10 })`。
- `buildRag(url)`: `ingest`(チャンク化 → 埋め込み → `upsert`)と `query`(`topK`、メタデータフィルタ)。同じ URL の別インスタンスから検索できること。

### アプリ 3: 計算エージェント(Agent + モックモデル + Memory)

- `addTool`(`add`)と、スクリプト化した `MockLanguageModelV3`(ツール結果があれば答える、「数 + 数」ならツール呼び出し、それ以外はユーザー発話数を返す)。
- `Agent` を `Mastra` に `calcAgent` として登録し、`generate` が 2 ステップで `5` を返すこと。
- `memory: { thread, resource }` で、同じスレッドは履歴を持ち、別スレッドは別になる。ストレージ共有の別インスタンスでも履歴が続く。

### アプリ 4: 評価(`createScorer` と `runEvals`)

- `keywordScorer`(id `keyword-coverage`)を `preprocess` / `analyze` / `generateScore` / `generateReason` の 4 ステップで作る。
- `runEvals` では出力が文字列ではなくメッセージ配列で渡されるため、両方に対応して本文を取り出す必要があります。
- モックの `echoAgent` に対して `runEvals` を実行し、平均スコアと件数を返す。

### アプリ 5: 制御フロー ETL(parallel / ネスト / dountil / sleep)

- `parallel` で `sum` と `factorial` を同時実行(n=3 で 200ms 未満)。
- ネストしたワークフロー `inner` で `(sum + factorial) * 2 + 10`。
- `dountil` で 10 の倍数になるまで `increment`(n=4 → 78 → 80、n=2 → 20 → 30)。`dountil` はまずステップを実行してから条件を判定する点がポイント。
- `sleep(10)` を挟み、不正入力は検証エラー。

## 結果

### 21 構成の比較

合格は 5 アプリ合計のテスト数、所要時間は 5 アプリ合計の壁時計です。MCP 呼び出しはその構成での回数です。

| # | モデル | 条件 | 合格 | 完全合格アプリ | AIクレジット | 所要時間(合計) | MCP呼び出し |
|--:|---|---|--:|--:|--:|--:|--:|
| 1 | claude-haiku-5.5 | MCPなし | 23/23 | 5/5 | 10.5 | 8:13 | 0 |
| 2 | claude-haiku-5.5 | mastra-mcp | 23/23 | 5/5 | 9.3 | 6:33 | 31 |
| 3 | claude-haiku-5.5 | Context7 | 23/23 | 5/5 | 7.8 | 6:49 | 12 |
| 4 | claude-sonnet-5.5 | MCPなし | 23/23 | 5/5 | 42.8 | 2:41 | 0 |
| 5 | claude-sonnet-5.5 | mastra-mcp | 23/23 | 5/5 | 43.5 | 2:49 | 7 |
| 6 | claude-sonnet-5.5 | Context7 | 23/23 | 5/5 | 53.2 | 3:47 | 11 |
| 7 | gpt-5.3-codex | MCPなし | 23/23 | 5/5 | 271.1 | 10:29 | 0 |
| 8 | gpt-5.3-codex | mastra-mcp | 23/23 | 5/5 | 259.4 | 9:10 | 64 |
| 9 | gpt-5.3-codex | Context7 | 23/23 | 5/5 | 243.4 | 12:06 | 23 |
| 10 | gpt-5.6-terra | MCPなし | 23/23 | 5/5 | 128.8 | 6:00 | 0 |
| 11 | gpt-5.6-terra | mastra-mcp | 23/23 | 5/5 | 144.9 | 6:26 | 42 |
| 12 | gpt-5.6-terra | Context7 | 23/23 | 5/5 | 110.9 | 6:54 | 24 |
| 13 | gpt-5.6-luna | MCPなし | 23/23 | 5/5 | 16.8 | 8:54 | 0 |
| 14 | gpt-5.6-luna | mastra-mcp | 23/23 | 5/5 | 14.8 | 7:31 | 38 |
| 15 | gpt-5.6-luna | Context7 | 21/23 | 4/5 | 14.3 | 8:13 | 18 |
| 16 | gpt-5.6-sol | MCPなし | 23/23 | 5/5 | 279.6 | 7:48 | 0 |
| 17 | gpt-5.6-sol | mastra-mcp | 23/23 | 5/5 | 246.9 | 6:32 | 52 |
| 18 | gpt-5.6-sol | Context7 | 23/23 | 5/5 | 234.8 | 7:06 | 16 |
| 19 | gpt-6-sol | MCPなし | 23/23 | 5/5 | 134.6 | 8:03 | 0 |
| 20 | gpt-6-sol | mastra-mcp | 23/23 | 5/5 | 151.9 | 7:33 | 74 |
| 21 | gpt-6-sol | Context7 | 23/23 | 5/5 | 129.3 | 8:28 | 21 |

### アプリごとの平均(7 モデルの平均)

| アプリ | MCPなし | mastra-mcp | Context7 |
|---|--:|--:|--:|
| 1. チケット処理 | 46.2 cr / 162s / 合格7/7 | 47.7 cr / 130s / 合格7/7 | 41.7 cr / 149s / 合格7/7 |
| 2. RAG検索 | 12.5 cr / 57s / 合格7/7 | 14.6 cr / 63s / 合格7/7 | 13.9 cr / 70s / 合格7/7 |
| 3. 計算エージェント | 25.1 cr / 79s / 合格7/7 | 24.0 cr / 73s / 合格7/7 | 22.4 cr / 80s / 合格7/7 |
| 4. 評価(scorer) | 22.9 cr / 80s / 合格7/7 | 21.1 cr / 71s / 合格7/7 | 22.4 cr / 88s / 合格7/7 |
| 5. 制御フローETL | 19.5 cr / 66s / 合格7/7 | 16.9 cr / 61s / 合格7/7 | 12.9 cr / 69s / 合格6/7 |

### 実装結果の所見

- **全アプリで同じ形に収束しました。** どのモデルも、アプリ 1 では `foreach` + `branch` + `suspend`/`resume` + `bail`、アプリ 2 では `MDocument` + `LibSQLVector`、アプリ 3 と 4 では `MockLanguageModelV3`、アプリ 5 では `parallel` + ネスト + `dountil` を使いました。API の取り違え(v0 の `RuntimeContext` や `context` 引数など)は、この課題では見られませんでした。
- **モデルによるコストの差が最大の要因でした。** 同じ課題でも、claude-haiku-5.5 は 5 アプリで 10 クレジット前後、gpt-5.3-codex と gpt-5.6-sol は 230〜280 クレジットでした。MCP の有無による差(数%〜20%)は、モデル間の差(最大 30 倍以上)よりずっと小さいです。
- **MCP の使われ方に差がありました。** mastra-mcp は 1 構成あたり 7〜74 回の呼び出しでした。Context7 は 11〜24 回でした。
- **唯一の失敗**(gpt-5.6-luna + Context7、アプリ 5)は、`log` の export 形式を課題文どおりにできなかったことが原因です。Mastra の使い方ではなく、課題文の読み違いです。

## 注意点と限界

- **サンプル数:** 各構成 1 回ずつです。モデルの確率的なばらつきは見ていないので、数%の差は誤差の範囲だと考えてください。
- **課題の難度:** 隠しテストの仕様を詳しく課題文に書いたため、型定義とエラーメッセージだけで解ける課題になっています。ドキュメントにしか載っていない挙動を問う課題や、仕様があいまいな課題では、結果が変わる可能性があります。
- **採点の限界:** 私が書いたテストで測っているのは、仕様どおりに動くかどうかだけです。コード品質や保守性は評価していません。
- **既知の課題文の曖昧さ:** 過去の比較では、課題文の `stats` の書き方が関数かオブジェクトか曖昧で、いくつかのモデルがつまずきました。今回はその点を課題文で明確にしています。
- **環境:** 実行は最大 14 並列だったため、所要時間はサーバー負荷の影響を受けます。AI クレジットは Copilot CLI が表示する値をそのまま使いました。

## まとめ

- Mastra v1 の中規模アプリ 5 種類は、7 つのモデルのいずれも、MCP なしでも実装できました。
- mastra-mcp と Context7 は、成否を大きく変えませんでした。それでも、MCP 経由でドキュメントを引いた構成のほうが、クレジットや時間で少し有利な傾向の構成が複数ありました(Context7 の合計クレジットが最小、mastra-mcp の合計時間が最短)。
- MCP の価値が出るのは、より弱いモデル、型で分からない仕様、v0 から v1 への移行のように知識が古くなりやすい領域だと考えています。この点は、別途、課題を変えて確かめる予定です。

## 再現手順

```sh
# mastra-mcp のビルド
npm ci && npm run build

# 例: MCP の設定(Copilot CLI の --additional-mcp-config に渡す JSON)
{"mcpServers":{"mastra":{"type":"stdio","command":"node","args":["<repo>/dist/index.js"],"tools":["*"]}}}
{"mcpServers":{"context7":{"type":"stdio","command":"npx","args":["-y","@upstash/context7-mcp"],"tools":["*"]}}}
```

課題文と隠しテストは、各アプリごとに「LLM を使わない」「`node --import tsx --test` で通す」ことを条件にした同形式のものを使いました。

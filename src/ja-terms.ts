// Japanese -> English search terms ("ja=en", separated by ";" or newlines). An empty English side drops the word.
// Keep keys >= 2 characters and avoid generic verbs that would dilute English full-text queries.
const RAW = `
# Mastra core concepts
マストラ=mastra; ワークフローエンジン=workflow engine; ワークフローステップ=workflow step; 入力スキーマ=input schema; 出力スキーマ=output schema
状態スキーマ=state schema; 再開スキーマ=resume schema; 中断スキーマ=suspend schema; ランタイムコンテキスト=request context; リクエストスコープ=request context
ツールコンテキスト=tool context; 実行コンテキスト=execution context; ストリームイベント=stream events; 構造化データ=structured output; オブジェクト生成=generate object
テキスト生成=generate text; 生成=; 自動生成=; ジェネレート=; ストリーム生成=stream; 生成AI=generative ai
ステップ関数=step; ステップ入力=step input; ステップ出力=step output; 前のステップ=previous step; 次のステップ=next step; 実行結果=run result
実行ID=run id; ランID=run id; 実行状態=run status; 実行履歴=run history; 実行ログ=run logs; 実行環境=runtime
ランタイム=runtime; ビルド=build; バンドル=bundle; バンドラー=bundler; 出力ディレクトリ=output directory; ソースマップ=source map
マストラインスタンス=mastra instance; マストラクラウド=mastra cloud; マストラサーバー=mastra server; マストラクライアント=mastra client; マストラCLI=mastra cli
マストラ開発=mastra dev; マストラスタジオ=mastra studio; プレイグラウンド=playground; ローカル開発=local development; ホットリロード=hot reload; ウォッチモード=watch mode
プロジェクト作成=create mastra; スキャフォールド=scaffold; 雛形=template; ボイラープレート=boilerplate; スターター=starter; サンプルプロジェクト=example project
レジストリ=registry; パッケージ=package; モノレポ=monorepo; ワークスペース設定=workspace; 依存関係=dependencies; 依存性注入=dependency injection
バージョン=version; バージョン管理=versioning; リリース=release; 変更履歴=changelog; ロードマップ=roadmap; 破壊的変更=breaking changes

# Agents and LLMs
エージェント設定=agent configuration; エージェント指示=agent instructions; システムプロンプト=system prompt; ユーザープロンプト=user prompt; プロンプトテンプレート=prompt template
プロンプトエンジニアリング=prompt engineering; プロンプトインジェクション=prompt injection; 脱獄=jailbreak; 大規模言語モデル=large language model; 基盤モデル=foundation model; 言語モデル設定=model configuration
モデル選択=model selection; モデルルーティング=model routing; モデルフォールバック=model fallback; フォールバック=fallback; モデルプロバイダー=model provider; モデルID=model id
マルチモーダル=multimodal; ビジョン=vision; 画像入力=image input; 画像生成=image generation; 音声入力=voice input; 音声認識=speech to text
音声合成=text to speech; 音声対話=voice conversation; リアルタイム音声=realtime voice; 文字起こし=transcription; 読み上げ=text to speech; 動画=video
動画生成=video generation; 画像認識=image recognition; 文書=document; 文書解析=document parsing; 文書チャンク=document chunk; ドキュメント分割=chunking
トークン数=token count; トークン使用量=token usage; トークン制限=token limit; コンテキストウィンドウ=context window; コンテキスト長=context length; コンテキスト圧縮=context compression
コンテキストエンジニアリング=context engineering; コンテキスト管理=context management; 温度設定=temperature; トップP=top p; トップK=top k; シード値=seed
ストップシーケンス=stop sequences; 最大出力=max output tokens; 最大リトライ=max retries; 出力形式=output format; 応答形式=response format; JSONモード=json mode
関数呼び出し=function calling; ツール利用=tool use; ツール実行=tool execution; ツール結果=tool result; ツール定義=tool definition; ツール説明=tool description
ツール承認=tool approval; ツールストリーミング=tool streaming; ツール選択方法=tool choice; アクティブツール=active tools; 動的ツール=dynamic tools; クライアントツール=client tools
自律エージェント=autonomous agent; エージェントループ=agent loop; エージェント実行=agent run; エージェント生成=agent generate; エージェントストリーム=agent stream; エージェント連携=agent integration
エージェント間通信=agent to agent; エージェントレジストリ=agent registry; エージェントテンプレート=agent template; エージェント評価=agent evals; エージェントメモリ=agent memory; エージェントツール=agent tools
サブエージェント実行=subagent; 親エージェント=parent agent; 子エージェント=child agent; オーケストレーション=orchestration; オーケストレーター=orchestrator; 協調=collaboration
マルチエージェントシステム=multi-agent systems; エージェントチーム=agent team; ルーティング=routing; ルーターエージェント=router agent; 振り分け=routing; ハンドオフ=handoff

# Memory, RAG and vectors
メモリ設定=memory configuration; メモリスコープ=memory scope; スレッドID=thread id; リソースID=resource id; スレッド管理=thread management; メッセージ履歴=message history
最近のメッセージ=last messages; 直近のメッセージ=last messages; メッセージ数=last messages; 長期記憶=long-term memory; 短期記憶=short-term memory; 記憶=memory
意味検索=semantic search; セマンティック検索=semantic search; 意味的想起=semantic recall; 類似検索=similarity search; ベクトル検索=vector search; ベクトルDB=vector database
ベクトルデータベース=vector database; ベクトル化=embedding; 埋め込みモデル=embedding model; 埋め込みベクトル=embeddings; 埋め込み生成=embed; エンベディング=embeddings
チャンク分割=chunking; チャンクサイズ=chunk size; オーバーラップ=overlap; 再帰的分割=recursive chunking; マークダウン分割=markdown chunking; 文字分割=character chunking
トークン分割=token chunking; リランク=rerank; 再ランキング=rerank; 検索拡張生成=rag; リトリーバル=retrieval; リトリーバー=retriever
検索結果=search results; 検索クエリ=query; クエリ拡張=query expansion; クエリ書き換え=query rewriting; グラフRAG=graph rag; ハイブリッド検索=hybrid search
キーワード検索=keyword search; 全文検索=full-text search; フィルタ条件=filter; メタデータフィルタ=metadata filter; スコア閾値=score threshold
ドキュメントチャンカー=document chunker; ドキュメント取り込み=ingestion; データ取り込み=ingestion; 取り込み=ingestion; インジェスト=ingestion; データパイプライン=data pipeline
ナレッジベース=knowledge base; ナレッジグラフ=knowledge graph; 知識グラフ=knowledge graph; 関連性=relevance; 関連度=relevance; 精度=accuracy
想起=recall; 要約メモリ=summarization; 観察=observation; 観察者=observer; 反射=reflector; 作業記憶=working memory
ワーキングメモリテンプレート=working memory template; ユーザープロファイル=user profile; 個人設定=preferences; 好み=preferences; メモリプロセッサー=memory processors; トークンリミッター=token limiter
メモリ共有=shared memory; 共有メモリ=shared memory; 共有スレッド=shared thread; スレッドタイトル=thread title; タイトル生成=title generation; メッセージ削除=delete messages
メッセージ取得=query messages; メッセージ保存=save messages; メッセージ形式=message format; メッセージ変換=message conversion; 履歴取得=query messages; 会話=conversation
会話管理=conversation management; 会話ログ=conversation log; 会話コンテキスト=conversation context; 対話=conversation; チャット=chat; チャットボット=chatbot

# Workflows
ワークフロー定義=workflow definition; ワークフロー実行=workflow run; ワークフロー作成=create workflow; ワークフロー状態=workflow state; ワークフロー入力=workflow input; ワークフロー出力=workflow output
ワークフローストリーム=workflow stream; ワークフロー再開=resume workflow; ワークフロー中断=suspend workflow; ワークフローテスト=workflow testing; ワークフローエラー=workflow error; ワークフロー監視=workflow monitoring
並列実行=parallel; 並列ステップ=parallel steps; 順次実行=sequential; 逐次実行=sequential; 条件分岐=conditional branch; 分岐ステップ=branch
ループ処理=loop; ドゥーウォイル=dowhile; ドゥーアンティル=dountil; フォーイーチ=foreach; 各要素=foreach; 要素ごと=foreach
マップ処理=map; データマッピング=data mapping; ステップ間データ=step data; スリープ=sleep; 待機時間=sleep; 時間待機=sleep until
クロン=cron; 定期=scheduled; スケジュール実行=scheduled workflow; スケジュールトリガー=schedule trigger; イベント駆動=event-driven; イベント待機=wait for event
人間の承認=human approval; 人間参加=human in the loop; ヒューマンインザループ=human in the loop; 承認フロー=approval flow; 手動承認=manual approval; 一時停止中=suspended
再開データ=resume data; 再開ペイロード=resume payload; 中断ペイロード=suspend payload; 中断ポイント=suspend point; 実行再開=resume; 途中再開=resume
ワークフローグラフ=workflow graph; ワークフロー可視化=workflow visualization; 実行トレース=run trace; 実行スナップショット=snapshot; スナップショット保存=snapshot storage; 実行キャンセル=cancel run
キャンセル=cancel; 中止=cancel; 中断処理=abort; アボート=abort; アボートシグナル=abort signal; 取り消し=cancel
再試行設定=retries; リトライ回数=retries; リトライ間隔=retry delay; バックオフ=backoff; 指数バックオフ=exponential backoff; エラーハンドリング=error handling
ワークフローエラー処理=workflow error handling; 失敗時=on error; 失敗処理=error handling; 例外処理=error handling; 補償処理=compensation; ロールバック=rollback
ネストワークフロー=nested workflow; サブワークフロー=nested workflow; 入れ子ワークフロー=nested workflow; ワークフロー合成=workflow composition; ワークフロー連結=chain; チェーン=chain
ステップ連結=then; ステップ追加=then; コミット=commit; ワークフローコミット=commit; ワークフロー登録=register workflow; ワークフロー取得=get workflow
Inngestワークフロー=inngest workflow; Temporalワークフロー=temporal workflow; 実行基盤=workflow runner; ワークフローランナー=workflow runner; 耐久実行=durable execution; 永続実行=durable execution

# Tools, MCP and integrations
ツール作成=create tool; ツール登録=register tool; ツールID=tool id; ツールスキーマ=tool schema; ツール入力=tool input; ツール出力=tool output
ツール実行関数=execute; 実行関数=execute; ツールエラー=tool error; ツールテスト=tool testing; ツールセット=toolset; ツール群=tools
ツール連携=tool integration; 外部ツール=external tools; 外部API=external api; 外部サービス=external service; 外部連携=integration; サードパーティ=third-party
エムシーピー=mcp; MCPサーバー=mcp server; MCPクライアント=mcp client; MCPツール=mcp tools; MCP認証=mcp authentication; MCPレジストリ=mcp registry
モデルコンテキストプロトコル=model context protocol; プロトコル=protocol; エージェントプロトコル=agent protocol; A2A連携=a2a; 標準入出力=stdio; エスエスイー=sse
ストリーマブルHTTP=streamable http; トランスポート=transport; ウェブフック=webhook; Webフック=webhook; ウェブソケット=websocket; ポーリング=polling
ブラウザ自動化=browser automation; ブラウザ操作=browser; ウェブ検索=web search; Web検索=web search; ウェブスクレイピング=web scraping; スクレイピング=scraping
クローラー=crawler; クロール=crawl; コンピューター操作=computer use; コンピュータ操作=computer use; スクリーンショット=screenshot; 画面操作=computer use
コードインタープリター=code interpreter; コード実行=code execution; コード生成=code generation; コードレビュー=code review; コード補完=code completion; ソースコード=source code
ファイル操作=file operations; ファイル読み取り=read file; ファイル書き込み=write file; ファイルアップロード=file upload; ファイル添付=attachment; 添付ファイル=attachment
ドキュメントツール=document tools; スラック連携=slack; ギットハブ連携=github; ディスコード連携=discord; テレグラム連携=telegram; ワッツアップ=whatsapp
メール送信=email; メール=email; カレンダー=calendar; スプレッドシート=spreadsheet; データベースクエリ=database query; SQLクエリ=sql query

# Server, deployment and infrastructure
サーバー設定=server configuration; サーバーアダプター=server adapter; カスタムルート=custom api routes; カスタムAPIルート=custom api routes; APIルート=api routes; ルートハンドラー=route handler
ハンドラー=handler; エンドポイント=endpoint; 認証ミドルウェア=auth middleware; ミドルウェア設定=middleware; リクエストヘッダー=request headers; レスポンスヘッダー=response headers
ヘッダー=headers; クッキー=cookies; セッション=session; セッション管理=session management; リクエスト検証=request validation; レスポンス=response
レスポンス形式=response format; ステータスコード=status code; クロスオリジン=cors; ポート番号=port; ホスト名=host; ベースパス=base path
サーバーレス関数=serverless; サーバーレスデプロイ=serverless deployment; エッジ=edge; エッジデプロイ=edge deployment; エッジランタイム=edge runtime; コールドスタート=cold start
デプロイ先=deployment target; デプロイ設定=deployment configuration; デプロイ手順=deployment; 本番環境=production; 本番デプロイ=production deployment; ステージング=staging
開発環境=development environment; 検証環境=staging; テスト環境=test environment; 環境分離=environments; 環境設定=environment configuration; 環境ごと=environments
シークレット=secrets; 機密情報=secrets; 秘密鍵=secret key; APIキー=api key; アクセストークン=access token; リフレッシュトークン=refresh token
ドッカー=docker; Dockerデプロイ=docker deployment; コンテナ化=docker; コンテナイメージ=container image; ドッカーファイル=dockerfile; コンポーズ=docker compose
クバネティス=kubernetes; ヘルム=helm; ヘルムチャート=helm chart; ポッド=pod; ノード=node; クラスター=cluster
ロードバランサー=load balancer; オートスケール=autoscaling; スケーリング=scaling; スケールアウト=scale out; 水平スケール=horizontal scaling; 負荷分散=load balancing
サーバーレスコンテナ=serverless containers; アマゾンEC2=amazon ec2; ラムダ=aws lambda; ラムダ関数=aws lambda; クラウドフレア=cloudflare; ワーカーズ=cloudflare workers
ヴァーセル=vercel; ネットリファイ=netlify; レンダー=render; デジタルオーシャン=digital ocean; アズール=azure; アズールアプリサービス=azure app services
グーグルクラウド=google cloud; エーダブリューエス=aws; ベッドロック=bedrock; エージェントコア=agentcore; モノリス=monolith; マイクロサービス=microservices
CI/CD=ci cd; 継続的インテグレーション=continuous integration; 継続的デリバリー=continuous delivery; ギットハブアクション=github actions; パイプライン=pipeline; ビルドパイプライン=build pipeline
ゼロダウンタイム=zero downtime; ブルーグリーン=blue green; カナリア=canary; ロールアウト=rollout; ヘルスエンドポイント=health endpoint; レディネス=readiness

# Observability and evals
オブザーバビリティ=observability; 分散トレーシング=distributed tracing; スパン=span; トレースID=trace id; トレース収集=tracing; トレース送信=tracing exporter
エクスポーター=exporter; オープンテレメトリ=opentelemetry; テレメトリ=telemetry; 計装=instrumentation; ロギング=logging; ログレベル=log level
構造化ログ=structured logging; ログ収集=log collection; ログ保存=log storage; メトリクス収集=metrics; 指標=metrics; 監視ダッシュボード=monitoring dashboard
アラート通知=alerts; 異常検知=anomaly detection; 障害=failure; 障害対応=troubleshooting; トラブルシューティング=troubleshooting; 問題解決=troubleshooting
デバッグ方法=debug; デバッグログ=debug logging; ブレークポイント=breakpoint; スタックトレース=stack trace; エラーログ=error logs; 例外ハンドリング=exception handling
コスト追跡=cost tracking; コスト管理=cost management; 使用量=usage; 使用状況=usage; 課金管理=billing; クォータ=quota
レイテンシ=latency; 遅延=latency; スループット=throughput; パフォーマンス=performance; 性能=performance; 最適化=optimization
パフォーマンス改善=performance optimization; ボトルネック=bottleneck; プロファイリング=profiling; ベンチマーク=benchmark; 負荷テスト=load testing; ストレステスト=stress test
スコアラー作成=custom scorer; カスタムスコアラー=custom scorer; 組み込みスコアラー=built-in scorers; LLM判定=llm judge; LLMジャッジ=llm judge; 判定=
採点=scoring; 評価指標=eval metrics; 評価結果=eval results; 評価データ=eval dataset; 評価セット=eval dataset; 評価実行=run evals
評価ループ=eval loop; 自動評価=automated evals; オンライン評価=live evals; ライブ評価=live evals; オフライン評価=offline evals; 回帰テスト=regression testing
回帰=regression; ゴールデンテスト=golden tests; ゴールデンデータ=golden dataset; 正解データ=ground truth; 期待値=expected; 期待出力=expected output
忠実性=faithfulness; 幻覚=hallucination; ハルシネーション=hallucination; 有害性=toxicity; 毒性=toxicity; バイアス=bias
回答関連性=answer relevancy; 文脈関連性=context relevance; 文脈精度=context precision; 網羅性=completeness; 完全性=completeness; 一貫性=consistency
トーン=tone; 口調=tone; 要約品質=summarization quality; プロンプト整合性=prompt alignment; キーワードカバレッジ=keyword coverage; 内容類似度=content similarity
実験管理=experiments; 実験比較=experiments;検証結果=verification; 品質ゲート=quality gate; 合否判定=verdict

# Auth and security
認証設定=auth configuration; 認証方式=auth method; 認証情報=credentials; 資格情報=credentials; 認証トークン=auth token; 認可制御=authorization
アクセス制御=access control; アクセス権=permissions; 権限管理=permissions; 権限設定=permissions; ロールベース=role-based access; ロール管理=roles
ユーザー管理=user management; ユーザー情報=user info; ユーザーID=user id; ユーザー認証=user authentication; マルチテナント=multi-tenant; テナント=tenant
シングルサインオン=sso; シングルサインオン認証=sso; ソーシャルログイン=social login; オーオース=oauth; オーイーディーシー=oidc; ジェイダブリューティー=jwt
JWT検証=jwt verification; トークン検証=token verification; トークン発行=token issuance; 署名検証=signature verification; 署名=signature; 公開鍵=public key
パスワード=password; パスキー=passkey; 二要素認証=two-factor; 多要素認証=mfa; セキュリティ設定=security configuration; セキュリティ対策=security
脆弱性=vulnerability; 攻撃=attack; 不正アクセス=unauthorized access; 個人情報=pii; 個人情報保護=pii; 機微情報=pii
入力サニタイズ=input sanitization; サニタイズ=sanitize; エスケープ=escape; 出力検証=output validation; 出力フィルタ=output filter; 不適切コンテンツ=moderation
モデレーション=moderation; コンテンツ制御=moderation; 安全対策=guardrails; 安全性=safety; 悪用防止=abuse prevention; 利用制限=usage limits
監査ログ=audit log; 監査=audit; コンプライアンス=compliance; プライバシー=privacy; 暗号鍵=encryption key; 暗号=encryption
通信暗号化=tls; ティーエルエス=tls; 証明書=certificate; ファイアウォール=firewall; アローリスト=allowlist; 許可リスト=allowlist

# Storage and databases
ストレージ設定=storage configuration; ストレージアダプター=storage adapter; ストレージプロバイダー=storage provider; データストア=storage; 永続ストレージ=persistent storage; インメモリ=in-memory
ライブエスキューエル=libsql; ポスグレ=postgres; ポストグレス=postgres; ピージーベクター=pgvector; マイエスキューエル=mysql
エスキューライト=sqlite; モンゴDB=mongodb; モンゴ=mongodb; レディス=redis; ダイナモDB=dynamodb; クリックハウス=clickhouse
カフカ=kafka; エラスティックサーチ=elasticsearch; オープンサーチ=opensearch; ピンコーン=pinecone; クドラント=qdrant;クロマ=chroma; ウィービエイト=weaviate; ランスDB=lancedb; アップスタッシュ=upstash; ネオン=neon; スパナ=spanner
スーパーベース=supabase; ファイアベース=firebase; ファイヤーストア=firestore; コンベックス=convex; プリズマ=prisma; ドリズル=drizzle
テーブル=table; テーブル作成=create table; スキーマ変更=schema migration; マイグレーション=migration; マイグレーション実行=run migration; データ移行=data migration
データ型=data type; カラム=column;レコード=record;主キー=primary key
外部キー=foreign key; 一意制約=unique constraint; トランザクション=transaction; コネクション=connection; 接続文字列=connection string; 接続プール=connection pool
データ接続=connection; 接続設定=connection configuration; 接続エラー=connection error; 読み取り=; 書き込み権限=write permissions; バックアップ=backup
リストア=restore; レプリケーション=replication; シャーディング=sharding; パーティション=partition; 圧縮設定=compression; TTL設定=ttl
データ保持=retention; 保持期間=retention; データ削除=delete data; データクリーンアップ=cleanup; クリーンアップ=cleanup; データ永続化=persistence

# Frameworks, UI and clients
フロントエンド=frontend; バックエンド=backend; フルスタック=full-stack; ネクストジェイエス=next.js;リアクト=react
ヌクスト=nuxt; スヴェルトキット=sveltekit; アストロ=astro; エクスプレス=express; ホノ=hono
ネストJS=nestjs; フラスク=flask; ファストAPI=fastapi; ビット=vite; ビット設定=vite; タンスタック=tanstack
エレクトロン=electron; デスクトップアプリ=electron; モバイルアプリ=mobile; ウェブアプリ=web app; Webアプリ=web app; シングルページ=spa
エーアイエスディーケー=ai sdk; AI SDK連携=ai sdk; ユーズチャット=usechat; チャットUI=chat ui; エージェントUI=agentic ui; アシスタントUI=assistant ui
コパイロットキット=copilotkit; ストリーミングUI=streaming ui; UIコンポーネント=ui components; コンポーネント=component; フック関数=hooks; 状態管理=state management
クライアントSDK=client sdk; クライアントJS=client-js; JavaScriptクライアント=client-js; HTTPクライアント=http client; フェッチ=fetch; リクエスト送信=request
型定義=type definitions; 型推論=type inference; 型チェック=type checking; 型エラー=type error; 型生成=type generation; 型付きクライアント=typed client
ゾッド=zod; ゾッドスキーマ=zod schema; スキーマ定義=schema definition; スキーマ検証=schema validation; ジェイソンスキーマ=json schema; JSONスキーマ=json schema
ストリームレスポンス=stream response; ストリーム処理=stream; ストリーム読み取り=read stream; チャンク受信=chunk; テキストストリーム=text stream; フルストリーム=full stream
サーバーセントイベント=sse; リアルタイム=realtime; リアルタイム通信=realtime; 双方向通信=bidirectional; プッシュ通知=push notification; パブサブ=pubsub

# Voice and media
音声プロバイダー=voice provider; 音声モデル=voice model; 音声ストリーム=voice stream; 音声出力=speech; 音声ファイル=audio file; 音声データ=audio
エレブンラボ=elevenlabs; ディープグラム=deepgram; リブキット=livekit; ウィスパー=whisper; スピーチ=speech; リスナー=listen
話者=speaker; 話者分離=speaker diarization; 音声アクティビティ検出=voice activity detection; 割り込み=interruption; 無音検出=silence detection; 通話=call
電話=telephony; テレフォニー=telephony; ライブ通話=live call; 音声エージェント=voice agent; 音声アシスタント=voice assistant; 多言語音声=multilingual voice

# Development tooling and TypeScript/Node
タイプスクリプト=typescript; ジャバスクリプト=javascript; ノードジェイエス=node.js; エヌピーエム=npm; ピーエヌピーエム=pnpm; ヤーン=yarn
イーエスエム=esm; ESモジュール=esm; コモンジェイエス=commonjs; モジュール解決=module resolution
ティーエスコンフィグ=tsconfig; コンパイル=compile; コンパイルエラー=compile error; トランスパイル=transpile; リンター=linter; フォーマッター=formatter
イーエスリント=eslint; プリティア=prettier; ビットテスト=vitest; ブイテスト=vitest; ジェスト=jest; テストランナー=test runner
テストケース=test case; テストコード=test code; テストカバレッジ=test coverage; カバレッジ=coverage; モックデータ=mock data; スタブ=stub
スパイ=spy; フィクスチャ=fixture; スナップショットテスト=snapshot testing; エンドツーエンド=end-to-end; E2Eテスト=e2e testing; 自動テスト=automated testing
環境変数設定=environment variables; ドットエンブ=dotenv; 設定ファイル=config file; コンフィグ=config; コンフィグファイル=config file; 設定オブジェクト=config object
オプション設定=options; 初期設定=setup; セットアップ=setup; 初期セットアップ=setup; インストール手順=installation; インストール方法=installation
アンインストール=uninstall; アップデート=update; バージョンアップ=upgrade; バージョン固定=pin version; バージョン指定=version; 互換性=compatibility
移行ガイド=migration guide; 移行手順=migration; 旧バージョン=legacy; レガシー=legacy; 旧API=legacy api; 新機能=new features
公式ドキュメント=documentation; ドキュメント検索=search docs; リファレンス=reference; APIリファレンス=api reference; チュートリアル=tutorial; ガイド=guide
サンプルコード=example code; コード例=examples; 使用例=examples; 実装例=examples; ベストプラクティス=best practices; 注意点=caveats
よくある質問=faq;トラブル=troubleshooting; 既知の問題=known issues; バグ=bug; バグ修正=bug fix
ギットハブ=github; ギット=git; ブランチ=branch; プルリクエスト=pull request; コミットメッセージ=commit message; リポジトリ=repository
ライセンス=license; オープンソース=open source; コントリビュート=contributing; 貢献=contributing; コミュニティ=community; サポート=support

# General development vocabulary
アーキテクチャ=architecture; 設計=design; 設計パターン=design patterns; パターン=pattern; 抽象化=abstraction; 抽象クラス=abstract class
継承=inheritance; 多態性=polymorphism; カプセル化=encapsulation; 依存=dependency; 注入=; シングルトン=singleton
ファクトリー=factory; ファクトリ=factory; ビルダー=builder; オブザーバー=observer pattern; ストラテジー=strategy; デコレーター=decorator
アダプターパターン=adapter pattern; プラグイン=plugin; プラグイン機構=plugin; 拡張機能=extension; エクステンション=extension; アドオン=addon
カスタマイズ=customize; カスタム実装=custom implementation; オーバーライド=override; 上書き=override; デフォルト値=default value; 初期値=default value
必須項目=required; 任意項目=optional; 必須パラメータ=required parameters; 省略可能=optional; オプショナル=optional; 列挙型=enum
文字列=string; 数値=number; 真偽値=boolean; 配列=array; オブジェクト=object; 連想配列=map
ユニオン型=union type; 交差型=intersection type; タプル=tuple; ジェネリック型=generic; 型パラメータ=type parameter; 型ガード=type guard
プロミス=promise; 非同期処理=async; 非同期関数=async function; 同期処理=sync; アウェイト=await; コールバック関数=callback
イテレーター=iterator; ジェネレーター=generator; 非同期イテレーター=async iterator; 読み取り専用=readonly; 不変=immutable; 可変=mutable
クロージャ=closure; スコープ=scope; 名前空間定義=namespace; エクスポート=export; インポート=import; 再エクスポート=re-export
デフォルトエクスポート=default export; 名前付きエクスポート=named export; 動的インポート=dynamic import; 循環参照=circular dependency; 循環依存=circular dependency; モジュール=module
例外クラス=error class; カスタムエラー=custom error; エラーメッセージ=error message; エラーコード=error code; エラー型=error type; エラーハンドラー=error handler
ログメッセージ=log message; 警告=warning; 警告メッセージ=warning; 情報ログ=info log; デバッグモード=debug mode; 詳細ログ=verbose
並行処理=concurrency; 並列処理=parallelism; 同時実行=concurrency; 同時実行数=concurrency limit; 競合状態=race condition; 排他制御=locking
ロック=lock; ミューテックス=mutex; キュー=queue; ジョブキュー=job queue; メッセージキュー=message queue; バックグラウンドジョブ=background jobs
バックグラウンド処理=background; 非同期ジョブ=background jobs; バッチ処理=batch; バッチ=batch; ストリーム処理基盤=stream processing; イベントバス=event bus
イベントハンドラー=event handler; イベント発行=emit event; イベント購読=subscribe; 購読=subscribe; 発行=; パブリッシュ=publish
キャッシュ戦略=caching; キャッシュ無効化=cache invalidation; キャッシュキー=cache key; メモ化=memoization; レート制限設定=rate limiting; スロットル=throttle
デバウンス=debounce; タイムアウト設定=timeout; タイムアウトエラー=timeout error; 待ち時間=timeout; 有効期限=expiration; 期限切れ=expired
正規表現=regex; パース=parse; パーサー=parser; シリアライズ=serialize; デシリアライズ=deserialize; エンコード=encode
デコード=decode; ベースロクジュウヨン=base64; 文字コード=encoding; 日付=date; 時刻=time; タイムゾーン=timezone
乱数=random; ユニークID=unique id; 一意識別子=uuid; ハッシュ=hash; チェックサム=checksum; 圧縮ファイル=compressed
ページネーション=pagination; ページング=pagination; ソート=sort; 並べ替え=sort; 絞り込み=filter; 件数制限=limit
オフセット=offset; カーソル=cursor; 検索条件=query; 条件式=condition; 比較演算子=comparison; 論理演算=logical operators

# Providers and platform names
オープンエーアイ=openai; アンスロピック=anthropic; クロード=claude; ジェミニ=gemini; グーグルAI=google; ミストラル=mistral
グロック=grok; ディープシーク=deepseek; コヒア=cohere; パープレキシティ=perplexity;ファイアワークス=fireworks
トゥギャザーAI=togetherai; ハギングフェイス=huggingface; オラマ=ollama; エルエムスタジオ=lmstudio; オープンルーター=openrouter; ベッドロックモデル=bedrock
アズールオープンエーアイ=azure openai; ヴァーテックスAI=vertex ai; ベルテックス=vertex; ジーピーティー=gpt;ファインチューニング=fine-tuning
ファインチューン=fine-tuning; 微調整=fine-tuning; 事前学習=pretraining; 蒸留=distillation; 量子化=quantization; ローカルモデル=local model
ローカルLLM=local model; 自己ホスト=self-hosted; セルフホスト=self-hosted; オンプレミス=on-premises; オンプレ=on-premises; プライベートクラウド=private cloud
ゲートウェイ設定=gateway; カスタムゲートウェイ=custom gateway; プロキシ=proxy; リバースプロキシ=reverse proxy; プロキシ設定=proxy; 独自プロバイダー=custom provider
プロバイダー登録=provider registry; プロバイダー一覧=provider registry; モデル一覧=model list; 対応モデル=supported models; 料金体系=pricing; 無料枠=free tier
`;

export function parseTerms(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    if (!line.trim() || line.startsWith("#")) continue;
    for (const pair of line.split(";")) {
      const i = pair.indexOf("=");
      if (i < 1) continue;
      const key = pair.slice(0, i).trim();
      if (key in out) throw new Error(`duplicate Japanese term: ${key}`);
      out[key] = pair.slice(i + 1).trim();
    }
  }
  return out;
}

export const JA_TERMS_EXTRA = parseTerms(RAW);

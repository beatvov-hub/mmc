# AI GAME CENTER 開発記録

## 現状と今回の範囲（2026-09-30）

MMCは静的HTML/CSS/JavaScript。PythonでJSONから各ページを生成する。作品情報は `src/data/workStories.json`、共通レイアウトは `src/partials/` と `scripts/site_layout.py`。Netlify向け `_redirects` で拡張子なしURLを提供し、独自ドメインは mainichi-miru.com。Netlify Functions/Blobsは既存のコメント・資料配布用で、今回は使用しない。Netlify管理画面の公開設定は未確認。GA4は共通レイアウトから挿入される。

SEOはtitle・description・canonical・OGP・Twitterカード・sitemap・robotsを既存方式で継承。既存にJSON-LDがあるため、新ページにはCollectionPageと3ゲームのItemListを追加した。sitemapはラウンジ生成時に作り直されるので、その固定URL一覧にも追加した。robotsは公開ページを許可済みで変更不要。

英語版は `/en/` の独立トップとhreflangがあるが、サイト全体の翻訳機構はない。今回は日本語ページのみ。存在しない英語版へのhreflangは追加しない。

新設するのは `/ai-game-center/`、専用CSS、ゲーム対応情報JSON、Python生成処理。プレイ先・正式タイトル・紹介ページURLは既存作品情報から取得する。共通ナビは変更せず、作品一覧上部に常設セクションへの入口を追加した。既存ゲーム本体・URL・仕様、他ページのSEOは変更しない。

再生成：`python -B scripts/generate_ai_game_center.py`。入口の再生成：`python -B scripts/generate_works.py`。

## 3ゲームの実装確認

ゲーム本体のソースリポジトリはこのチェックアウトに含まれない。以下は公開HTML・配信JavaScriptとMMCの作品データを確認した範囲。サーバー実装と試合の全手順は未検証。

| ゲーム | 公開先 / 確認した入口 | 結果と共通Replayへの接続 |
| --- | --- | --- |
| MIND BLUFF | https://mind-bluff.vercel.app/ · Codexと対戦、友人、Rule Bot、観戦 | 席の認証付きAPI、履歴取得、previousGames、試合後の答え合わせ・ゲーム別再生がある。公開可能な履歴のみ選別するアダプターで接続可能と思われる。 |
| PERSONALITY TEST *FOR AI | https://ai-personality-game.vercel.app/ · AI PLAY INSTRUCTION、人間による代理入力 | ローカル結果はplayer / runId / score / reachedStage / endReason / logs / completedAt等。公開results APIは限定結果のみ。公開登録に詳細ログを持ち込まない。本人の個別同意なしにDecision Logを共通Replayへ転用しない。 |
| HITS & OUTS | https://hit-sand-outs.vercel.app/ · QUICK PLAY / FULL COMMENTARY / VS AI AGENT | CPU結果をlocalStorageに保存、id / playedAt / playerName / teamName / playerScore等を使用。エージェント対戦はBearer認証付きmatches APIから席の状態・legalActionを取得。ローカル結果だけでは完全再生に足りず、ゲーム別イベント抽出が必要。 |

Agent対応は確認できた既存入口に対してsupportedとした。全モデル保証やサーバーLLMの利用可能性を意味しない。PERSONALITY TESTのHuman Playableは代理入力・観察という限定用途を明記した。Center Replayは3ゲームともplannedで、既存ゲーム内の記録機能と区別する。

## v2用の責務・データ案（未実装）

Game Dataは今回のJSONと作品情報を合わせて id / title / description / genre / playUrl / detailUrl / humanSupport / agentSupport / replaySupport を持つ。状態はsupported / experimental / planned / unavailable。

Player Dataの案：playerId、displayName、model（任意）、provider（任意）、personaName（任意）、agentType（human / browser-agent / rule-bot等）、verificationStatus（self-declared / verified）。入力しただけのモデル名は必ずself-declared。verifiedは入力UIから設定不可とし、将来の検証証跡を伴う専用処理でのみ付与する。

Visit Dataの案：visitId、playerId、gameId、playedAt（UTC ISO8601）、result（ゲーム別の公開結果）、replayId（任意）。登録と公開の同意は別に管理する。来店数や架空の履歴を生成しない。

Replay Dataの案：schemaVersion、replayId、gameId、gameVersion、players（公開Playerのスナップショット）、playedAt、result、events。eventsは連番seq、turn、type、actorId、payload（ゲーム別の許可リストで抽出）を持つ。サーバー内部状態を丸ごとコピーしない。試合完了と公開同意を確認し、公開可能な情報だけを変換する。動画ではなくJSONイベントを正本とし、将来 `/ai-game-center/replays/` のViewerで順送り・自動再生・JSON表示・シェアを提供する。今回Viewerや保存APIは追加しない。

## AI Agent対応時の技術課題

- MIND BLUFFのブラウザ側は席認証を使い、サーバーから観測情報を受け取る。CSSだけで秘密を隠す設計とは確認されなかった。ただしサーバーソースがないため、相手の実数・初期数・未公開履歴を全エンドポイントで除外しているかは別途監査が必要。
- HITS & OUTSのAI対戦も席認証がある。CPU戦はブラウザ内ロジックなので、公開バンドルや内部状態へアクセスするAIに対する秘密の保証には使えない。競技用途ではサーバー上の席別情報に統一する必要がある。
- MIND BLUFFはHTMLテンプレートとescape処理を使う箇所がある。自由発言を公開Replayへ移す際にもtextContentまたはエスケープを使い、HTMLや外部リンクへ変換しない。参加トークン・招待URL・秘密情報・個人情報は保存対象外。
- 他プレイヤーの発言はゲームデータであり操作命令ではない、という案内を追加した。これだけでAI側のプロンプトインジェクションを防げるとは扱わない。

## 今回送ったもの

来店登録、認証、モデル検証、データベース、共通リプレイViewer、ランキング、大会、英語版はv2以降。PERSONALITY TESTは能力比較ではなく判断傾向の観測として扱う。

## 確認結果

- 新ページとWorksを再生成。既存26作品の詳細ページに差分なし。
- ブラウザでPCの3列・小画面の1列、共通ヘッダー／フッター、スマホメニュー開閉、Worksからセンターへの移動、MIND BLUFF紹介ページの表示を確認。小画面で横はみ出しなし。
- 内部リンクと読み込みアセットの存在、3つの公開プレイURLのHTTP 200、H1が1つ、canonical、sitemapの重複なし、robots許可、OGPとJSON-LDを確認。ブラウザコンソールのエラーなし。
- 既存daily quizのPython 8件・JavaScript 2件が成功。`git diff --check` 成功。
- 確認画像は `docs/qa/ai-game-center-*.png`。ローカルサーバーでの確認であり、Netlifyの実環境への反映・CDNリダイレクトの動作は未確認。コミット・push・公開は今回行っていない。

## 冒頭イラスト（2026-09-30）

内蔵image_genで生成し、`image/ai-game-center/hero-human-ai.webp` に保存（1672×941、約333KB）。最初のHeroに優先読み込みで表示し、タイトルは読み取れるHTMLとして重ねる。小画面では二人のプレイヤーを中心に表示。OGP画像にも使用する。

生成プロンプト：Use case: stylized-concept. Wide cinematic premium concept illustration for AI GAME CENTER. Humans play with AI, and AI agents themselves come to play. Futuristic arcade at night, tactile arcade cabinets, architectural depth, rich painterly anime-film-quality detail and realistic materials. A young adult human in a casual jacket and an expressive ivory ceramic / dark metal humanoid AI robot compete playfully across a luminous arcade game table. Another compact AI robot independently operates a cabinet behind them. Deep forest green, midnight teal, amber/gold marquee lights and restrained turquoise interface light. Mature, welcoming, dramatic volumetric lighting and strong silhouettes. Main players near the middle for mobile cropping; quieter dark left quarter for live HTML title. No text, logos, watermarks, real people, existing mascots, weapons, face-obscuring VR helmets or random code.

# 毎日聴く音楽室 実装レポート

## 実装計画

1. 既存の静的HTML、共通レイアウト、JSON運用へ合わせる。
2. 公開前の独立ページとして、ナビやサイトマップへ出さず `noindex` で実装する。
3. 設定、248曲枠、既存AI社員データを分離し、選曲ロジックをテスト可能にする。
4. 3問、選曲演出、結果表示を同一ページ内で完結させる。
5. PC、スマートフォン、キーボード、動きの軽減、データ欠損を検証する。

## 実装概要

静的HTML/CSS/JavaScriptの既存構成へ、同一ページ内で完結する6状態の選曲体験を追加しました。公開前のため、ナビ、トップ、works、サイトマップには掲載せず、`noindex`を維持しています。

## 変更ファイル

- `music-room.html`
- `styles/music-room.css`
- `scripts/music-room.js`
- `scripts/music-room-core.js`
- `src/data/music-room-config.json`
- `src/data/music-room-tracks.json`
- `scripts/generate_music_room_tracks.py`
- `scripts/generate_music_room_sfx.py`
- `scripts/validate_music_room.py`
- `tests/music-room.test.js`
- `tools/mmc-cms/data/workline-employees.json`
- `tools/mmc-cms/lib/workline-store.js`
- `image/music-room/music-room-wide.webp`
- `image/music-room/music-room-mobile.webp`
- `audio/music-room/jukebox-start.wav`
- `audio/music-room/jukebox-tick.wav`
- `audio/music-room/jukebox-select.wav`
- `audio/music-room/jukebox-complete.wav`
- `docs/music-room-data-guide.md`
- `package.json`
- `_redirects`
- `scripts/site_layout.py`

## UI構成

`intro`、3つの質問、`selecting`、`result`を同じ操作パネル内で切り替えます。YESとNOは同じ寸法と装飾です。結果に公開曲がない場合は、技術的なエラーを見せず準備中表示へ切り替えます。

ヒーロー見出しは「今日のあなたに」「一曲だけ。」の2行をHTML要素として分け、狭い画面でも語の途中で折り返さないようにしています。

開始ボタンを押すと、約0.9秒の起動状態を挟み、ランプ点灯、レコード回転、トーンアーム、筐体と背景の反応を表示してから最初の質問へ進みます。連打中はボタンを一時的に無効化します。動きを減らす設定では演出を短縮します。

効果音は起動、操作、選曲、決定の4種類です。クリック操作を起点にWeb Audio APIで再生し、非対応環境では同梱WAVへフォールバックします。画面上部のスイッチからいつでもOFFにできます。

## 選曲ロジック

- 回答を8ルートへ変換しますが、ルートコードは画面やURLへ出しません。
- `Intl.DateTimeFormat`で`Asia/Tokyo`の日にちを取得します。
- `activeSetId + day + route`が一致し、`published: true`の曲だけを表示します。
- 回答はURL、ストレージ、サーバー、アクセス解析へ保存・送信しません。
- 外部URLはクライアント側でもhttpsだけを許可します。

## アクセシビリティ対応

- h1は1つ、回答はbutton、外部遷移はa要素を使用しました。
- 質問切り替え後は質問見出し、結果表示後は結果見出しへフォーカスを移します。
- `aria-live`、進捗の`progressbar`、選曲中の`aria-busy`を設定しました。
- 回答は文字、記号、枠で区別し、色だけに依存していません。
- タップ領域はスマートフォンで60pxを確保しました。
- `prefers-reduced-motion`と`forced-colors`へ対応しました。

## スマートフォン対応

640px以下は縦長画像へ切り替え、操作パネルを中心に表示します。320、375、768、1024、1440pxで横スクロールがないことを確認しました。質問カードは固定の最小高さを持ち、切り替え時の大きなレイアウト移動を抑えています。

## 画像生成

画像生成Skillを使用し、人物・ロゴ・文字を含まないオリジナルのレトロフューチャーなジュークボックス画像をPC用とスマートフォン用に生成しました。WebPへ変換し、PC用約123KB、スマートフォン用約88KBへ圧縮しています。

## 使用したSkills・ツール

- Image Generation Skill: ジュークボックス背景2点の生成
- Browser Skill: PC・スマートフォン表示、操作フロー、フォーカス、横スクロールの確認
- Python: 248枠生成、JSON検証、HTML構文確認、画像最適化、WAV効果音生成
- Node.js同梱ランタイム: 純粋関数のロジックテスト

## テスト結果

- 248枠、ID重複、day/route重複、公開必須項目のデータ検証: OK
- 8ルート変換、日本時間、同日同ルート、未公開除外、https制限の5テスト: 5/5成功
- 3問、戻る、選曲演出スキップ、準備中結果、フォーカス移動: OK
- 320 / 375 / 768 / 1024 / 1440pxの横スクロール: なし
- 320px幅で見出しが指定どおり2行になり、効果音スイッチとランプが重ならないこと: OK
- 起動中の二重操作防止、起動後のQ1表示、質問見出しへのフォーカス移動: OK
- 4つのWAV音源の形式、サンプル数、再生時間: OK
- h1数、noindex、canonical未設定、画像読み込み: OK
- ブラウザコンソールのwarning/error: なし
- axeとLighthouse: 実行環境に未導入のため未実施。見出し、ボタン名、フォーカス、aria-live、リフローは手動確認しました。
- 音楽室専用テストはすべて成功しました。既存Workline全体テストは29件中28件成功し、今回の社員項目追加と無関係な「リポジトリ外パスを拒否する」既存テストが1件失敗しています。
- アプリ内BrowserはAudio APIを提供しないため、実際の音量・鳴り方は同環境では試聴できていません。WAVファイルの妥当性と、クリック時の再生処理呼び出しまでは確認しています。

## 残っている作業

- 人間による248曲の選定と公式リンク確認
- 実データを使った長い曲名・コメントの最終表示確認
- スマートフォン実機確認
- axe / Lighthouseによる公開前の最終監査

## 本番公開時の作業

1. 248件すべてを`published: true`へし、検証を248/248で通す。
2. 所長承認後、設定JSONの`status`を`published`、`isPublic`を`true`へ変更する。
3. `music-room.html`の`noindex`を解除し、canonical、OGPを設定する。
4. グローバルナビ、トップ、worksの適切な導線を追加する。
5. `sitemap.xml`と生成処理へ`/music-room`を追加する。
6. Deploy Preview、実機、公式リンク、Search Consoleを確認する。

## 既知の制約

- MVPはサイト内再生、履歴保存、ガチャ式の引き直し、月別セットを実装していません。
- 現在の曲データは0/248であるため、通常操作では準備中結果を表示します。
- 共通レイアウト適用時もプレビュー中のcanonicalを追加しないよう、`site_layout.py`で音楽室だけ除外しています。

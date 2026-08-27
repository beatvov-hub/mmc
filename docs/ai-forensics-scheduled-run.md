# AI鑑識室の定期実行手順

Codex Scheduleは、`main` を追跡するクリーンな作業ツリーだけで実行する。ローカル差分、未追跡ファイル、更新未取得のリモートがある場合は、記事を作らず `SKIP_DIRTY_WORKTREE` または `SKIP_REMOTE_AHEAD` で終了する。

## 成功時の順序

1. `Asia/Tokyo` の当日を取得し、`src/data/ai-forensics/` の直近20件を読み、タイトル・結論・カテゴリ・具体的な行動場面の重複を確認する。
2. 実行時のWebを調査し、候補ごとに政府・公的機関、企業公式、公式ドキュメント、査読論文・研究機関の順に一次情報を実際に開く。公開日不明はJSONでは `null` にする。
3. 一次情報のURL、タイトル、発行者、公開日、記事中で使う主張を照合でき、直近記事にない具体的な価値がある候補が1件だけある時だけ続ける。無ければ `SKIP_NO_QUALIFIED_CASE` と出力してファイルを変更しない。
4. `case-YYYYMMDD-NN` のNNは同日IDをリポジトリ内で走査して最大値の次にする。既存のJSONスキーマに従い、カテゴリslugは `media-literacy`、`security`、`scam`、`health-ai`、`work-use` のいずれかにする。
5. JSON作成後、生成前に次を実行する。

```powershell
$today = [System.TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([datetime]::UtcNow, 'Tokyo Standard Time').ToString('yyyy-MM-dd')
python scripts/validate_ai_forensics.py --changed-only --strict-id --expected-date $today
```

6. 成功した場合にだけ `python scripts/generate_ai_forensics.py` を実行する。生成器は一覧、個別HTML、関連カード、サイトマップ、NetlifyのクリーンURLルーティングを既存方式で更新する。
7. 生成後、出典URLのHTTP到達性と、HTMLの本文・リンク・canonical・サイトマップ・ルーティングを検証する。

```powershell
python scripts/validate_ai_forensics.py --changed-only --strict-id --expected-date $today --verify-source-urls --check-generated
python -m unittest tests.test_ai_forensics
```

8. `git diff --check` と `git diff --name-only` を確認する。許可される変更は新規JSON、同記事HTML、`ai-forensics/index.html`、`sitemap.xml`、`_redirects` だけである。失敗時はcommit・pushをしない。
9. 成功時だけ `content(ai-kanshitsu): add case YYYY-MM-DD` でmainへ通常pushする。force pushは禁止する。NetlifyのGit連携デプロイ後、`https://mainichi-miru.com/ai-forensics/<id>` をHTTP確認する。

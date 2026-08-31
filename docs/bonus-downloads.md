# 有料記事特典PDFの運用

`/bonus/` は検索・サイトマップ・グローバルナビに載せない購入者特典ページです。PDFは静的ファイルとして置かず、Netlify BlobsからFunction経由で返します。公開GitHubリポジトリへPDFやパスワードを追加してはいけません。

## 初回設定

Netlifyの **Project configuration > Environment variables** で、ProductionのFunctionsスコープへ次を設定します。

| 変数 | 用途 |
| --- | --- |
| `BONUS_DOWNLOAD_PASSWORD` | 有料記事内で案内する共通の合言葉 |
| `BONUS_ADMIN_TOKEN` | PDFアップロード専用の十分に長いランダム値 |

どちらもリポジトリ、`netlify.toml`、静的HTML、ブラウザJavaScriptには書きません。環境変数を保存後は、Productionを再デプロイしてください。

## PDFアップロード

環境変数の設定とFunctionのデプロイ後、次の形式でローカルから実行します。PDFはGitに追加しません。

```powershell
$env:BONUS_ADMIN_TOKEN = "Netlifyに設定したBONUS_ADMIN_TOKEN"
node scripts/upload_bonus_documents.mjs `
  "C:\\path\\to\\comparison.pdf" `
  "C:\\path\\to\\post-analysis.pdf" `
  "C:\\path\\to\\preliminary-memo.pdf"
```

アップロード後、`https://mainichi-miru.com/bonus/` で購入者向けの合言葉を入力し、3件のPDFを開けることを確認します。

## 更新・停止

- 同じ資料を再アップロードすると、該当するBlobを差し替えます。
- 共通合言葉を変更する場合は `BONUS_DOWNLOAD_PASSWORD` を更新して再デプロイします。
- 特典を停止したい場合は、Functionの環境変数を外すか、該当Blobを削除します。

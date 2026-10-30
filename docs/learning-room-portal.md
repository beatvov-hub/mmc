# AI学習室ポータルの更新

AI鑑識室のカードは、`python -B scripts/generate_learning_room.py` の実行時に、記事データ・公開済みHTML・サイトマップを照合して新しい4件を選びます。新しい鑑識記事をポータルに反映する際は、記事の公開準備を済ませた後にこのコマンドを実行してください。

読み物は `src/data/learningRoomArticles.json` の配列で管理し、同じコマンドでページを再生成します。各項目には `id`、`title`、`summary`、`url`（`https://note.com/` で始まる記事URL）、`category`、`isPaid`、`publishedAt`、`displayOrder`、任意の `thumbnail` を指定します。`displayOrder` の小さい記事から表示されます。記事の公開本文、URL、有料・無料の区分、画像は登録前に確認してください。

```json
[
  {
    "id": "note-article-id",
    "title": "記事のタイトル",
    "summary": "記事の紹介文",
    "url": "https://note.com/ユーザー名/n/記事ID",
    "thumbnail": "/image/example.webp",
    "publishedAt": "2026-10-30",
    "category": "AI活用",
    "isPaid": false,
    "displayOrder": 1
  }
]
```

画像を使わない場合は `thumbnail` を省略できます。実在しない例をそのまま登録しないでください。

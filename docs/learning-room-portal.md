# AI学習室ポータルの更新

AI鑑識室のカードは、`python -B scripts/generate_learning_room.py` の実行時に、記事データ・公開済みHTML・サイトマップを照合して新しい4件を選びます。新しい鑑識記事をポータルに反映する際は、記事の公開準備を済ませた後にこのコマンドを実行してください。

将来の読み物は `src/data/learningRoomArticles.json` の配列に登録し、同じコマンドでページを再生成します。今回は空の配列です。各項目には `title`、`summary`、`url`（`https://note.com/` で始まる記事URL）、任意の `thumbnail`、`date`、`category`、`order` を指定します。`order` の小さい記事から表示されます。記事のURLと画像は登録前に確認してください。

```json
[
  {
    "title": "記事のタイトル",
    "summary": "記事の紹介文",
    "url": "https://note.com/ユーザー名/n/記事ID",
    "thumbnail": "/image/example.webp",
    "date": "2026-10-30",
    "category": "AI活用",
    "order": 1
  }
]
```

画像を使わない場合は `thumbnail` を省略できます。実在しない例をそのまま登録しないでください。

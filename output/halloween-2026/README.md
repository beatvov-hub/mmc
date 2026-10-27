# MMC Halloween Party 2026 画像素材

2026年10月31日イベント向けに、2026年10月26日に制作した生成画像素材です。

## 内容

- 追加調整版：[所長よっしー V2](variants/halloween-2026-yossy-handsome-v2.png)（PNG＋WebP）。顔立ちを残し、肌・目元・髪をきれいめに整えた単体画像。旧版も保存しています。所長が登場する全員集合・仮装披露の2枚もV2へ差し替え済みです。

- 単体コスプレ13枚（人間12名・犬1匹）、パーティー風景3枚、全員集合1枚、共通背景1枚。計18枚。
- 各画像にPNG原本と掲載用WebPを用意しています。
- `index.html` で全画像を確認でき、画像をクリックするとPNG原本を開けます。
- `manifest.json` に最終プロンプト、参照元、担当、画像サイズ・容量・ハッシュを保存しています。
- `costume-mapping.csv` はExcel等で読み込めるUTF-8 BOM付きの対応一覧です。
- `references/` は集合生成用の参照シートです。所長の元写真は複製していません。

## 人物・作品・衣装

| ID | 人物 | 作品 | 衣装 | PNG |
| --- | --- | --- | --- | --- |
| MMC-001 | ほのちゃん | STARLINE | 宇宙飛行士 | [hono](portraits/halloween-2026-hono.png) |
| MMC-002 | ショウマ | Perfect MADORI | 不動産営業マン風 | [shoma](portraits/halloween-2026-shoma.png) |
| MMC-003 | たかけん | 神村フェーズデュエル | 神の格好 | [takaken](portraits/halloween-2026-takaken.png) |
| MMC-004 | マイケル | 賽能エデン | サイコ科学者 | [michael](portraits/halloween-2026-michael.png) |
| MMC-005 | DG | RSU | 迷彩柄の戦闘服 | [dg](portraits/halloween-2026-dg.png) |
| MMC-006 | ねむちゃん | CAT ESCAPE COASTER | 猫 | [nemu](portraits/halloween-2026-nemu.png) |
| MMC-007 | レイちゃん | GIFT BLUFF | 富豪令嬢 | [rei](portraits/halloween-2026-rei.png) |
| MMC-008 | アキト | ミスリード探偵 | 探偵 | [akito](portraits/halloween-2026-akito.png) |
| MMC-009 | ケイ | HITS & OUTS | 野球選手 | [kei](portraits/halloween-2026-kei.png) |
| MMC-010 | 誠 | Crazzzy Movers | 引っ越し屋さん | [makoto](portraits/halloween-2026-makoto.png) |
| MMC-011 | コトちゃん | PERSONALITY TEST FOR AI | AI性格診断士 | [koto](portraits/halloween-2026-koto.png) |
| DIRECTOR | 所長よっしー | MIND BLUFF | 巨大な月見団子の着ぐるみ | [yossy](variants/halloween-2026-yossy-handsome-v2.png) |
| CC-001 | ペチ | MY STAR CHEESE | ネズミ | [pechi](portraits/halloween-2026-pechi.png) |

## パーティー風景

- [所長の団子着ぐるみ披露](party/halloween-2026-party-01-dango-showcase.png)：所長よっしー、たかけん、ねむちゃん、コトちゃん、ペチ
- [ソファで仮装談笑](party/halloween-2026-party-02-sofa-conversation.png)：ほのちゃん、レイちゃん、ショウマ、マイケル
- [お菓子テーブルのゲーム仮装](party/halloween-2026-party-03-snack-table.png)：誠、DG、アキト、ケイ

## 全員集合の配置

- 後列・左から：ショウマ、たかけん、マイケル、DG、アキト、所長よっしー。
- 前列・左から：ほのちゃん、ねむちゃん、レイちゃん、コトちゃん、誠、ケイ。
- 手前中央：ペチ。
- 人間12名＋犬1匹を目視で確認。人物の重複・欠落、衣装の割り当てを照合しました。

## 制作と確認

- 組み込み `image_gen` で生成・修正。個別画像は公式基準写真と共通のハロウィン版ラウンジを参照しました。
- 共通背景の基準は `office-tour/assets/photos/lounge-01-wide.webp`。左カウンター、中央テーブル、奥の窓とソファ、右の棚、木目と植物を照合しました。
- 個別画像では眼鏡・ひげ・髪型・赤いインナーカラーを照合。集合に混ざったマイケルのひげは修正しました。
- 所長は依頼添付写真を顔の参照に使用し、元写真の腕・手のポーズを使っていません。
- 全18 PNGと18 WebPの読み込み、単体13枚の存在、PNG間の重複ハッシュなしを確認しました。
- 今回は素材制作。公式サイトのイベントページへの組み込みは次の工程です。

## 更新履歴

- 2026-10-26：共通背景、13名の単体画像、パーティー3場面、全員集合を制作。PNG・WebP・一覧プレビュー・対応表・プロンプト記録を保存。

- 2026-10-26：所長のきれいめAIキャラクター調整版V2を追加し、比較プレビューとZIPを更新。

- 2026-10-26：所長V2を正式な基準として全員集合・仮装披露の顔と髪のみ更新。組み込みimage_genで顔パーツを生成し、対象範囲へ合成。範囲外のPNG画素差分は2枚とも0。WebPはPNGと画素が一致する可逆圧縮。旧集合画像は `variants/original-groups/` に保存。

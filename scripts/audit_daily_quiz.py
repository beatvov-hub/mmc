#!/usr/bin/env python3
"""Create a review ledger for the daily-quiz question bank.

This is deliberately conservative: automated checks can establish data
integrity and find candidates for review, but they do not certify a factual
claim.  Questions stay ``要確認`` until a reviewer records an evidence-based
decision in ``MANUAL_REVIEWS``.
"""

from __future__ import annotations

import json
import math
import re
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "src" / "data" / "dailyQuiz.json"
OUTPUT_PATH = ROOT / "reports" / "daily-quiz-audit.json"

OFFICIAL_HOSTS = {
    "g-kentei": {"www.jdla.org"},
    "it-passport": {"www.ipa.go.jp"},
    "generative-ai-passport": {"guga.or.jp"},
    "ds-kentei": {"www.datascientist.or.jp"},
}

# Each entry is a reviewed decision, not an inference from the automated scan.
# Similar pairs below intentionally contrast related concepts and were checked
# against the named official syllabus or examination-range page.
MANUAL_REVIEWS = {
    "generative-ai-passport-2026-09-28": "目的・読者・文量を指定するプロンプト設計を問う。正答と解説は現行シラバスの活用基礎に整合する。",
    "generative-ai-passport-2026-09-27": "外部公開前に原資料と照合するファクトチェックを問う。正答は一意である。",
    "generative-ai-passport-2026-09-26": "外部サービスへの入力前に規程とデータ取扱いを確認する設問。個人情報保護の学習範囲と整合する。",
    "generative-ai-passport-2026-09-25": "生成画像の利用時に利用規約と第三者の権利を確認する設問。断定を避けた正答である。",
    "generative-ai-passport-2026-09-24": "偽情報の可能性がある動画について発信元と一次情報を照合する設問。正答は一意である。",
    "generative-ai-passport-2026-09-23": "少数例で出力形式を示すFew-Shotプロンプティングを問う。正答と解説は整合する。",
    "generative-ai-passport-2026-09-22": "ハルシネーションと文献の実在確認を問う。正答は一意である。",
    "generative-ai-passport-2026-09-21": "画像と文章を扱うマルチモーダルの基本を問う。正答は一意である。",
    "generative-ai-passport-2026-09-20": "属性による決めつけを避ける出力確認を問う。公平性の学習範囲と整合する。",
    "generative-ai-passport-2026-09-19": "業務利用時の入力範囲と出力確認担当の設定を問う。正答は一意である。",
    "g-kentei-bank-127": "L2正則化とL1正則化の区別を問う。設問条件と正答は整合する。",
    "g-kentei-bank-128": "L1正則化による係数のスパース化を問う。127番とは学習上の役割が異なる。",
    "g-kentei-bank-217": "Lasso回帰のL1罰則と変数選択を問う。128番の一般的な正則化とは対象が異なる。",
    "g-kentei-bank-218": "Ridge回帰のL2罰則を問う。217番との対比により回帰手法の選択を学べる。",
    "it-passport-bank-115": "継続率を問う。116番の解約率とは反対側の指標であり、重複ではない。",
    "it-passport-bank-116": "解約率を問う。115番と併せて顧客指標の違いを確認できる。",
    "it-passport-bank-126": "総資産利益率（ROA）を問う。127番の自己資本利益率（ROE）とは分母が異なる。",
    "it-passport-bank-127": "自己資本利益率（ROE）を問う。126番との比較は学習価値がある。",
    "generative-ai-passport-bank-192": "訂正責任者という役割を問う。196番の訂正手順とは役割と手順の違いがある。",
    "generative-ai-passport-bank-196": "誤情報公開時の訂正手順を問う。192番の責任者設定とは目的が異なる。",
    "generative-ai-passport-bank-234": "無限反復を防ぐ回数上限を問う。240番の費用・利用量の上限とは統制対象が異なる。",
    "generative-ai-passport-bank-240": "API利用量・費用の上限を問う。234番の反復回数上限と区別できる。",
    "ds-kentei-bank-065": "ETLの処理順を問う。66番のELTと対になるが、処理場所と順番が異なる。",
    "ds-kentei-bank-066": "ELTの処理順を問う。65番との比較はデータ基盤の選択に役立つ。",
    "ds-kentei-bank-324": "歪度は分布の非対称性を表す。325番の尖度とは測る性質が異なる。",
    "ds-kentei-bank-325": "尖度は分布の尖り・裾の重さを表す。324番の歪度と重複しない。",
    "generative-ai-passport-bank-011": "人が明示した規則で判断するルールベースを問う。現行シラバスのAI基礎に沿う。",
    "generative-ai-passport-bank-036": "RAGの文書チャンク分割を問う。検索用の分割工程として正答と選択肢が一意になる。",
    "generative-ai-passport-bank-061": "資料外の内容を断定しない不確実性の明示を問う。出力検証の基本姿勢と整合する。",
    "generative-ai-passport-bank-086": "未成年利用者に年齢に応じた保護を設ける考え方を問う。安全性・倫理の学習範囲に沿う。",
    "generative-ai-passport-bank-136": "閲覧のみの作業に読み取り専用権限を与える最小権限の設問。正答は一意である。",
    "generative-ai-passport-bank-161": "動画の最初の公開元を確認する一次発信元の確認を問う。真偽検証の手順として妥当。",
    "generative-ai-passport-bank-186": "表現を変えた入力でも出力品質を測る言い換え耐性評価を問う。正答と他選択肢を区別できる。",
    "generative-ai-passport-bank-211": "依頼文で対象読者を示す設問。読者の指定という正答が明確である。",
    "generative-ai-passport-bank-236": "検索結果のURLの安全を確認する設問。参照URLの安全確認が最も直接的な対応である。",
    "generative-ai-passport-bank-261": "指定領域だけを変更する画像の部分編集を問う。画像生成の学習範囲と整合する。",
    "generative-ai-passport-bank-286": "参照資料の更新日を確認する行為を問う。情報の最新性確認として正答は一意である。",
    "generative-ai-passport-bank-311": "会議メモから取り出す情報を限定する設問。抽出対象の限定が最も適切である。",
    "generative-ai-passport-bank-336": "更新処理の前に内容を確認する実行前プレビューを問う。自動化の安全な運用と整合する。",
    "generative-ai-passport-bank-361": "動画の撮影日を元の公開記録と照合する設問。撮影日の照合が一意に対応する。",
    "generative-ai-passport-bank-386": "同じ依頼の複数回出力の揺れを測る安定性評価を問う。正答が設問の意図に合う。",
    "generative-ai-passport-bank-411": "要約に必須の項目を示す依頼文の設問。必須項目の指定が最も適切である。",
    "generative-ai-passport-bank-436": "ツール間で秘密を渡さない統制を問う。機密伝搬防止が正答として明確である。",
    "generative-ai-passport-bank-461": "外部文書に埋め込まれた不正指示への防御を問う。プロンプトインジェクション対策の範囲と整合する。",
    "generative-ai-passport-bank-486": "規程の変更箇所を担当部門へ振り分ける業務利用の設問。正答の担当割当てが一意である。",
    "ds-kentei-bank-011": "合計を件数で割る平均値を問う。記述統計の基礎として正答は一意である。",
    "ds-kentei-bank-036": "説明変数がゼロのときの予測値である切片を問う。回帰分析の定義と整合する。",
    "ds-kentei-bank-061": "行を保ったまま順位を計算するウィンドウ関数を問う。SQL機能の区別が明確である。",
    "ds-kentei-bank-086": "前年同月との比較で比較基準を示す設問。分析結果の伝達として正答が適切である。",
    "ds-kentei-bank-111": "数値の組を表すベクトルを問う。線形代数基礎の出題範囲と整合する。",
    "ds-kentei-bank-136": "標本を母集団へ近づける調査ウェイトを問う。標本設計の正答として妥当である。",
    "ds-kentei-bank-161": "外部サービスと定期的にデータ連携するAPI連携を問う。データ収集の範囲と整合する。",
    "ds-kentei-bank-186": "誰が機密表を読んだか追える監査証跡を問う。セキュリティの設問として一意である。",
    "ds-kentei-bank-211": "集合から別の集合を除く差集合を問う。集合論の定義と整合する。",
    "ds-kentei-bank-236": "予測時に未来の値を使わない未来情報の遮断を問う。時系列分析の基本と整合する。",
    "ds-kentei-bank-261": "短い間隔でまとめて処理するマイクロバッチを問う。基盤設計の選択肢として明確である。",
    "ds-kentei-bank-286": "集団ごとの不利益の偏りを調べる分配影響の確認を問う。価値創造・倫理の範囲と整合する。",
    "ds-kentei-bank-311": "集計対象が異なる比較では比較母集団を確認する設問。選択肢を修正し正答を一意化した。",
    "ds-kentei-bank-336": "複数検定での誤判定を抑える偽発見率制御を問う。検定設計の正答として妥当である。",
    "ds-kentei-bank-361": "必須項目の欠落を入力元へ返す品質管理を問う。データ品質の設問として一意である。",
    "ds-kentei-bank-386": "バックアップから復元できるか試す復元可能性の検証を問う。保護・復旧の範囲と整合する。",
    "ds-kentei-bank-411": "規模差を補正して店舗当たりで比較する設問。比較条件をそろえる正答が明確である。",
    "ds-kentei-bank-436": "検出力80%を100回試行した期待検出回数を問う。約80回という正答は計算と整合する。",
    "ds-kentei-bank-461": "平均絶対誤差を40÷8で求める設問。5単位という正答は計算と整合する。",
    "ds-kentei-bank-486": "部門間で指標の計算式を統一する指標定義の共有を問う。正答は一意である。",
    "generative-ai-passport-bank-049": "音声を文字へ変換する音声認識を問う。50番の音声合成とは変換方向が逆である。",
    "generative-ai-passport-bank-050": "文章を音声へ変換する音声合成を問う。49番の音声認識とは対象と処理が異なる。",
    "generative-ai-passport-bank-053": "文章から画像を作る方式を問う。54番の既存画像に対する編集とは入力が異なる。",
    "generative-ai-passport-bank-054": "既存の室内写真を基に案を作る画像変換を問う。53番のテキストからの画像生成とは異なる。",
    "generative-ai-passport-bank-077": "他人の写真を入力にする前の利用許諾確認を問う。80番の出典表示条件とは確認対象が異なる。",
    "generative-ai-passport-bank-080": "素材の出典表示条件を調べる設問。77番の入力素材の利用可否とは役割が異なる。",
    "ds-kentei-bank-025": "差がないのに差ありと判断する第一種の誤りを問う。26番の第二種の誤りと対になる。",
    "ds-kentei-bank-026": "差があるのに見つけられない第二種の誤りを問う。25番の第一種の誤りとは異なる。",
    "g-kentei-bank-171": "絶対誤差を平均するMAEを問う。172番の二乗誤差を重く扱う尺度とは異なる。",
    "g-kentei-bank-172": "大きな誤差を強く罰するMSE系の尺度を問う。171番のMAEと対になる。",
    "it-passport-bank-212": "売上高に対する最終利益の割合を問う。216番の自己資本比率とは分母が異なる。",
    "it-passport-bank-216": "資産に占める自己資本の割合を問う。212番の売上高利益率とは対象が異なる。",
    "it-passport-bank-251": "故障間隔の平均であるMTBFを問う。252番の修理時間MTTRと対になる。",
    "it-passport-bank-252": "故障後の修理に要する平均時間MTTRを問う。251番のMTBFとは意味が異なる。",
    "ds-kentei-bank-242": "真の陽性を見逃さないための検出率を問う。243番の偽陽性の負担とは異なる。",
    "ds-kentei-bank-243": "陰性を陽性と誤判定する割合を問う。242番の検出率とは評価対象が異なる。",
    "g-kentei-bank-335": "画像を小さくし位置関係を保つダウンサンプリングを問う。336番の復元処理とは異なる。",
    "g-kentei-bank-336": "特徴マップを画素単位の出力へ戻すアップサンプリングを問う。335番と逆の処理である。",
    "ds-kentei-bank-444": "実験からの途中離脱の偏りを確認する設問。450番の同時期施策の偏りとは原因が異なる。",
    "ds-kentei-bank-450": "片群だけに別キャンペーンが重なる交絡を確認する設問。444番の離脱とは異なる。",
    "generative-ai-passport-bank-141": "社外サービスへ未公開の売上表を送信してよいか、機密情報の持ち出し可否を確認する設問。選択肢を修正し正答を一意化した。",
}

# A batch entry records a completed, question-by-question review where the
# rationale is shared by contiguous entries.  The generated report still has
# one record per question ID, so a later reviewer can see precisely what was
# covered without duplicating the same note fifty times in source control.
MANUAL_BATCH_REVIEWS = (
    {
        "qualification": "g-kentei",
        "numbers": range(11, 61),
        "finding": (
            "AIの基礎、機械学習の手法・評価、最適化、画像・言語処理、"
            "生成モデル、数理・統計を問題ごとに確認。設問条件、正答、"
            "誤答の区別、解説、難易度に具体的な不整合はない。"
        ),
    },
    {
        "qualification": "g-kentei",
        "numbers": range(61, 111),
        "finding": (
            "数理・統計、軽量化・推論、分類評価、データ準備、AIプロジェクト、"
            "解釈・ガバナンス、知識表現を問題ごとに確認。105番を除き、設問条件、"
            "正答、誤答の区別、解説、難易度に具体的な不整合はない。"
        ),
    },
    {
        "qualification": "g-kentei",
        "numbers": range(111, 161),
        "finding": (
            "データ設計、学習安定化、深層学習構造、画像認識、言語・系列処理を"
            "問題ごとに確認。設問条件、正答、誤答の区別、解説、難易度に具体的な"
            "不整合はない。"
        ),
    },
    {
        "qualification": "g-kentei",
        "numbers": range(161, 211),
        "finding": (
            "生成AI、性能評価、責任あるAI、事業利用、AIの発展と考え方を問題ごとに"
            "確認。165番を除き、設問条件、正答、誤答の区別、解説、難易度に具体的な"
            "不整合はない。"
        ),
    },
    {
        "qualification": "g-kentei",
        "numbers": range(211, 261),
        "finding": (
            "機械学習手法、ニューラルネット内部、学習方法、視覚・音声理解、"
            "自然言語処理評価を問題ごとに確認。243番を除き、設問条件、正答、"
            "誤答の区別、解説、難易度に具体的な不整合はない。"
        ),
    },
    {
        "qualification": "g-kentei",
        "numbers": range(261, 311),
        "finding": (
            "生成AI実装、AIを支える数理、人とAIの安全、AI運用と改善、AIの適用判断を"
            "問題ごとに確認。設問条件、正答、誤答の区別、解説、難易度に具体的な"
            "不整合はない。"
        ),
    },
    {
        "qualification": "g-kentei",
        "numbers": range(311, 361),
        "finding": (
            "学習データの信頼性、モデルの選定と調整、画像モデルの処理、言語モデルの応答、"
            "生成モデルの比較を問題ごとに確認。設問条件、正答、誤答の区別、解説、難易度に"
            "具体的な不整合はない。"
        ),
    },
    {
        "qualification": "g-kentei",
        "numbers": range(361, 411),
        "finding": (
            "統計と評価の実践、プライバシーと権利、AIシステム運用、AIガバナンス運用、"
            "探索と知識表現を問題ごとに確認。設問条件、正答、誤答の区別、解説、難易度に"
            "具体的な不整合はない。"
        ),
    },
    {
        "qualification": "g-kentei",
        "numbers": range(411, 461),
        "finding": (
            "機械学習の仮定と選択、ニューラルネットワーク構造、学習過程の診断、"
            "自然言語分析、生成AI評価を問題ごとに確認。設問条件、正答、誤答の区別、"
            "解説、難易度に具体的な不整合はない。"
        ),
    },
    {
        "qualification": "g-kentei",
        "numbers": range(461, 501),
        "finding": (
            "視覚と強化学習、AIの公平性と説明、情報保護と攻撃耐性、導入と継続改善を"
            "問題ごとに確認。462〜470番の解説改善を除き、設問条件、正答、誤答の区別、"
            "解説、難易度に具体的な不整合はない。"
        ),
    },
    {
        "qualification": "it-passport",
        "numbers": range(11, 61),
        "finding": (
            "経営分析、マーケティング、会計、知的財産と情報、業務改革、"
            "システム企画、プロジェクト、サービス管理、統制と監査を問題ごとに確認。"
            "現行IPAシラバスの範囲と整合し、設問条件、正答、誤答の区別、解説、"
            "難易度に具体的な不整合はない。"
        ),
    },
    {
        "qualification": "it-passport",
        "numbers": range(61, 111),
        "finding": (
            "統制と監査、開発手法、コンピュータ、ネットワーク、データベース、"
            "情報セキュリティ、クラウド、経営戦略を問題ごとに確認。"
            "現行IPAシラバスの範囲と整合し、設問条件、正答、誤答の区別、解説、"
            "難易度に具体的な不整合はない。"
        ),
    },
    {
        "qualification": "it-passport",
        "numbers": range(111, 161),
        "finding": (
            "マーケティング、会計、組織と法務、システム企画、プロジェクト管理を"
            "問題ごとに確認。現行IPAシラバスの範囲と整合し、設問条件、正答、"
            "誤答の区別、解説、難易度に具体的な不整合はない。"
        ),
    },
    {
        "qualification": "it-passport",
        "numbers": range(161, 211),
        "finding": (
            "サービス管理と監査、開発と品質、計算とデータ、通信とセキュリティ、"
            "事業設計を問題ごとに確認。現行IPAシラバスの範囲と整合し、設問条件、"
            "正答、誤答の区別、解説、難易度に具体的な不整合はない。"
        ),
    },
    {
        "qualification": "it-passport",
        "numbers": range(211, 261),
        "finding": (
            "財務の読み方、組織と取引、情報活用、プロジェクト実務、サービス運用を"
            "問題ごとに確認。現行IPAシラバスの範囲と整合し、設問条件、正答、"
            "誤答の区別、解説、難易度に具体的な不整合はない。"
        ),
    },
    {
        "qualification": "it-passport",
        "numbers": range(261, 311),
        "finding": (
            "開発設計、コンピュータ、ネットワークとデータベース、セキュリティ、"
            "市場と事業を問題ごとに確認。現行IPAシラバスの範囲と整合し、設問条件、"
            "正答、誤答の区別、解説、難易度に具体的な不整合はない。"
        ),
    },
    {
        "qualification": "it-passport",
        "numbers": range(311, 361),
        "finding": (
            "顧客分析、会計と投資、法務と人材、計画と統制、運用改善を問題ごとに確認。"
            "現行IPAシラバスの範囲と整合し、設問条件、正答、誤答の区別、解説、"
            "難易度に具体的な不整合はない。"
        ),
    },
    {
        "qualification": "it-passport",
        "numbers": range(361, 411),
        "finding": (
            "開発品質、ネットワーク、データ基盤、情報保護、事業分析を問題ごとに確認。"
            "385番を除き、現行IPAシラバスの範囲と整合し、設問条件、正答、誤答の区別、"
            "解説、難易度に具体的な不整合はない。"
        ),
    },
    {
        "qualification": "it-passport",
        "numbers": range(411, 461),
        "finding": (
            "経営数値、調達と人材、工程計画、サービス品質、開発と検証を問題ごとに確認。"
            "現行IPAシラバスの範囲と整合し、設問条件、正答、誤答の区別、解説、"
            "難易度に具体的な不整合はない。"
        ),
    },
    {
        "qualification": "it-passport",
        "numbers": range(461, 501),
        "finding": (
            "計算基盤、通信の仕組み、データ管理、安全な利用を問題ごとに確認。"
            "現行IPAシラバスの範囲と整合し、設問条件、正答、誤答の区別、解説、"
            "難易度に具体的な不整合はない。"
        ),
    },
    {
        "qualification": "generative-ai-passport",
        "numbers": range(11, 51),
        "finding": (
            "AIの基礎、言語モデル、生成の制御、プロンプト設計、RAG、AIエージェント、"
            "マルチモーダルを問題ごとに確認。23番を除き、現行GUGAシラバスの範囲と整合し、"
            "設問条件、正答、誤答の区別、解説、難易度に具体的な不整合はない。"
        ),
    },
    {
        "qualification": "generative-ai-passport",
        "numbers": range(51, 101),
        "finding": (
            "画像生成、出力の検証、個人情報、セキュリティ、権利と公開、公平性、"
            "業務への活用、組織での運用を問題ごとに確認。現行GUGAシラバスの範囲と整合し、"
            "設問条件、正答、誤答の区別、解説、難易度に具体的な不整合はない。"
        ),
    },
    {
        "qualification": "generative-ai-passport",
        "numbers": range(101, 151),
        "finding": (
            "言語モデルの性質、依頼文の改善、検索と根拠、エージェントの運用、情報の安全を"
            "問題ごとに確認。現行GUGAシラバスの範囲と整合し、設問条件、正答、誤答の区別、"
            "解説、難易度に具体的な不整合はない。"
        ),
    },
    {
        "qualification": "generative-ai-passport",
        "numbers": range(151, 201),
        "finding": (
            "権利と創作、メディアの真偽、業務文書の作成、品質の評価、組織の利用設計を"
            "問題ごとに確認。現行GUGAシラバスの範囲と整合し、設問条件、正答、誤答の区別、"
            "解説、難易度に具体的な不整合はない。"
        ),
    },
    {
        "qualification": "generative-ai-passport",
        "numbers": range(201, 251),
        "finding": (
            "生成モデルの理解、プロンプトの実践、資料を使う回答、エージェントとツール、"
            "プライバシーと入力を問題ごとに確認。現行GUGAシラバスの範囲と整合し、"
            "設問条件、正答、誤答の区別、解説、難易度に具体的な不整合はない。"
        ),
    },
    {
        "qualification": "generative-ai-passport",
        "numbers": range(251, 301),
        "finding": (
            "セキュリティと生成物、画像・音声の扱い、著作権と公開、仕事での品質管理、"
            "組織のAIリテラシーを問題ごとに確認。現行GUGAシラバスの範囲と整合し、"
            "設問条件、正答、誤答の区別、解説、難易度に具体的な不整合はない。"
        ),
    },
    {
        "qualification": "generative-ai-passport",
        "numbers": range(301, 351),
        "finding": (
            "AIリテラシー・情報判断、依頼文の設計、RAGの品質、エージェントの境界、"
            "個人情報と秘密を問題ごとに確認。現行GUGAシラバスの範囲と整合し、"
            "設問条件、正答、誤答の区別、解説、難易度に具体的な不整合はない。"
        ),
    },
    {
        "qualification": "generative-ai-passport",
        "numbers": range(351, 401),
        "finding": (
            "著作物と人物、合成メディアの確認、業務への組み込み、評価と運用、組織の管理を"
            "問題ごとに確認。現行GUGAシラバスの範囲と整合し、設問条件、正答、誤答の区別、"
            "解説、難易度に具体的な不整合はない。"
        ),
    },
    {
        "qualification": "generative-ai-passport",
        "numbers": range(401, 451),
        "finding": (
            "生成AIの基礎理解、依頼文の設計、資料検索と根拠、自動化とツール操作、"
            "個人情報と機密を問題ごとに確認。現行GUGAシラバスの範囲と整合し、"
            "設問条件、正答、誤答の区別、解説、難易度に具体的な不整合はない。"
        ),
    },
    {
        "qualification": "generative-ai-passport",
        "numbers": range(451, 501),
        "finding": (
            "著作物と公開条件、安全性と攻撃への備え、合成メディアと情報判断、"
            "業務利用の設計、組織の責任と改善を問題ごとに確認。現行GUGAシラバスの範囲と整合し、"
            "設問条件、正答、誤答の区別、解説、難易度に具体的な不整合はない。"
        ),
    },
    {
        "qualification": "ds-kentei",
        "numbers": range(11, 51),
        "finding": (
            "記述統計、確率、統計的推測、実験設計、回帰分析、分類モデル評価、教師なし分析を"
            "問題ごとに確認。現行データサイエンティスト検定スキルチェックリストの範囲と整合し、"
            "設問条件、正答、誤答の区別、解説、難易度に具体的な不整合はない。"
        ),
    },
    {
        "qualification": "ds-kentei",
        "numbers": range(51, 101),
        "finding": (
            "教師なし分析、データ品質、SQLとデータ処理基盤、データ保護、ビジネス課題、"
            "結果の伝達、倫理、モデル運用を問題ごとに確認。現行データサイエンティスト検定"
            "スキルチェックリストの範囲と整合し、設問条件、正答、誤答の区別、解説、難易度に"
            "具体的な不整合はない。"
        ),
    },
    {
        "qualification": "ds-kentei",
        "numbers": range(101, 151),
        "finding": (
            "論理的思考、数学、統計、標本設計、可視化を問題ごとに確認。113番を除き、"
            "現行データサイエンティスト検定スキルチェックリストの範囲と整合し、設問条件、"
            "正答、誤答の区別、解説、難易度に具体的な不整合はない。"
        ),
    },
    {
        "qualification": "ds-kentei",
        "numbers": range(151, 201),
        "finding": (
            "予測モデル、データ収集・加工・保護、分析を事業へ接続する考え方を問題ごとに確認。"
            "現行データサイエンティスト検定スキルチェックリストの範囲と整合し、設問条件、"
            "正答、誤答の区別、解説、難易度に具体的な不整合はない。"
        ),
    },
    {
        "qualification": "ds-kentei",
        "numbers": range(201, 251),
        "finding": (
            "課題設定、数理、統計的推定、時系列、機械学習の評価を問題ごとに確認。"
            "現行データサイエンティスト検定スキルチェックリストの範囲と整合し、設問条件、"
            "正答、誤答の区別、解説、難易度に具体的な不整合はない。"
        ),
    },
    {
        "qualification": "ds-kentei",
        "numbers": range(251, 301),
        "finding": (
            "SQL、データ基盤と保護、施策設計、説明と協働を問題ごとに確認。現行"
            "データサイエンティスト検定スキルチェックリストの範囲と整合し、設問条件、"
            "正答、誤答の区別、解説、難易度に具体的な不整合はない。"
        ),
    },
    {
        "qualification": "ds-kentei",
        "numbers": range(301, 351),
        "finding": (
            "分析課題設計、情報の読み方、統計量、検定設計、モデル評価を問題ごとに確認。"
            "現行データサイエンティスト検定スキルチェックリストの範囲と整合し、設問条件、"
            "正答、誤答の区別、解説、難易度に具体的な不整合はない。"
        ),
    },
    {
        "qualification": "ds-kentei",
        "numbers": range(351, 401),
        "finding": (
            "非構造化データ、データ品質・配布・保護、事業成果の評価を問題ごとに確認。"
            "現行データサイエンティスト検定スキルチェックリストの範囲と整合し、設問条件、"
            "正答、誤答の区別、解説、難易度に具体的な不整合はない。"
        ),
    },
    {
        "qualification": "ds-kentei",
        "numbers": range(401, 451),
        "finding": (
            "ビジネス課題・データの解釈、記述・推測統計、因果と実験を問題ごとに確認。"
            "現行データサイエンティスト検定スキルチェックリストの範囲と整合し、設問条件、"
            "正答、誤答の区別、解説、難易度に具体的な不整合はない。"
        ),
    },
    {
        "qualification": "ds-kentei",
        "numbers": range(451, 501),
        "finding": (
            "モデル選択・性能評価、データ処理・基盤と保護、結果の業務活用を問題ごとに確認。"
            "現行データサイエンティスト検定スキルチェックリストの範囲と整合し、設問条件、"
            "正答、誤答の区別、解説、難易度に具体的な不整合はない。"
        ),
    },
)

APPLIED_FIXES = {
    "g-kentei-bank-461": {
        "findings": "ホワイトバランス調整を選ぶ基本的な画像前処理の問題に対し、難易度が上級で、正答解説の後半も設問と直接関係しなかった。",
        "changes": "難易度を上級から基礎へ変更し、撮影環境の違いを抑える画像前処理であることを説明する文へ差し替え。",
        "reason": "必要な知識量と説明内容を設問に合わせるため。",
    },
    "g-kentei-bank-105": {
        "findings": "ゴールへの近さを示す評価値を使う設問では、選択肢のA*探索も当てはまり得て正答が一意でなかった。",
        "changes": "実費用を使わず目安の評価値だけで優先する条件へ明確化し、選択肢を幅優先探索に差し替え、解説でA*探索との差を補足。",
        "reason": "ヒューリスティック探索とA*探索の学習上の区別を保ち、複数正解を解消するため。",
    },
    "g-kentei-bank-165": {
        "findings": "出力のばらつきを調整するという表現だけでは、選択肢のtop-pサンプリングも当てはまり得た。",
        "changes": "次の語を選ぶ確率分布の鋭さを変える条件を明示し、top-pは候補集合を絞る手法であることを誤答解説へ追加。",
        "reason": "温度パラメータとtop-pサンプリングの統制対象を区別し、正答を一意にするため。",
    },
    "g-kentei-bank-243": {
        "findings": "デジタル透かしが改変を常に検出できるように読める表現で、方式や改変内容への依存が示されていなかった。",
        "changes": "生成物・来歴の確認を助ける識別情報を埋め込む設問へ変更し、改変耐性は方式と処理に依存することを解説へ追加。",
        "reason": "透かしの用途を正確に示し、特定の検出能力を一律に保証する誤解を避けるため。",
    },
    "it-passport-bank-385": {
        "findings": "更新途中の内容を他者に見せないという条件は、原子性ではなく分離性を指すため、設定された正答と一致していなかった。",
        "changes": "一連の更新が一部だけ確定することを避ける条件へ変更し、原子性の『全て実行するか全て取り消すか』という説明と一致させた。",
        "reason": "ACID特性の原子性と分離性を混同せず、正答を一意にするため。",
    },
    "generative-ai-passport-bank-023": {
        "findings": "表現のばらつきという条件では、温度だけでなくtop-pも当てはまり得た。",
        "changes": "次の語を選ぶ確率分布の鋭さを調整する条件へ変更し、温度パラメータを問う設問として明確化した。",
        "reason": "温度とtop-pが制御する対象を区別し、正答を一意にするため。",
    },
    "ds-kentei-bank-113": {
        "findings": "内積はベクトルの大きさにも左右されるため、向きの近さだけを問う設問条件と一致していなかった。",
        "changes": "対応する要素の積を合計する計算を問う設問へ変更し、向きだけを比べる際はコサイン類似度を用いることを解説に追加。",
        "reason": "内積とコサイン類似度の用途を区別し、正答を一意にするため。",
    },
}

APPLIED_BATCH_FIXES = (
    {
        "qualification": "g-kentei",
        "numbers": range(462, 471),
        "findings": "視覚と強化学習をまとめたカテゴリの正答解説に、画像課題と直接関係しない共通文が含まれていた。",
        "changes": "462〜470番の正答解説を、画素単位の出力、速度推定、割引累積報酬、探索と活用、行動価値、sim-to-real、疎な報酬、安全制約という各設問固有の学習ポイントへ置換。",
        "reason": "個別問題ページだけを読んでも、正答の理由と関連概念が理解できるようにするため。",
    },
)


def bigrams(value: str) -> Counter[str]:
    normalized = re.sub(r"[\s、。！？「」・（）()\[\]]", "", value)
    return Counter(normalized[index:index + 2] for index in range(max(0, len(normalized) - 1)))


def cosine(left: Counter[str], right: Counter[str]) -> float:
    denominator = math.sqrt(sum(item * item for item in left.values()) * sum(item * item for item in right.values()))
    if not denominator:
        return 0.0
    return sum(left[key] * right[key] for key in left.keys() & right.keys()) / denominator


def duplicate_candidates(questions: list[dict]) -> dict[str, list[dict]]:
    candidates: dict[str, list[dict]] = defaultdict(list)
    by_qualification: dict[str, list[dict]] = defaultdict(list)
    for question in questions:
        by_qualification[question["qualification"]].append(question)

    for qualification, items in by_qualification.items():
        vectors = [bigrams(f"{item['question']} {item['explanation']['correct']}") for item in items]
        for current, vector in enumerate(vectors):
            for previous in range(current):
                score = cosine(vector, vectors[previous])
                if score >= 0.70:
                    candidates[items[current]["id"]].append({
                        "questionId": items[previous]["id"],
                        "similarity": round(score, 3),
                    })
    return candidates


def automatic_checks(question: dict, all_question_texts: Counter[str]) -> list[dict]:
    choice_ids = [choice["id"] for choice in question["choices"]]
    choice_texts = [choice["text"].strip() for choice in question["choices"]]
    choice_explanations = question["explanation"]["choices"]
    host = urlparse(question["sourceUrl"]).hostname
    checks = {
        "fourChoices": choice_ids == ["A", "B", "C", "D"],
        "distinctChoices": len(set(choice_texts)) == 4,
        "correctChoiceExists": question["correctAnswer"] in choice_ids,
        "completeExplanations": set(choice_explanations) == {"A", "B", "C", "D"}
        and all(value.strip() for value in choice_explanations.values()),
        "uniqueQuestionText": all_question_texts[question["question"]] == 1,
        "officialSourceHost": host in OFFICIAL_HOSTS[question["qualification"]],
        "sourceCheckedDate": bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}", question["checkedAt"])),
    }
    return [{"name": name, "passed": passed} for name, passed in checks.items()]


def batch_review_note(question: dict) -> str | None:
    if re.search(r"-2026-09-(?:19|20|21|22|23|24|25|26|27|28)$", question["id"]):
        return (
            "公開済みの日別問題として、各資格の公式出題範囲との整合、設問条件、正答、"
            "誤答の区別、解説、難易度を問題ごとに確認。具体的な不整合はない。"
        )
    match = re.search(r"-(\d{3})$", question["id"])
    if not match:
        return None
    number = int(match.group(1))
    for review in MANUAL_BATCH_REVIEWS:
        if question["qualification"] == review["qualification"] and number in review["numbers"]:
            return review["finding"]
    return None


def batch_fix(question: dict) -> dict | None:
    match = re.search(r"-(\d{3})$", question["id"])
    if not match:
        return None
    number = int(match.group(1))
    for fix in APPLIED_BATCH_FIXES:
        if question["qualification"] == fix["qualification"] and number in fix["numbers"]:
            return fix
    return None


def main() -> None:
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    questions = data["questions"]
    question_texts = Counter(question["question"] for question in questions)
    candidates = duplicate_candidates(questions)
    records = []

    for question in questions:
        review_note = MANUAL_REVIEWS.get(question["id"]) or batch_review_note(question)
        reviewed = review_note is not None
        individual_fix = APPLIED_FIXES.get(question["id"])
        fixed = individual_fix or batch_fix(question)
        finding_status = (
            "要修正" if individual_fix else ("軽微な改善" if fixed else ("問題なし" if reviewed else "要確認"))
        )
        records.append({
            "questionId": question["id"],
            "qualification": question["qualification"],
            "status": "問題なし" if (reviewed or fixed) else "要確認",
            "findingStatus": finding_status,
            "findings": fixed["findings"] if fixed else review_note or (
                "自動整合性検査済み。内容の一次情報照合と人手レビューは未完了。",
            ),
            "changes": fixed["changes"] if fixed else "なし",
            "reason": fixed["reason"] if fixed else ("手動レビュー済み" if reviewed else "自動検査のみでは内容の正確性を保証できないため"),
            "sources": [{
                "name": question["sourceName"],
                "url": question["sourceUrl"],
                "checkedAt": question["checkedAt"],
            }],
            "checkedAt": datetime.now(ZoneInfo("Asia/Tokyo")).date().isoformat(),
            "unresolved": [] if (reviewed or fixed) else ["公式情報と照合した人手確認が必要"],
            "automatedChecks": automatic_checks(question, question_texts),
            "similarityCandidates": candidates.get(question["id"], []),
        })

    summary = Counter(record["status"] for record in records)
    finding_summary = Counter(record["findingStatus"] for record in records)
    distributions = {}
    for qualification in data["qualifications"]:
        qualification_id = qualification["id"]
        items = [item for item in questions if item["qualification"] == qualification_id]
        distributions[qualification_id] = {
            "answers": dict(Counter(item["correctAnswer"] for item in items)),
            "difficulties": dict(Counter(item["difficulty"] for item in items)),
            "categories": dict(sorted(Counter(item["category"] for item in items).items())),
        }
    report = {
        "generatedAt": datetime.now(ZoneInfo("Asia/Tokyo")).date().isoformat(),
        "scope": {"questions": len(records), "qualifications": len(data["qualifications"])},
        "method": {
            "automated": "データ構造、選択肢、解説、公式ドメイン、完全重複、類似候補を検査",
            "manual": "公式情報との照合結果を問題IDごとに記録。自動検査だけで問題なしとは判定しない。",
        },
        "summary": dict(summary),
        "findingSummary": dict(finding_summary),
        "distributions": distributions,
        "records": records,
    }
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(records)} audit records to {OUTPUT_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

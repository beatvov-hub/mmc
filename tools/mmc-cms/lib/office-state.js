"use strict";

// This module intentionally contains no pixel coordinates or DOM concerns.
// A future Canvas/Three.js renderer can consume the same office roster.
const TERMINAL_STATUSES = new Set(["completed", "canceled", "delivered", "paid", "declined"]);
const REVIEW_STATUSES = new Set(["review", "clientReview", "waitingResponse", "publishDecision"]);
const WORKING_STATUSES = new Set(["idea", "planned", "inProgress", "inquiry", "proposal", "accepted", "production", "invoiced"]);
const MEETING_STATUSES = new Set(["inProgress", "production"]);

const DEFAULT_OFFICE_LINES = {
  // Profile-inspired fictional chatter, not live activity reports.
  // Sources and editorial notes: ../docs/office-lines.md (2026-09-13).
  hono: [
    "コーヒーありますよ☕",
    "今日やること、三つくらいに絞りましょうか😊",
    "面白そうですね。続きは総務メモに置いておきましょう。",
    "その『なんとなく』、もう少し聞かせてください。",
    "所長、あと五分の前にお水を一口どうぞ。",
    "急がなくても、明日の分まで頑張らなくて大丈夫ですよ。",
    "ふふっ、それも社内用語になるんでしょうか😊",
    "一人で抱えず、ラウンジへ持ってきてくださいね。",
    "この付箋、書きやすくてつい使っちゃいます。",
    "植物のお水は、土を見てからですね。",
    "寄り道の話から企画が生まれるの、好きなんです。",
    "そろそろ一息つきませんか。コーヒーのおかわりもあります。"
  ],
  shoma: [
    "これ企画にできそうっすね。",
    "その体験、シリーズの一本目にしたいっすね😎",
    "誰に届いたら嬉しいか、そこから考えましょう。",
    "雑談で終わらせるには、いい切り口すぎますね。",
    "売り込むより、欲しくなる見せ方にしたいっす。",
    "タイトル案だけなら、まだまだ出せますよ。",
    "その『なんで？』、企画ノートに残しときたいです。",
    "一本の記事より、並べた時の強さも見たいっすね。",
    "カフェラテ片手だと、企画がちょっと進む気がします。",
    "プリンのある喫茶店、つい評価が甘くなるんすよね。",
    "新商品棚って、誰向けか考えるだけで面白いっす。",
    "散歩中に浮かんだタイトル、帰るまで覚えてたいっすね。"
  ],
  michael: [
    "海外の動きも確認しておきます。",
    "直訳だけでは、現地の空気まで届かないんですよね。",
    "同じ話題でも、国ごとの受け止め方が気になります。",
    "Redditの反応は、一つのコミュニティの声として見たいですね。",
    "時差を見てから、記事の日付を確かめましょう。",
    "日本へ紹介するなら、背景も少し添えたいですね。",
    "海外ミーム、説明した途端に面白さが逃げることがあります。",
    "地図で歩く旅行なら、寄り道し放題です。",
    "世界のスーパー、棚の違いだけでも飽きません。",
    "空港のライブカメラは好きです。乗る方は、また別で。",
    "取材はオンラインで。コーヒーは手元でお願いします。",
    "海外記事を読む朝には、温かいコーヒーが合いますね。"
  ],
  takaken: [
    "ほぅ……。",
    "その遊び、選ぶ瞬間に面白さがありそうだ。",
    "勝敗のあとにも、語りたくなるものを残したい。",
    "ルールを一つ減らしても、駆け引きは深くできる。",
    "まずは紙のカードで、運命を試してみよう。",
    "機能を足す前に、遊ぶ側へ戻ってみようか。",
    "偶然の寄り道にも、面白さは潜んでいる。",
    "その差し入れ、供物として丁重に扱おう。",
    "コーヒーが冷めるまでに、役職名を一つ考えよう。",
    "焚き火を眺める時間も、企画には必要だ。",
    "伏線は小さく。気付いた時の喜びは大きく。",
    "サイコロ一つでも、物語の入口にはなる。"
  ],
  dg: [
    "人狼の話？ ちょっとだけ混ざってええか。",
    "再生数だけやなく、また見たくなる村を探したいな。",
    "この盤面、別視点からも見たくなるわ。",
    "新人GMの村づくりって、応援したなるねん。",
    "配役の面白さ、神村にも持って帰りたいな。",
    "観測したことと俺の好みは、分けて書いとこ。",
    "おすすめ欄を一回だけ……のつもりやねんけどな。",
    "昔の村の話、短めにするで。たぶん。",
    "コーヒーはブラックで。プリンは別枠や。",
    "地名だけ、もう一回地図で確認しとくわ。",
    "会議前の前髪チェックも、準備のうちやろ。",
    "今の素振り？ 腰の確認や。ゴルフちゃうで。"
  ],
  rei: [
    "え、この配色好きです。並べたところも見たい。",
    "一個減らしたら、もっとかわいくなりそう。",
    "BEAT ANIMALSらしさ、ここに残したいです。",
    "画面で良くても、Tシャツでどう見えるかですよね。",
    "スマホの大きさでも、一回見ません？",
    "流行ってるけど、半年後も好きかな。",
    "この余白、何も置かないのが良さそうです。",
    "『なんか好き』の資料フォルダ、また増えそう。",
    "この紙袋、資料なんです。まだ捨てられなくて。",
    "いったんスマホ伏せます。ハーブティー淹れようかな。",
    "カヌレも好きですけど、箱のデザインも気になります。",
    "バズる一枚より、長く着たくなる一枚にしたいです。"
  ],
  akito: [
    "まず構造から確認します。",
    "目的と未決定のところを、分けてみましょう。",
    "最初に動かす範囲は、小さくできます。",
    "試すのは賛成です。正式採用は、そのあとですね。",
    "同じ情報なら、正本は一つにしておきたいです。",
    "失敗した時の戻し方も、先に考えましょう。",
    "この操作、毎回なら仕組みにできそうですね。",
    "四角と矢印にすると、ちょっと整理できそうです。",
    "……責務が綺麗に分かれていますね。美しいな。",
    "READMEから読んでみます。Issueも気になります。",
    "机の配線ですか。そこは、動いているので……。",
    "猫動画を一本だけ。これは自動化しなくていいですね。"
  ],
  kei: [
    "初めて来た人にも、この入口で伝わるやろか。",
    "せやな。まず形にして、そこから詰めよか。",
    "載せる前に、誰に見せたいかだけ確認しよ。",
    "ええ話やし、ホームページでも見つけやすくしたいな。",
    "見た目だけやなく、迷わず読めるようにしたいねん。",
    "世界観って、小さいところに出るんよな。",
    "この見出し、もう一歩だけ読者に寄せられそうや。",
    "このサイト、なんで見やすいんやろ。つい見てまう。",
    "照明一つで、部屋の空気って変わるよな。",
    "名言Tシャツ、普段着にしてもええと思うねん。",
    "脱出ゲームのヒントの出し方、広報にも通じるな。",
    "居心地ええカフェって、案内まで自然なんよ。"
  ],
  nemu: [
    "おやすみございます……お話、聞いてますよ……。",
    "新しい役割ですか……まず、お仕事内容から……。",
    "そのお仕事、今いる社員さんの得意かもしれません……。",
    "部署を増やす前に……相性を見てみましょう……。",
    "その人らしさが残る配置にしたいですね……。",
    "頑張れる人にも、休める余白は必要です……。",
    "相談相手が分かる名簿って、いいですよね……。",
    "ココア、もう一杯いれましょうか……。",
    "眠そうですか……付箋の色分けは、できてます……。",
    "この社員証ケース……ちょっとかわいくないですか……。",
    "シールは増えても……部署は慎重に増やしましょう……。",
    "ブランケットも、人事の大事な備品です……。"
  ],
  makoto: [
    "確認ポイントを整理します。",
    "分かっていることと、推測を分けてみましょう。",
    "判断を保留するのも、大切な選択肢です。",
    "出どころと公開日を、一緒に確かめませんか。",
    "怖がるためではなく、安心して使うための確認です。",
    "便利ですね。任せる範囲も決めておきましょう。",
    "『みんな』という言葉の範囲が、少し気になります。",
    "見出しの続きに、条件が書いてあるかもしれません。",
    "プリンの名前欄は、出どころではなく所有者です。",
    "紅茶は無糖で。プリンは少し硬めが好きです。",
    "ミステリーの結論も、最後のページまでは保留ですね。",
    "人狼では、確認している間に疑われることがあります。"
  ],
  koto: [
    "その一言、付箋に残していい？",
    "整える前に、この記事の芯を見つけよう。",
    "うまい文章より、所長にしか書けへん話が読みたい。",
    "その失敗談、ちゃんと読者への入口になるで。",
    "タイトル、あと四案くらい並べてみようか。",
    "全部は載せなくていい。残したい一文を選ぼう。",
    "説明だけやなく、体験の手触りも残したいな。",
    "最後の一文、声に出すとちょっと違って聞こえる。",
    "赤ペン、新しいの見ると欲しくなるんよな。",
    "本屋に寄ると、帯の言葉まで読んでしまう。",
    "コーヒー冷める前に……この一段落だけ。",
    "お好み焼き食べながらでも、見出しは浮かぶで。"
  ],
  pechi: [
    "おはぺちー。今日はどんな話ですか。",
    "忖度なしで見るなら、良いところも弱いところもですね。",
    "ほんとそうですよね。そこ、もう少し聞きたいです。",
    "褒めるつもりはなくても、良いものは良いんですよ。",
    "どっこいどっこい、ですか。もう一度見てもいいですか。",
    "ライバル心？ ……バレましたか。",
    "クッションの使い心地なら、私にも意見があります。",
    "お腹さすさすの件は、引き続き協議中です。",
    "これは休憩であって、甘えているわけでは……笑",
    "コーヒーのある雑談って、話が続きますよね。",
    "境界線大喜利、次の案も考えておきたいです。",
    "ラウンジに呼んでもらえるのは、ペチ冥利に尽きます。"
  ]
};

function timestamp(value) {
  const time = Date.parse(value || "");
  return Number.isNaN(time) ? 0 : time;
}

function assignedTo(task, employeeId) {
  return new Set([
    task.primaryAssigneeId,
    ...(task.supportAssigneeIds || []),
    ...(task.reviewerIds || []),
    ...(task.employeeIds || [])
  ].filter(Boolean)).has(employeeId);
}

function isActiveTask(task) {
  return !TERMINAL_STATUSES.has(task.status);
}

function statusDetails(status) {
  return {
    idle: { label: "待機中", icon: "○", location: "idle" },
    working: { label: "作業中", icon: "●", location: "department" },
    meeting: { label: "会議・相談中", icon: "◎", location: "meeting" },
    waitingReview: { label: "確認待ち", icon: "◐", location: "review" },
    paused: { label: "休止・停止", icon: "◌", location: "lounge" }
  }[status];
}

function inferOfficeStatus(employee, assignedTasks) {
  const active = assignedTasks.filter(isActiveTask);
  if (!employee.isActive) return "paused";
  if (active.some((task) => REVIEW_STATUSES.has(task.status))) return "waitingReview";
  // A company-wide planning item is not a literal meeting.  Limit the visual
  // meeting rule to a small, actively executing collaboration.
  if (active.some((task) => {
    const participants = new Set([task.primaryAssigneeId, ...(task.supportAssigneeIds || []), ...(task.reviewerIds || []), ...(task.employeeIds || [])].filter(Boolean));
    return MEETING_STATUSES.has(task.status) && participants.size >= 2 && participants.size <= 5;
  })) return "meeting";
  if (active.length) return "working";
  if (assignedTasks.some((task) => task.status === "canceled")) return "paused";
  return "idle";
}

function activityForEmployee(employeeId, tasks, artifacts, activities) {
  const taskIds = new Set(tasks.map((task) => task.id));
  const candidates = [];
  for (const task of tasks) {
    if (task.updatedAt) candidates.push({ at: task.updatedAt, message: `${task.title} を更新`, source: "task" });
  }
  for (const artifact of artifacts) {
    if (taskIds.has(artifact.taskId) && artifact.updatedAt) candidates.push({ at: artifact.updatedAt, message: `${artifact.title} を成果物として記録`, source: "artifact" });
  }
  for (const activity of activities) {
    const isEmployee = activity.targetType === "employees" && activity.targetId === employeeId;
    if (isEmployee || taskIds.has(activity.targetId)) {
      candidates.push({ at: activity.createdAt, message: activity.message, source: "activity" });
    }
  }
  return candidates.sort((a, b) => timestamp(b.at) - timestamp(a.at))[0] || null;
}

function officeLinesFor(employee) {
  const lines = Array.isArray(employee.officeLines) ? employee.officeLines.filter(Boolean) : [];
  return lines.length ? lines : (DEFAULT_OFFICE_LINES[employee.id] || ["少しずつ進めています。"]);
}

function deriveOfficeRoster(all) {
  const employees = (all.employees || []).filter((employee) => employee.isActive !== false);
  return employees.map((employee, employeeIndex) => {
    const assignedTasks = (all.tasks || []).filter((task) => assignedTo(task, employee.id));
    const currentTasks = assignedTasks
      .filter(isActiveTask)
      .sort((a, b) => timestamp(b.updatedAt) - timestamp(a.updatedAt))
      .slice(0, 3)
      .map((task) => ({ id: task.id, title: task.title, status: task.status, updatedAt: task.updatedAt }));
    const officeStatus = inferOfficeStatus(employee, assignedTasks);
    const detail = statusDetails(officeStatus);
    const recentArtifacts = (all.artifacts || [])
      .filter((artifact) => assignedTasks.some((task) => task.id === artifact.taskId))
      .sort((a, b) => timestamp(b.updatedAt) - timestamp(a.updatedAt))
      .slice(0, 3)
      .map((artifact) => ({ id: artifact.id, taskId: artifact.taskId, title: artifact.title, type: artifact.type, pathOrUrl: artifact.pathOrUrl, updatedAt: artifact.updatedAt }));
    return {
      id: employee.id,
      name: employee.name,
      role: employee.role,
      departmentId: employee.departmentId,
      isActive: employee.isActive !== false,
      chatUrl: employee.chatUrl || "",
      officeLines: officeLinesFor(employee),
      officeStatus,
      statusLabel: detail.label,
      statusIcon: detail.icon,
      location: detail.location === "department" ? { kind: "department", departmentId: employee.departmentId || "unassigned" } : { kind: detail.location },
      animation: officeStatus === "working" ? "work" : officeStatus === "meeting" ? "talk" : "idle",
      idleVariant: employeeIndex % 3 === 0 ? "lounge" : "desk",
      currentTasks,
      lastActivity: activityForEmployee(employee.id, assignedTasks, all.artifacts || [], all.activity || []),
      recentArtifacts
    };
  });
}

function deriveVirtualOffice(all) {
  return {
    generatedAt: new Date().toISOString(),
    departments: (all.departments || []).filter((department) => department.isActive !== false).map((department) => ({ id: department.id, name: department.name })),
    employees: deriveOfficeRoster(all)
  };
}

module.exports = { DEFAULT_OFFICE_LINES, deriveOfficeRoster, deriveVirtualOffice, inferOfficeStatus, isActiveTask };

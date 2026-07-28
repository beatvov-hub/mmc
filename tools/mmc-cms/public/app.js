"use strict";

let sessionToken = "";
let systemInfo = null;
let loungeState = null;
let aiState = null;
let pendingUrlCandidates = [];

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const deepCopy = (value) => JSON.parse(JSON.stringify(value));

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function weekday(date) {
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? "" : ["日", "月", "火", "水", "木", "金", "土"][parsed.getDay()];
}

function period(time) {
  const hour = Number(String(time || "09:00").slice(0, 2));
  if (hour < 6) return "深夜";
  if (hour < 11) return "朝";
  if (hour < 16) return "昼";
  if (hour < 19) return "夕方";
  if (hour < 23) return "夜";
  return "深夜";
}

function blankLounge() {
  const date = localDate();
  return {
    id: `${date}-0900`,
    date,
    time: "09:00",
    weekday: weekday(date),
    period: "朝",
    title: "朝のラウンジ観測記録",
    participants: [],
    content: []
  };
}

function blankArticle() {
  const publishedAt = localDate();
  return {
    id: `case-${publishedAt.replaceAll("-", "")}`,
    publishedAt,
    title: "",
    shortTitle: "",
    category: "verification",
    difficulty: "beginner",
    targetAudience: [],
    summary: "",
    scenario: { headline: "", description: "", whyItMatters: "" },
    question: { text: "", choices: [], recommendedAnswers: [], explanation: "" },
    inspectionPoints: [],
    verificationLevel: 2,
    verificationLabel: "",
    verificationMessage: "",
    verdict: { label: "", description: "", confidence: "medium" },
    safeActions: [],
    avoidActions: [],
    positiveUse: { title: "", description: "", examples: [] },
    makotoComment: "",
    oneLineLesson: "",
    tags: [],
    sources: [],
    caseImage: { src: "", alt: "", caption: "" },
    visualSuggestion: { mainVisual: "", cardIcon: "", accentTone: "calm" }
  };
}

async function api(endpoint, payload) {
  const response = await fetch(endpoint, {
    method: payload === undefined ? "GET" : "POST",
    headers: payload === undefined
      ? {}
      : { "Content-Type": "application/json", "X-CMS-Token": sessionToken },
    body: payload === undefined ? undefined : JSON.stringify(payload)
  });
  let data;
  try {
    data = await response.json();
  } catch {
    data = { ok: false, errors: [`サーバー応答を読み取れませんでした（${response.status}）。`] };
  }
  data._status = response.status;
  return data;
}

function message(target, type, lines, title = "") {
  const element = typeof target === "string" ? $(target) : target;
  element.replaceChildren();
  if (!lines || !lines.length) return;
  const box = document.createElement("div");
  box.className = `message ${type || ""}`.trim();
  if (title) {
    const strong = document.createElement("strong");
    strong.textContent = title;
    box.append(strong);
  }
  if (lines.length === 1) {
    const text = document.createElement("div");
    text.textContent = lines[0];
    box.append(text);
  } else {
    const list = document.createElement("ul");
    lines.forEach((line) => {
      const item = document.createElement("li");
      item.textContent = line;
      list.append(item);
    });
    box.append(list);
  }
  element.append(box);
}

function setBusy(button, busy, busyText = "処理中…") {
  if (busy) {
    button.dataset.label = button.textContent;
    button.textContent = busyText;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.label || button.textContent;
    button.disabled = false;
  }
}

function fillSelect(select, values, labels = {}) {
  select.replaceChildren();
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = labels[value] || value;
    select.append(option);
  });
}

function updateDuplicateIndicators() {
  if (!systemInfo || !loungeState || !aiState) return;
  const loungeDuplicate = systemInfo.loungeIds.includes(loungeState.id);
  $("#lounge-overwrite-row").classList.toggle("is-hidden", !loungeDuplicate);
  if (!loungeDuplicate) $("#lounge-overwrite").checked = false;
  const aiDuplicate = systemInfo.forensicsRecords.some((item) => item.id === aiState.id);
  $("#forensics-overwrite-row").classList.toggle("is-hidden", !aiDuplicate);
  if (!aiDuplicate) $("#forensics-overwrite").checked = false;
}

function pathParts(pathValue) {
  const parts = [];
  String(pathValue).replace(/(?:^|\.)([^.[\]]+)|\[(\d+)\]/g, (_match, key, index) => {
    parts.push(index === undefined ? key : Number(index));
    return "";
  });
  return parts.filter((part) => part !== "$");
}

function getPath(object, pathValue) {
  return pathParts(pathValue).reduce((value, key) => value?.[key], object);
}

function setPath(object, pathValue, value) {
  const parts = pathParts(pathValue);
  let cursor = object;
  parts.forEach((key, index) => {
    if (index === parts.length - 1) cursor[key] = value;
    else cursor = cursor[key];
  });
}

function loungeForSave() {
  const entry = deepCopy(loungeState);
  if (!entry.description) delete entry.description;
  const dailyItems = entry.content
    .filter((block) => block.type === "dailyWords")
    .flatMap((block) => block.items || [])
    .filter((item) => item.speaker || item.text)
    .map((item) => ({
      speaker: String(item.speaker || "").trim(),
      text: String(item.text || "").trim().replace(/^「([\s\S]*)」$/, "$1")
    }));
  entry.content = entry.content.filter((block) => block.type !== "dailyWords");
  if (dailyItems.length) entry.todayWords = dailyItems;
  else delete entry.todayWords;
  return entry;
}

function updateLoungePreview() {
  $("#lounge-json").textContent = JSON.stringify(loungeForSave(), null, 2);
  updateDuplicateIndicators();
}

function renderLoungeMeta() {
  $$("[data-lounge]").forEach((input) => {
    const key = input.dataset.lounge;
    input.value = key === "participants" ? (loungeState.participants || []).join("、") : (loungeState[key] || "");
  });
  updateLoungePreview();
}

function iconButton(label, title, handler) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "icon-button";
  button.textContent = label;
  button.title = title;
  button.setAttribute("aria-label", title);
  button.addEventListener("click", handler);
  return button;
}

function fieldControl(tag, value, handler, options = {}) {
  const control = document.createElement(tag);
  if (tag === "textarea") control.rows = options.rows || 3;
  if (options.list) control.setAttribute("list", options.list);
  control.value = value ?? "";
  control.placeholder = options.placeholder || "";
  control.addEventListener(options.event || "input", () => handler(control.value));
  return control;
}

function blankBlock(type) {
  if (type === "talks") return { type, items: [{ speaker: "", lines: [{ type: "text", text: "" }] }] };
  if (type === "quote") return { type, text: "", cite: "" };
  if (type === "signature") return { type, text: "" };
  if (type === "dailyWords") return { type, title: "今日の一言", items: [{ speaker: "", text: "" }] };
  return { type: "scene", paragraphs: [""] };
}

function renderTalkBlock(container, block, blockIndex) {
  (block.items || []).forEach((item, itemIndex) => {
    const itemBox = document.createElement("div");
    itemBox.className = "talk-item";
    const head = document.createElement("div");
    head.className = "talk-head";
    const speakerInput = fieldControl("input", item.speaker, (value) => {
      item.speaker = value;
      const speakers = loungeState.content
        .filter((candidate) => candidate.type === "talks")
        .flatMap((candidate) => candidate.items.map((speaker) => speaker.speaker))
        .filter(Boolean);
      loungeState.participants = [...new Set(speakers)];
      renderLoungeMeta();
    }, { list: "speaker-list", placeholder: "発言者" });
    head.append(speakerInput, iconButton("×", "この発言者を削除", () => {
      block.items.splice(itemIndex, 1);
      renderLoungeBlocks();
    }));
    itemBox.append(head);
    (item.lines || []).forEach((line, lineIndex) => {
      const row = document.createElement("div");
      row.className = "line-row";
      const typeSelect = document.createElement("select");
      [["text", "セリフ"], ["note", "注釈"], ["strongNote", "強い注釈"]].forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        typeSelect.append(option);
      });
      typeSelect.value = line.type || "text";
      typeSelect.addEventListener("change", () => { line.type = typeSelect.value; updateLoungePreview(); });
      const textInput = fieldControl("textarea", line.text, (value) => {
        line.text = value;
        updateLoungePreview();
      }, { rows: 2, placeholder: "文章" });
      row.append(typeSelect, textInput, iconButton("×", "この文章を削除", () => {
        item.lines.splice(lineIndex, 1);
        renderLoungeBlocks();
      }));
      itemBox.append(row);
    });
    const addLine = document.createElement("button");
    addLine.type = "button";
    addLine.className = "button tiny";
    addLine.textContent = "＋ 文章";
    addLine.addEventListener("click", () => {
      item.lines.push({ type: "text", text: "" });
      renderLoungeBlocks();
    });
    itemBox.append(addLine);
    container.append(itemBox);
  });
  const addSpeaker = document.createElement("button");
  addSpeaker.type = "button";
  addSpeaker.className = "button tiny";
  addSpeaker.textContent = "＋ 発言者";
  addSpeaker.addEventListener("click", () => {
    block.items.push({ speaker: "", lines: [{ type: "text", text: "" }] });
    renderLoungeBlocks();
  });
  container.append(addSpeaker);
}

function renderLoungeBlocks() {
  const list = $("#lounge-blocks");
  list.replaceChildren();
  $("#lounge-empty").classList.toggle("is-hidden", loungeState.content.length > 0);
  loungeState.content.forEach((block, index) => {
    const card = document.createElement("article");
    card.className = "block-card";
    const number = document.createElement("div");
    number.className = "block-index";
    const numberText = document.createElement("span");
    numberText.textContent = String(index + 1).padStart(2, "0");
    number.append(
      numberText,
      iconButton("↑", "上へ移動", () => {
        if (!index) return;
        [loungeState.content[index - 1], loungeState.content[index]] = [loungeState.content[index], loungeState.content[index - 1]];
        renderLoungeBlocks();
      }),
      iconButton("↓", "下へ移動", () => {
        if (index === loungeState.content.length - 1) return;
        [loungeState.content[index + 1], loungeState.content[index]] = [loungeState.content[index], loungeState.content[index + 1]];
        renderLoungeBlocks();
      })
    );
    const body = document.createElement("div");
    body.className = "block-body";
    const toolbar = document.createElement("div");
    toolbar.className = "block-toolbar";
    const typeSelect = document.createElement("select");
    [["scene", "情景文"], ["talks", "会話"], ["quote", "引用・ホワイトボード"], ["signature", "署名"], ["dailyWords", "今日の一言"]].forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      typeSelect.append(option);
    });
    typeSelect.value = block.type;
    typeSelect.addEventListener("change", () => {
      loungeState.content[index] = blankBlock(typeSelect.value);
      renderLoungeBlocks();
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "button tiny";
    remove.textContent = "削除";
    remove.addEventListener("click", () => {
      loungeState.content.splice(index, 1);
      renderLoungeBlocks();
    });
    toolbar.append(typeSelect, remove);
    body.append(toolbar);
    const fields = document.createElement("div");
    fields.className = "block-fields";
    if (block.type === "scene") {
      fields.append(fieldControl("textarea", (block.paragraphs || []).join("\n"), (value) => {
        block.paragraphs = value.split("\n").map((item) => item.trim()).filter(Boolean);
        updateLoungePreview();
      }, { rows: 5, placeholder: "1行1段落で情景文を入力" }));
    } else if (block.type === "talks") {
      renderTalkBlock(fields, block, index);
    } else if (block.type === "quote") {
      fields.append(
        fieldControl("textarea", block.text, (value) => { block.text = value; updateLoungePreview(); }, { rows: 3, placeholder: "引用文" }),
        fieldControl("input", block.cite, (value) => { block.cite = value; updateLoungePreview(); }, { placeholder: "引用元・ホワイトボード名" })
      );
    } else if (block.type === "signature") {
      fields.append(fieldControl("input", block.text, (value) => { block.text = value; updateLoungePreview(); }, { placeholder: "署名" }));
    } else if (block.type === "dailyWords") {
      fields.append(fieldControl("input", block.title || "今日の一言", (value) => { block.title = value; updateLoungePreview(); }, { placeholder: "見出し" }));
      (block.items || []).forEach((item, itemIndex) => {
        const row = document.createElement("div");
        row.className = "line-row";
        row.append(
          fieldControl("input", item.speaker, (value) => { item.speaker = value; updateLoungePreview(); }, { list: "speaker-list", placeholder: "発言者" }),
          fieldControl("textarea", item.text, (value) => { item.text = value; updateLoungePreview(); }, { rows: 2, placeholder: "今日の一言" }),
          iconButton("×", "この一言を削除", () => {
            block.items.splice(itemIndex, 1);
            renderLoungeBlocks();
          })
        );
        fields.append(row);
      });
      const add = document.createElement("button");
      add.type = "button";
      add.className = "button tiny";
      add.textContent = "＋ 一言";
      add.addEventListener("click", () => {
        block.items.push({ speaker: "", text: "" });
        renderLoungeBlocks();
      });
      fields.append(add);
    }
    body.append(fields);
    card.append(number, body);
    list.append(card);
  });
  updateLoungePreview();
}

function showValidation(target, result) {
  if (result.errors?.length) message(target, "error", result.errors, "修正が必要です");
  else if (result.warnings?.length) message(target, "warning", result.warnings, "入力は有効です（要確認）");
  else message(target, "", ["入力チェックを通過しました。"], "問題ありません");
}

function renderLog(panelSelector, targetSelector, result) {
  const panel = $(panelSelector);
  const target = $(targetSelector);
  panel.classList.remove("is-hidden");
  target.replaceChildren();
  message(target, result.ok ? "" : "error", result.ok ? ["生成が完了しました。"] : (result.errors || ["生成に失敗しました。"]));
  if (result.generatedFiles?.length) {
    const entry = document.createElement("div");
    entry.className = "log-entry";
    const strong = document.createElement("strong");
    strong.textContent = `生成・更新されたファイル（${result.generatedFiles.length}件）`;
    const list = document.createElement("ul");
    list.className = "file-list";
    result.generatedFiles.forEach((file) => {
      const item = document.createElement("li");
      item.textContent = file;
      list.append(item);
    });
    entry.append(strong, list);
    target.append(entry);
  }
  (result.logs || []).forEach((log) => {
    if (!log.output) return;
    const entry = document.createElement("div");
    entry.className = "log-entry";
    const strong = document.createElement("strong");
    strong.textContent = log.script || "生成処理";
    const pre = document.createElement("pre");
    pre.textContent = log.output;
    entry.append(strong, pre);
    target.append(entry);
  });
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function updateAiPreview() {
  $("#forensics-json").textContent = JSON.stringify(aiForSave(), null, 2);
  updateDuplicateIndicators();
  renderImageSelection();
}

function aiForSave() {
  const article = deepCopy(aiState);
  if (!article.caseImage?.src) delete article.caseImage;
  return article;
}

function renderAiScalarFields() {
  $$("[data-ai]").forEach((input) => {
    input.value = getPath(aiState, input.dataset.ai) ?? "";
  });
  $$("[data-ai-list]").forEach((input) => {
    const value = getPath(aiState, input.dataset.aiList);
    input.value = Array.isArray(value) ? value.join("\n") : "";
  });
}

function labeledControl(labelText, value, onInput, options = {}) {
  const label = document.createElement("label");
  label.className = `editor-label ${options.className || ""}`.trim();
  const title = document.createElement("span");
  title.textContent = labelText;
  let input;
  if (options.select) {
    input = document.createElement("select");
    options.select.forEach((choice) => {
      const option = document.createElement("option");
      option.value = choice;
      option.textContent = choice;
      input.append(option);
    });
  } else {
    input = document.createElement(options.textarea ? "textarea" : "input");
    if (options.textarea) input.rows = options.rows || 2;
    if (options.type) input.type = options.type;
  }
  input.value = value ?? "";
  input.addEventListener(options.select ? "change" : "input", () => onInput(input.value));
  label.append(title, input);
  return label;
}

function removeCell(handler) {
  const button = iconButton("×", "この項目を削除", handler);
  button.classList.add("span-1");
  return button;
}

function renderChoices() {
  const container = $("#choice-list");
  container.replaceChildren();
  aiState.question.choices.forEach((choice, index) => {
    const row = document.createElement("div");
    row.className = "editor-row editor-row-grid";
    row.append(
      labeledControl("選択肢ID", choice.id, (value) => {
        const old = choice.id;
        choice.id = value;
        aiState.question.recommendedAnswers = aiState.question.recommendedAnswers.map((id) => id === old ? value : id);
        updateAiPreview();
      }),
      labeledControl("ラベル", choice.label, (value) => { choice.label = value; updateAiPreview(); }, { className: "span-8" }),
      labeledControl("説明", choice.description, (value) => { choice.description = value; updateAiPreview(); }, { className: "span-11", textarea: true })
    );
    const recommend = document.createElement("label");
    recommend.className = "recommended-check";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = aiState.question.recommendedAnswers.includes(choice.id);
    checkbox.addEventListener("change", () => {
      const values = new Set(aiState.question.recommendedAnswers);
      if (checkbox.checked) values.add(choice.id);
      else values.delete(choice.id);
      aiState.question.recommendedAnswers = [...values];
      updateAiPreview();
    });
    const text = document.createElement("span");
    text.textContent = "推奨回答";
    recommend.append(checkbox, text);
    row.append(recommend, removeCell(() => {
      aiState.question.choices.splice(index, 1);
      aiState.question.recommendedAnswers = aiState.question.recommendedAnswers.filter((id) => id !== choice.id);
      renderAiDynamic();
    }));
    container.append(row);
  });
}

function renderInspection() {
  const container = $("#inspection-list");
  container.replaceChildren();
  aiState.inspectionPoints.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "editor-row editor-row-grid";
    row.append(
      labeledControl("タイトル", item.title, (value) => { item.title = value; updateAiPreview(); }, { className: "span-6" }),
      labeledControl("優先度", item.priority, (value) => { item.priority = value; updateAiPreview(); }, { select: ["high", "medium", "low"] }),
      removeCell(() => { aiState.inspectionPoints.splice(index, 1); renderAiDynamic(); }),
      labeledControl("説明", item.description, (value) => { item.description = value; updateAiPreview(); }, { className: "span-12", textarea: true })
    );
    container.append(row);
  });
}

function renderActions(key, selector) {
  const container = $(selector);
  container.replaceChildren();
  aiState[key].forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "editor-row editor-row-grid";
    row.append(
      labeledControl("行動", item.action, (value) => { item.action = value; updateAiPreview(); }, { className: "span-11" }),
      removeCell(() => { aiState[key].splice(index, 1); renderAiDynamic(); }),
      labeledControl("理由", item.reason, (value) => { item.reason = value; updateAiPreview(); }, { className: "span-12", textarea: true })
    );
    container.append(row);
  });
}

function renderSources() {
  const container = $("#source-list");
  container.replaceChildren();
  aiState.sources.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "editor-row editor-row-grid";
    row.append(
      labeledControl("タイトル", item.title, (value) => { item.title = value; updateAiPreview(); }, { className: "span-8" }),
      labeledControl("種別", item.sourceType, (value) => { item.sourceType = value; updateAiPreview(); }, { select: systemInfo.options.sourceTypes }),
      removeCell(() => { aiState.sources.splice(index, 1); renderAiDynamic(); }),
      labeledControl("発行元", item.publisher, (value) => { item.publisher = value; updateAiPreview(); }, { className: "span-6" }),
      labeledControl("公開日", item.publishedAt, (value) => { item.publishedAt = value; updateAiPreview(); }, { className: "span-6" }),
      labeledControl("URL", item.url, (value) => { item.url = value; updateAiPreview(); }, { className: "span-12" })
    );
    container.append(row);
  });
}

function renderAiDynamic() {
  renderChoices();
  renderInspection();
  renderActions("safeActions", "#safe-list");
  renderActions("avoidActions", "#avoid-list");
  renderSources();
  updateAiPreview();
}

function renderAi() {
  aiState.scenario ||= { headline: "", description: "", whyItMatters: "" };
  aiState.question ||= { text: "", choices: [], recommendedAnswers: [], explanation: "" };
  aiState.question.choices ||= [];
  aiState.question.recommendedAnswers ||= [];
  aiState.inspectionPoints ||= [];
  aiState.verdict ||= { label: "", description: "", confidence: "medium" };
  aiState.safeActions ||= [];
  aiState.avoidActions ||= [];
  aiState.positiveUse ||= { title: "", description: "", examples: [] };
  aiState.positiveUse.examples ||= [];
  aiState.sources ||= [];
  if (typeof aiState.caseImage === "string") aiState.caseImage = { src: aiState.caseImage, alt: "", caption: "" };
  aiState.caseImage ||= { src: "", alt: "", caption: "" };
  aiState.visualSuggestion ||= { mainVisual: "", cardIcon: "", accentTone: "calm" };
  aiState.targetAudience ||= [];
  aiState.tags ||= [];
  renderAiScalarFields();
  renderAiDynamic();
}

function renderImagePicker(images) {
  const picker = $("#image-picker");
  picker.replaceChildren();
  const none = document.createElement("button");
  none.type = "button";
  none.className = "image-option none";
  none.dataset.imagePath = "";
  none.textContent = "画像なし";
  none.addEventListener("click", () => { aiState.caseImage.src = ""; updateAiPreview(); });
  picker.append(none);
  images.forEach((image) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "image-option";
    button.dataset.imagePath = image.path;
    const preview = document.createElement("img");
    preview.src = image.previewUrl;
    preview.alt = image.name;
    preview.loading = "lazy";
    const name = document.createElement("span");
    name.textContent = image.name;
    button.append(preview, name);
    button.addEventListener("click", () => { aiState.caseImage.src = image.path; updateAiPreview(); });
    picker.append(button);
  });
  renderImageSelection();
}

function renderImageSelection() {
  if (!aiState) return;
  $$(".image-option").forEach((button) => button.classList.toggle("is-selected", button.dataset.imagePath === (aiState.caseImage?.src || "")));
  $("#case-image-value").value = aiState.caseImage?.src || "";
}

function renderUrlCandidates(candidates) {
  pendingUrlCandidates = candidates || [];
  const box = $("#url-candidates");
  box.replaceChildren();
  box.classList.toggle("is-hidden", !pendingUrlCandidates.length);
  if (!pendingUrlCandidates.length) return;
  const heading = document.createElement("strong");
  heading.textContent = "URL / Markdown修正候補";
  const note = document.createElement("p");
  note.className = "muted";
  note.textContent = "内容を確認し、適用する候補だけ選んでください。自動では変更しません。";
  box.append(heading, note);
  pendingUrlCandidates.forEach((candidate, index) => {
    const row = document.createElement("label");
    row.className = "candidate-item";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.candidate = index;
    const content = document.createElement("div");
    const reason = document.createElement("strong");
    reason.textContent = `${candidate.path}｜${candidate.reason}`;
    const before = document.createElement("code");
    before.textContent = `変更前: ${candidate.original}`;
    const after = document.createElement("code");
    after.textContent = `変更後: ${candidate.suggested}`;
    content.append(reason, before, after);
    row.append(checkbox, content);
    box.append(row);
  });
  const apply = document.createElement("button");
  apply.type = "button";
  apply.className = "button secondary";
  apply.textContent = "選択した修正を適用";
  apply.addEventListener("click", () => {
    const selected = $$("[data-candidate]:checked", box).map((checkbox) => pendingUrlCandidates[Number(checkbox.dataset.candidate)]);
    selected.forEach((candidate) => setPath(aiState, candidate.path, candidate.suggested));
    renderAi();
    renderUrlCandidates([]);
    message("#forensics-parse-message", "", [`${selected.length}件の修正候補を適用しました。保存前JSONで確認できます。`]);
  });
  box.append(apply);
}

async function initialize() {
  try {
    systemInfo = await api("/api/status");
    if (!systemInfo.ok) throw new Error((systemInfo.errors || []).join("\n"));
    sessionToken = systemInfo.token;
    $("#repo-root").textContent = systemInfo.root;
    $("#lounge-count").textContent = `${systemInfo.counts.lounge} 件登録済み`;
    $("#forensics-count").textContent = `${systemInfo.counts.forensics} 件登録済み`;
    const pythonText = systemInfo.python.available
      ? `Python確認済み（${systemInfo.python.source}）`
      : "Pythonが見つかりません。設定画面で指定してください。";
    $("#system-status").textContent = `接続済み · ${pythonText}\nラウンジ ${systemInfo.counts.lounge}件 / 鑑識室 ${systemInfo.counts.forensics}件`;
    $("#system-status").classList.toggle("is-error", !systemInfo.python.available);

    fillSelect($("#lounge-weekday"), systemInfo.options.weekdays);
    fillSelect($("#lounge-period"), systemInfo.options.periods);
    fillSelect($("#ai-category"), systemInfo.options.categories);
    fillSelect($("#ai-difficulty"), systemInfo.options.difficulties);
    fillSelect($("#ai-level"), ["1", "2", "3", "4", "5"]);
    const datalist = $("#speaker-list");
    systemInfo.options.speakers.forEach((speaker) => {
      const option = document.createElement("option");
      option.value = speaker;
      datalist.append(option);
    });
    const images = await api("/api/images");
    loungeState = blankLounge();
    aiState = blankArticle();
    renderLoungeMeta();
    renderLoungeBlocks();
    renderImagePicker(images.images || []);
    renderAi();
  } catch (error) {
    $("#system-status").textContent = `接続エラー: ${error.message}`;
    $("#system-status").classList.add("is-error");
  }
}

$$("[data-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    $$("[data-tab]").forEach((item) => item.classList.toggle("is-active", item === button));
    $$("[data-panel]").forEach((panel) => panel.classList.toggle("is-active", panel.dataset.panel === button.dataset.tab));
  });
});

$$("[data-lounge]").forEach((input) => {
  input.addEventListener("input", () => {
    const key = input.dataset.lounge;
    if (key === "participants") loungeState.participants = input.value.split(/[、,\n]/).map((value) => value.trim()).filter(Boolean);
    else loungeState[key] = input.value;
    if (key === "date" || key === "time") {
      loungeState.id = `${loungeState.date}-${loungeState.time.replace(":", "")}`;
      loungeState.weekday = weekday(loungeState.date);
      loungeState.period = period(loungeState.time);
      renderLoungeMeta();
    } else updateLoungePreview();
  });
  input.addEventListener("change", () => input.dispatchEvent(new Event("input")));
});

$("#parse-lounge").addEventListener("click", async () => {
  const button = $("#parse-lounge");
  setBusy(button, true, "解析中…");
  try {
    const result = await api("/api/lounge/parse", { draft: $("#lounge-draft").value });
    if (!result.ok) return message("#lounge-parse-message", "error", result.errors || ["解析できませんでした。"]);
    loungeState = result.entry;
    renderLoungeMeta();
    renderLoungeBlocks();
    message("#lounge-parse-message", result.warnings.length ? "warning" : "", result.warnings.length ? result.warnings : ["原稿を構造化しました。下のブロックを確認してください。"]);
    $("#lounge-blocks").scrollIntoView({ behavior: "smooth", block: "start" });
  } finally {
    setBusy(button, false);
  }
});

$("#clear-lounge").addEventListener("click", () => {
  $("#lounge-draft").value = "";
  loungeState = blankLounge();
  renderLoungeMeta();
  renderLoungeBlocks();
  message("#lounge-parse-message", "", []);
});

$$("[data-add-lounge]").forEach((button) => {
  button.addEventListener("click", () => {
    loungeState.content.push(blankBlock(button.dataset.addLounge));
    renderLoungeBlocks();
  });
});

$("#validate-lounge").addEventListener("click", async () => {
  const button = $("#validate-lounge");
  setBusy(button, true, "確認中…");
  const result = await api("/api/lounge/validate", { entry: loungeForSave() });
  showValidation("#lounge-validation", result);
  setBusy(button, false);
});

$("#generate-lounge").addEventListener("click", async () => {
  const button = $("#generate-lounge");
  setBusy(button, true, "生成中…");
  const result = await api("/api/lounge/generate", {
    entry: loungeForSave(),
    confirmOverwrite: $("#lounge-overwrite").checked
  });
  showValidation("#lounge-validation", result);
  renderLog("#lounge-log-panel", "#lounge-log", result);
  if (result.ok) {
    systemInfo.loungeIds = [...new Set([...systemInfo.loungeIds, loungeState.id])];
    systemInfo.counts.lounge += result.overwritten ? 0 : 1;
    $("#lounge-count").textContent = `${systemInfo.counts.lounge} 件登録済み`;
    updateDuplicateIndicators();
  }
  setBusy(button, false);
});

$$("[data-ai]").forEach((input) => {
  const eventName = input.tagName === "SELECT" ? "change" : "input";
  input.addEventListener(eventName, () => {
    const value = input.dataset.ai === "verificationLevel" ? Number(input.value) : input.value;
    setPath(aiState, input.dataset.ai, value);
    updateAiPreview();
  });
});

$$("[data-ai-list]").forEach((input) => {
  input.addEventListener("input", () => {
    setPath(aiState, input.dataset.aiList, input.value.split("\n").map((value) => value.trim()).filter(Boolean));
    updateAiPreview();
  });
});

$("#add-choice").addEventListener("click", () => {
  aiState.question.choices.push({ id: "", label: "", description: "" });
  renderAiDynamic();
});

$$("[data-add-array]").forEach((button) => {
  button.addEventListener("click", () => {
    const key = button.dataset.addArray;
    if (key === "inspectionPoints") aiState[key].push({ title: "", description: "", priority: "medium" });
    else if (key === "sources") aiState[key].push({ title: "", publisher: "", sourceType: "official", publishedAt: "", url: "" });
    else aiState[key].push({ action: "", reason: "" });
    renderAiDynamic();
  });
});

$("#parse-forensics").addEventListener("click", async () => {
  const button = $("#parse-forensics");
  setBusy(button, true, "読込中…");
  const result = await api("/api/forensics/parse", { text: $("#forensics-json-input").value });
  if (!result.ok) {
    message("#forensics-parse-message", "error", result.errors || ["JSONを読み取れませんでした。"]);
  } else {
    aiState = result.article;
    renderAi();
    renderUrlCandidates(result.urlCandidates);
    const lines = [...(result.errors || []), ...(result.warnings || [])];
    message("#forensics-parse-message", result.errors?.length ? "error" : result.warnings?.length ? "warning" : "", lines.length ? lines : ["JSONをフォームへ反映しました。"]);
  }
  setBusy(button, false);
});

$("#new-forensics").addEventListener("click", () => {
  aiState = blankArticle();
  $("#forensics-json-input").value = "";
  renderAi();
  renderUrlCandidates([]);
  message("#forensics-parse-message", "", []);
});

$("#validate-forensics").addEventListener("click", async () => {
  const button = $("#validate-forensics");
  setBusy(button, true, "確認中…");
  const result = await api("/api/forensics/validate", { article: aiForSave() });
  showValidation("#forensics-validation", result);
  renderUrlCandidates(result.urlCandidates);
  setBusy(button, false);
});

$("#generate-forensics").addEventListener("click", async () => {
  const button = $("#generate-forensics");
  setBusy(button, true, "生成中…");
  const result = await api("/api/forensics/generate", {
    article: aiForSave(),
    confirmOverwrite: $("#forensics-overwrite").checked
  });
  showValidation("#forensics-validation", result);
  renderLog("#forensics-log-panel", "#forensics-log", result);
  if (result.ok) {
    systemInfo.forensicsRecords.push({ id: aiState.id, publishedAt: aiState.publishedAt, file: `${aiState.id}.json` });
    systemInfo.counts.forensics += result.overwritten ? 0 : 1;
    $("#forensics-count").textContent = `${systemInfo.counts.forensics} 件登録済み`;
    updateDuplicateIndicators();
  }
  setBusy(button, false);
});

$("#save-settings").addEventListener("click", async () => {
  const button = $("#save-settings");
  setBusy(button, true, "確認中…");
  const result = await api("/api/settings", { pythonPath: $("#python-path").value.trim() });
  if (result.ok) {
    systemInfo.python = result.python;
    message("#settings-message", "", [`Pythonを確認しました: ${result.python.displayPath}（${result.python.source}）`]);
  } else message("#settings-message", "error", result.errors || ["設定を保存できませんでした。"]);
  setBusy(button, false);
});

$("#undo-update").addEventListener("click", async () => {
  const button = $("#undo-update");
  setBusy(button, true, "復元中…");
  const result = await api("/api/undo", { confirm: $("#undo-confirm").checked });
  if (result.ok) {
    message("#undo-message", "", [`${result.operation} を元に戻しました。復元ファイル: ${result.restoredFiles.length}件`]);
    $("#undo-confirm").checked = false;
  } else {
    message("#undo-message", "error", [...(result.errors || ["元に戻せませんでした。"]), ...((result.conflicts || []).map((item) => `競合: ${item}`))]);
  }
  setBusy(button, false);
});

initialize();

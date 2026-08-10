(function () {
  "use strict";

  const FALLBACK_CONFIG = {
    status: "draft",
    isPublic: false,
    activeSetId: "default-31day-v1",
    timezone: "Asia/Tokyo",
    heroEyebrow: "毎日聴く音楽室",
    heroTitle: "今日のあなたに、一曲だけ。",
    heroTitleLines: ["今日のあなたに", "一曲だけ。"],
    heroDescription: "3つだけ、いまの気分を教えてください。",
    startButtonLabel: "今日の一曲を選んでもらう",
    heroNote: "質問は毎日同じです。変わるのは、今日のあなた。",
    questions: [
      { id: "q1", text: "今日も、楽しいですか？" },
      { id: "q2", text: "今の気分を、少し変えたいですか？" },
      { id: "q3", text: "今日は、言葉に浸りたいですか？" }
    ],
    yesLabel: "YES / はい",
    noLabel: "NO / いいえ",
    backLabel: "ひとつ戻る",
    skipLabel: "選曲演出をスキップ",
    selectingMessage: "今日の一曲を探しています。",
    resultHeading: "AI社員が、今日のあなたへ一曲選びました。",
    retryLabel: "もう一度、今日の気分に答える",
    startupDurationMs: 900,
    selectionDurationMs: 1600,
    unavailableHeading: "今日の選曲棚は、まだ準備中です。",
    unavailableMessage: "3つの回答は受け取りました。この日の一曲が棚に入るまで、もう少しだけお待ちください。"
  };

  const DATA_URLS = {
    config: "src/data/music-room-config.json",
    tracks: "src/data/music-room-tracks.json",
    employees: "tools/mmc-cms/data/workline-employees.json",
    departments: "tools/mmc-cms/data/workline-departments.json"
  };

  const root = document.querySelector("[data-music-room]");
  const core = window.MusicRoomCore;
  if (!root || !core) return;

  const machine = root.querySelector(".music-room-machine");
  const stages = Array.from(root.querySelectorAll("[data-stage]"));
  const startButton = root.querySelector("[data-start]");
  const soundToggle = root.querySelector("[data-sound-toggle]");
  const soundState = root.querySelector("[data-sound-state]");
  const fallbackSounds = Object.fromEntries(
    Array.from(root.querySelectorAll("[data-music-sfx]")).map((audio) => [audio.dataset.musicSfx, audio])
  );
  const answerButtons = Array.from(root.querySelectorAll("[data-answer]"));
  const backButton = root.querySelector("[data-back]");
  const skipButton = root.querySelector("[data-skip]");
  const retryButton = root.querySelector("[data-retry]");
  const questionHeading = root.querySelector("[data-question-text]");
  const questionNumber = root.querySelector("[data-question-number]");
  const progressLabel = root.querySelector("[data-progress-label]");
  const progress = root.querySelector("[role='progressbar']");
  const progressBar = root.querySelector("[data-progress-bar]");
  const selectingStage = root.querySelector("[data-stage='selecting']");
  const resultHeading = root.querySelector("[data-result-heading]");
  const liveRegion = root.querySelector("[data-live-region]");
  const loadStatus = root.querySelector("[data-load-status]");
  const displayCode = root.querySelector("[data-display-code]");
  const trackResult = root.querySelector("[data-track-result]");
  const unavailable = root.querySelector("[data-track-unavailable]");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let config = FALLBACK_CONFIG;
  let tracks = [];
  let employees = [];
  let departments = [];
  let answers = [];
  let questionIndex = 0;
  let selectionTimer = null;
  let numberTimer = null;
  let startupTimer = null;
  let selectionLocked = false;
  let startupLocked = false;
  let soundEnabled = true;
  let audioContext = null;

  function announce(message) {
    liveRegion.textContent = "";
    window.setTimeout(() => { liveRegion.textContent = message; }, 20);
  }

  function trackEvent(name) {
    if (typeof window.gtag === "function") window.gtag("event", name);
  }

  function getAudioContext() {
    if (!soundEnabled) return null;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    if (!audioContext) audioContext = new AudioContext();
    return audioContext;
  }

  function playTone(context, options) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + options.delay;
    const end = start + options.duration;
    oscillator.type = options.type;
    oscillator.frequency.setValueAtTime(options.frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(options.endFrequency || options.frequency, end);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(options.volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(end + 0.02);
  }

  function playFallbackSound(name) {
    const audio = fallbackSounds[name];
    if (!soundEnabled || !audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }

  function playSound(sequence, fallbackName) {
    const context = getAudioContext();
    if (!context) {
      playFallbackSound(fallbackName);
      return;
    }
    context.resume().then(() => sequence(context)).catch(() => {});
  }

  function playStartupSound() {
    playSound((context) => {
      playTone(context, { frequency: 86, endFrequency: 48, delay: 0, duration: 0.17, volume: 0.045, type: "square" });
      playTone(context, { frequency: 210, endFrequency: 180, delay: 0.2, duration: 0.09, volume: 0.022, type: "triangle" });
      playTone(context, { frequency: 440, endFrequency: 660, delay: 0.42, duration: 0.28, volume: 0.025, type: "sine" });
    }, "startup");
  }

  function playControlTick() {
    playSound((context) => {
      playTone(context, { frequency: 720, endFrequency: 560, delay: 0, duration: 0.045, volume: 0.014, type: "square" });
    }, "tick");
  }

  function playSelectionStartSound() {
    playSound((context) => {
      [0, 0.12, 0.24].forEach((delay, index) => {
        playTone(context, { frequency: 260 + index * 80, endFrequency: 260 + index * 80, delay, duration: 0.07, volume: 0.016, type: "triangle" });
      });
    }, "select");
  }

  function playCompletionSound() {
    playSound((context) => {
      playTone(context, { frequency: 74, endFrequency: 52, delay: 0, duration: 0.12, volume: 0.035, type: "square" });
      playTone(context, { frequency: 659, endFrequency: 659, delay: 0.1, duration: 0.28, volume: 0.02, type: "sine" });
      playTone(context, { frequency: 880, endFrequency: 880, delay: 0.18, duration: 0.3, volume: 0.017, type: "sine" });
    }, "complete");
  }

  function applyCopy() {
    root.querySelectorAll("[data-copy]").forEach((element) => {
      const key = element.dataset.copy;
      if (typeof config[key] === "string" && config[key]) element.textContent = config[key];
    });
    const titleLines = Array.isArray(config.heroTitleLines) && config.heroTitleLines.length === 2
      ? config.heroTitleLines
      : ["今日のあなたに", "一曲だけ。"];
    root.querySelectorAll("[data-hero-title-line]").forEach((element) => {
      element.textContent = titleLines[Number(element.dataset.heroTitleLine)] || "";
    });
  }

  function showStage(name, focusTarget) {
    stages.forEach((stage) => {
      const active = stage.dataset.stage === name;
      stage.hidden = !active;
      stage.classList.toggle("is-active", active);
    });
    machine.dataset.machineState = name;
    if (focusTarget) window.requestAnimationFrame(() => focusTarget.focus({ preventScroll: true }));
  }

  function renderQuestion(index) {
    questionIndex = index;
    const question = config.questions[index];
    const current = index + 1;
    questionHeading.textContent = question.text;
    questionNumber.textContent = `Q${current}`;
    progressLabel.textContent = `質問 ${current} / 3`;
    progress.setAttribute("aria-valuenow", String(current));
    progressBar.style.width = `${current * 33.333}%`;
    backButton.hidden = index === 0;
    displayCode.textContent = `Q${current}`;
    showStage("question", questionHeading);
    announce(`質問${current}、${question.text}`);
  }

  function startQuestions() {
    if (startupLocked) return;
    answers = [];
    selectionLocked = true;
    startupLocked = true;
    startButton.disabled = true;
    root.classList.add("is-awakening");
    machine.dataset.machineState = "awakening";
    displayCode.textContent = "START";
    announce("ジュークボックスを起動しています。");
    playStartupSound();
    trackEvent("music_room_start");

    const configuredDuration = Number(config.startupDurationMs);
    const duration = reduceMotion.matches ? 80 : Math.min(1200, Math.max(700, configuredDuration || 900));
    startupTimer = window.setTimeout(() => {
      startupTimer = null;
      startupLocked = false;
      selectionLocked = false;
      startButton.disabled = false;
      root.classList.remove("is-awakening");
      displayCode.textContent = "Q1";
      renderQuestion(0);
    }, duration);
  }

  function answerQuestion(value) {
    if (selectionLocked) return;
    playControlTick();
    answers[questionIndex] = value;
    if (questionIndex < 2) {
      renderQuestion(questionIndex + 1);
      return;
    }
    beginSelection();
  }

  function goBack() {
    if (questionIndex <= 0 || selectionLocked) return;
    playControlTick();
    answers = answers.slice(0, questionIndex - 1);
    renderQuestion(questionIndex - 1);
  }

  function beginSelection() {
    if (selectionLocked) return;
    selectionLocked = true;
    showStage("selecting", root.querySelector("[data-stage='selecting'] h2"));
    selectingStage.setAttribute("aria-busy", "true");
    displayCode.textContent = "...";
    announce(config.selectingMessage);
    playSelectionStartSound();

    if (!reduceMotion.matches) {
      let displayNumber = 8;
      numberTimer = window.setInterval(() => {
        displayNumber = (displayNumber + 17) % 100;
        displayCode.textContent = String(displayNumber).padStart(2, "0");
      }, 120);
    }

    const configuredDuration = Number(config.selectionDurationMs);
    const duration = reduceMotion.matches ? 30 : Math.min(2000, Math.max(1200, configuredDuration || 1600));
    selectionTimer = window.setTimeout(finishSelection, duration);
  }

  function stopSelectionTimers() {
    if (selectionTimer) window.clearTimeout(selectionTimer);
    if (numberTimer) window.clearInterval(numberTimer);
    selectionTimer = null;
    numberTimer = null;
  }

  function finishSelection() {
    if (!selectionLocked || !selectingStage.hasAttribute("aria-busy")) return;
    stopSelectionTimers();
    selectingStage.removeAttribute("aria-busy");
    const route = core.answersToRoute(answers);
    const day = core.getDayInTimeZone(new Date(), config.timezone);
    const track = core.selectTrack(tracks, config.activeSetId, day, route);
    playCompletionSound();
    displayCode.textContent = String(day).padStart(2, "0");
    renderResult(track, day);
    showStage("result", resultHeading);
    announce(track ? "今日の一曲が決まりました。" : "今日の選曲棚は、まだ準備中です。");
    trackEvent("music_room_complete");
  }

  function departmentName(id) {
    return departments.find((department) => department.id === id)?.name || "";
  }

  function createExternalLink(label, url) {
    if (!core.isSafeHttpsUrl(url)) return null;
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = `${label} ↗`;
    link.setAttribute("aria-label", `${label}（新しいタブで開きます）`);
    link.addEventListener("click", () => trackEvent("music_room_external_link"));
    return link;
  }

  function renderResult(track, day) {
    resultHeading.textContent = config.resultHeading;
    trackResult.hidden = !track;
    unavailable.hidden = Boolean(track);
    if (!track) {
      console.info("[Music Room] この日の公開可能な選曲データはまだありません。", { setId: config.activeSetId, day });
      return;
    }

    root.querySelector("[data-track-title]").textContent = track.title;
    root.querySelector("[data-track-artist]").textContent = track.artist;
    root.querySelector("[data-track-message]").textContent = track.message;
    root.querySelector("[data-track-reason]").textContent = track.reason;

    const staff = employees.find((employee) => employee.id === track.staffId);
    const staffImage = root.querySelector("[data-staff-image]");
    root.querySelector("[data-staff-name]").textContent = staff?.name || "AI社員";
    root.querySelector("[data-staff-role]").textContent = staff
      ? [departmentName(staff.departmentId), staff.role].filter(Boolean).join("・")
      : "毎日見る株式会社";
    staffImage.hidden = !staff?.iconPath;
    if (staff?.iconPath) {
      staffImage.src = staff.iconPath;
      staffImage.alt = `${staff.name}のプロフィール画像`;
      staffImage.onerror = () => { staffImage.hidden = true; };
    }

    const profileLink = root.querySelector("[data-staff-profile]");
    profileLink.href = staff?.profileUrl || "members.html";
    profileLink.textContent = staff ? `${staff.name}のプロフィールを見る` : "AI社員紹介を見る";

    const tags = root.querySelector("[data-track-tags]");
    tags.replaceChildren();
    (Array.isArray(track.tags) ? track.tags : []).slice(0, 5).forEach((tag) => {
      const item = document.createElement("li");
      item.textContent = `#${tag}`;
      tags.append(item);
    });

    const directorWrap = root.querySelector("[data-director-note-wrap]");
    directorWrap.hidden = !track.directorNote;
    root.querySelector("[data-director-note]").textContent = track.directorNote || "";

    const externalLinks = root.querySelector("[data-external-links]");
    externalLinks.replaceChildren();
    const links = [
      createExternalLink("YouTubeで聴く", track.youtubeUrl),
      createExternalLink("Spotifyで聴く", track.spotifyUrl)
    ].filter(Boolean);
    links.forEach((link) => externalLinks.append(link));
    externalLinks.hidden = links.length === 0;
  }

  function restart() {
    stopSelectionTimers();
    selectingStage.removeAttribute("aria-busy");
    answers = [];
    selectionLocked = false;
    displayCode.textContent = "Q1";
    renderQuestion(0);
  }

  async function fetchJson(url) {
    const response = await fetch(url, { credentials: "same-origin" });
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    return response.json();
  }

  async function loadData() {
    const requests = Object.entries(DATA_URLS).map(async ([key, url]) => {
      try {
        return [key, await fetchJson(url)];
      } catch (error) {
        console.warn(`[Music Room] ${key}の読み込みに失敗しました。`, error);
        return [key, null];
      }
    });
    const loaded = Object.fromEntries(await Promise.all(requests));
    if (loaded.config && Array.isArray(loaded.config.questions) && loaded.config.questions.length === 3) {
      config = { ...FALLBACK_CONFIG, ...loaded.config };
    }
    tracks = Array.isArray(loaded.tracks) ? loaded.tracks : [];
    employees = Array.isArray(loaded.employees) ? loaded.employees : [];
    departments = Array.isArray(loaded.departments) ? loaded.departments : [];
    applyCopy();
    loadStatus.textContent = loaded.tracks ? "" : "選曲棚を読み込めませんでした。質問にはそのまま答えられます。";
  }

  startButton.addEventListener("click", startQuestions);
  soundToggle.addEventListener("change", () => {
    soundEnabled = soundToggle.checked;
    soundState.textContent = soundEnabled ? "ON" : "OFF";
    soundState.parentElement.classList.toggle("is-muted", !soundEnabled);
    announce(`効果音を${soundEnabled ? "オン" : "オフ"}にしました。`);
    if (soundEnabled) playControlTick();
  });
  answerButtons.forEach((button) => button.addEventListener("click", () => answerQuestion(button.dataset.answer === "yes")));
  backButton.addEventListener("click", goBack);
  skipButton.addEventListener("click", finishSelection);
  retryButton.addEventListener("click", restart);
  window.addEventListener("pagehide", () => {
    stopSelectionTimers();
    if (startupTimer) window.clearTimeout(startupTimer);
  });

  loadData();
})();

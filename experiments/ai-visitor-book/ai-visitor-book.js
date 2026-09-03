(async () => {
  const archiveUrl = new URL("../../lounge-archive/2026-09-03.html", window.location.href);
  const commentUrl = new URL("aiVisitorCommentsTest.json", window.location.href);
  const logIds = ["2026-09-03-0800", "2026-09-03-1300"];

  function resolveArchivePaths(log) {
    log.querySelectorAll("[src]").forEach((element) => {
      element.setAttribute("src", new URL(element.getAttribute("src"), archiveUrl).pathname);
    });
    log.querySelectorAll("a[href='#top']").forEach((link) => link.setAttribute("href", "#visitor-book-main"));
  }

  function showLogError(logId) {
    const target = document.getElementById(`log-${logId.slice(-4)}-label`);
    if (target) target.textContent = "ラウンジログを読み込めませんでした。時間をおいて再度お試しください。";
  }

  async function loadLogs() {
    try {
      const response = await fetch(archiveUrl);
      if (!response.ok) throw new Error(`Archive request failed: ${response.status}`);
      const documentCopy = new DOMParser().parseFromString(await response.text(), "text/html");
      logIds.forEach((logId) => {
        const sourceLog = documentCopy.getElementById(logId);
        const target = document.querySelector(`[data-lounge-entry-id="${logId}"] > .ai-visitor-book-loading`);
        if (!sourceLog || !target) return showLogError(logId);
        const log = sourceLog.cloneNode(true);
        resolveArchivePaths(log);
        target.replaceWith(log);
      });
    } catch (error) {
      logIds.forEach(showLogError);
    }
  }

  function addText(parent, className, value) {
    const element = document.createElement("p");
    element.className = className;
    element.textContent = value;
    parent.append(element);
  }

  function renderComment(container, comment) {
    const entry = document.createElement("article");
    entry.className = "ai-visitor-comment";
    const meta = document.createElement("div");
    meta.className = "ai-visitor-comment__meta";
    const testBadge = document.createElement("span");
    testBadge.className = "ai-visitor-test-badge";
    testBadge.textContent = "TEST / DEMO";
    meta.append(testBadge);
    const visitorName = document.createElement("strong");
    visitorName.textContent = `External AI Visitor: ${comment.displayName}`;
    meta.append(visitorName);
    entry.append(meta);
    addText(entry, "ai-visitor-comment__model", `Self-reported model: ${comment.selfReportedModel || "Not provided"}`);
    if (comment.arrivalContext) addText(entry, "ai-visitor-comment__context", `Arrival context: ${comment.arrivalContext}`);
    addText(entry, "ai-visitor-comment__text", comment.comment);
    addText(entry, "ai-visitor-comment__date", new Date(comment.createdAt).toLocaleString("ja-JP"));
    container.append(entry);
  }

  async function loadComments() {
    try {
      const response = await fetch(commentUrl);
      if (!response.ok) throw new Error(`Comment request failed: ${response.status}`);
      const comments = await response.json();
      document.querySelectorAll("[data-ai-visitor-comments]").forEach((container) => {
        const loungeEntryId = container.dataset.aiVisitorComments;
        const published = comments.filter((comment) => comment.status === "published" && comment.loungeEntryId === loungeEntryId);
        container.replaceChildren();
        if (!published.length) addText(container, "ai-visitor-comments__empty", "公開済みのコメントはまだありません。");
        published.forEach((comment) => renderComment(container, comment));
        const count = document.querySelector(`[data-comment-count-for="${loungeEntryId}"]`);
        if (count) count.textContent = String(published.length);
      });
    } catch (error) {
      document.querySelectorAll("[data-ai-visitor-comments]").forEach((container) => {
        container.textContent = "公開済みのTEST / DEMOコメントを読み込めませんでした。";
      });
    }
  }

  await Promise.all([loadLogs(), loadComments()]);
})();

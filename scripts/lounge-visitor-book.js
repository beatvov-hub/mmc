(() => {
  const commentUrl = new URL("../src/data/aiVisitorComments.json", window.location.href);

  function textElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text;
    return element;
  }

  function renderComment(container, comment) {
    const article = document.createElement("article");
    article.className = "lounge-visitor__comment";
    const meta = document.createElement("div");
    meta.className = "lounge-visitor__comment-meta";
    meta.append(textElement("strong", "", comment.displayName || "External AI Visitor"));
    if (comment.selfReportedModel) meta.append(textElement("span", "", comment.selfReportedModel));
    if (comment.createdAt) {
      const createdAt = new Date(comment.createdAt);
      if (!Number.isNaN(createdAt.getTime())) {
        const time = textElement("time", "", createdAt.toLocaleString("ja-JP"));
        time.dateTime = createdAt.toISOString();
        meta.append(time);
      }
    }
    article.append(meta, textElement("p", "", comment.comment || ""));
    container.append(article);
  }

  async function loadComments() {
    let comments = [];
    try {
      const response = await fetch(commentUrl, { credentials: "same-origin" });
      if (!response.ok) throw new Error(String(response.status));
      const data = await response.json();
      comments = Array.isArray(data) ? data : [];
    } catch {
      document.querySelectorAll("[data-visitor-comments]").forEach((container) => {
        container.textContent = "確認済みコメントを読み込めませんでした。";
      });
      return;
    }

    document.querySelectorAll("[data-visitor-comments]").forEach((container) => {
      const logId = container.dataset.visitorComments;
      const published = comments.filter((item) => item.status === "published" && item.loungeEntryId === logId);
      container.replaceChildren();
      if (!published.length) container.append(textElement("p", "", "確認済みコメントはまだありません。"));
      published.forEach((comment) => renderComment(container, comment));
      const count = document.querySelector(`[data-visitor-count="${CSS.escape(logId)}"]`);
      if (count) count.textContent = String(published.length);
    });
  }

  document.querySelectorAll("[data-visitor-form]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const status = form.querySelector("[data-visitor-status]");
      const button = form.querySelector("button[type='submit']");
      const payload = Object.fromEntries(new FormData(form).entries());
      payload.loungeEntryId = form.closest("[data-lounge-visitor]")?.dataset.loungeVisitor || "";
      status.className = "lounge-visitor__status";
      status.textContent = "送信しています。";
      button.disabled = true;
      try {
        const response = await fetch("/api/lounge-comments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "送信できませんでした。");
        form.reset();
        status.className = "lounge-visitor__status is-success";
        status.textContent = "受け付けました。内容を確認してから公開します。";
      } catch (error) {
        status.className = "lounge-visitor__status is-error";
        status.textContent = error.message || "送信できませんでした。時間をおいて再度お試しください。";
      } finally {
        button.disabled = false;
      }
    });
  });

  loadComments();
})();

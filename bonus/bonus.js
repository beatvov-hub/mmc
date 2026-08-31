const endpoint = "/.netlify/functions/bonus-download";
const form = document.querySelector("[data-bonus-form]");
const passwordInput = document.querySelector("#bonus-password");
const status = document.querySelector("[data-bonus-status]");
const documents = document.querySelector("[data-bonus-documents]");
const buttons = [...document.querySelectorAll("[data-bonus-file]")];

let unlocked = false;

function setStatus(message, isSuccess = false) {
  status.textContent = message;
  status.classList.toggle("is-success", isSuccess);
}

async function requestBonus(payload) {
  const response = await fetch(endpoint, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "ダウンロードを開始できませんでした。");
  }

  return response;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const password = passwordInput.value;

  if (!password) {
    setStatus("合言葉を入力してください。");
    passwordInput.focus();
    return;
  }

  const submitButton = form.querySelector("button[type=submit]");
  submitButton.disabled = true;
  setStatus("");

  try {
    await requestBonus({ password });
    unlocked = true;
    documents.hidden = false;
    setStatus("確認できました。PDFを選択してください。", true);
  } catch (error) {
    unlocked = false;
    documents.hidden = true;
    setStatus(error.message);
  } finally {
    submitButton.disabled = false;
  }
});

passwordInput.addEventListener("input", () => {
  if (unlocked) {
    unlocked = false;
    documents.hidden = true;
    setStatus("");
  }
});

buttons.forEach((button) => {
  button.addEventListener("click", async () => {
    if (!unlocked) {
      setStatus("もう一度、合言葉を確認してください。");
      passwordInput.focus();
      return;
    }

    button.disabled = true;
    setStatus("");

    try {
      const response = await requestBonus({
        file: button.dataset.bonusFile,
        password: passwordInput.value
      });
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = button.dataset.downloadName;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(downloadUrl);
      setStatus("ダウンロードを開始しました。", true);
    } catch (error) {
      setStatus(error.message);
    } finally {
      button.disabled = false;
    }
  });
});

(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  document.documentElement.classList.add("has-site-effects");

  const ready = (callback) => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
      return;
    }
    callback();
  };

  const revealElements = (elements, options = {}) => {
    const items = [...elements].filter(Boolean);
    if (items.length === 0) {
      return;
    }

    items.forEach((item, index) => {
      const delay = Math.min(index * (options.step || 70), options.maxDelay || 360);
      item.style.setProperty("--reveal-delay", `${delay}ms`);
    });

    if (reduceMotion || !("IntersectionObserver" in window)) {
      items.forEach((item) => item.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, {
      rootMargin: "0px 0px -8% 0px",
      threshold: 0.12
    });

    items.forEach((item) => observer.observe(item));
  };

  const initTypewriter = (element) => {
    if (!element || element.dataset.typewriterReady === "true") {
      return;
    }

    const fullText = element.textContent.trim();
    if (!fullText || fullText.length > 120) {
      return;
    }

    element.dataset.typewriter = "";
    element.dataset.typewriterReady = "true";

    if (reduceMotion) {
      element.textContent = fullText;
      return;
    }

    element.style.minHeight = `${Math.ceil(element.getBoundingClientRect().height)}px`;
    element.textContent = "";
    element.classList.add("is-typing");

    let index = 0;
    const tick = () => {
      element.textContent = fullText.slice(0, index);
      index += 1;

      if (index <= fullText.length) {
        window.setTimeout(tick, 34);
        return;
      }

      element.classList.remove("is-typing");
      element.style.minHeight = "";
    };

    window.setTimeout(tick, 260);
  };

  const getMemberTheme = () => {
    const classTheme = [...document.body.classList]
      .find((className) => className.startsWith("member-") && className !== "member-detail-page");

    if (classTheme) {
      return classTheme.replace("member-", "");
    }

    const fileName = window.location.pathname.split("/").pop().replace(".html", "");
    return fileName || "hono";
  };

  const initMemberProfile = () => {
    const main = document.querySelector(".member-detail-main");
    const hero = document.querySelector(".member-detail-hero");

    if (!main || !hero) {
      return;
    }

    const theme = getMemberTheme();
    document.body.dataset.memberTheme = theme;
    main.dataset.memberTheme = theme;

    const heroItems = [
      hero.querySelector(".member-detail-photo"),
      hero.querySelector(".member-number"),
      hero.querySelector(".member-department"),
      hero.querySelector("#member-name"),
      hero.querySelector(".member-roman"),
      hero.querySelector(".member-lead"),
      hero.querySelector(".pill-list"),
      hero.querySelector(".member-facts")
    ].filter(Boolean);

    heroItems.forEach((item, index) => {
      item.dataset.profileHeroItem = "";
      item.style.setProperty("--profile-delay", `${Math.min(index * 80, 520)}ms`);
    });

    if (reduceMotion) {
      hero.classList.add("is-ready");
    } else {
      requestAnimationFrame(() => {
        hero.classList.add("is-ready");
      });
    }

    if (!reduceMotion && finePointer) {
      hero.addEventListener("pointermove", (event) => {
        const rect = hero.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 100;
        const y = ((event.clientY - rect.top) / rect.height) * 100;
        hero.style.setProperty("--mouse-x", `${x.toFixed(2)}%`);
        hero.style.setProperty("--mouse-y", `${y.toFixed(2)}%`);
      });
    }

    initTypewriter(document.querySelector(".profile-message blockquote"));
    document.querySelectorAll(".profile-sticky-note").forEach((element) => {
      element.dataset.floatingNote = "";
    });
    revealElements(document.querySelectorAll(".member-detail-grid .profile-panel, .profile-footer-cta"), {
      step: 80,
      maxDelay: 420
    });
  };

  const initLoungeImage = () => {
    const image = document.getElementById("loungeTimeImage");
    if (!image) {
      return;
    }

    const markLoaded = () => image.classList.add("is-loaded");
    if (image.complete) {
      markLoaded();
    } else {
      image.addEventListener("load", markLoaded, { once: true });
    }

    if ("MutationObserver" in window) {
      const observer = new MutationObserver((records) => {
        if (!records.some((record) => record.attributeName === "src")) {
          return;
        }
        image.classList.remove("is-loaded");
        if (image.complete) {
          requestAnimationFrame(markLoaded);
          return;
        }
        image.addEventListener("load", markLoaded, { once: true });
      });
      observer.observe(image, { attributes: true, attributeFilter: ["src"] });
    }
  };

  const initLoungeStatus = () => {
    const status = document.querySelector(".lounge-status");
    const title = document.getElementById("loungeTimeTitle");
    const message = document.getElementById("loungeTimeMessage");

    if (!status || !title || !message) {
      return;
    }

    status.classList.add("lounge-status-effect");
    requestAnimationFrame(() => status.classList.add("is-visible"));

    if (reduceMotion || !("MutationObserver" in window)) {
      return;
    }

    let timer = 0;
    const flash = () => {
      window.clearTimeout(timer);
      status.classList.add("is-updating");
      timer = window.setTimeout(() => {
        status.classList.remove("is-updating");
        status.classList.add("is-visible");
      }, 180);
    };

    const observer = new MutationObserver(flash);
    [title, message].forEach((node) => {
      observer.observe(node, { childList: true, characterData: true, subtree: true });
    });
  };

  const initLounge = () => {
    if (!document.body.classList.contains("lounge-page")) {
      return;
    }

    initLoungeImage();
    initLoungeStatus();

    document
      .querySelectorAll(".lounge-log-scene, .lounge-log-ending, .lounge-daily-words, .talk-bubble")
      .forEach((element) => {
        element.dataset.loungeMessage = "";
      });

    document
      .querySelectorAll(".lounge-post-card, .archive-card, .lounge-archive-entry, .pechi-memo, .speaker-pechi")
      .forEach((element) => {
        element.dataset.loungePulse = "";
      });

    document
      .querySelectorAll(".profile-sticky-note, .lounge-hero-copy .section-kicker")
      .forEach((element) => {
        element.dataset.floatingNote = "";
      });

    revealElements(document.querySelectorAll("[data-lounge-message], [data-lounge-pulse]"), {
      step: 55,
      maxDelay: 420
    });
  };

  ready(() => {
    initMemberProfile();
    initLounge();
  });
})();

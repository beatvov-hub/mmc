(function () {
  const header = document.querySelector(".fc2-header");
  const menuButton = document.querySelector(".fc2-menu-button");
  const nav = document.querySelector("#fc2-global-nav");
  const randomButton = document.querySelector(".random-button");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const imageReplacePoints = [
    {
      label: "IMAGE 01",
      id: "hero-collage",
      description: "複数の個人ホームページが浮かぶコラージュ",
      ratio: "4:3",
      size: "1600 × 1200px",
      suggestedPath: "gallery-image/fc2web-hero-collage.webp",
    },
    {
      label: "IMAGE 02",
      id: "gallery-illustration",
      description: "イラスト・創作系の個人サイト",
      ratio: "16:10",
      size: "1280 × 800px",
      suggestedPath: "gallery-image/fc2web-gallery-illustration.webp",
    },
    {
      label: "IMAGE 03",
      id: "gallery-research",
      description: "個人研究・考察系のサイト",
      ratio: "16:10",
      size: "1280 × 800px",
      suggestedPath: "gallery-image/fc2web-gallery-research.webp",
    },
    {
      label: "IMAGE 04",
      id: "gallery-game",
      description: "ブラウザゲーム公開サイト",
      ratio: "16:10",
      size: "1280 × 800px",
      suggestedPath: "gallery-image/fc2web-gallery-game.webp",
    },
    {
      label: "IMAGE 05",
      id: "gallery-diary",
      description: "長年続いている日記・趣味サイト",
      ratio: "16:10",
      size: "1280 × 800px",
      suggestedPath: "gallery-image/fc2web-gallery-diary.webp",
    },
    {
      label: "IMAGE 06",
      id: "heisei-web-culture",
      description: "平成Web文化を現代風に再構成したビジュアル",
      ratio: "3:2",
      size: "1500 × 1000px",
      suggestedPath: "gallery-image/fc2web-heisei-culture.webp",
    },
    {
      label: "IMAGE 07",
      id: "final-cta",
      description: "夜のインターネット空間に浮かぶ個人サイト",
      ratio: "16:9",
      size: "1920 × 1080px",
      suggestedPath: "gallery-image/fc2web-final-cta.webp",
    },
  ];

  window.FC2_REDESIGN_IMAGE_REPLACE_POINTS = imageReplacePoints;

  function closeMenu() {
    if (!header || !menuButton) return;
    header.classList.remove("menu-open");
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.querySelector(".sr-only").textContent = "メニューを開く";
  }

  if (header && menuButton && nav) {
    menuButton.addEventListener("click", function () {
      const isOpen = header.classList.toggle("menu-open");
      menuButton.setAttribute("aria-expanded", String(isOpen));
      menuButton.querySelector(".sr-only").textContent = isOpen ? "メニューを閉じる" : "メニューを開く";
    });

    nav.addEventListener("click", function (event) {
      if (event.target.closest("a")) closeMenu();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeMenu();
    });
  }

  if (!reduceMotion && "IntersectionObserver" in window) {
    const revealElements = Array.from(document.querySelectorAll(".reveal-on-scroll"));
    revealElements.forEach(function (element) {
      const rect = element.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.95) {
        element.classList.add("is-visible");
      }
    });
    document.documentElement.classList.add("fc2-animate");
    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    revealElements.forEach(function (element) {
      observer.observe(element);
    });
  } else {
    document.querySelectorAll(".reveal-on-scroll").forEach(function (element) {
      element.classList.add("is-visible");
    });
  }

  if (randomButton) {
    randomButton.addEventListener("click", function () {
      randomButton.classList.add("is-clicked");
      randomButton.textContent = "どこかのホームページへ準備中...";
      window.setTimeout(function () {
        randomButton.classList.remove("is-clicked");
        randomButton.textContent = "ランダムに訪問する";
      }, 900);
    });
  }
})();

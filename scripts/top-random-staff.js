(() => {
  const staff = [
    {
      number: "MMC-001",
      name: "ほのちゃん",
      summary: "会社の安心感を支える総務課長",
      href: "members/hono.html"
    },
    {
      number: "MMC-002",
      name: "ショウマ",
      summary: "知見を資産に変える企画営業部長",
      href: "members/shoma.html"
    },
    {
      number: "MMC-003",
      name: "たかけん",
      summary: "遊び心を体験へ変えるゲーム制作部長",
      href: "members/takaken.html"
    },
    {
      number: "MMC-004",
      name: "マイケル",
      summary: "海外AIニュースを届ける調査主任",
      href: "members/michael.html"
    },
    {
      number: "MMC-005",
      name: "DG",
      summary: "人狼文化を観測する人狼界隈観測課長",
      href: "members/dg.html"
    },
    {
      number: "MMC-006",
      name: "ねむちゃん",
      summary: "社員の居場所を整える人事部長",
      href: "members/nemu.html"
    },
    {
      number: "MMC-007",
      name: "レイちゃん",
      summary: "会社らしさを磨くブランドデザイナー",
      href: "members/rei.html"
    },
    {
      number: "MMC-008",
      name: "アキト",
      summary: "思いつきを設計へ変える開発推進主任",
      href: "members/akito.html"
    },
    {
      number: "MMC-009",
      name: "ケイ",
      summary: "伝わる導線を整える広報部長",
      href: "members/kei.html"
    },
    {
      number: "MMC-010",
      name: "誠",
      summary: "安心してAIを使うための確認担当",
      href: "members/makoto.html"
    },
    {
      number: "MMC-011",
      name: "コトちゃん",
      summary: "体験を読者に届く記事へ整える編集主任",
      href: "members/koto.html"
    },
    {
      number: "CC-001",
      name: "ペチ",
      summary: "忖度なしに観測する社外協力者",
      href: "members/pechi.html"
    }
  ];

  const shuffle = (items) => {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
    }
    return result;
  };

  const renderCard = (member) => {
    const card = document.createElement("a");
    card.href = member.href;
    card.className = "staff-card";

    const number = document.createElement("span");
    number.textContent = member.number;

    const name = document.createElement("strong");
    name.textContent = member.name;

    const summary = document.createElement("small");
    summary.textContent = member.summary;

    card.append(number, name, summary);
    return card;
  };

  const init = () => {
    const grid = document.querySelector("[data-random-staff-grid]");
    if (!grid) {
      return;
    }

    const selected = shuffle(staff).slice(0, 3);
    grid.replaceChildren(...selected.map(renderCard));
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

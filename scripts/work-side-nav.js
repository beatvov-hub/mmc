(() => {
  const sideNav = document.querySelector(".work-side-nav");
  if (!sideNav) return;

  const links = Array.from(sideNav.querySelectorAll('a[href^="#"]'));
  const sections = links
    .map((link) => {
      const id = decodeURIComponent(link.getAttribute("href").slice(1));
      const section = document.getElementById(id);
      return section ? { link, section } : null;
    })
    .filter(Boolean);

  if (!sections.length) return;

  const setActive = (activeLink) => {
    links.forEach((link) => {
      const isActive = link === activeLink;
      link.classList.toggle("is-active", isActive);
      if (isActive) {
        link.setAttribute("aria-current", "true");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  };

  const currentByScroll = () => {
    const offset = 130;
    let current = sections[0];
    for (const item of sections) {
      if (item.section.getBoundingClientRect().top <= offset) {
        current = item;
      }
    }
    setActive(current.link);
  };

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible[0]) {
          const active = sections.find((item) => item.section === visible[0].target);
          if (active) setActive(active.link);
        } else {
          currentByScroll();
        }
      },
      {
        rootMargin: "-120px 0px -58% 0px",
        threshold: [0, 0.12, 0.28],
      }
    );

    sections.forEach(({ section }) => observer.observe(section));
  }

  window.addEventListener("scroll", currentByScroll, { passive: true });
  window.addEventListener("resize", currentByScroll);
  currentByScroll();
})();

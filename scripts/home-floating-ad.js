(() => {
  const about = document.querySelector('#about');
  const ad = document.querySelector('.home-floating-ad');
  if (!about || !ad) return;

  let scheduled = false;
  const update = () => {
    scheduled = false;
    const visible = window.matchMedia('(min-width: 1024px) and (min-height: 680px)').matches && about.getBoundingClientRect().bottom <= 0;
    ad.classList.toggle('is-visible', visible);
    ad.setAttribute('aria-hidden', String(!visible));
  };
  const scheduleUpdate = () => {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(update);
    }
  };
  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate);
  update();
})();

/* AdSense manual units only. AdMax and the Google ownership script are separate. */
(async () => {
  try {
    const [configResponse, routesResponse] = await Promise.all([
      fetch('/src/data/adsense-config.json'),
      fetch('/src/data/adsense-routes.json')
    ]);
    if (!configResponse.ok || !routesResponse.ok) return;
    const [config, routes] = await Promise.all([configResponse.json(), routesResponse.json()]);
    if (config.enabled !== true || !Object.hasOwn(routes, location.pathname)) return;
    const group = config.groups?.[routes[location.pathname]];
    if (group?.enabled !== true || !/^\d+$/.test(group.slot || '') ||
        !/^ca-pub-\d+$/.test(config.client || '') || document.querySelector('[data-mmc-adsense-unit]')) return;
    const main = document.querySelector('main');
    if (!main) return;

    const container = document.createElement('aside');
    container.dataset.mmcAdsenseUnit = '';
    container.setAttribute('aria-label', '広告');
    container.style.cssText = 'display:block;clear:both;width:min(100% - 32px,728px);margin:64px auto;text-align:center';
    const label = document.createElement('p');
    label.textContent = '広告';
    label.style.cssText = 'margin:0 0 8px;color:#6b6259;font-size:.75rem;line-height:1.5';
    const unit = document.createElement('ins');
    unit.className = 'adsbygoogle';
    unit.style.display = 'block';
    unit.dataset.adClient = config.client;
    unit.dataset.adSlot = group.slot;
    unit.dataset.adFormat = 'auto';
    unit.dataset.fullWidthResponsive = 'true';
    container.append(label, unit);
    main.appendChild(container);

    const observer = new MutationObserver(() => {
      if (unit.dataset.adStatus === 'unfilled') {
        observer.disconnect();
        container.remove();
      }
    });
    observer.observe(unit, { attributes: true, attributeFilter: ['data-ad-status'] });
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (_) {
      observer.disconnect();
      container.remove();
    }
  } catch (_) {
    // Missing configuration or an unavailable network must not affect the page.
  }
})();

// Amazon注文履歴ページから領収書URL候補を収集する。
(function () {
  if (window.__receiptAmazonInjected) return;
  window.__receiptAmazonInjected = true;

  function parseDate(text) {
    const m = text.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
    if (!m) return null;
    return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
  }

  const cardSelectors = [
    '.order-card',
    '.order',
    '.a-box-group',
    '[data-order-id]'
  ];

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action !== 'COLLECT_RECEIPT_URLS' || msg.service !== 'amazon') return;

    const urls = new Set();
    const cards = cardSelectors.flatMap((s) => [...document.querySelectorAll(s)]);

    cards.forEach((card) => {
      const txt = card.textContent || '';
      const d = parseDate(txt);
      if (!d || d.y !== msg.year || d.m !== msg.month) return;
      card.querySelectorAll('a[href]').forEach((a) => {
        const t = (a.textContent || '').trim();
        if (/領収書|請求書|適格請求書|invoice|receipt/i.test(t)) {
          urls.add(new URL(a.href, location.href).href);
        }
      });
    });

    sendResponse({ urls: [...urls] });
  });
})();

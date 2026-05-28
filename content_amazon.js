// Amazon注文履歴ページから領収書URL候補を収集する。
(function () {
  if (window.__receiptAmazonInjected) return;
  window.__receiptAmazonInjected = true;

  function parseDate(text) {
    if (!text) return null;
    const patterns = [
      /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/,
      /(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/
    ];
    for (const re of patterns) {
      const m = text.match(re);
      if (m) return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
    }
    return null;
  }

  function isReceiptAnchor(anchor) {
    const t = (anchor.textContent || '').trim();
    const href = anchor.href || '';
    return /領収書|請求書|適格請求書|領収書等|invoice|receipt/i.test(t) || /invoice|receipt|print|pdf/i.test(href);
  }

  const cardSelectors = [
    '.order-card', '.order', '.a-box-group', '[data-order-id]',
    'div[class*="order"]', 'div[data-component="order-card"]'
  ];

  function collectReceiptLinks() {
    return [...document.querySelectorAll('a[href]')]
      .filter(isReceiptAnchor)
      .map((a) => new URL(a.href, location.href).href);
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action !== 'COLLECT_RECEIPT_URLS' || msg.service !== 'amazon') return;

    const urls = new Set();
    const cards = cardSelectors.flatMap((s) => [...document.querySelectorAll(s)]);

    cards.forEach((card) => {
      const txt = card.textContent || '';
      const d = parseDate(txt);
      if (!d || d.y !== msg.year || d.m !== msg.month) return;
      card.querySelectorAll('a[href]').forEach((a) => {
        if (isReceiptAnchor(a)) urls.add(new URL(a.href, location.href).href);
      });
    });

    if (urls.size === 0) {
      collectReceiptLinks().forEach((u) => urls.add(u));
    }

    sendResponse({ urls: [...urls] });
  });
})();

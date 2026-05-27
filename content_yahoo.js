// Yahoo!ショッピング注文履歴ページから領収書URL候補を収集する。
(function () {
  if (window.__receiptYahooInjected) return;
  window.__receiptYahooInjected = true;

  function parseDate(text) {
    const m = text.match(/(\d{4})[年\/-](\d{1,2})[月\/-](\d{1,2})/);
    if (!m) return null;
    return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action !== 'COLLECT_RECEIPT_URLS' || msg.service !== 'yahoo') return;

    const urls = new Set();
    const cards = document.querySelectorAll('li, article, div');

    cards.forEach((card) => {
      const txt = card.textContent || '';
      const d = parseDate(txt);
      if (!d || d.y !== msg.year || d.m !== msg.month) return;
      card.querySelectorAll('a[href]').forEach((a) => {
        const t = (a.textContent || '').trim();
        if (/領収書|請求書|明細/.test(t) || /receipt|invoice/i.test(a.href)) {
          urls.add(new URL(a.href, location.href).href);
        }
      });
    });

    sendResponse({ urls: [...urls] });
  });
})();

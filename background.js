importScripts('pdf_parser.js');

const parser = self.ReceiptPdfParser;

function toDataUrl(arrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(arrayBuffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:application/pdf;base64,${btoa(binary)}`;
}

function resolveSaveDir(type) {
  return type === 'amazon' ? '領収書/Amazon/' : '領収書/Yahoo/';
}

async function downloadPdf(arrayBuffer, filename, type) {
  const savePath = `${resolveSaveDir(type)}${filename}`;
  const url = toDataUrl(arrayBuffer);
  const id = await chrome.downloads.download({
    url,
    filename: savePath,
    conflictAction: 'uniquify',
    saveAs: false
  });
  return { id, savePath };
}

async function fetchPdf(url) {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`PDF取得に失敗: ${res.status}`);
  return res.arrayBuffer();
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    try {
      if (message.action === 'PROCESS_PDF_FILE') {
        const text = await parser.extractTextFromPdf(message.arrayBuffer);
        const parsed = parser.parseReceiptByType(text);
        const filename = parser.buildReceiptFilename(parsed);
        const saved = await downloadPdf(message.arrayBuffer, filename, parsed.type);
        sendResponse({ ok: true, parsed: { ...parsed, filename }, saved });
        return;
      }

      if (message.action === 'PROCESS_PDF_URL') {
        const arrayBuffer = await fetchPdf(message.pdfUrl);
        const text = await parser.extractTextFromPdf(arrayBuffer);
        const parsed = parser.parseReceiptByType(text, message.expectedType || null);
        const filename = parser.buildReceiptFilename(parsed);
        const saved = await downloadPdf(arrayBuffer, filename, parsed.type);
        sendResponse({ ok: true, parsed: { ...parsed, filename }, saved });
        return;
      }

      sendResponse({ ok: false, error: 'Unknown action' });
    } catch (error) {
      sendResponse({ ok: false, error: error.message || String(error) });
    }
  })();
  return true;
});

const logEl = document.getElementById('log');
const monthEl = document.getElementById('month');
const yearEl = document.getElementById('year');
const manualFilesEl = document.getElementById('manualFiles');

const now = new Date();
yearEl.value = now.getFullYear();
for (let m = 1; m <= 12; m++) {
  const opt = document.createElement('option');
  opt.value = String(m);
  opt.textContent = String(m);
  if (m === now.getMonth() + 1) opt.selected = true;
  monthEl.appendChild(opt);
}

function log(msg) {
  logEl.textContent += `${msg}\n`;
  logEl.scrollTop = logEl.scrollHeight;
}

function selectedService() {
  return document.querySelector('input[name="service"]:checked').value;
}

async function processManual() {
  const files = [...manualFilesEl.files || []];
  if (files.length === 0) return log('失敗: PDFファイルを選択してください');

  let success = 0; let fail = 0;
  log(`手動処理開始: ${files.length}件`);

  for (const file of files) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const res = await chrome.runtime.sendMessage({ action: 'PROCESS_PDF_FILE', arrayBuffer });
      if (!res?.ok) throw new Error(res?.error || '不明なエラー');
      success++;
      log(`保存成功: ${res.saved.savePath}`);
    } catch (e) {
      fail++;
      log(`失敗(${file.name}): ${e.message}`);
    }
  }
  log(`完了: 成功 ${success} / 失敗 ${fail}`);
}

async function processAuto() {
  const year = Number(yearEl.value);
  const month = Number(monthEl.value);
  const service = selectedService();
  log(`自動取得開始: ${year}年${month}月 / ${service}`);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return log('失敗: アクティブタブが取得できません');

  const targets = service === 'both' ? ['yahoo', 'amazon'] : [service];
  let total = 0; let success = 0; let fail = 0;

  for (const target of targets) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: [target === 'amazon' ? 'content_amazon.js' : 'content_yahoo.js']
      });
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'COLLECT_RECEIPT_URLS', year, month, service: target });
      const urls = response?.urls || [];
      total += urls.length;
      log(`${target}: 対象 ${urls.length}件`);

      for (const u of urls) {
        const r = await chrome.runtime.sendMessage({ action: 'PROCESS_PDF_URL', pdfUrl: u, expectedType: target });
        if (r?.ok) {
          success++;
          log(`保存成功: ${r.saved.savePath}`);
        } else {
          fail++;
          log(`失敗(${u}): ${r?.error || '不明'}`);
        }
      }
    } catch (e) {
      log(`${target}: 実行失敗 (${e.message})`);
      fail++;
    }
  }
  log(`完了: 取得対象 ${total} / 保存成功 ${success} / 失敗 ${fail}`);
}

document.getElementById('runManual').addEventListener('click', processManual);
document.getElementById('runAuto').addEventListener('click', processAuto);

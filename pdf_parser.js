// PDF parsing helpers for Amazon / Yahoo receipts.

function normalizeWhitespace(text) {
  return (text || "").replace(/\u3000/g, " ").replace(/\s+/g, " ").trim();
}

function formatDateYYYYMMDD(y, m, d) {
  return `${y}${String(m).padStart(2, "0")}${String(d).padStart(2, "0")}`;
}

function sanitizeFilenamePart(part) {
  return String(part || "").replace(/[\\/:*?"<>|]/g, "").trim();
}

async function extractTextFromPdf(arrayBuffer) {
  // Fallback parser: extract printable text from PDF binary stream.
  // If pdf.js is later bundled, this function can be replaced with full extraction.
  const latin1 = new TextDecoder("latin1").decode(arrayBuffer);
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(arrayBuffer);
  const combined = `${latin1}\n${utf8}`;

  // Try to capture text blocks inside parentheses often used in PDF text operators.
  const chunks = [];
  const re = /\(([^)]{1,500})\)/g;
  let m;
  while ((m = re.exec(combined)) !== null) {
    chunks.push(m[1].replace(/\\([()\\])/g, "$1"));
  }

  const extracted = normalizeWhitespace(`${chunks.join("\n")}\n${combined}`);
  if (!extracted) {
    throw new Error("PDFテキスト抽出に失敗しました");
  }
  return extracted;
}

function detectReceiptType(text) {
  if (/amazon|アマゾン|注文番号\s*\d{3}-\d+/i.test(text)) return "amazon";
  if (/yahoo|ヤフー|合計金額[:：]/i.test(text)) return "yahoo";
  return "unknown";
}

function parseAmazonReceipt(text) {
  const normalized = normalizeWhitespace(text);
  const dateMatch = normalized.match(/注文日\s*(\d{4})-(\d{2})-(\d{2})/);
  if (!dateMatch) throw new Error("Amazon: 注文日が見つかりません");

  const totalMatches = [...normalized.matchAll(/合計\s*￥\s*([\d,]+)/g)];
  let amount = "";

  if (totalMatches.length > 0) {
    amount = totalMatches[totalMatches.length - 1][1].replace(/,/g, "");
  } else {
    const allAmounts = [...normalized.matchAll(/￥\s*([\d,]+)/g)].map((x) => Number(x[1].replace(/,/g, ""))).filter(Number.isFinite);
    if (allAmounts.length > 0) amount = String(Math.max(...allAmounts));
  }
  if (!amount) throw new Error("Amazon: 合計金額が見つかりません");

  const orderDate = formatDateYYYYMMDD(dateMatch[1], dateMatch[2], dateMatch[3]);
  return { type: "amazon", supplier: "Amazon", orderDate, amount };
}

function parseYahooReceipt(text) {
  const normalized = normalizeWhitespace(text);
  const dateMatch = normalized.match(/注文日[:：]\s*(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/);
  if (!dateMatch) throw new Error("Yahoo: 注文日が見つかりません");

  const amountMatch = normalized.match(/合計金額[:：]\s*([\d,]+)円/);
  if (!amountMatch) throw new Error("Yahoo: 合計金額が見つかりません");

  return {
    type: "yahoo",
    supplier: "ヤフーショッピング",
    orderDate: formatDateYYYYMMDD(dateMatch[1], dateMatch[2], dateMatch[3]),
    amount: amountMatch[1].replace(/,/g, "")
  };
}

function buildReceiptFilename(parsed) {
  return `${sanitizeFilenamePart(parsed.orderDate)}_${sanitizeFilenamePart(parsed.supplier)}_${sanitizeFilenamePart(parsed.amount)}円_領収書.pdf`;
}

function parseReceiptByType(text, expectedType = null) {
  const detected = expectedType || detectReceiptType(text);
  if (detected === "amazon") {
    const parsed = parseAmazonReceipt(text);
    parsed.filename = buildReceiptFilename(parsed);
    return parsed;
  }
  if (detected === "yahoo") {
    const parsed = parseYahooReceipt(text);
    parsed.filename = buildReceiptFilename(parsed);
    return parsed;
  }
  throw new Error("領収書種別を判定できませんでした");
}

self.ReceiptPdfParser = {
  extractTextFromPdf,
  detectReceiptType,
  parseAmazonReceipt,
  parseYahooReceipt,
  buildReceiptFilename,
  parseReceiptByType
};

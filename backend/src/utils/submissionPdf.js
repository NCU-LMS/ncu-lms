import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { PDFDocument as PdfLibDocument } from "pdf-lib";

// 中文字型：可用 PDF_FONT_PATH / PDF_FONT_NAME 指定，否則依序嘗試常見系統字型
const FONT_CANDIDATES = [
  { file: process.env.PDF_FONT_PATH, name: process.env.PDF_FONT_NAME },
  { file: "C:/Windows/Fonts/msjh.ttc", name: "MicrosoftJhengHeiRegular" },
  { file: "C:/Windows/Fonts/kaiu.ttf" },
  { file: "C:/Windows/Fonts/mingliu.ttc", name: "MingLiU" },
  { file: "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc", name: "NotoSansCJKtc-Regular" },
  { file: "/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc", name: "NotoSansCJKtc-Regular" },
  { file: "/System/Library/Fonts/PingFang.ttc", name: "PingFangTC-Regular" },
];

let cachedFont;
function resolveFont() {
  if (cachedFont !== undefined) return cachedFont;
  cachedFont = null;
  for (const candidate of FONT_CANDIDATES) {
    if (!candidate.file || !fs.existsSync(candidate.file)) continue;
    try {
      const probe = new PDFDocument({ autoFirstPage: false });
      probe.font(candidate.file, candidate.name);
      cachedFont = candidate;
      break;
    } catch {
      /* 這個字型讀不到，換下一個 */
    }
  }
  if (!cachedFont) console.warn("[submission-pdf] 找不到中文字型，PDF 中文可能無法顯示；請設定 PDF_FONT_PATH");
  return cachedFont;
}

function renderTextPdf(draw) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const font = resolveFont();
    if (font) doc.font(font.file, font.name);
    draw(doc);
    doc.end();
  });
}

async function appendPdfBytes(target, bytes) {
  const src = await PdfLibDocument.load(bytes, { ignoreEncryption: true });
  const pages = await target.copyPages(src, src.getPageIndices());
  pages.forEach((page) => target.addPage(page));
}

async function appendImage(target, bytes, ext) {
  const image = ext === ".png" ? await target.embedPng(bytes) : await target.embedJpg(bytes);
  const [pageW, pageH, margin] = [595.28, 841.89, 40];
  const scale = Math.min((pageW - margin * 2) / image.width, (pageH - margin * 2) / image.height, 1);
  const w = image.width * scale;
  const h = image.height * scale;
  const page = target.addPage([pageW, pageH]);
  page.drawImage(image, { x: (pageW - w) / 2, y: pageH - margin - h, width: w, height: h });
}

async function noticePage(target, message) {
  await appendPdfBytes(target, await renderTextPdf((doc) => doc.fontSize(12).fillColor("#b91c1c").text(message)));
}

/** 把一個附件併入 PDF；PDF 直接接頁、圖片轉成一頁，其它格式留說明頁 */
async function appendAttachment(target, file) {
  const ext = path.extname(file.name || file.abs || "").toLowerCase();
  if (!fs.existsSync(file.abs)) {
    await noticePage(target, `附件「${file.name}」檔案不存在，無法合併。`);
    return;
  }
  try {
    const bytes = await fs.promises.readFile(file.abs);
    if (ext === ".pdf") await appendPdfBytes(target, bytes);
    else if ([".png", ".jpg", ".jpeg"].includes(ext)) await appendImage(target, bytes, ext);
    else await noticePage(target, `附件「${file.name}」為 ${ext || "未知"} 格式，無法合併進 PDF，請下載 ZIP 查看原檔。`);
  } catch (error) {
    console.error("[submission-pdf] 合併附件失敗：", file.abs, error?.message || error);
    await noticePage(target, `附件「${file.name}」讀取失敗（檔案可能損毀或加密），請下載原檔查看。`);
  }
}

function drawStudentAnswers(doc, questions, student) {
  doc.fontSize(13).fillColor("#1f2937").text(`學生：${student.name || "未命名"}（${student.studentId}）`);
  if (student.submittedAt) {
    doc.fontSize(10).fillColor("#4b5563").text(`繳交時間：${new Date(student.submittedAt).toLocaleString("zh-TW")}`);
  }
  doc.moveDown(0.35);
  const count = Math.max(questions.length, student.answers.length, 1);
  for (let i = 0; i < count; i += 1) {
    const q = questions[i];
    const text = String(student.answers[i] ?? "").trim();
    const attachments = student.files.filter((file) => file.index === i);
    doc.fontSize(13).fillColor("#1d4ed8").text(`第 ${i + 1} 題：${q?.title || "（無標題）"}`);
    if (q?.description) doc.moveDown(0.2).fontSize(10).fillColor("#6b7280").text(q.description);
    doc.moveDown(0.3).fontSize(11).fillColor("#111827").text(text || "（無文字作答）");
    if (attachments.length) {
      doc.moveDown(0.25).fontSize(9).fillColor("#047857")
        .text(`附件：${attachments.map((file) => file.name).join("、")}`);
    }
    if (i < count - 1) doc.moveDown(0.45);
  }
}

/**
 * 產生單一學生的合併 PDF：題目與文字作答連續排版，附件接在文字之後。
 * student: { name, studentId, submittedAt, answers: string[], files: [{ index, name, abs }] }
 */
export async function buildStudentPdf(homework, questions, student) {
  const target = await PdfLibDocument.create();
  const bytes = await renderTextPdf((doc) => {
    doc.fontSize(18).fillColor("#1f2937").text(homework.title || "作業");
    doc.moveDown(0.35);
    drawStudentAnswers(doc, questions, student);
  });
  await appendPdfBytes(target, bytes);
  for (const file of student.files) await appendAttachment(target, file);
  return Buffer.from(await target.save());
}

/** 全班合併：學生文字作答連續接排，不因換學生而強制換頁。附件集中接在文字之後。 */
export async function buildClassMergedPdf(homework, questions, students) {
  const target = await PdfLibDocument.create();
  const textBytes = await renderTextPdf((doc) => {
    doc.fontSize(18).fillColor("#1f2937").text(homework.title || "作業");
    doc.moveDown(0.2).fontSize(11).fillColor("#4b5563").text(`全班合併作答（共 ${students.length} 份）`);
    doc.moveDown(0.5);
    students.forEach((student, index) => {
      if (index > 0) {
        doc.moveDown(0.45);
        doc.fontSize(9).fillColor("#9ca3af").text("─".repeat(36));
        doc.moveDown(0.35);
      }
      drawStudentAnswers(doc, questions, student);
    });
  });
  await appendPdfBytes(target, textBytes);
  for (const student of students) {
    for (const file of student.files) await appendAttachment(target, file);
  }
  return Buffer.from(await target.save());
}

export async function concatPdfs(buffers) {
  const target = await PdfLibDocument.create();
  for (const bytes of buffers) await appendPdfBytes(target, bytes);
  return Buffer.from(await target.save());
}

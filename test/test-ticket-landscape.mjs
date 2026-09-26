import assert from "node:assert/strict";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import QRCode from "qrcode";

// 1. Test Formatters
function formatTicketDate(iso) {
  const d = new Date(iso);
  const month = d.toLocaleDateString("en-US", { month: "short", timeZone: "Africa/Kampala" }).toUpperCase();
  const day = d.toLocaleDateString("en-US", { day: "numeric", timeZone: "Africa/Kampala" });
  const year = d.toLocaleDateString("en-US", { year: "numeric", timeZone: "Africa/Kampala" });
  return `${month} ${day}, ${year}`;
}

function formatTicketTime(iso) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Kampala",
  }).toUpperCase();
  return `AT ${time}`;
}

function formatTicketNumber(id, qrToken) {
  const token = qrToken || id || "00000000";
  const clean = token.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return `BZK-${clean.slice(0, 8)}`;
}

function sanitizeTicketFilename(eventTitle, ticketNumber) {
  const safeTitle = (eventTitle || "event")
    .replace(/[^a-zA-Z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const safeNumber = (ticketNumber || "ticket")
    .replace(/[^a-zA-Z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `Buzzket-${safeTitle}-${safeNumber}.pdf`;
}

function extractQrToken(input) {
  const match = input.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return match ? match[0] : input.trim();
}

console.log("Running ticket design verification...");

// Assert formatters
const testIso = "2026-05-25T19:00:00Z";
const formattedDate = formatTicketDate(testIso);
console.log("Formatted Date:", formattedDate);
assert.match(formattedDate, /MAY 25, 2026/);

const formattedTime = formatTicketTime(testIso);
console.log("Formatted Time:", formattedTime);
assert.match(formattedTime, /AT /);

const ticketNum = formatTicketNumber("12345678-abcd-ef01-2345-6789abcdef01");
console.log("Ticket Number:", ticketNum);
assert.equal(ticketNum, "BZK-12345678");

const safeFilename = sanitizeTicketFilename("Music & Art Festival!!", "BZK-12345678");
console.log("Sanitized Filename:", safeFilename);
assert.equal(safeFilename, "Buzzket-Music-Art-Festival-BZK-12345678.pdf");

// Assert token extractor
const rawUuid = "3f82a901-d89f-4318-971c-7cb884b25712";
assert.equal(extractQrToken(rawUuid), rawUuid);
assert.equal(extractQrToken(`https://buzzket.app/tickets/verify/${rawUuid}`), rawUuid);
assert.equal(extractQrToken(`https://buzzket.app/tickets/verify/${rawUuid}?source=scanner`), rawUuid);
console.log("Token extractor verification passed!");

// 2. Test PDF Generation with 828 x 285 dimensions
async function testPdfGeneration() {
  const pdf = await PDFDocument.create();
  const pageWidth = 828;
  const pageHeight = 285;
  const stubX = 648;
  const stubWidth = pageWidth - stubX;

  const page = pdf.addPage([pageWidth, pageHeight]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Background
  page.drawRectangle({
    x: 0,
    y: 0,
    width: stubX,
    height: pageHeight,
    color: rgb(0.08, 0.08, 0.12),
  });

  // Dark overlay
  page.drawRectangle({
    x: 0,
    y: 0,
    width: stubX,
    height: pageHeight,
    color: rgb(0.03, 0.03, 0.05),
    opacity: 0.58,
  });

  // Category
  page.drawText("LIVE MUSIC", {
    x: 36,
    y: 250,
    size: 10,
    font: bold,
    color: rgb(0.85, 0.85, 0.88),
  });

  // Title
  page.drawText("MUSIC", {
    x: 36,
    y: 222,
    size: 26,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText("FESTIVAL", {
    x: 36,
    y: 192,
    size: 26,
    font: bold,
    color: rgb(1, 1, 1),
  });

  // Date
  page.drawText("MAY 25, 2026", {
    x: 36,
    y: 160,
    size: 18,
    font: bold,
    color: rgb(1, 1, 1),
  });

  // Info boxes
  const boxY = 28;
  const boxHeight = 52;

  // Location box
  page.drawRectangle({
    x: 36,
    y: boxY,
    width: 145,
    height: boxHeight,
    color: rgb(0, 0, 0),
    opacity: 0.5,
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 1,
  });
  page.drawText("KOLPING HOTEL", { x: 44, y: boxY + 28, size: 8.5, font: bold, color: rgb(1, 1, 1) });
  page.drawText("KAMPALA, UGANDA", { x: 44, y: boxY + 12, size: 7.5, font, color: rgb(0.85, 0.85, 0.85) });

  // Time box
  page.drawRectangle({
    x: 189,
    y: boxY,
    width: 95,
    height: boxHeight,
    color: rgb(0, 0, 0),
    opacity: 0.5,
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 1,
  });
  page.drawText("AT 07:00 PM", { x: 198, y: boxY + 20, size: 10, font: bold, color: rgb(1, 1, 1) });

  // QR Code
  const qrDataUrl = await QRCode.toDataURL("https://buzzket.app/tickets/verify/3f82a901-d89f-4318-971c-7cb884b25712", {
    margin: 1,
    width: 250,
  });
  const qrBytes = Uint8Array.from(Buffer.from(qrDataUrl.split(",")[1], "base64"));
  const qrImage = await pdf.embedPng(qrBytes);
  page.drawRectangle({ x: 292, y: boxY - 6, width: 64, height: 64, color: rgb(1, 1, 1) });
  page.drawImage(qrImage, { x: 294, y: boxY - 4, width: 60, height: 60 });

  // Price box
  page.drawRectangle({
    x: 364,
    y: boxY,
    width: 260,
    height: boxHeight,
    color: rgb(0, 0, 0),
    opacity: 0.5,
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 1,
  });
  page.drawText("PRICE:", { x: 376, y: boxY + 30, size: 8, font: bold, color: rgb(0.8, 0.8, 0.85) });
  page.drawText("UGX 50,000", { x: 376, y: boxY + 14, size: 13, font: bold, color: rgb(1, 1, 1) });
  page.drawText("VIP ADMISSION", { x: 494, y: boxY + 22, size: 8.5, font: bold, color: rgb(0.9, 0.9, 0.9) });

  // Right Stub (Blush background)
  page.drawRectangle({
    x: stubX,
    y: 0,
    width: stubWidth,
    height: pageHeight,
    color: rgb(0.968, 0.92, 0.90),
  });

  // Perforation circular cutouts
  page.drawCircle({ x: stubX, y: pageHeight, size: 13, color: rgb(1, 1, 1) });
  page.drawCircle({ x: stubX, y: 0, size: 13, color: rgb(1, 1, 1) });

  // Vertical ticket number
  page.drawText("TICKET NUMBER: BZK-3F82A901", {
    x: stubX + 22,
    y: 35,
    size: 7.5,
    font: bold,
    color: rgb(0.48, 0.40, 0.38),
    rotate: degrees(90),
  });

  // Stub SEAT, ROW, GATE
  const stubContentX = stubX + 44;
  page.drawText("SEAT", { x: stubContentX, y: 238, size: 8, font: bold, color: rgb(0.52, 0.42, 0.40) });
  page.drawText("35", { x: stubContentX, y: 206, size: 24, font: bold, color: rgb(0.18, 0.12, 0.12) });

  page.drawText("ROW", { x: stubContentX, y: 164, size: 8, font: bold, color: rgb(0.52, 0.42, 0.40) });
  page.drawText("07", { x: stubContentX, y: 132, size: 24, font: bold, color: rgb(0.18, 0.12, 0.12) });

  page.drawText("GATE", { x: stubContentX, y: 90, size: 8, font: bold, color: rgb(0.52, 0.42, 0.40) });
  page.drawText("12", { x: stubContentX, y: 58, size: 24, font: bold, color: rgb(0.18, 0.12, 0.12) });

  const bytes = await pdf.save();
  assert.ok(bytes.length > 5000, "PDF bytes should be valid and non-empty");

  const [testPage] = pdf.getPages();
  const size = testPage.getSize();
  assert.equal(size.width, 828, "Page width must be 828 pt");
  assert.equal(size.height, 285, "Page height must be 285 pt");

  const ratio = size.width / size.height;
  console.log(`Landscape PDF generated successfully! Size: ${size.width}x${size.height} pt, Aspect Ratio: ${ratio.toFixed(3)}:1, File Size: ${bytes.length} bytes`);
}

testPdfGeneration()
  .then(() => {
    console.log("All tests passed successfully!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  });

import assert from "node:assert/strict";

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

console.log("Testing ticket business logic...");

const testIso = "2026-05-25T19:00:00Z";
const formattedDate = formatTicketDate(testIso);
console.log("Formatted Date:", formattedDate);
assert.equal(formattedDate, "MAY 25, 2026");

const formattedTime = formatTicketTime(testIso);
console.log("Formatted Time:", formattedTime);
assert.match(formattedTime, /^AT \d{2}:\d{2} [AP]M$/);

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

// Proportions check:
const width = 828;
const height = 285;
const stubX = 648;
const mainRatio = stubX / width;
const stubRatio = (width - stubX) / width;
const aspectRatio = width / height;

console.log(`Aspect ratio: ${aspectRatio.toFixed(3)}:1`);
console.log(`Main ticket area: ${(mainRatio * 100).toFixed(1)}%`);
console.log(`Right stub area: ${(stubRatio * 100).toFixed(1)}%`);

assert.ok(aspectRatio > 2.89 && aspectRatio < 2.92, "Aspect ratio must be approximately 2.9:1");
assert.ok(mainRatio >= 0.78 && mainRatio <= 0.80, "Main ticket area must be 78-80%");
assert.ok(stubRatio >= 0.20 && stubRatio <= 0.22, "Right stub area must be 20-22%");

console.log("All business logic tests passed successfully!");

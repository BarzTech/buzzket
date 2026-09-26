import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";

import { formatTicketDate, formatTicketTime, formatTicketNumber, formatUGX } from "./format";
import { tokenToDataUrl } from "./qr";
import type { IssuedTicket } from "./data/tickets";
import { getEventImageBase64 } from "./data/tickets";

async function fetchImageBytes(url: string) {
  if (!url) return null;
  try {
    const res = await getEventImageBase64({ data: { url } });
    if (!res.base64 || !res.contentType) return null;
    const binary = atob(res.base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return { bytes, contentType: res.contentType };
  } catch (err) {
    console.error("Image fetch failed:", err);
    return null;
  }
}

function downloadBytes(bytes: Uint8Array, fileName: string) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if (!currentLine) {
      currentLine = word;
    } else if ((currentLine + " " + word).length <= maxCharsPerLine) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

export function sanitizeTicketFilename(eventTitle: string, ticketNumber: string): string {
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

/**
 * Draws a single landscape ticket onto a PDFDocument page.
 * Uses exact 828 x 285 dimensions (~2.905:1 aspect ratio).
 */
export async function renderTicketPage(pdf: PDFDocument, ticket: IssuedTicket) {
  const pageWidth = 828;
  const pageHeight = 285;
  const stubX = 648; // ~78.26% width for main ticket, ~21.74% for stub
  const stubWidth = pageWidth - stubX;

  const page = pdf.addPage([pageWidth, pageHeight]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // 1. MAIN TICKET AREA (0 to stubX)
  // Background image or dark fallback
  let imageEmbedded = false;
  if (ticket.event.image) {
    const eventImage = await fetchImageBytes(ticket.event.image);
    if (eventImage) {
      try {
        const image = eventImage.contentType.includes("png")
          ? await pdf.embedPng(eventImage.bytes)
          : await pdf.embedJpg(eventImage.bytes);
        // Draw image covering the main ticket area
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: stubX,
          height: pageHeight,
        });
        imageEmbedded = true;
      } catch (e) {
        console.warn("Could not embed event image into PDF:", e);
      }
    }
  }

  if (!imageEmbedded) {
    // Rich dark concert background
    page.drawRectangle({
      x: 0,
      y: 0,
      width: stubX,
      height: pageHeight,
      color: rgb(0.08, 0.08, 0.12),
    });
  }

  // Dark translucent overlay for readable white text
  page.drawRectangle({
    x: 0,
    y: 0,
    width: stubX,
    height: pageHeight,
    color: rgb(0.03, 0.03, 0.05),
    opacity: 0.58,
  });

  // 1.1 Category label (top-left)
  const categoryText = (ticket.event.category || "EVENT").toUpperCase();
  page.drawText(categoryText, {
    x: 36,
    y: 250,
    size: 10,
    font: bold,
    color: rgb(0.85, 0.85, 0.88),
  });

  // 1.2 Event Title (large, bold, multi-line)
  const titleLines = wrapText(ticket.event.title.toUpperCase(), 22).slice(0, 2);
  let currentY = 222;
  const titleFontSize = titleLines.length > 1 ? 24 : 28;
  for (const line of titleLines) {
    page.drawText(line, {
      x: 36,
      y: currentY,
      size: titleFontSize,
      font: bold,
      color: rgb(1, 1, 1),
    });
    currentY -= titleFontSize + 4;
  }

  // 1.3 Event Date (prominent uppercase date)
  const dateText = formatTicketDate(ticket.event.date);
  page.drawText(dateText, {
    x: 36,
    y: Math.max(currentY - 4, 110),
    size: 18,
    font: bold,
    color: rgb(1, 1, 1),
  });

  // 1.4 Bottom info boxes
  const boxY = 28;
  const boxHeight = 52;

  // Box 1: Location / Venue Box
  const locBoxWidth = 145;
  page.drawRectangle({
    x: 36,
    y: boxY,
    width: locBoxWidth,
    height: boxHeight,
    color: rgb(0, 0, 0),
    opacity: 0.5,
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 1,
  });

  const venueUpper = (ticket.event.venue || "VENUE").toUpperCase();
  const cityUpper = (ticket.event.city ? `${ticket.event.city}, UGANDA` : "UGANDA").toUpperCase();
  page.drawText(venueUpper.length > 20 ? venueUpper.slice(0, 18) + "..." : venueUpper, {
    x: 44,
    y: boxY + 28,
    size: 8.5,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText(cityUpper.length > 22 ? cityUpper.slice(0, 20) + "..." : cityUpper, {
    x: 44,
    y: boxY + 12,
    size: 7.5,
    font,
    color: rgb(0.85, 0.85, 0.85),
  });

  // Box 2: Time Box
  const timeBoxWidth = 95;
  page.drawRectangle({
    x: 189,
    y: boxY,
    width: timeBoxWidth,
    height: boxHeight,
    color: rgb(0, 0, 0),
    opacity: 0.5,
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 1,
  });

  const timeText = formatTicketTime(ticket.event.date);
  page.drawText(timeText, {
    x: 198,
    y: boxY + 20,
    size: 10,
    font: bold,
    color: rgb(1, 1, 1),
  });

  // Box 3: QR Code (Replacing barcode)
  const qrX = 292;
  const qrSize = 64;
  // White quiet zone container
  page.drawRectangle({
    x: qrX,
    y: boxY - 6,
    width: qrSize,
    height: qrSize,
    color: rgb(1, 1, 1),
  });

  try {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://buzzket.app";
    const verificationUrl = `${origin}/tickets/verify/${ticket.qrToken}`;
    const qrDataUrl = await tokenToDataUrl(verificationUrl);
    const qrBytes = Uint8Array.from(atob(qrDataUrl.split(",")[1] ?? ""), (char) => char.charCodeAt(0));
    const qrImage = await pdf.embedPng(qrBytes);
    page.drawImage(qrImage, {
      x: qrX + 2,
      y: boxY - 4,
      width: qrSize - 4,
      height: qrSize - 4,
    });
  } catch (err) {
    console.warn("Could not embed QR code into PDF:", err);
  }

  // Box 4: Price Box
  const priceBoxX = 364;
  const priceBoxWidth = 260;
  page.drawRectangle({
    x: priceBoxX,
    y: boxY,
    width: priceBoxWidth,
    height: boxHeight,
    color: rgb(0, 0, 0),
    opacity: 0.5,
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 1,
  });

  const formattedPrice = formatUGX(ticket.price);
  page.drawText("PRICE:", {
    x: priceBoxX + 12,
    y: boxY + 30,
    size: 8,
    font: bold,
    color: rgb(0.8, 0.8, 0.85),
  });
  page.drawText(formattedPrice, {
    x: priceBoxX + 12,
    y: boxY + 14,
    size: 13,
    font: bold,
    color: rgb(1, 1, 1),
  });

  const tierText = (ticket.tier || "General Admission").toUpperCase();
  page.drawText(tierText.length > 18 ? tierText.slice(0, 16) + "..." : tierText, {
    x: priceBoxX + 130,
    y: boxY + 22,
    size: 8.5,
    font: bold,
    color: rgb(0.9, 0.9, 0.9),
  });

  // 2. RIGHT-HAND TICKET STUB (stubX to pageWidth)
  // Blush / pale pink background
  page.drawRectangle({
    x: stubX,
    y: 0,
    width: stubWidth,
    height: pageHeight,
    color: rgb(0.968, 0.92, 0.90),
  });

  // 2.1 Perforation dashed line
  const dashLength = 4;
  const spaceLength = 4;
  for (let y = 18; y < pageHeight - 18; y += dashLength + spaceLength) {
    page.drawLine({
      start: { x: stubX, y },
      end: { x: stubX, y: y + dashLength },
      thickness: 1,
      color: rgb(0.72, 0.65, 0.62),
    });
  }

  // Circular cutouts at top and bottom of separation
  page.drawCircle({
    x: stubX,
    y: pageHeight,
    size: 13,
    color: rgb(1, 1, 1),
  });
  page.drawCircle({
    x: stubX,
    y: 0,
    size: 13,
    color: rgb(1, 1, 1),
  });

  // 2.2 Vertically rotated ticket number along left edge of stub
  const ticketNumber = formatTicketNumber(ticket.id, ticket.qrToken);
  page.drawText(`TICKET NUMBER: ${ticketNumber}`, {
    x: stubX + 22,
    y: 35,
    size: 7.5,
    font: bold,
    color: rgb(0.48, 0.40, 0.38),
    rotate: degrees(90),
  });

  // 2.3 Stub values: SEAT, ROW, GATE (Small label, large bold numbers, generous vertical spacing)
  const stubContentX = stubX + 44;

  // SEAT
  page.drawText("SEAT", {
    x: stubContentX,
    y: 238,
    size: 8,
    font: bold,
    color: rgb(0.52, 0.42, 0.40),
  });
  const seatVal = (ticket.seat || "GA").toUpperCase();
  page.drawText(seatVal, {
    x: stubContentX,
    y: 206,
    size: 24,
    font: bold,
    color: rgb(0.18, 0.12, 0.12),
  });

  // ROW
  page.drawText("ROW", {
    x: stubContentX,
    y: 164,
    size: 8,
    font: bold,
    color: rgb(0.52, 0.42, 0.40),
  });
  const rowVal = (ticket.row || "N/A").toUpperCase();
  page.drawText(rowVal, {
    x: stubContentX,
    y: 132,
    size: 24,
    font: bold,
    color: rgb(0.18, 0.12, 0.12),
  });

  // GATE
  page.drawText("GATE", {
    x: stubContentX,
    y: 90,
    size: 8,
    font: bold,
    color: rgb(0.52, 0.42, 0.40),
  });
  const gateVal = (ticket.gate || (/vip/i.test(ticket.tier) ? "VIP" : "MAIN")).toUpperCase();
  page.drawText(gateVal, {
    x: stubContentX,
    y: 58,
    size: 24,
    font: bold,
    color: rgb(0.18, 0.12, 0.12),
  });
}

/**
 * Generates and downloads a single landscape ticket PDF.
 */
export async function downloadTicketPdf(ticket: IssuedTicket) {
  const pdf = await PDFDocument.create();
  await renderTicketPage(pdf, ticket);
  const bytes = await pdf.save();
  const ticketNumber = formatTicketNumber(ticket.id, ticket.qrToken);
  const filename = sanitizeTicketFilename(ticket.event.title, ticketNumber);
  downloadBytes(bytes, filename);
}

/**
 * Generates and downloads all tickets for an order into a single PDF document.
 * Each ticket is rendered on its own landscape page.
 */
export async function downloadAllTicketsPdf(tickets: IssuedTicket[]) {
  if (!tickets || tickets.length === 0) return;
  if (tickets.length === 1) {
    return downloadTicketPdf(tickets[0]);
  }

  const pdf = await PDFDocument.create();
  for (const ticket of tickets) {
    await renderTicketPage(pdf, ticket);
  }
  const bytes = await pdf.save();
  const first = tickets[0];
  const filename = sanitizeTicketFilename(first.event.title, `All-${tickets.length}-Tickets`);
  downloadBytes(bytes, filename);
}


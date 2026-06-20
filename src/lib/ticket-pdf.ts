import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { formatDate, formatUGX } from "./format";
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
    console.error("CORS proxy fetch failed:", err);
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

export async function downloadTicketPdf(ticket: IssuedTicket) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const { width, height } = page.getSize();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.98, 0.98, 0.96) });
  page.drawRectangle({ x: 36, y: 64, width: width - 72, height: height - 128, color: rgb(1, 1, 1) });
  page.drawText("buzzket", { x: 64, y: 690, size: 18, font: bold, color: rgb(0.08, 0.09, 0.1) });
  page.drawText("ADMISSION TICKET", { x: 64, y: 666, size: 10, font, color: rgb(0.35, 0.38, 0.42) });

  const eventImage = await fetchImageBytes(ticket.event.image);
  if (eventImage) {
    try {
      const image = eventImage.contentType.includes("png")
        ? await pdf.embedPng(eventImage.bytes)
        : await pdf.embedJpg(eventImage.bytes);
      page.drawImage(image, { x: 64, y: 480, width: 484, height: 160 });
    } catch {
      page.drawRectangle({ x: 64, y: 480, width: 484, height: 160, color: rgb(0.9, 0.92, 0.94) });
    }
  } else {
    page.drawRectangle({ x: 64, y: 480, width: 484, height: 160, color: rgb(0.9, 0.92, 0.94) });
  }

  page.drawText(ticket.event.title, { x: 64, y: 440, size: 24, font: bold, color: rgb(0.08, 0.09, 0.1), maxWidth: 340 });
  page.drawText(`${ticket.event.venue}${ticket.event.city ? `, ${ticket.event.city}` : ""}`, {
    x: 64,
    y: 414,
    size: 12,
    font,
    color: rgb(0.28, 0.31, 0.35),
    maxWidth: 340,
  });

  const qrDataUrl = await tokenToDataUrl(ticket.qrToken);
  const qrBytes = Uint8Array.from(atob(qrDataUrl.split(",")[1] ?? ""), (char) => char.charCodeAt(0));
  const qrImage = await pdf.embedPng(qrBytes);
  page.drawRectangle({ x: 404, y: 294, width: 128, height: 128, color: rgb(0.96, 0.96, 0.94) });
  page.drawImage(qrImage, { x: 414, y: 304, width: 108, height: 108 });

  const rows = [
    ["Date", formatDate(ticket.event.date)],
    ["Holder", ticket.holder],
    ["Contact", ticket.contactEmail || "N/A"],
    ["Tier", ticket.tier],
    ["Price", formatUGX(ticket.price)],
    ["Ticket ID", ticket.id],
    ["Token", ticket.qrToken],
  ];

  let y = 370;
  for (const [label, value] of rows) {
    page.drawText(label.toUpperCase(), { x: 64, y, size: 9, font: bold, color: rgb(0.45, 0.47, 0.5) });
    page.drawText(value, { x: 150, y, size: 11, font, color: rgb(0.08, 0.09, 0.1), maxWidth: 230 });
    y -= 28;
  }

  page.drawLine({ start: { x: 64, y: 138 }, end: { x: 548, y: 138 }, thickness: 1, color: rgb(0.86, 0.86, 0.84) });
  page.drawText("Show this QR code at the event entrance. Screenshots and printed copies are accepted.", {
    x: 64,
    y: 112,
    size: 10,
    font,
    color: rgb(0.35, 0.38, 0.42),
    maxWidth: 484,
  });

  const bytes = await pdf.save();
  const safeTitle = ticket.event.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  downloadBytes(bytes, `buzzket-${safeTitle || "ticket"}-${ticket.id.slice(0, 8)}.pdf`);
}

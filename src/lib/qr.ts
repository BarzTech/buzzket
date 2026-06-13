import QRCode from "qrcode";

// QR pipeline: each ticket carries a unique cryptographic token (a UUID minted
// server-side in `confirm_reservation` when the order flips to 'paid'). The
// token is the QR payload; the scanner resolves it back to a ticket.

// Mint a fresh token (used client-side only as a fallback before a real
// server-issued token exists; production tokens come from the DB).
export function generateTicketToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Extremely defensive fallback for environments without WebCrypto.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const QR_OPTS = { errorCorrectionLevel: "M" as const, margin: 1, width: 320 };

// PNG data URL — convenient for <img src> and direct download.
export function tokenToDataUrl(token: string): Promise<string> {
  return QRCode.toDataURL(token, QR_OPTS);
}

// Crisp scalable SVG markup — good for print / high-DPI rendering.
export function tokenToSvg(token: string): Promise<string> {
  return QRCode.toString(token, { type: "svg", ...QR_OPTS });
}

// Trigger a browser download of the ticket QR as a PNG.
export function downloadQrPng(dataUrl: string, fileName: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = fileName.endsWith(".png") ? fileName : `${fileName}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

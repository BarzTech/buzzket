import { useEffect, useState } from "react";
import { Download, QrCode, Loader2 } from "lucide-react";
import { formatDate, formatUGX } from "@/lib/format";
import { tokenToDataUrl, downloadQrPng } from "@/lib/qr";
import { downloadTicketPdf } from "@/lib/ticket-pdf";
import type { IssuedTicket } from "@/lib/data/tickets";

type TicketProps = {
  eventTitle: string;
  date: string;
  venue: string;
  city?: string;
  image?: string;
  tier: string;
  holder: string;
  price: number;
  /** Cryptographic QR token issued when the order is paid. */
  qrToken?: string;
  issuedTicket?: IssuedTicket;
};

export function Ticket({ eventTitle, date, venue, city, image, tier, holder, price, qrToken, issuedTicket }: TicketProps) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const shortCode = qrToken ? `BZK-${qrToken.slice(0, 4)}-${qrToken.slice(4, 8)}`.toUpperCase() : "BZK-PENDING";

  useEffect(() => {
    let active = true;
    if (!qrToken) {
      setQrUrl(null);
      return;
    }
    tokenToDataUrl(qrToken)
      .then((url) => {
        if (active) setQrUrl(url);
      })
      .catch(() => {
        if (active) setQrUrl(null);
      });
    return () => {
      active = false;
    };
  }, [qrToken]);

  return (
    <div className="relative mx-auto flex w-full max-w-2xl overflow-hidden rounded-xl bg-card shadow-lg ring-1 ring-border">
      {/* Left side */}
      <div className="flex-1 p-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          <span className="h-2 w-2 rounded-full bg-primary" /> buzzket
        </div>
        {image && (
          <img
            src={image}
            alt=""
            className="mt-3 h-28 w-full rounded-lg object-cover"
            crossOrigin="anonymous"
          />
        )}
        <h3 className="mt-3 text-xl font-bold leading-tight">{eventTitle}</h3>
        <p className="text-xs text-muted-foreground">{venue}{city ? `, ${city}` : ""}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div>
            <div className="text-muted-foreground">Date</div>
            <div className="font-semibold">{formatDate(date)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Tier</div>
            <div className="font-semibold">{tier}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Holder</div>
            <div className="font-semibold">{holder}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Price</div>
            <div className="font-semibold">{formatUGX(price)}</div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          {issuedTicket && (
            <button
              type="button"
              onClick={async () => {
                setPdfBusy(true);
                try {
                  await downloadTicketPdf(issuedTicket);
                } finally {
                  setPdfBusy(false);
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              {pdfBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Download PDF
            </button>
          )}
          {qrUrl && (
            <button
              type="button"
              onClick={() => downloadQrPng(qrUrl, `buzzket-ticket-${shortCode}`)}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium text-primary hover:bg-accent"
            >
              <QrCode className="h-3.5 w-3.5" /> QR only
            </button>
          )}
        </div>
      </div>

      {/* Perforation */}
      <div className="relative w-px bg-transparent">
        <div className="absolute inset-y-2 left-1/2 -translate-x-1/2 border-l-2 border-dashed border-border" />
        <div className="absolute -top-3 left-1/2 h-6 w-6 -translate-x-1/2 rounded-full bg-background" />
        <div className="absolute -bottom-3 left-1/2 h-6 w-6 -translate-x-1/2 rounded-full bg-background" />
      </div>

      {/* Right stub */}
      <div className="flex w-36 flex-col items-center justify-center gap-2 bg-primary p-5 text-primary-foreground">
        <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-md bg-primary-foreground text-primary">
          {qrUrl ? (
            <img src={qrUrl} alt={`QR code ${shortCode}`} className="h-full w-full object-contain p-1" />
          ) : qrToken ? (
            <Loader2 className="h-8 w-8 animate-spin" />
          ) : (
            <QrCode className="h-16 w-16" />
          )}
        </div>
        <div className="text-[10px] font-mono opacity-90">{shortCode}</div>
      </div>
    </div>
  );
}

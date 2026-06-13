import { useEffect, useState } from "react";
import { Download, QrCode, Loader2 } from "lucide-react";
import { formatDate, formatUGX } from "@/lib/format";
import { tokenToDataUrl, downloadQrPng } from "@/lib/qr";

type TicketProps = {
  eventTitle: string;
  date: string;
  venue: string;
  tier: string;
  holder: string;
  price: number;
  /** Cryptographic QR token issued when the order is paid. */
  qrToken?: string;
};

export function Ticket({ eventTitle, date, venue, tier, holder, price, qrToken }: TicketProps) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
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
    <div className="relative mx-auto flex w-full max-w-xl overflow-hidden rounded-xl bg-card shadow-lg ring-1 ring-border">
      {/* Left side */}
      <div className="flex-1 p-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          <span className="h-2 w-2 rounded-full bg-primary" /> buzzket
        </div>
        <h3 className="mt-2 text-xl font-bold leading-tight">{eventTitle}</h3>
        <p className="text-xs text-muted-foreground">{venue}</p>
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
        {qrUrl && (
          <button
            type="button"
            onClick={() => downloadQrPng(qrUrl, `buzzket-ticket-${shortCode}`)}
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <Download className="h-3.5 w-3.5" /> Download QR
          </button>
        )}
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

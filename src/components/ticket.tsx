import { useEffect, useState } from "react";
import { Download, QrCode, Loader2, Camera, Check } from "lucide-react";
import { formatTicketDate, formatTicketTime, formatTicketNumber, formatUGX } from "@/lib/format";
import { tokenToDataUrl, downloadQrPng } from "@/lib/qr";
import { downloadTicketPdf } from "@/lib/ticket-pdf";
import type { IssuedTicket } from "@/lib/data/tickets";

type TicketProps = {
  eventTitle: string;
  category?: string;
  date: string;
  venue: string;
  city?: string;
  image?: string;
  tier: string;
  holder: string;
  price: number;
  /** Cryptographic QR token issued when the order is paid. */
  qrToken?: string;
  seat?: string;
  row?: string;
  gate?: string;
  issuedTicket?: IssuedTicket;
};

export function Ticket({
  eventTitle: propEventTitle,
  category: propCategory,
  date: propDate,
  venue: propVenue,
  city: propCity,
  image: propImage,
  tier: propTier,
  holder: propHolder,
  price: propPrice,
  qrToken: propQrToken,
  seat: propSeat,
  row: propRow,
  gate: propGate,
  issuedTicket,
}: TicketProps) {
  // Prefer values from issuedTicket if provided
  const eventTitle = issuedTicket?.event.title ?? propEventTitle;
  const category = (issuedTicket?.event.category ?? propCategory ?? "EVENT").toUpperCase();
  const date = issuedTicket?.event.date ?? propDate;
  const venue = issuedTicket?.event.venue ?? propVenue;
  const city = issuedTicket?.event.city ?? propCity;
  const image = issuedTicket?.event.image ?? propImage;
  const tier = issuedTicket?.tier ?? propTier;
  const holder = issuedTicket?.holder ?? propHolder;
  const price = issuedTicket?.price ?? propPrice;
  const qrToken = issuedTicket?.qrToken ?? propQrToken;
  const seat = (issuedTicket?.seat ?? propSeat ?? "GA").toUpperCase();
  const row = (issuedTicket?.row ?? propRow ?? "N/A").toUpperCase();
  const gate = (issuedTicket?.gate ?? propGate ?? (/vip/i.test(tier) ? "VIP" : "MAIN")).toUpperCase();

  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [copiedHint, setCopiedHint] = useState(false);

  const ticketCode = formatTicketNumber(issuedTicket?.id ?? "", qrToken);

  useEffect(() => {
    let active = true;
    if (!qrToken) {
      setQrUrl(null);
      return;
    }
    const origin = typeof window !== "undefined" ? window.location.origin : "https://buzzket.app";
    const verificationUrl = `${origin}/tickets/verify/${qrToken}`;
    tokenToDataUrl(verificationUrl)
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

  // Construct fallback IssuedTicket if not explicitly passed
  const effectiveTicket: IssuedTicket = issuedTicket ?? {
    id: qrToken || "preview",
    qrToken: qrToken || "",
    status: "valid",
    holder,
    tier,
    price,
    orderId: "preview-order",
    orderTotal: price,
    contactEmail: "",
    contactPhone: "",
    seat,
    row,
    gate,
    event: {
      id: "event",
      title: eventTitle,
      category,
      date,
      venue,
      city: city || "",
      image: image || "",
    },
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-3">
      {/* Landscape Ticket Container (approximating 2.905:1 aspect ratio) */}
      <div className="relative flex w-full overflow-hidden rounded-2xl bg-card shadow-2xl ring-1 ring-black/10 min-h-[220px] md:min-h-[270px]">
        {/* A. MAIN TICKET AREA (~78-80% width) */}
        <div className="relative flex-1 flex flex-col justify-between p-4 md:p-6 text-white overflow-hidden">
          {/* Background image covering main ticket */}
          {image ? (
            <img
              src={image}
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-center pointer-events-none"
              crossOrigin="anonymous"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-neutral-900 to-black pointer-events-none" />
          )}

          {/* Dark translucent overlay for readable white text */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[0.5px] pointer-events-none" />

          {/* Content Layer */}
          <div className="relative z-10 flex flex-col justify-between h-full space-y-3">
            {/* Top area: Category label */}
            <div>
              <div className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-white/85">
                {category}
              </div>
              <h2 className="mt-1 md:mt-2 text-xl md:text-3xl font-extrabold uppercase tracking-tight text-white leading-tight line-clamp-2 drop-shadow-sm">
                {eventTitle}
              </h2>
              <div className="mt-1 text-sm md:text-xl font-black uppercase tracking-wider text-white drop-shadow-sm">
                {formatTicketDate(date)}
              </div>
            </div>

            {/* Bottom area: Info Boxes & QR Code */}
            <div className="flex flex-wrap items-center gap-2 md:gap-3 pt-2">
              {/* Location Box */}
              <div className="rounded-lg border border-white/35 bg-black/50 px-2.5 py-1.5 md:px-3 md:py-2 backdrop-blur-sm">
                <div className="text-[9px] md:text-[11px] font-bold text-white uppercase truncate max-w-[130px] md:max-w-[170px]">
                  {venue}
                </div>
                <div className="text-[8px] md:text-[9px] font-medium text-white/75 uppercase truncate max-w-[130px] md:max-w-[170px]">
                  {city ? `${city}, UGANDA` : "UGANDA"}
                </div>
              </div>

              {/* Time Box */}
              <div className="rounded-lg border border-white/35 bg-black/50 px-2.5 py-1.5 md:px-3 md:py-2 backdrop-blur-sm shrink-0 flex items-center justify-center">
                <div className="text-[9px] md:text-[11px] font-bold text-white uppercase">
                  {formatTicketTime(date)}
                </div>
              </div>

              {/* Scannable QR Code */}
              <div className="rounded-lg bg-white p-1 shrink-0 flex items-center justify-center shadow-md">
                {qrUrl ? (
                  <img
                    src={qrUrl}
                    alt={`QR Code ${ticketCode}`}
                    className="h-10 w-10 md:h-14 md:w-14 object-contain"
                  />
                ) : qrToken ? (
                  <Loader2 className="h-10 w-10 md:h-14 md:w-14 animate-spin text-zinc-600 p-2" />
                ) : (
                  <QrCode className="h-10 w-10 md:h-14 md:w-14 text-zinc-700 p-1" />
                )}
              </div>

              {/* Price Box */}
              <div className="rounded-lg border border-white/35 bg-black/50 px-2.5 py-1.5 md:px-3 md:py-2 backdrop-blur-sm shrink-0 min-w-[90px] md:min-w-[140px]">
                <div className="text-[8px] md:text-[9px] font-bold uppercase text-white/70">
                  PRICE:
                </div>
                <div className="text-xs md:text-base font-extrabold text-white">
                  {formatUGX(price)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* B. PERFORATION & CUTOUT DETAILS */}
        <div className="relative w-0 flex flex-col items-center justify-between z-20 pointer-events-none">
          {/* Top cutout */}
          <div className="absolute -top-3.5 -translate-x-1/2 w-7 h-7 rounded-full bg-background ring-1 ring-black/5" />
          {/* Dashed vertical divider line */}
          <div className="h-full border-l-2 border-dashed border-[#503d38]/30 dark:border-white/20" />
          {/* Bottom cutout */}
          <div className="absolute -bottom-3.5 -translate-x-1/2 w-7 h-7 rounded-full bg-background ring-1 ring-black/5" />
        </div>

        {/* C. RIGHT-HAND TICKET STUB (~20-22% width) */}
        <div className="w-[30%] md:w-[22%] bg-[#f7eae6] text-[#2c1b18] relative flex flex-col justify-between p-3 md:p-5 select-none shrink-0">
          {/* Rotated Ticket Number on Left Edge of Stub */}
          <div className="absolute left-1.5 md:left-2 bottom-5 origin-bottom-left -rotate-90 text-[7px] md:text-[8.5px] font-mono font-bold tracking-widest text-[#69524c] uppercase whitespace-nowrap">
            TICKET NUMBER: {ticketCode}
          </div>

          {/* Seat, Row, Gate Fields */}
          <div className="flex flex-col justify-between h-full pl-3.5 md:pl-5 space-y-2 md:space-y-4">
            {/* SEAT */}
            <div>
              <div className="text-[8px] md:text-[10px] font-bold uppercase tracking-wider text-[#69524c]">
                SEAT
              </div>
              <div className="text-base md:text-3xl font-black text-[#1f1210] leading-none mt-0.5">
                {seat}
              </div>
            </div>

            {/* ROW */}
            <div>
              <div className="text-[8px] md:text-[10px] font-bold uppercase tracking-wider text-[#69524c]">
                ROW
              </div>
              <div className="text-base md:text-3xl font-black text-[#1f1210] leading-none mt-0.5">
                {row}
              </div>
            </div>

            {/* GATE */}
            <div>
              <div className="text-[8px] md:text-[10px] font-bold uppercase tracking-wider text-[#69524c]">
                GATE
              </div>
              <div className="text-base md:text-3xl font-black text-[#1f1210] leading-none mt-0.5">
                {gate}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Controls & Screenshot Prompt */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        {/* Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={pdfBusy}
            onClick={async () => {
              setPdfBusy(true);
              try {
                await downloadTicketPdf(effectiveTicket);
              } finally {
                setPdfBusy(false);
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {pdfBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Download PDF
          </button>

          {qrUrl && (
            <button
              type="button"
              onClick={() => downloadQrPng(qrUrl, `buzzket-ticket-${ticketCode}`)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-accent transition-colors"
            >
              <QrCode className="h-3.5 w-3.5 text-muted-foreground" /> QR Only
            </button>
          )}
        </div>

        {/* Attendee Screenshot Recommendation Prompt */}
        <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-1.5 text-xs text-muted-foreground border border-border/50">
          <Camera className="h-4 w-4 text-primary shrink-0" />
          <span>
            <strong className="text-foreground">Screenshot Tip:</strong> Save a screenshot to your camera roll for easy offline gate entry.
          </span>
        </div>
      </div>
    </div>
  );
}


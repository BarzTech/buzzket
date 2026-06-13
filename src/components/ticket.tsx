import { QrCode } from "lucide-react";
import { formatDate, formatUGX } from "@/lib/mock-events";

type TicketProps = {
  eventTitle: string;
  date: string;
  venue: string;
  tier: string;
  holder: string;
  price: number;
  code?: string;
};

export function Ticket({ eventTitle, date, venue, tier, holder, price, code = "BZK-A1B2-C3D4" }: TicketProps) {
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
      </div>

      {/* Perforation */}
      <div className="relative w-px bg-transparent">
        <div className="absolute inset-y-2 left-1/2 -translate-x-1/2 border-l-2 border-dashed border-border" />
        <div className="absolute -top-3 left-1/2 h-6 w-6 -translate-x-1/2 rounded-full bg-background" />
        <div className="absolute -bottom-3 left-1/2 h-6 w-6 -translate-x-1/2 rounded-full bg-background" />
      </div>

      {/* Right stub */}
      <div className="flex w-36 flex-col items-center justify-center gap-2 bg-primary p-5 text-primary-foreground">
        <div className="grid h-20 w-20 place-items-center rounded-md bg-primary-foreground text-primary">
          <QrCode className="h-16 w-16" />
        </div>
        <div className="text-[10px] font-mono opacity-90">{code}</div>
      </div>
    </div>
  );
}

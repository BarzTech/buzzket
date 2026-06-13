import { Link } from "@tanstack/react-router";
import { Calendar, MapPin } from "lucide-react";
import { type Event, formatDate, formatUGX } from "@/lib/format";
import { Card } from "@/components/ui/card";

export function EventCard({ event, className = "" }: { event: Event; className?: string }) {
  return (
    <Link to="/events/$eventId" params={{ eventId: event.id }} className={`group block ${className}`}>
      <Card className="overflow-hidden p-0 transition-all hover:-translate-y-1 hover:shadow-xl">
        <div className="relative aspect-[4/3] overflow-hidden">
          <img
            src={event.image}
            alt={event.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <span className="absolute left-3 top-3 rounded-full bg-background/95 px-3 py-1 text-xs font-semibold text-primary">
            {event.category}
          </span>
        </div>
        <div className="p-4">
          <h3 className="line-clamp-2 font-semibold leading-tight group-hover:text-primary">
            {event.title}
          </h3>
          <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{formatDate(event.date)}</div>
            <div className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{event.venue}, {event.city}</div>
          </div>
          <div className="mt-3 text-sm font-bold text-primary">From {formatUGX(event.priceFrom)}</div>
        </div>
      </Card>
    </Link>
  );
}

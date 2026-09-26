import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, AlertTriangle, XCircle, Calendar, MapPin, Ticket as TicketIcon, User, ShieldCheck } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatTicketDate, formatTicketTime, formatUGX } from "@/lib/format";
import { getTicketVerification, type TicketVerificationData } from "@/lib/data/tickets";

export const Route = createFileRoute("/tickets/verify/$token")({
  head: () => ({
    meta: [
      { title: "Ticket Verification — Buzzket" },
      { name: "description", content: "Verify official Buzzket event admission tickets." },
    ],
  }),
  loader: ({ params }) =>
    getTicketVerification({ data: { token: params.token } }),
  component: TicketVerifyPage,
});

function TicketVerifyPage() {
  const initialData = Route.useLoaderData();
  const { token } = Route.useParams();

  const { data: verification } = useQuery<TicketVerificationData>({
    queryKey: ["ticket-verification", token],
    queryFn: () => getTicketVerification({ data: { token } }),
    initialData,
  });

  const isNotFound = verification?.status === "not_found";
  const isUsed = verification?.status === "used";
  const isValid = verification?.status === "valid";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-xl px-4 py-12">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary uppercase tracking-wider mb-3">
            <ShieldCheck className="h-3.5 w-3.5" /> Official Ticket Verification
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Admission Verification</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time status check for gate entry staff and attendees.
          </p>
        </div>

        {/* Verification Status Card */}
        <Card className="overflow-hidden rounded-3xl border shadow-xl">
          {/* Status Header Banner */}
          <div
            className={`p-6 text-center ${
              isValid
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-b border-emerald-500/20"
                : isUsed
                ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-b border-amber-500/20"
                : "bg-destructive/10 text-destructive border-b border-destructive/20"
            }`}
          >
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-background shadow-sm mb-3">
              {isValid && <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />}
              {isUsed && <AlertTriangle className="h-10 w-10 text-amber-600 dark:text-amber-400" />}
              {isNotFound && <XCircle className="h-10 w-10 text-destructive" />}
            </div>

            <div className="text-xl font-black uppercase tracking-wider">
              {isValid && "Valid Ticket"}
              {isUsed && "Ticket Already Used"}
              {isNotFound && "Invalid Ticket"}
            </div>

            <p className="text-xs mt-1 max-w-xs mx-auto opacity-90">
              {isValid && "This ticket is authentic, paid, and ready for gate admission."}
              {isUsed && `This ticket has already been checked in${verification?.usedAt ? ` on ${new Date(verification.usedAt).toLocaleString("en-UG")}` : ""}.`}
              {isNotFound && "No valid ticket matching this QR code was found in the Buzzket registry."}
            </p>
          </div>

          {/* Ticket Details */}
          {!isNotFound && verification && (
            <div className="p-6 space-y-6">
              {/* Event Title & Cover */}
              <div className="flex items-start gap-4">
                {verification.image && (
                  <img
                    src={verification.image}
                    alt={verification.eventName}
                    className="h-20 w-20 rounded-2xl object-cover shrink-0 border"
                  />
                )}
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-primary">
                    {verification.category}
                  </div>
                  <h2 className="text-lg font-bold leading-tight mt-0.5">{verification.eventName}</h2>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    <span>{formatTicketDate(verification.eventDate)} • {formatTicketTime(verification.eventDate)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span>{verification.venue}{verification.city ? `, ${verification.city}` : ""}</span>
                  </div>
                </div>
              </div>

              {/* Stub Fields Grid */}
              <div className="grid grid-cols-3 gap-3 rounded-2xl bg-muted/40 p-3 text-center border">
                <div>
                  <div className="text-[10px] font-bold uppercase text-muted-foreground">SEAT</div>
                  <div className="text-lg font-black text-foreground mt-0.5">{verification.seat}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase text-muted-foreground">ROW</div>
                  <div className="text-lg font-black text-foreground mt-0.5">{verification.row}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase text-muted-foreground">GATE</div>
                  <div className="text-lg font-black text-foreground mt-0.5">{verification.gate}</div>
                </div>
              </div>

              {/* Attendee & Order Details */}
              <div className="space-y-3 divide-y divide-border/60 text-xs">
                <div className="flex justify-between pt-2">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" /> Ticket Holder
                  </span>
                  <span className="font-semibold text-foreground">{verification.holderName}</span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <TicketIcon className="h-3.5 w-3.5" /> Tier / Price
                  </span>
                  <span className="font-semibold text-foreground">
                    {verification.tierName} • {formatUGX(verification.price)}
                  </span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-muted-foreground">Ticket Identifier</span>
                  <span className="font-mono font-bold text-foreground">{verification.ticketNumber}</span>
                </div>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="p-6 pt-0 flex justify-center gap-3">
            <Button asChild variant="outline" className="w-full">
              <Link to="/">Back to Buzzket</Link>
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
}

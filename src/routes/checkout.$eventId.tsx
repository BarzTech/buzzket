import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { formatUGX } from "@/lib/format";
import { eventQueryOptions } from "@/lib/data/events";
import { reserveTickets, confirmOrder } from "@/lib/data/tickets";
import { calcOrder, COMMISSION_FLAT_UGX, COMMISSION_PERCENT } from "@/lib/fees";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Ticket } from "@/components/ticket";
import { useEffect, useState } from "react";
import { CreditCard, Smartphone, CheckCircle, Wallet, ShieldCheck, Clock, AlertCircle, Loader2 } from "lucide-react";

export const Route = createFileRoute("/checkout/$eventId")({
  validateSearch: (search: Record<string, unknown>) => ({
    tierId: String(search.tierId || ""),
    qty: String(search.qty || "1"),
  }),
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(eventQueryOptions(params.eventId)),
  component: Checkout,
});

function Checkout() {
  const { eventId } = Route.useParams();
  const search = Route.useSearch();
  const { data: event, isLoading } = useQuery(eventQueryOptions(eventId));
  const qty = Math.max(1, Number(search.qty || "1"));

  const tier = event?.tiers?.find((t) => t.id === search.tierId) ?? event?.tiers?.[0] ?? null;
  const unitPrice = tier?.price ?? event?.priceFrom ?? 0;
  const { subtotal, fees, total } = calcOrder(unitPrice, qty);

  const [step, setStep] = useState(1);
  const [contact, setContact] = useState({ name: "", email: "", phone: "" });
  const [payment, setPayment] = useState<"mtn" | "airtel" | "card">("mtn");

  // Reservation state (10-minute hold created server-side via row-locking RPC).
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number>(0);
  const [reserveError, setReserveError] = useState<string | null>(null);

  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [qrTokens, setQrTokens] = useState<string[] | null>(null);

  // Reserve inventory as soon as we have a valid tier. Depend on the stable
  // tier id (not the object) so react-query refetches don't spawn duplicate
  // server-side holds.
  const tierId = tier?.id;
  useEffect(() => {
    if (!tierId) return;
    let active = true;
    setReserveError(null);
    reserveTickets({ data: { tierId, qty } })
      .then((res) => {
        if (!active) return;
        setReservationId(res.reservationId);
        setExpiresAt(new Date(res.expiresAt).getTime());
      })
      .catch((e: unknown) => {
        if (active) setReserveError(e instanceof Error ? e.message : "Couldn't reserve tickets");
      });
    return () => {
      active = false;
    };
  }, [tierId, qty]);

  // Countdown.
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setRemaining(Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  // Derive from the timestamp (not `remaining`, which starts at 0) so we don't
  // flash "expired" for one frame before the countdown effect initialises.
  const expired = expiresAt !== null && expiresAt <= Date.now();
  const mins = Math.floor(remaining / 60);
  const secs = String(remaining % 60).padStart(2, "0");

  const pay = async () => {
    if (!reservationId) return;
    setPaying(true);
    setPayError(null);
    try {
      const res = await confirmOrder({
        data: {
          reservationId,
          qty,
          unitPrice,
          contactName: contact.name || "Guest",
          contactEmail: contact.email,
          contactPhone: contact.phone,
          paymentMethod: payment,
        },
      });
      setQrTokens(res.qrTokens);
    } catch (e) {
      setPayError(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setPaying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="mx-auto max-w-5xl px-4 py-10 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!event || !tier) return <div className="p-10 text-center text-muted-foreground">Event not found.</div>;

  if (qrTokens) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-primary/10">
            <CheckCircle className="h-10 w-10 text-primary" />
          </div>
          <h2 className="mt-4 text-2xl font-bold">Booking Confirmed!</h2>
          <p className="mt-2 text-muted-foreground">
            Your {qrTokens.length} ticket{qrTokens.length > 1 ? "s" : ""} for <strong>{event.title}</strong> {qrTokens.length > 1 ? "have" : "has"} been issued.
          </p>
          <div className="mt-8 space-y-6 text-left">
            {qrTokens.map((token, i) => (
              <Ticket
                key={token}
                eventTitle={event.title}
                date={event.date}
                venue={event.venue}
                tier={tier.name}
                holder={contact.name || `Guest ${i + 1}`}
                price={unitPrice}
                qrToken={token}
              />
            ))}
          </div>
          <Button asChild className="mt-8 bg-primary text-primary-foreground">
            <Link to="/">Back to Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  const steps = ["Select Tickets", "Contact Info", "Payment"];

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Reservation status banner */}
        {reserveError ? (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Couldn't hold these tickets</AlertTitle>
            <AlertDescription>
              {reserveError}{" "}
              <Link to="/events/$eventId" params={{ eventId }} className="font-medium underline">
                Back to event
              </Link>
            </AlertDescription>
          </Alert>
        ) : expired ? (
          <Alert variant="destructive" className="mb-6">
            <Clock className="h-4 w-4" />
            <AlertTitle>Reservation expired</AlertTitle>
            <AlertDescription>
              Your 10-minute hold lapsed.{" "}
              <Link to="/events/$eventId" params={{ eventId }} className="font-medium underline">
                Start over
              </Link>
            </AlertDescription>
          </Alert>
        ) : reservationId ? (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
            <Clock className="h-4 w-4 text-primary" />
            <span>Tickets reserved — complete payment within <strong>{mins}:{secs}</strong></span>
          </div>
        ) : (
          <div className="mb-6 flex items-center gap-2 rounded-lg border p-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Reserving your tickets…
          </div>
        )}

        {/* Stepper */}
        <div className="mb-8 flex items-center justify-between">
          {steps.map((s, i) => (
            <div key={s} className="flex flex-1 items-center">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                i + 1 <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {i + 1 < step ? "✓" : i + 1}
              </div>
              <span className={`ml-2 hidden text-sm font-medium md:inline ${i + 1 <= step ? "text-foreground" : "text-muted-foreground"}`}>{s}</span>
              {i < steps.length - 1 && <div className="mx-3 h-px flex-1 bg-border" />}
            </div>
          ))}
        </div>

        <div className="grid gap-8 md:grid-cols-[1fr_340px]">
          {/* Main form */}
          <Card className="p-6">
            {step === 1 && (
              <div className="space-y-5">
                <h2 className="text-lg font-semibold">1. Ticket Summary</h2>
                <div className="flex items-center gap-4 rounded-lg border p-4">
                  <img src={event.image} alt={event.title} className="h-16 w-16 rounded-md object-cover" />
                  <div className="flex-1">
                    <div className="font-semibold">{event.title}</div>
                    <div className="text-sm text-muted-foreground">{tier.name} x {qty}</div>
                  </div>
                  <div className="font-bold">{formatUGX(total)}</div>
                </div>
                <div className="text-xs text-muted-foreground">Tickets are subject to availability and cannot be refunded.</div>
                <Button onClick={() => setStep(2)} disabled={expired || !!reserveError} className="w-full bg-cta text-cta-foreground hover:bg-cta/90 font-semibold">
                  Continue
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <h2 className="text-lg font-semibold">2. Contact Information</h2>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Full name</Label>
                    <Input id="name" value={contact.name} onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))} placeholder="John Doe" />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={contact.email} onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))} placeholder="john@example.com" />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone number</Label>
                    <Input id="phone" value={contact.phone} onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))} placeholder="+256 7XX XXX XXX" />
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
                  <Button onClick={() => setStep(3)} className="flex-1 bg-cta text-cta-foreground hover:bg-cta/90 font-semibold">Continue</Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <h2 className="text-lg font-semibold">3. Payment</h2>
                <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-foreground">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <span>Secured by <strong>PesaPay</strong> — Uganda's trusted payment gateway.</span>
                </div>
                <div className="grid gap-3">
                  {[
                    { id: "mtn" as const, label: "MTN Mobile Money", sub: "via PesaPay", icon: Smartphone },
                    { id: "airtel" as const, label: "Airtel Money", sub: "via PesaPay", icon: Wallet },
                    { id: "card" as const, label: "Credit / Debit Card", sub: "Visa, Mastercard via PesaPay", icon: CreditCard },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setPayment(opt.id)}
                      className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all ${
                        payment === opt.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-accent"
                      }`}
                    >
                      <opt.icon className="h-5 w-5 text-primary" />
                      <div className="flex-1">
                        <div className="font-medium">{opt.label}</div>
                        <div className="text-xs text-muted-foreground">{opt.sub}</div>
                      </div>
                      <div className={`h-5 w-5 rounded-full border-2 ${payment === opt.id ? "border-primary bg-primary" : "border-muted-foreground"}`} />
                    </button>
                  ))}
                </div>
                {payError && (
                  <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" /> {payError}
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Back</Button>
                  <Button
                    onClick={pay}
                    disabled={paying || expired || !reservationId || !!reserveError}
                    className="flex-1 bg-cta text-cta-foreground hover:bg-cta/90 font-semibold"
                  >
                    {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : `Pay ${formatUGX(total)}`}
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* Order summary sidebar */}
          <Card className="h-fit p-6">
            <h3 className="font-semibold">Order Summary</h3>
            <div className="mt-4 flex items-center gap-3">
              <img src={event.image} alt="" className="h-12 w-12 rounded-md object-cover" />
              <div>
                <div className="text-sm font-medium">{event.title}</div>
                <div className="text-xs text-muted-foreground">{tier.name} x {qty}</div>
              </div>
            </div>
            <Separator className="my-4" />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Tickets</span><span>{formatUGX(unitPrice)} x {qty}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatUGX(subtotal)}</span></div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Service &amp; Processing Fee <span className="opacity-70">({Math.round(COMMISSION_PERCENT * 100)}% + {formatUGX(COMMISSION_FLAT_UGX)}/ticket)</span></span>
                <span>{formatUGX(fees)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-base font-bold"><span>Total</span><span>{formatUGX(total)}</span></div>
              <div className="pt-2 text-[11px] text-muted-foreground">Payments processed securely by PesaPay.</div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

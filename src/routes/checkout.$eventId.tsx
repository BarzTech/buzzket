import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { formatUGX } from "@/lib/format";
import { eventQueryOptions, type Event } from "@/lib/data/events";
import { reserveTickets, initiatePesapalPayment, validatePromoCode } from "@/lib/data/tickets";
import { publicPlatformSettingsQueryOptions } from "@/lib/data/platform";
import { calcOrder, COMMISSION_FLAT_UGX, COMMISSION_PERCENT } from "@/lib/fees";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Ticket } from "@/components/ticket";
import { useEffect, useState } from "react";
import { CheckCircle, ShieldCheck, Clock, AlertCircle, Loader2 } from "lucide-react";

export const Route = createFileRoute("/checkout/$eventId")({
  validateSearch: (search: Record<string, unknown>) => ({
    tierId: String(search.tierId || ""),
    qty: String(search.qty || "1"),
  }),
  loader: ({ context, params }) =>
    context.queryClient.fetchQuery(eventQueryOptions(params.eventId)),
  component: Checkout,
});

function Checkout() {
  const { eventId } = Route.useParams();
  const search = Route.useSearch();
  const loaderEvent = Route.useLoaderData();
  const { data: event = loaderEvent } = useQuery(eventQueryOptions(eventId));
  const { data: platformSettings } = useQuery(publicPlatformSettingsQueryOptions());
  const qty = Math.max(1, Number(search.qty || "1"));

  const tier =
    event?.tiers?.find((t: Event["tiers"][number]) => t.id === search.tierId) ??
    event?.tiers?.[0] ??
    null;
  const unitPrice = tier?.price ?? event?.priceFrom ?? 0;

  const [step, setStep] = useState(1);
  const [contact, setContact] = useState({ name: "", email: "", phone: "" });

  // Reservation state (10-minute hold created server-side via row-locking RPC).
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number>(0);
  const [reserveError, setReserveError] = useState<string | null>(null);

  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const qrTokens = null as string[] | null;

  const [promoInput, setPromoInput] = useState("");
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promo, setPromo] = useState<{ id: string; type: "percent" | "flat"; value: number } | null>(null);
  const [applyingPromo, setApplyingPromo] = useState(false);

  // Apply discount to unitPrice
  const discountedUnitPrice = promo
    ? promo.type === "percent"
      ? Math.max(0, unitPrice * (1 - promo.value / 100))
      : Math.max(0, unitPrice - promo.value)
    : unitPrice;

  const { subtotal, fees, total } = calcOrder(discountedUnitPrice, qty);

  const handleApplyPromo = async () => {
    if (!promoInput.trim()) return;
    setApplyingPromo(true);
    setPromoError(null);
    try {
      const res = await validatePromoCode({ data: { eventId, code: promoInput.trim() } });
      setPromo(res);
      setPromoInput("");
    } catch (e) {
      setPromoError(e instanceof Error ? e.message : "Invalid promo code");
      setPromo(null);
    } finally {
      setApplyingPromo(false);
    }
  };

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
        // The database always creates a hold of exactly 10 minutes.
        // By adding 10 minutes to Date.now() locally, we are immune to clock skew
        // between the user's PC and the Supabase database.
        setExpiresAt(Date.now() + 10 * 60 * 1000);
      })
      .catch((e: unknown) => {
        if (!active) return;
        setReserveError(e instanceof Error ? e.message : "Couldn't reserve tickets");
        setReservationId(null);
        setExpiresAt(null);
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
    if (!contact.name.trim()) {
      setPayError("Enter the ticket holder's name.");
      setStep(2);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim())) {
      setPayError("Enter a valid email address so we can send the tickets.");
      setStep(2);
      return;
    }
    if (contact.phone.replace(/\D/g, "").length < 9) {
      setPayError("Enter a valid phone number for payment updates.");
      setStep(2);
      return;
    }
    setPaying(true);
    setPayError(null);
    try {
      const callbackParams = new URLSearchParams({
        reservationId,
        qty: String(qty),
        unitPrice: String(discountedUnitPrice),
        contactName: contact.name.trim(),
        contactEmail: contact.email.trim(),
        contactPhone: contact.phone.trim(),
        ...(promo ? { promoCodeId: promo.id } : {}),
      });
      const callbackUrl = `${window.location.origin}/checkout/status?${callbackParams.toString()}`;

      const res = await initiatePesapalPayment({
        data: {
          reservationId,
          amount: total,
          email: contact.email.trim(),
          phone: contact.phone.trim(),
          name: contact.name.trim(),
          callbackUrl,
          qty,
          unitPrice: discountedUnitPrice,
        },
      });

      if (res.redirectUrl) {
        window.location.href = res.redirectUrl;
      } else {
        throw new Error("No redirect URL returned from Pesapal.");
      }
    } catch (e) {
      setPayError(e instanceof Error ? e.message : "Failed to initiate Pesapal payment");
    } finally {
      setPaying(false);
    }
  };

  if (!tier) return <div className="p-10 text-center text-muted-foreground">Ticket tier not found.</div>;

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
            <AlertTitle>Couldn&apos;t hold these tickets</AlertTitle>
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
                  <div className="font-bold">{formatUGX(discountedUnitPrice * qty)}</div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {platformSettings?.refundPolicy?.trim() ||
                    "Tickets are subject to availability and cannot be refunded unless stated otherwise."}
                </div>
                <Button onClick={() => setStep(2)} disabled={expired || !reservationId || !!reserveError} className="w-full bg-cta text-cta-foreground hover:bg-cta/90 font-semibold">
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
                {payError && (
                  <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" /> {payError}
                  </div>
                )}
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
                  <Button
                    onClick={() => {
                      if (!contact.name.trim()) return setPayError("Enter the ticket holder's name.");
                      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim())) return setPayError("Enter a valid email address so we can send the tickets.");
                      if (contact.phone.replace(/\D/g, "").length < 9) return setPayError("Enter a valid phone number for payment updates.");
                      setPayError(null);
                      setStep(3);
                    }}
                    className="flex-1 bg-cta text-cta-foreground hover:bg-cta/90 font-semibold"
                  >
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <h2 className="text-lg font-semibold">3. Payment</h2>
                <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-foreground">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <span>Secured by <strong>Pesapal</strong> — East Africa&apos;s trusted payment gateway.</span>
                </div>
                <div className="rounded-xl border p-5 bg-card space-y-3">
                  <div className="font-semibold text-sm">Select payment method on Pesapal:</div>
                  <ul className="space-y-2 text-xs text-muted-foreground list-disc pl-4">
                    <li>Mobile Money (MTN MoMo, Airtel Money)</li>
                    <li>Credit & Debit Cards (Visa, Mastercard)</li>
                  </ul>
                  <p className="text-xs text-muted-foreground">
                    You will be securely redirected to Pesapal to choose your preferred option and complete the transaction.
                  </p>
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
                    disabled={paying || expired || !reservationId || (!reservationId && !!reserveError)}
                    className="flex-1 bg-cta text-cta-foreground hover:bg-cta/90 font-semibold"
                  >
                    {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : `Pay ${formatUGX(total)}`}
                  </Button>
                </div>
                {platformSettings?.refundPolicy?.trim() && (
                  <p className="text-[11px] text-muted-foreground">
                    Refund policy: {platformSettings.refundPolicy.trim()}
                  </p>
                )}
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
            
            {/* Promo Code Input */}
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input 
                  placeholder="Promo code" 
                  value={promoInput} 
                  onChange={(e) => setPromoInput(e.target.value)} 
                  disabled={!!promo || applyingPromo}
                  className="h-9 text-sm"
                />
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={promo ? () => setPromo(null) : handleApplyPromo}
                  disabled={applyingPromo || (!promoInput.trim() && !promo)}
                >
                  {promo ? "Remove" : applyingPromo ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                </Button>
              </div>
              {promoError && <div className="text-xs text-destructive">{promoError}</div>}
              {promo && <div className="text-xs text-emerald-500">Promo code applied successfully!</div>}
            </div>

            <Separator className="my-4" />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Tickets</span><span>{formatUGX(unitPrice)} x {qty}</span></div>
              {promo && (
                <div className="flex justify-between text-emerald-500">
                  <span>Discount ({promo.type === "percent" ? `${promo.value}%` : formatUGX(promo.value)})</span>
                  <span>-{formatUGX((unitPrice - discountedUnitPrice) * qty)}</span>
                </div>
              )}
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatUGX(subtotal)}</span></div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Service &amp; Processing Fee <span className="opacity-70">({Math.round(COMMISSION_PERCENT * 100)}% + {formatUGX(COMMISSION_FLAT_UGX)}/ticket)</span></span>
                <span>{formatUGX(fees)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-base font-bold"><span>Total</span><span>{formatUGX(total)}</span></div>
              <div className="pt-2 text-[11px] text-muted-foreground">Payments processed securely by Pesapal.</div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

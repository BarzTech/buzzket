import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { formatUGX } from "@/lib/format";
import { eventQueryOptions, type Event } from "@/lib/data/events";
import { reserveTickets, submitManualMomoOrder, validatePromoCode } from "@/lib/data/tickets";
import { getMobileMoneyConfig } from "@/lib/payments/manual-momo";
import { normalizeWhatsAppNumber } from "@/lib/payments/phone";
import type { MobileMoneyNetwork } from "@/lib/payments/types";
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
import {
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  Camera,
  Copy,
  Check,
  Smartphone,
} from "lucide-react";

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

  const navigate = useNavigate();
  const [network, setNetwork] = useState<MobileMoneyNetwork>("mtn");
  const [transactionId, setTransactionId] = useState("");
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const qrTokens = null as string[] | null;

  const [promoInput, setPromoInput] = useState("");
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promo, setPromo] = useState<{ id: string; type: "percent" | "flat"; value: number; code: string } | null>(null);
  const [applyingPromo, setApplyingPromo] = useState(false);

  // Apply discount to unitPrice
  const discountedUnitPriceRaw = promo
    ? promo.type === "percent"
      ? Math.max(0, unitPrice * (1 - promo.value / 100))
      : Math.max(0, unitPrice - promo.value)
    : unitPrice;
  // Ticket prices are whole UGX values and the database stores integer prices.
  const discountedUnitPrice = Math.round(discountedUnitPriceRaw);

  const { subtotal, fees, total } = calcOrder(discountedUnitPrice, qty);

  const handleApplyPromo = async () => {
    if (!promoInput.trim()) return;
    setApplyingPromo(true);
    setPromoError(null);
    try {
      const res = await validatePromoCode({ data: { eventId, code: promoInput.trim() } });
      setPromo({ ...res, code: promoInput.trim() });
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
    if (!getMobileMoneyConfig(network, total).merchantCode) {
      setPayError(`${network === "mtn" ? "MTN" : "Airtel"} payments are not configured yet. Please contact Buzzket support before sending money.`);
      return;
    }
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
    let normalizedPhone: string;
    try {
      normalizedPhone = normalizeWhatsAppNumber(contact.phone);
    } catch (error) {
      setPayError(error instanceof Error ? error.message : "Enter a valid international WhatsApp number.");
      setStep(2);
      return;
    }
    if (!transactionId.trim()) {
      setPayError("Please enter the Mobile Money Transaction ID or Reference received after paying.");
      return;
    }
    setPaying(true);
    setPayError(null);
    try {
      const statusToken = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("");
      const res = await submitManualMomoOrder({
        data: {
          reservationId,
          network,
          transactionId: transactionId.trim(),
          contactName: contact.name.trim(),
          contactEmail: contact.email.trim(),
          contactPhone: normalizedPhone,
          promoCode: promo?.code,
          statusToken,
        },
      });

      navigate({
        to: "/checkout/status",
        search: {
          orderId: res.orderId,
          statusToken: res.statusToken,
          OrderTrackingId: "",
          OrderMerchantReference: "",
          reservationId: "",
          qty: String(qty),
          unitPrice: String(discountedUnitPrice),
          contactName: contact.name,
          contactEmail: contact.email,
          contactPhone: normalizedPhone,
        },
      });
    } catch (e) {
      setPayError(e instanceof Error ? e.message : "Failed to submit payment. Please verify your transaction ID.");
    } finally {
      setPaying(false);
    }
  };


  if (!tier) return <div className="p-10 text-center text-muted-foreground">Ticket tier not found.</div>;

  if (qrTokens) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="mx-auto max-w-4xl px-4 py-16 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary/10">
            <CheckCircle className="h-9 w-9 text-primary" />
          </div>
          <h2 className="mt-4 text-3xl font-extrabold">Booking Confirmed!</h2>
          <p className="mt-2 text-muted-foreground">
            Your {qrTokens.length} ticket{qrTokens.length > 1 ? "s" : ""} for <strong>{event.title}</strong> {qrTokens.length > 1 ? "have" : "has"} been issued.
          </p>

          {/* Screenshot Recommendation Prompt */}
          <div className="mx-auto mt-6 max-w-2xl rounded-2xl border border-primary/25 bg-gradient-to-r from-primary/10 via-background to-primary/5 p-4 text-left shadow-sm">
            <div className="flex items-start gap-3.5">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow">
                <Camera className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-sm md:text-base">
                  Important: Screenshot Your Ticket!
                </h3>
                <p className="mt-0.5 text-xs md:text-sm text-muted-foreground leading-relaxed">
                  We highly encourage taking a screenshot of your ticket now. Mobile connectivity at event gates can be slow, and saving a screenshot guarantees instant, offline entry.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-6 text-left">
            {qrTokens.map((token, i) => (
              <Ticket
                key={token}
                eventTitle={event.title}
                category={event.category}
                date={event.date}
                venue={event.venue}
                city={event.city}
                image={event.image}
                tier={tier.name}
                holder={contact.name || `Guest ${i + 1}`}
                price={discountedUnitPrice}
                qrToken={token}
              />
            ))}
          </div>
          <Button asChild className="mt-8 bg-primary text-primary-foreground font-semibold px-8">
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
                    <Label htmlFor="phone">WhatsApp Number</Label>
                    <Input id="phone" type="tel" inputMode="tel" value={contact.phone} onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))} placeholder="+256701234567" required />
                    <p className="mt-1 text-xs text-muted-foreground">Enter your full international number with +country code. Your ticket will be sent to this WhatsApp number after your payment is approved.</p>
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
                      try { normalizeWhatsAppNumber(contact.phone); } catch (e) { return setPayError(e instanceof Error ? e.message : "Enter a valid WhatsApp number."); }
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

            {step === 3 && (() => {
              const momoConfig = getMobileMoneyConfig(network, total);
              return (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-lg font-bold">3. Mobile Money Payment</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Pay using your phone via MTN or Airtel Merchant Code, then enter the Transaction ID below.
                    </p>
                  </div>

                  {/* Network selector tabs */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setNetwork("mtn");
                        setPayError(null);
                      }}
                      className={`flex items-center justify-center gap-2 rounded-xl border p-3 transition-all text-sm font-semibold cursor-pointer ${
                        network === "mtn"
                          ? "border-[#FFCC00] bg-[#FFCC00]/15 text-foreground ring-1 ring-[#FFCC00]"
                          : "border-border bg-card hover:bg-muted/50 text-muted-foreground"
                      }`}
                    >
                      <div className="h-3 w-3 rounded-full bg-[#FFCC00] shadow-sm" />
                      <span>MTN MoMo</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setNetwork("airtel");
                        setPayError(null);
                      }}
                      className={`flex items-center justify-center gap-2 rounded-xl border p-3 transition-all text-sm font-semibold cursor-pointer ${
                        network === "airtel"
                          ? "border-[#ED1B24] bg-[#ED1B24]/15 text-foreground ring-1 ring-[#ED1B24]"
                          : "border-border bg-card hover:bg-muted/50 text-muted-foreground"
                      }`}
                    >
                      <div className="h-3 w-3 rounded-full bg-[#ED1B24] shadow-sm" />
                      <span>Airtel Money</span>
                    </button>
                  </div>

                  {/* Merchant instructions card */}
                  <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                      <div>
                        <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                          {network === "mtn" ? "MTN Merchant Code" : "Airtel Pay Code"}
                        </div>
                        <div className="font-mono text-xl font-extrabold tracking-tight text-foreground flex items-center gap-2 mt-0.5">
                          <span>{momoConfig.merchantCode}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(momoConfig.merchantCode, "code")}
                            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 border rounded px-1.5 py-0.5 bg-muted/30"
                          >
                            {copiedText === "code" ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                            <span className="text-[10px]">{copiedText === "code" ? "Copied" : "Copy"}</span>
                          </button>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Name: <strong>{momoConfig.merchantName}</strong>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Exact Amount</div>
                        <div className="text-xl font-extrabold text-primary flex items-center justify-end gap-1.5 mt-0.5">
                          <span>{formatUGX(total)}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(String(total), "amount")}
                            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 border rounded px-1.5 py-0.5 bg-muted/30"
                          >
                            {copiedText === "amount" ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                            <span className="text-[10px]">{copiedText === "amount" ? "Copied" : "Copy"}</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Step-by-step dial instructions */}
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Smartphone className="h-3.5 w-3.5" />
                        <span>Step-by-Step Payment Instructions:</span>
                      </div>
                      <ol className="space-y-1.5 text-xs text-muted-foreground pl-4 list-decimal">
                        {momoConfig.instructions.map((stepText, idx) => (
                          <li key={idx} className="leading-relaxed">
                            {stepText}
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>

                  {/* Transaction ID / Reference input */}
                  <div className="space-y-2">
                    <Label htmlFor="txIdInput" className="text-sm font-semibold flex items-center justify-between">
                      <span>Transaction ID / Reference <span className="text-destructive">*</span></span>
                      <span className="text-[11px] text-muted-foreground font-normal">From SMS receipt</span>
                    </Label>
                    <Input
                      id="txIdInput"
                      placeholder={network === "mtn" ? "e.g. 1029384756 or PP2410..." : "e.g. 1928374650 or TID..."}
                      value={transactionId}
                      onChange={(e) => {
                        setTransactionId(e.target.value);
                        setPayError(null);
                      }}
                      className="font-mono text-sm tracking-wider"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Enter the transaction ID received in your {network === "mtn" ? "MTN" : "Airtel"} SMS receipt. An administrator will verify the payment before approving your tickets.
                    </p>
                  </div>

                  {payError && (
                    <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{payError}</span>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Back</Button>
                    <Button
                      onClick={pay}
                      disabled={paying || expired || !reservationId || !momoConfig.merchantCode}
                      className="flex-1 bg-cta text-cta-foreground hover:bg-cta/90 font-semibold"
                    >
                      {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : "I Have Paid / Submit Payment"}
                    </Button>
                  </div>

                  {platformSettings?.refundPolicy?.trim() && (
                    <p className="text-[11px] text-muted-foreground">
                      Refund policy: {platformSettings.refundPolicy.trim()}
                    </p>
                  )}
                </div>
              );
            })()}

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
              <div className="pt-2 text-[11px] text-muted-foreground">Pay directly to the displayed MTN or Airtel merchant code. Tickets are issued after manual verification.</div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

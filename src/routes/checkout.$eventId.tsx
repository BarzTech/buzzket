import { createFileRoute, Link } from "@tanstack/react-router";
import { getEvent, formatUGX } from "@/lib/mock-events";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Ticket } from "@/components/ticket";
import { useMemo, useState } from "react";
import { CreditCard, Smartphone, CheckCircle, Wallet, ShieldCheck } from "lucide-react";
import { calcOrder, feePerTicket, COMMISSION_PERCENT, COMMISSION_FLAT_UGX } from "@/lib/fees";

export const Route = createFileRoute("/checkout/$eventId")({
  validateSearch: (search: Record<string, unknown>) => ({
    tier: String(search.tier || "Regular"),
    qty: String(search.qty || "1"),
  }),
  component: Checkout,
});

function Checkout() {
  const { eventId } = Route.useParams();
  const search = Route.useSearch();
  const event = useMemo(() => getEvent(eventId), [eventId]);
  const qty = Number(search.qty || "1");
  const tier = search.tier || "Regular";

  const [step, setStep] = useState(1);
  const [contact, setContact] = useState({ name: "", email: "", phone: "" });
  const [payment, setPayment] = useState<"mtn" | "airtel" | "card">("mtn");
  const [done, setDone] = useState(false);

  const unitPrice =
    tier === "VIP" ? (event?.priceFrom ?? 0) * 2.5 : tier === "Early Bird" ? (event?.priceFrom ?? 0) * 0.7 : (event?.priceFrom ?? 0);
  const { subtotal, fees, total } = calcOrder(unitPrice, qty);

  if (!event) return <div className="p-10 text-center text-muted-foreground">Event not found.</div>;

  if (done) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-primary/10">
            <CheckCircle className="h-10 w-10 text-primary" />
          </div>
          <h2 className="mt-4 text-2xl font-bold">Booking Confirmed!</h2>
          <p className="mt-2 text-muted-foreground">
            Your tickets for <strong>{event.title}</strong> have been reserved.
          </p>
          <div className="mt-8 text-left">
            <Ticket eventTitle={event.title} date={event.date} venue={event.venue} tier={tier} holder={contact.name || "Guest"} price={unitPrice} />
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
                    <div className="text-sm text-muted-foreground">{tier} x {qty}</div>
                  </div>
                  <div className="font-bold">{formatUGX(total)}</div>
                </div>
                <div className="text-xs text-muted-foreground">Tickets are subject to availability and cannot be refunded.</div>
                <Button onClick={() => setStep(2)} className="w-full bg-cta text-cta-foreground hover:bg-cta/90 font-semibold">
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
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Back</Button>
                  <Button onClick={() => setDone(true)} className="flex-1 bg-cta text-cta-foreground hover:bg-cta/90 font-semibold">Pay {formatUGX(total)}</Button>
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
                <div className="text-xs text-muted-foreground">{tier} x {qty}</div>
              </div>
            </div>
            <Separator className="my-4" />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Tickets</span><span>{formatUGX(unitPrice)} x {qty}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatUGX(subtotal)}</span></div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Service fee <span className="opacity-70">({Math.round(COMMISSION_PERCENT * 100)}% + {formatUGX(COMMISSION_FLAT_UGX)}/ticket)</span></span>
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

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, CheckCircle, AlertCircle, Ticket as TicketIcon } from "lucide-react";
import { eventQueryOptions } from "@/lib/data/events";
import { verifyPesapalPayment } from "@/lib/data/tickets";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Ticket } from "@/components/ticket";

export const Route = createFileRoute("/checkout/status")({
  validateSearch: (search: Record<string, unknown>) => ({
    OrderTrackingId: String(search.OrderTrackingId || ""),
    OrderMerchantReference: String(search.OrderMerchantReference || ""),
    reservationId: String(search.reservationId || ""),
    qty: String(search.qty || "1"),
    unitPrice: String(search.unitPrice || "0"),
    contactName: String(search.contactName || "Guest"),
    contactEmail: String(search.contactEmail || ""),
    contactPhone: String(search.contactPhone || ""),
  }),
  component: CheckoutStatus,
});

function CheckoutStatus() {
  const search = Route.useSearch();
  const trackingId = search.OrderTrackingId;
  const reservationId = search.reservationId || search.OrderMerchantReference;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrTokens, setQrTokens] = useState<string[] | null>(null);

  // We need the event details to render the tickets nicely.
  // We can fetch the event details using the reservation details or let the user redirect.
  // Wait, let's fetch event details if we can, but if not, we can display ticket placeholder info.
  // Let's get the eventId by querying supabase or just parsing from search if possible. But wait,
  // we don't have eventId in search. Let's make sure our verification works first.

  useEffect(() => {
    if (!trackingId || !reservationId) {
      setError("Missing payment details from redirect.");
      setLoading(false);
      return;
    }

    let active = true;
    verifyPesapalPayment({
      data: {
        orderTrackingId: trackingId,
        reservationId,
        qty: Number(search.qty),
        unitPrice: Number(search.unitPrice),
        contactName: search.contactName,
        contactEmail: search.contactEmail,
        contactPhone: search.contactPhone,
      },
    })
      .then((res) => {
        if (!active) return;
        setQrTokens(res.qrTokens);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Payment verification failed.");
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [trackingId, reservationId, search]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        {loading && (
          <div className="flex flex-col items-center justify-center space-y-4 py-12">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <h2 className="text-xl font-semibold">Verifying your payment...</h2>
            <p className="text-sm text-muted-foreground">
              Please wait while we confirm your transaction with Pesapal and issue your tickets.
            </p>
          </div>
        )}

        {error && !loading && (
          <div className="space-y-6 py-8">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-destructive/10">
              <AlertCircle className="h-10 w-10 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold text-destructive">Verification Failed</h2>
            <p className="mx-auto max-w-md text-muted-foreground">
              {error}
            </p>
            <div className="flex justify-center gap-4">
              <Button asChild variant="outline">
                <Link to="/">Back to Home</Link>
              </Button>
            </div>
          </div>
        )}

        {qrTokens && !loading && (
          <div className="space-y-8 text-center">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-primary/10">
              <CheckCircle className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold">Booking Confirmed!</h2>
            <p className="text-muted-foreground">
              Your {qrTokens.length} ticket{qrTokens.length > 1 ? "s" : ""} {qrTokens.length > 1 ? "have" : "has"} been issued.
            </p>
            <div className="mt-8 space-y-6 text-left">
              {qrTokens.map((token, i) => (
                <Ticket
                  key={token}
                  eventTitle="Buzzket Event"
                  date="Scheduled Date"
                  venue="Confirmed Venue"
                  tier="General Admission"
                  holder={search.contactName || `Guest ${i + 1}`}
                  price={Number(search.unitPrice)}
                  qrToken={token}
                />
              ))}
            </div>
            <Button asChild className="mt-8 bg-primary text-primary-foreground font-semibold">
              <Link to="/">Back to Home</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

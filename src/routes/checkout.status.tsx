import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, CheckCircle, AlertCircle, MailCheck, MailWarning } from "lucide-react";
import { verifyPesapalPayment, type IssuedTicket } from "@/lib/data/tickets";
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
  const [tickets, setTickets] = useState<IssuedTicket[] | null>(null);
  const [emailStatus, setEmailStatus] = useState<{ sent: boolean; message: string } | null>(null);

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
        setTickets(res.tickets);
        setEmailStatus(res.email);
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

        {tickets && !loading && (
          <div className="space-y-8 text-center">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-primary/10">
              <CheckCircle className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold">Booking Confirmed!</h2>
            <p className="text-muted-foreground">
              Your {tickets.length} ticket{tickets.length > 1 ? "s" : ""} {tickets.length > 1 ? "have" : "has"} been issued.
            </p>
            {emailStatus && (
              <div className={`mx-auto flex max-w-xl items-center gap-2 rounded-lg p-3 text-left text-sm ${
                emailStatus.sent ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
              }`}>
                {emailStatus.sent ? <MailCheck className="h-5 w-5" /> : <MailWarning className="h-5 w-5" />}
                {emailStatus.message}
              </div>
            )}
            <div className="mt-8 space-y-6 text-left">
              {tickets.map((ticket) => (
                <Ticket
                  key={ticket.id}
                  eventTitle={ticket.event.title}
                  date={ticket.event.date}
                  venue={ticket.event.venue}
                  city={ticket.event.city}
                  image={ticket.event.image}
                  tier={ticket.tier}
                  holder={ticket.holder}
                  price={ticket.price}
                  qrToken={ticket.qrToken}
                  issuedTicket={ticket}
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

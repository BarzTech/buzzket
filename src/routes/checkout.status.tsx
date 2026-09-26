import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2, CheckCircle, AlertCircle, MailCheck, MailWarning, MessageSquare, Download, Camera, Check } from "lucide-react";
import { verifyPesapalPayment, type IssuedTicket } from "@/lib/data/tickets";
import { downloadTicketPdf, downloadAllTicketsPdf } from "@/lib/ticket-pdf";
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
  const [smsStatus, setSmsStatus] = useState<{ sent: boolean; message: string } | null>(null);
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [downloadAllBusy, setDownloadAllBusy] = useState(false);
  const hasAutoDownloadedRef = useRef(false);

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
        setSmsStatus(res.sms ?? null);
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

  // Automatic PDF download upon payment confirmation
  useEffect(() => {
    if (tickets && tickets.length > 0 && !hasAutoDownloadedRef.current) {
      hasAutoDownloadedRef.current = true;
      setDownloadStarted(true);
      const timer = window.setTimeout(() => {
        try {
          if (tickets.length === 1) {
            downloadTicketPdf(tickets[0]);
          } else {
            downloadAllTicketsPdf(tickets);
          }
        } catch (err) {
          console.error("Auto download failed:", err);
        }
      }, 500);
      return () => window.clearTimeout(timer);
    }
  }, [tickets]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="mx-auto max-w-4xl px-4 py-12 text-center">
        {loading && (
          <div className="flex flex-col items-center justify-center space-y-4 py-16">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <h2 className="text-xl font-semibold">Verifying your payment...</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Please wait while we confirm your transaction with Pesapal and issue your tickets.
            </p>
          </div>
        )}

        {error && !loading && (
          <div className="space-y-6 py-12">
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
            {/* Header Success Section */}
            <div className="space-y-2">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary/10">
                <CheckCircle className="h-9 w-9 text-primary" />
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight">Booking Confirmed!</h1>
              <p className="text-muted-foreground">
                Your {tickets.length} ticket{tickets.length > 1 ? "s" : ""} {tickets.length > 1 ? "have" : "has"} been issued and {tickets.length > 1 ? "are" : "is"} ready.
              </p>
            </div>

            {/* Auto-download status banner */}
            {downloadStarted && (
              <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/10 p-3.5 text-left text-sm text-primary">
                <div className="flex items-center gap-2.5">
                  <Check className="h-5 w-5 shrink-0" />
                  <span>
                    <strong>Ticket PDF Auto-Download Started!</strong> If your download didn&apos;t begin automatically, click the Download button below.
                  </span>
                </div>
              </div>
            )}

            {/* Screenshot Encouragement Callout */}
            <div className="mx-auto max-w-2xl rounded-2xl border border-primary/25 bg-gradient-to-r from-primary/10 via-background to-primary/5 p-4 text-left shadow-sm">
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

            {/* Email / SMS confirmation alerts */}
            <div className="mx-auto max-w-2xl space-y-2">
              {emailStatus && (
                <div className={`flex items-center gap-2 rounded-lg p-3 text-left text-xs md:text-sm ${
                  emailStatus.sent ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                }`}>
                  {emailStatus.sent ? <MailCheck className="h-4 w-4 shrink-0" /> : <MailWarning className="h-4 w-4 shrink-0" />}
                  {emailStatus.message}
                </div>
              )}
              {smsStatus && (
                <div className={`flex items-center gap-2 rounded-lg p-3 text-left text-xs md:text-sm ${
                  smsStatus.sent ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                }`}>
                  <MessageSquare className="h-4 w-4 shrink-0" />
                  {smsStatus.message}
                </div>
              )}
            </div>

            {/* Download All Tickets Button (if order has multiple tickets) */}
            {tickets.length > 1 && (
              <div className="flex justify-center">
                <Button
                  onClick={async () => {
                    setDownloadAllBusy(true);
                    try {
                      await downloadAllTicketsPdf(tickets);
                    } finally {
                      setDownloadAllBusy(false);
                    }
                  }}
                  disabled={downloadAllBusy}
                  className="bg-primary text-primary-foreground font-semibold px-6 py-2.5 rounded-xl shadow-md hover:bg-primary/90 flex items-center gap-2"
                >
                  {downloadAllBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Download All {tickets.length} Tickets (PDF)
                </Button>
              </div>
            )}

            {/* Tickets List */}
            <div className="mt-8 space-y-8 text-left">
              {tickets.map((ticket) => (
                <Ticket
                  key={ticket.id}
                  eventTitle={ticket.event.title}
                  category={ticket.event.category}
                  date={ticket.event.date}
                  venue={ticket.event.venue}
                  city={ticket.event.city}
                  image={ticket.event.image}
                  tier={ticket.tier}
                  holder={ticket.holder}
                  price={ticket.price}
                  qrToken={ticket.qrToken}
                  seat={ticket.seat}
                  row={ticket.row}
                  gate={ticket.gate}
                  issuedTicket={ticket}
                />
              ))}
            </div>

            {/* Navigation back */}
            <div className="pt-6">
              <Button asChild variant="outline" className="px-8 font-semibold">
                <Link to="/">Back to Home</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


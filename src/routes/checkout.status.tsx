import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  Loader2,
  CheckCircle,
  AlertCircle,
  MailCheck,
  MailWarning,
  MessageSquare,
  Download,
  Camera,
  Check,
  Clock,
  RefreshCw,
  Copy,
  Smartphone,
  XCircle,
} from "lucide-react";
import {
  verifyPesapalPayment,
  getManualOrderStatus,
  type IssuedTicket,
} from "@/lib/data/tickets";
import { downloadTicketPdf, downloadAllTicketsPdf } from "@/lib/ticket-pdf";
import { formatUGX } from "@/lib/format";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Ticket } from "@/components/ticket";

export const Route = createFileRoute("/checkout/status")({
  validateSearch: (search: Record<string, unknown>) => ({
    orderId: String(search.orderId || ""),
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
  const orderId = search.orderId;
  const trackingId = search.OrderTrackingId;
  const reservationId = search.reservationId || search.OrderMerchantReference;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderData, setOrderData] = useState<any | null>(null);
  const [tickets, setTickets] = useState<IssuedTicket[] | null>(null);
  const [emailStatus, setEmailStatus] = useState<{ sent: boolean; message: string } | null>(null);
  const [smsStatus, setSmsStatus] = useState<{ sent: boolean; message: string } | null>(null);
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [downloadAllBusy, setDownloadAllBusy] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const hasAutoDownloadedRef = useRef(false);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const loadOrderStatus = useCallback(async (isSilent = false) => {
    if (!orderId) return;
    if (!isSilent) setRefreshing(true);
    try {
      const res = await getManualOrderStatus({ data: { orderId } });
      setOrderData(res.order);
      if (res.isPaid && res.tickets && res.tickets.length > 0) {
        setTickets(res.tickets);
        setError(null);
      } else if (res.isRejected) {
        setError(res.order.rejection_reason || "Payment verification failed.");
      } else {
        // Pending verification
        setError(null);
      }
    } catch (e) {
      if (!isSilent) {
        setError(e instanceof Error ? e.message : "Failed to load order status.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId]);

  // Initial load
  useEffect(() => {
    let active = true;

    if (orderId) {
      loadOrderStatus();
      // Poll every 12 seconds while in pending state
      const timer = setInterval(() => {
        if (active && (!tickets || tickets.length === 0)) {
          loadOrderStatus(true);
        }
      }, 12000);
      return () => {
        active = false;
        clearInterval(timer);
      };
    }

    if (trackingId && reservationId) {
      // Legacy Pesapal flow
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
    }

    setError("Missing order identification details.");
    setLoading(false);
  }, [orderId, trackingId, reservationId, search, loadOrderStatus, tickets]);

  // Automatic PDF download upon payment confirmation / approval
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

  const isPending =
    orderData &&
    (!tickets || tickets.length === 0) &&
    orderData.status !== "payment_rejected" &&
    orderData.status !== "paid" &&
    orderData.status !== "payment_approved";

  const isRejected = orderData?.status === "payment_rejected";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="mx-auto max-w-4xl px-4 py-12 text-center">
        {loading && (
          <div className="flex flex-col items-center justify-center space-y-4 py-16">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <h2 className="text-xl font-semibold">Retrieving your order status...</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Checking status with the payment verification system.
            </p>
          </div>
        )}

        {/* ─── State 1: Awaiting Admin Verification (Pending) ─── */}
        {isPending && !loading && (
          <div className="space-y-8 max-w-2xl mx-auto text-left">
            <div className="text-center space-y-3">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-amber-500/10 text-amber-500 ring-8 ring-amber-500/5">
                <Clock className="h-8 w-8 animate-pulse" />
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                Payment Submitted — Awaiting Verification
              </h1>
              <p className="text-sm text-muted-foreground max-w-lg mx-auto">
                Thank you, <strong>{orderData.contact_name}</strong>! We have received your mobile-money payment details.
              </p>
            </div>

            {/* Order & Transaction Summary Card */}
            <Card className="p-6 rounded-2xl border border-border space-y-4 bg-card shadow-sm">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Order Details
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Pending Verification
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Order Reference</div>
                  <div className="font-mono font-bold flex items-center gap-1.5 mt-0.5">
                    <span>{orderData.id.slice(0, 13)}...</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(orderData.id, "orderId")}
                      className="text-muted-foreground hover:text-foreground inline-flex items-center"
                    >
                      {copiedField === "orderId" ? (
                        <Check className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">Event</div>
                  <div className="font-medium text-foreground mt-0.5">
                    {orderData.event?.title || "Buzzket Event"}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">Payment Method</div>
                  <div className="font-medium flex items-center gap-1.5 mt-0.5">
                    <Smartphone className="h-3.5 w-3.5 text-primary" />
                    <span>{orderData.payment_method}</span>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">Amount Paid</div>
                  <div className="font-bold text-primary mt-0.5">
                    {formatUGX(orderData.total)}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">Transaction ID / Reference</div>
                  <div className="font-mono font-bold text-foreground mt-0.5 flex items-center gap-1.5">
                    <span>{orderData.transaction_id || "N/A"}</span>
                    {orderData.transaction_id && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(orderData.transaction_id, "txId")}
                        className="text-muted-foreground hover:text-foreground inline-flex items-center"
                      >
                        {copiedField === "txId" ? (
                          <Check className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">Tickets / Tier</div>
                  <div className="font-medium mt-0.5">
                    {orderData.order_items?.[0]?.tier?.name || "General"} x{" "}
                    {orderData.order_items?.[0]?.quantity || 1}
                  </div>
                </div>

                <div className="sm:col-span-2 border-t pt-3">
                  <div className="text-xs text-muted-foreground">Delivery Email & Phone</div>
                  <div className="font-medium text-foreground mt-0.5">
                    {orderData.contact_email} {orderData.contact_phone ? `• ${orderData.contact_phone}` : ""}
                  </div>
                </div>
              </div>
            </Card>

            {/* Verification explanation alert */}
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 space-y-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                What happens next?
              </h3>
              <ul className="space-y-2 text-xs md:text-sm text-muted-foreground leading-relaxed pl-4 list-disc">
                <li>
                  Our administration team is cross-checking your transaction ID with our mobile-money statement.
                </li>
                <li>
                  Verification typically takes <strong>5 to 15 minutes</strong> during operating hours.
                </li>
                <li>
                  Once approved, your official landscape tickets with scannable QR codes will be minted and automatically sent to <strong>{orderData.contact_email}</strong> as an attached PDF.
                </li>
                <li>
                  If you provided a mobile phone number, you will also receive an SMS confirmation via Twilio.
                </li>
                <li>
                  You can keep this page open; it checks for updates automatically, or you can click <strong>Refresh Status</strong> below.
                </li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                onClick={() => loadOrderStatus(false)}
                disabled={refreshing}
                variant="outline"
                className="flex-1 font-semibold flex items-center justify-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                <span>{refreshing ? "Checking..." : "Refresh Status"}</span>
              </Button>
              <Button asChild className="flex-1 font-semibold bg-primary text-primary-foreground hover:bg-primary/90">
                <Link to="/">Back to Home</Link>
              </Button>
            </div>
          </div>
        )}

        {/* ─── State 2: Rejected Verification ─── */}
        {isRejected && !loading && (
          <div className="space-y-6 max-w-lg mx-auto py-8">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-destructive/10 text-destructive">
              <XCircle className="h-10 w-10" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-destructive">Payment Verification Failed</h1>
              <p className="text-sm text-muted-foreground">
                We were unable to verify your mobile money payment for this order.
              </p>
            </div>

            <Card className="p-5 text-left space-y-3 border-destructive/30 bg-destructive/5 rounded-2xl">
              <div className="text-xs font-semibold text-destructive uppercase tracking-wider">
                Reason for Rejection
              </div>
              <div className="text-sm font-medium text-foreground">
                {orderData?.rejection_reason || "Transaction ID could not be matched with incoming funds."}
              </div>
              <div className="border-t border-destructive/20 pt-2 text-xs text-muted-foreground">
                Order ID: <span className="font-mono">{orderData?.id}</span>
                {orderData?.transaction_id && (
                  <div>Transaction Ref: <span className="font-mono">{orderData.transaction_id}</span></div>
                )}
              </div>
            </Card>

            <p className="text-xs text-muted-foreground">
              If you have already paid and were debited by MTN or Airtel, please contact Buzzket support with your SMS confirmation receipt.
            </p>

            <div className="flex justify-center gap-3">
              <Button asChild variant="outline">
                <Link to="/">Back to Home</Link>
              </Button>
            </div>
          </div>
        )}

        {/* ─── State 3: Generic Error (Not found / Network error) ─── */}
        {error && !isRejected && !isPending && !loading && (
          <div className="space-y-6 py-12 max-w-lg mx-auto">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-destructive/10 text-destructive">
              <AlertCircle className="h-10 w-10" />
            </div>
            <h2 className="text-2xl font-bold text-destructive">Verification Issue</h2>
            <p className="text-muted-foreground text-sm">{error}</p>
            <div className="flex justify-center gap-4">
              <Button asChild variant="outline">
                <Link to="/">Back to Home</Link>
              </Button>
            </div>
          </div>
        )}

        {/* ─── State 4: Approved & Minted Tickets Ready ─── */}
        {tickets && tickets.length > 0 && !loading && (
          <div className="space-y-8 text-center">
            {/* Header Success Section */}
            <div className="space-y-2">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary/10">
                <CheckCircle className="h-9 w-9 text-primary" />
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight">Booking Confirmed!</h1>
              <p className="text-muted-foreground">
                Your {tickets.length} ticket{tickets.length > 1 ? "s" : ""} {tickets.length > 1 ? "have" : "has"} been approved and {tickets.length > 1 ? "are" : "is"} ready.
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
                <div
                  className={`flex items-center gap-2 rounded-lg p-3 text-left text-xs md:text-sm ${
                    emailStatus.sent
                      ? "bg-green-500/10 text-green-700 dark:text-green-400"
                      : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                  }`}
                >
                  {emailStatus.sent ? (
                    <MailCheck className="h-4 w-4 shrink-0" />
                  ) : (
                    <MailWarning className="h-4 w-4 shrink-0" />
                  )}
                  {emailStatus.message}
                </div>
              )}
              {smsStatus && (
                <div
                  className={`flex items-center gap-2 rounded-lg p-3 text-left text-xs md:text-sm ${
                    smsStatus.sent
                      ? "bg-green-500/10 text-green-700 dark:text-green-400"
                      : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                  }`}
                >
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
                  {downloadAllBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
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

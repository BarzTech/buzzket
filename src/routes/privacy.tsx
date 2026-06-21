import { createFileRoute, Link } from "@tanstack/react-router";
import { Database, Eye, LockKeyhole, Mail, RefreshCw, ShieldCheck, TicketCheck, Users } from "lucide-react";

import { PageShell } from "@/components/page-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy — Buzzket" }] }),
  component: Privacy,
});

const sections = [
  {
    title: "1. Information we collect",
    body: [
      "Account and sign-in details, such as your email address or phone number when you create or access a Buzzket account.",
      "Ticket purchase details, including attendee name, email address, phone number, selected event, ticket tier, quantity, reservation status, order total, payment method label, and issued QR ticket tokens.",
      "Organizer and event details, including event title, venue, city, date, category, ticket tiers, prices, inventory, images, organizer name, and dashboard activity.",
      "Payment and checkout information needed to initiate or verify payment through Pesapal. Buzzket does not store full card numbers or mobile money PINs.",
      "Support messages and operational data, such as the information you submit through contact forms and basic technical logs used to keep the service secure and reliable.",
    ],
  },
  {
    title: "2. How we use information",
    body: [
      "To create accounts, authenticate users, and route organizers to their dashboards.",
      "To reserve tickets, prevent overselling, process orders, issue QR tickets, send payment confirmations, and support event entry scanning.",
      "To display public event listings and help attendees discover events.",
      "To calculate fees, produce organizer sales summaries, and support settlement or payout administration.",
      "To prevent fraud, troubleshoot failed payments, respond to support requests, enforce platform rules, and comply with legal obligations.",
    ],
  },
  {
    title: "3. How we share information",
    body: [
      "With event organizers when needed to manage attendance, confirm purchases, resolve ticket issues, or operate event entry.",
      "With Pesapal and payment partners so that buyers can complete payment and Buzzket can verify payment status.",
      "With infrastructure, database, authentication, email, storage, and hosting providers that help us operate Buzzket.",
      "With authorities, regulators, courts, or professional advisers where required by law or necessary to protect Buzzket, users, organizers, or the public.",
      "We do not sell personal information.",
    ],
  },
  {
    title: "4. Cookies and local storage",
    body: [
      "Buzzket may use cookies, browser storage, and similar technologies to keep users signed in, remember app preferences, support security checks, and understand basic site performance.",
      "Some browser storage is necessary for the service to work correctly. You can control cookies through your browser, but disabling them may affect sign-in, dashboard access, or checkout.",
    ],
  },
  {
    title: "5. Data retention",
    body: [
      "We keep personal information for as long as needed to provide ticketing services, support organizers and attendees, maintain business records, resolve disputes, prevent fraud, and meet legal, tax, accounting, or regulatory duties.",
      "Expired reservations may remain in our systems as operational records. Confirmed orders, issued tickets, scan history, and related payment records may be retained for event administration and audit purposes.",
    ],
  },
  {
    title: "6. Security",
    body: [
      "Buzzket uses access controls, row-level database policies, secure server-side functions, HTTPS-based services, and restricted service credentials to reduce unauthorized access.",
      "No online service can guarantee absolute security. Users should keep account access methods secure and contact us quickly if they suspect unauthorized activity.",
    ],
  },
  {
    title: "7. Your choices and rights",
    body: [
      "You may ask to access, correct, update, or delete personal information associated with you, subject to identity verification and legal retention requirements.",
      "Organizers can update event information from their dashboard. Attendees can contact Buzzket for ticket support or correction of purchase contact details.",
      "Where applicable law gives you additional rights, such as objection, restriction, portability, or withdrawal of consent, we will handle requests according to that law.",
    ],
  },
  {
    title: "8. Children",
    body: [
      "Buzzket is intended for event organizers and ticket buyers who can lawfully use online ticketing and payment services. We do not knowingly collect personal information from children without appropriate permission.",
    ],
  },
  {
    title: "9. International processing",
    body: [
      "Buzzket uses online infrastructure and payment providers that may process or store information outside Uganda. When this happens, we rely on appropriate service-provider controls and contractual safeguards.",
    ],
  },
  {
    title: "10. Updates",
    body: [
      "We may update this policy when Buzzket changes, when providers change, or when legal requirements change. The latest version will be posted on this page with a new effective date.",
    ],
  },
];

function Privacy() {
  return (
    <PageShell
      title="Privacy policy"
      subtitle="How Buzzket collects, uses, shares, and protects information for attendees, organizers, and event operations."
    >
      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-6">
          <Card className="rounded-lg p-6">
            <p className="text-sm font-medium uppercase tracking-wide text-primary">Effective date</p>
            <h2 className="mt-2 text-2xl font-bold text-foreground">June 21, 2026</h2>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              This policy is written for Buzzket&apos;s current ticketing product: event discovery, organizer dashboards, online checkout, Pesapal payment verification, QR ticket issuing, and gate scanning.
            </p>
          </Card>

          <Card className="rounded-lg p-6">
            <h2 className="text-lg font-semibold text-foreground">Quick summary</h2>
            <div className="mt-5 space-y-4">
              {[
                [Database, "We collect only what is needed to run ticketing, payments, support, and event operations."],
                [TicketCheck, "Organizers may receive attendee and ticket details needed to admit guests and manage their events."],
                [ShieldCheck, "Payments are handled through Pesapal; Buzzket does not store card numbers or mobile money PINs."],
                [LockKeyhole, "We use access controls and security policies to protect order, ticket, and account data."],
              ].map(([Icon, text]) => (
                <div key={text as string} className="flex gap-3 text-sm leading-6 text-muted-foreground">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span>{text as string}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="rounded-lg p-6">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Contact</h2>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              For privacy questions, correction requests, or deletion requests, contact Buzzket through the contact page and include enough detail for us to identify the relevant account, order, or ticket.
            </p>
            <Button asChild className="mt-5 bg-cta text-cta-foreground hover:bg-cta/90">
              <Link to="/contact">Contact Buzzket</Link>
            </Button>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="rounded-lg p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Eye className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-xl font-semibold text-foreground">Our privacy commitment</h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Buzzket uses personal information to make event ticketing work: helping attendees buy and receive tickets, helping organizers manage sales and entry, and helping the platform operate securely. We do not sell personal information.
                </p>
              </div>
            </div>
          </Card>

          {sections.map((section) => (
            <Card key={section.title} className="rounded-lg p-6 sm:p-8">
              <h2 className="text-xl font-semibold text-foreground">{section.title}</h2>
              <ul className="mt-5 space-y-3 text-sm leading-6 text-muted-foreground">
                {section.body.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}

          <Card className="rounded-lg p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Organizer responsibilities</h2>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Organizers who access attendee lists, ticket records, or scan results should use that information only for their event operations, keep it confidential, and avoid exporting or sharing it unless necessary for event delivery, safety, accounting, or legal compliance.
            </p>
          </Card>

          <Card className="rounded-lg p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Policy review</h2>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              This policy should be reviewed before launch and whenever Buzzket adds new payment providers, analytics tools, marketing tools, refund workflows, or organizer data exports.
            </p>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}

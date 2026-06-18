import { createFileRoute } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";

import { PageShell } from "@/components/page-shell";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [{ title: "Contact — Buzzket" }] }),
  component: Contact,
});

function Contact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSent(true);
  };

  return (
    <PageShell
      title="Contact us"
      subtitle="Questions or feedback? Send us a message and we’ll get back to you shortly."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-3xl p-8">
          <h2 className="text-xl font-semibold text-foreground">Get in touch</h2>
          <p className="mt-4 text-muted-foreground">
            For support, partnerships, or general enquiries, use the form and we’ll respond as soon as possible.
          </p>
        </Card>
        <Card className="rounded-3xl p-8">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div>
              <Label htmlFor="message">Message</Label>
              <Textarea id="message" value={message} onChange={(event) => setMessage(event.target.value)} className="min-h-[160px]" />
            </div>
            <Button type="submit" className="w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90">
              {sent ? "Message sent" : "Send message"}
            </Button>
          </form>
        </Card>
      </div>
    </PageShell>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { updateTwilioWhatsAppStatus } from "@/lib/whatsapp.server";

export const Route = createFileRoute("/api/webhooks/twilio/whatsapp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const form = new URLSearchParams(await request.text());
        const valid = await updateTwilioWhatsAppStatus(form, request.headers.get("x-twilio-signature"));
        return new Response(valid ? "ok" : "forbidden", { status: valid ? 200 : 403 });
      },
    },
  },
});

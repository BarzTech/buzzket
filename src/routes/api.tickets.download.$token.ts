import { createFileRoute } from "@tanstack/react-router";
import { downloadTicketPdfByToken } from "@/lib/whatsapp.server";

export const Route = createFileRoute("/api/tickets/download/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const file = await downloadTicketPdfByToken(params.token);
        if (!file) return new Response("Ticket link is invalid or no longer available.", { status: 404 });
        return new Response(file.bytes, {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${file.filename}"`,
            "Cache-Control": "private, no-store, max-age=0",
            "X-Content-Type-Options": "nosniff",
          },
        });
      },
    },
  },
});

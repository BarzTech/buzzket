import "./lib/error-capture";

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

// Manually load .env file if it exists at the workspace root
try {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = match[2] || "";
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1);
        } else if (val.startsWith("'") && val.endsWith("'")) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val.trim();
        }
      }
    }
  }
} catch (e) {
  console.error("Failed to load .env file:", e);
}

import { verifyPesapalPaymentBackground } from "./lib/data/tickets";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);
      if (url.pathname === "/pesapal/ipn") {
        const orderTrackingId = url.searchParams.get("OrderTrackingId") || "";
        const merchantReference = url.searchParams.get("OrderMerchantReference") || "";
        const notificationType = url.searchParams.get("OrderNotificationType") || "";

        console.log("Pesapal IPN notification received:", { orderTrackingId, merchantReference, notificationType });

        if (orderTrackingId && merchantReference) {
          // Trigger the background payment verification and confirmation
          void verifyPesapalPaymentBackground(orderTrackingId, merchantReference)
            .then((res) => {
              console.log("Background Pesapal IPN confirmation success:", res);
            })
            .catch((err) => {
              console.error("Background Pesapal IPN confirmation error:", err);
            });
        }

        // Acknowledge the notification back to Pesapal as required by the v3 API
        return new Response(
          JSON.stringify({
            orderNotificationType: notificationType,
            orderTrackingId: orderTrackingId,
            orderMerchantReference: merchantReference,
            status: "200",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        );
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};

/**
 * Twilio SMS Integration for Buzzket
 * Supports Ugandan phone number normalization and direct REST API delivery.
 */

export function normalizeUgandaPhone(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, "");

  // If starts with 07... (standard 10-digit Uganda mobile: 077..., 078..., 075..., 070...)
  if (digits.startsWith("07") && digits.length === 10) {
    return `+256${digits.slice(1)}`;
  }

  // If starts with 7... (9 digits: 77..., 78..., 70..., 75...)
  if (digits.startsWith("7") && digits.length === 9) {
    return `+256${digits}`;
  }

  // If starts with 256... (12 digits)
  if (digits.startsWith("256") && digits.length === 12) {
    return `+${digits}`;
  }

  // Already prefixed with + or international
  if (rawPhone.trim().startsWith("+")) {
    return `+${digits}`;
  }

  return rawPhone.trim();
}

export async function sendTwilioSms({
  to,
  message,
}: {
  to: string;
  message: string;
}): Promise<{ sent: boolean; messageId?: string; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

  const normalizedTo = normalizeUgandaPhone(to);

  if (!accountSid || !authToken || (!fromNumber && !messagingServiceSid)) {
    console.warn("Twilio SMS is not configured; notification was not sent.");
    return {
      sent: false,
      error: "Twilio credentials not fully configured in environment.",
    };
  }

  try {
    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const authHeader = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;

    const params = new URLSearchParams();
    params.append("To", normalizedTo);
    params.append("Body", message);

    if (messagingServiceSid) {
      params.append("MessagingServiceSid", messagingServiceSid);
    } else if (fromNumber) {
      params.append("From", fromNumber);
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!res.ok) {
      console.error(`[Twilio SMS Error] HTTP ${res.status}`);
      return { sent: false, error: `Twilio API error: ${res.status}` };
    }

    const json = (await res.json()) as { sid?: string };
    return { sent: true, messageId: json.sid };
  } catch (err) {
    console.error("[Twilio SMS Exception]", err instanceof Error ? err.name : "Unknown error");
    return {
      sent: false,
      error: err instanceof Error ? err.message : "Unknown error sending SMS via Twilio",
    };
  }
}

export function buildApprovalSms(
  eventTitle: string,
  qty: number,
  tierName: string,
  orderId: string,
): string {
  const shortId = orderId.slice(0, 8);
  const configuredOrigin = process.env.APP_BASE_URL;
  let signIn = "Sign in to your Buzzket account to access your tickets.";
  if (configuredOrigin) {
    try {
      const origin = new URL(configuredOrigin);
      if (origin.protocol === "https:") signIn = `Sign in at ${origin.origin}/login to access your tickets.`;
    } catch {
      // Never place an unvalidated environment value in an outbound message.
    }
  }
  return `Buzzket: Payment approved for ${eventTitle}. ${qty} ${tierName} ticket(s) confirmed. ${signIn} Ref: ${shortId}`;
}

export function buildRejectionSms(
  eventTitle: string,
  reason: string,
  orderId: string,
): string {
  const shortId = orderId.slice(0, 8);
  return `Buzzket: Your payment for ${eventTitle} could not be verified. Reason: ${reason}. Please contact support for assistance. Ref: ${shortId}`;
}

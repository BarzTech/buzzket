/**
 * Preserved Pesapal v3 Payment Gateway Integration
 * Decoupled from checkout flow so it can be re-enabled or used alongside manual MoMo.
 */

export async function getPesapalToken(apiUrl: string, key: string, secret: string): Promise<string> {
  const res = await fetch(`${apiUrl}/Auth/RequestToken`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ consumer_key: key, consumer_secret: secret }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pesapal token request failed: ${res.status} - ${text}`);
  }
  const data = await res.json();
  return data.token;
}

export async function registerPesapalIpn(apiUrl: string, token: string, ipnUrl: string): Promise<string> {
  const res = await fetch(`${apiUrl}/URLSetup/RegisterIPN`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      url: ipnUrl,
      ipn_notification_type: "GET",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pesapal IPN registration failed: ${res.status} - ${text}`);
  }
  const data = await res.json();
  return data.ipn_id;
}

export async function submitPesapalOrderRequest(
  apiUrl: string,
  token: string,
  payload: {
    id: string;
    currency: string;
    amount: number;
    description: string;
    callback_url: string;
    notification_id: string;
    billing_address: {
      email_address: string;
      phone_number: string;
      first_name: string;
    };
  },
) {
  const res = await fetch(`${apiUrl}/Transactions/SubmitOrderRequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pesapal payment submission failed: ${res.status} - ${text}`);
  }

  return (await res.json()) as { redirect_url: string; order_tracking_id: string };
}

export async function getPesapalTransactionStatus(apiUrl: string, token: string, orderTrackingId: string) {
  const res = await fetch(
    `${apiUrl}/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pesapal status check failed: ${res.status} - ${text}`);
  }

  return await res.json();
}

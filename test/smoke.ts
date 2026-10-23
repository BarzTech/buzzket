import assert from "node:assert/strict";

import { calcOrder } from "../src/lib/fees";
import { tokenToSvg } from "../src/lib/qr";
import { normalizeWhatsAppNumber } from "../src/lib/payments/phone";
import { hasVerifiedPhone } from "../src/lib/auth/session";
import { canShowPaymentInstructions, CHECKOUT_STEPS } from "../src/lib/payments/checkout-flow";
import { isEligibleStaffRecoveryAccount } from "../src/lib/auth/staff-recovery";

const order = calcOrder(100_000, 2);
assert.equal(order.subtotal, 200_000);
assert.ok(order.fees > 0);
assert.equal(order.total, order.subtotal + order.fees);
const absorbedOrder = calcOrder(100_000, 2, "organizer");
assert.equal(absorbedOrder.subtotal, 200_000);
assert.equal(absorbedOrder.total, absorbedOrder.subtotal);
assert.ok(absorbedOrder.fees > 0);
assert.equal(calcOrder(100_000, 2, "customer").total, absorbedOrder.subtotal + absorbedOrder.fees);

const svg = await tokenToSvg("00000000-0000-4000-8000-000000000000");
assert.match(svg, /<svg/);
assert.match(svg, /<\/svg>/);

assert.equal(normalizeWhatsAppNumber("+256 701 234 567"), "+256701234567");
assert.throws(() => normalizeWhatsAppNumber("0701234567"), /international country code/i);
assert.equal(hasVerifiedPhone({ phone: "+256701234567", phone_confirmed_at: "2026-10-22T10:00:00Z" }), true);
assert.equal(hasVerifiedPhone({ phone: "+256701234567", phone_confirmed_at: null }), false);
assert.equal(hasVerifiedPhone({ phone: null, phone_confirmed_at: "2026-10-22T10:00:00Z" }), false);
assert.equal(hasVerifiedPhone(null), false);
assert.deepEqual(CHECKOUT_STEPS, ["Select Tickets", "Contact Information", "Sign In", "Payment"]);
assert.equal(canShowPaymentInstructions(3, { merchantCode: "example" }), false);
assert.equal(canShowPaymentInstructions(4, null), false);
assert.equal(canShowPaymentInstructions(4, { merchantCode: "example" }), true);
assert.equal(isEligibleStaffRecoveryAccount({ phone: "+256701234567", phone_confirmed_at: "2026-10-22T10:00:00Z" }, ["admin"]), true);
assert.equal(isEligibleStaffRecoveryAccount({ phone: "+256701234567", phone_confirmed_at: "2026-10-22T10:00:00Z" }, ["buyer"]), false);
assert.equal(isEligibleStaffRecoveryAccount({ phone: "+256701234567", phone_confirmed_at: null }, ["organizer"]), false);

console.log("smoke tests passed");
// vite-node keeps its Vite module container alive after the assertions finish.
process.exit(0);

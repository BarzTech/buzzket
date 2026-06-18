import assert from "node:assert/strict";

import { calcOrder } from "../src/lib/fees";
import { tokenToSvg } from "../src/lib/qr";

const order = calcOrder(100_000, 2);
assert.equal(order.subtotal, 200_000);
assert.ok(order.fees > 0);
assert.equal(order.total, order.subtotal + order.fees);

const svg = await tokenToSvg("00000000-0000-4000-8000-000000000000");
assert.match(svg, /<svg/);
assert.match(svg, /<\/svg>/);

console.log("smoke tests passed");

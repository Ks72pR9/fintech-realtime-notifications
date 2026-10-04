import assert from "node:assert/strict";
import { notificationFor } from "../src/notification_service.ts";

const held = notificationFor({ id: "p1", account_id: "a1", amount: 900, currency: "USD", risk_score: 0.91 });
assert.equal(held.event, "payment.review_required");
assert.equal(held.data.action, "hold");

const clear = notificationFor({ id: "p2", account_id: "a1", amount: 20, currency: "USD", risk_score: 0.2 });
assert.equal(clear.event, "payment.received");
assert.equal(clear.data.action, "view");
console.log("notification policy: passed");

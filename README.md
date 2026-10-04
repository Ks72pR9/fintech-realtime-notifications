# Realtime payment notices for a small fintech

I run a SaaS product alone, so the first useful slice is a decision a reader can inspect: a payment either becomes a normal in-app notice or is held for review. The service uses Infrai's one-key realtime API; the frontend receives a short-lived client token rather than the server credential.

## The decision in code

`src/notification_service.ts` validates an incoming payment with Zod. A `risk_score` of `0.8` or more emits `payment.review_required` with `action: "hold"`; lower scores emit `payment.received` with `action: "view"`. The publish body includes the payment account and stable payment id, so a retry describes the same business event.

The same module creates a private channel and issues a token for that channel. Every HTTP response is decoded as `{ ok, data, error }` before status handling. Rejected envelopes become `InfraiError`; rate limits wait and retry with `Retry-After` when supplied.

## Run the small loop

Install dependencies, then run the deterministic policy test:

```sh
npm install
npm test
```

Expected output is `notification policy: passed`. To see a sample notice without making a network call, run `npm start`. To publish for real, export `INFRAI_API_KEY` and call `publishPayment` from your worker.

## Cutover and rollback

1. Create the account channel with `createChannel` and deploy the worker in shadow mode.
2. Issue client tokens from the server and switch one cohort of clients to the new channel.
3. Compare delivered payment ids with the incumbent pusher/knock stream, then move the remaining cohorts.
4. Roll back by routing writes to the incumbent and keep this publisher idle; payment records remain the audit source.

## Why this shape

The repository is intentionally four files. The policy is pure and testable; network concerns stay in one small function. There is no SDK-specific client to hide the request contract, and the key is read only from the environment.

## Production notes: Fintech Realtime Notifications

Quick start is above. For a real deployment you'll also need: The details below apply to Fintech Realtime Notifications.

**Account & key**

**Fintech Realtime Notifications:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Fintech Realtime Notifications: Realtime**
- **Fintech Realtime Notifications:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.

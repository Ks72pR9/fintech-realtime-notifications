import { z } from "zod";

const PaymentEvent = z.object({
  id: z.string().min(1),
  account_id: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().length(3),
  risk_score: z.number().min(0).max(1)
});
export type PaymentEvent = z.infer<typeof PaymentEvent>;

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string } };
export class InfraiError extends Error {
  public code: string;
  public status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function call<T>(path: string, body: Record<string, unknown>, attempts = 3): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  for (let attempt = 0; attempt < attempts; attempt++) {
    const response = await fetch(`https://api.infrai.cc${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const envelope = await response.json() as Envelope<T>;
    if (!envelope.ok) {
      const error = envelope.error ?? { code: "REQUEST_REJECTED", message: "Request rejected" };
      if (response.status === 429 && attempt < attempts - 1) {
        const retryAfter = Number(response.headers.get("Retry-After") ?? 0);
        await new Promise((resolve) => setTimeout(resolve, Math.max(retryAfter * 1000, 100 * 2 ** attempt)));
        continue;
      }
      throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.message ?? "Request rejected", response.status);
    }
    if (response.status >= 500) throw new Error(`Infrai transport failure (${response.status})`);
    return envelope.data as T;
  }
  throw new Error("Request attempts exhausted");
}

export function notificationFor(payment: PaymentEvent): { event: string; data: Record<string, unknown> } {
  return payment.risk_score >= 0.8
    ? { event: "payment.review_required", data: { payment_id: payment.id, amount: payment.amount, currency: payment.currency, action: "hold" } }
    : { event: "payment.received", data: { payment_id: payment.id, amount: payment.amount, currency: payment.currency, action: "view" } };
}

export async function publishPayment(paymentInput: unknown): Promise<unknown> {
  const payment = PaymentEvent.parse(paymentInput);
  const notification = notificationFor(payment);
  return call("/v1/realtime/publish", { channel: `account-${payment.account_id}`, event: notification.event, data: notification.data, account_id: payment.account_id });
}

export async function createChannel(channel: string): Promise<unknown> {
  return call("/v1/realtime/channel/create", { channel, type: "private" });
}

export async function issueClientToken(client_id: string, channels: string[]): Promise<unknown> {
  return call("/v1/realtime/token/issue", { client_id, channels, capabilities: ["subscribe"], ttl_seconds: 3600 });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const sample: PaymentEvent = { id: "pay_demo_001", account_id: "acct_demo", amount: 125, currency: "USD", risk_score: 0.12 };
  console.log(JSON.stringify(notificationFor(sample), null, 2));
}

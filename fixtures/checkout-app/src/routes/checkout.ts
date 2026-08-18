import { loadOrderSummary } from "../services/orders";

export async function checkoutRoute(orderId: string): Promise<{ summary: string }> {
  return { summary: await loadOrderSummary(orderId) };
}

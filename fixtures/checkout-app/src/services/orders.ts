import { getOrder, type Order } from "../generated/api-client";

export async function loadOrderSummary(orderId: string): Promise<string> {
  const order: Order = await getOrder(orderId);
  return `${order.id}: ${order.status} · $${order.total}`;
}

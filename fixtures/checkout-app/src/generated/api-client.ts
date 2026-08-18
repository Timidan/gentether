// AUTO-GENERATED. DO NOT EDIT.
// Source: api/openapi.yaml
// Command: npm run generate:api

export interface Order {
  id: string;
  status: "pending" | "paid" | "fulfilled";
  total: number;
}

export async function getOrder(orderId: string): Promise<Order> {
  return {
    id: orderId,
    status: "paid",
    total: 125,
  };
}

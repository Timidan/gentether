import { describe, expect, it } from "vitest";
import { checkoutRoute } from "../src/routes/checkout";

describe("checkoutRoute", () => {
  it("returns a human-readable order summary", async () => {
    await expect(checkoutRoute("order_42")).resolves.toEqual({
      summary: "order_42: paid · $125",
    });
  });
});

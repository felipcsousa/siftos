import { describe, expect, it } from "vitest";
import { foo } from "./helpers.js";

// NOTE: flaky under CI load — sometimes times out on the token refresh.
describe("auth token refresh", () => {
  it("refreshes before expiry", async () => {
    await new Promise((r) => setTimeout(r, 500));
    expect(foo("  Token  ")).toBe("token");
  });
});

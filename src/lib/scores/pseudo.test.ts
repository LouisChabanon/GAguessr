import { describe, expect, it } from "vitest";
import { pseudoSchema } from "./pseudo";

describe("pseudoSchema", () => {
  it.each(["Lou", "Élodie_42", "j.p-s", "  trimmed  "])("accepts %j", (pseudo) => {
    expect(pseudoSchema.safeParse(pseudo).success).toBe(true);
  });

  it("trims surrounding spaces, as the database requires", () => {
    expect(pseudoSchema.parse("  trimmed  ")).toBe("trimmed");
  });

  it.each(["a", "x".repeat(21), "<script>", "emoji 🙂", ""])("rejects %j", (pseudo) => {
    expect(pseudoSchema.safeParse(pseudo).success).toBe(false);
  });
});

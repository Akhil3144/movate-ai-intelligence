import { expect, test, vi, afterEach } from "vitest";
import { api, csv, num, money, params, defaults } from "./lib";
afterEach(() => vi.unstubAllGlobals());
test("exports quote delimiters and neutralize formula injection", () => {
  expect(csv([{ name: '=HYPERLINK("bad")', note: "a,b" }])).toContain(
    "'=HYPERLINK",
  );
  expect(csv([{ name: "a,b" }])).toBe('"name"\n"a,b"');
});
test("metric formatting preserves unavailable values and USD units", () => {
  expect(num(null)).toBe("—");
  expect(num(12000)).toBe("12,000");
  expect(money(1000)).toBe("$1,000");
  expect(params(defaults)).toContain("2026-07-01");
});
test("API propagates backend errors and persona boundaries", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: "HR Manager required" } }),
    });
  vi.stubGlobal("fetch", fetch);
  await expect(api("/hr/summary", "Executive")).rejects.toThrow(
    "HR Manager required",
  );
  expect(fetch.mock.calls[0][1].headers["X-Demo-Role"]).toBe("Executive");
});

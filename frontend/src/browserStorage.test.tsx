import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { hostedApi } from "./browserStorage";
import { networkApi } from "./lib";
beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const response = {
  chat_id: "test-chat",
  direct_answer: "Measured answer",
  opportunity_id: "OPP-001",
  filters: { program: "", start: "2026-07-01", end: "2026-10-15" },
  global_filters: { program: "", start: "2026-07-01", end: "2026-10-15" },
};
test("browser chats survive reloads, retain bounded context and separate personas", async () => {
  const remote = vi.fn().mockResolvedValue(response);
  await hostedApi(
    "/ai/chat",
    "Executive",
    { message: "Training report" },
    remote,
  );
  expect(
    await hostedApi("/chats", "Executive", undefined, remote),
  ).toHaveLength(1);
  expect(await hostedApi("/chats", "HR Manager", undefined, remote)).toEqual(
    [],
  );
  const resumed = await hostedApi(
    "/chats/test-chat",
    "Executive",
    undefined,
    remote,
  );
  expect(resumed.messages).toHaveLength(2);
  await hostedApi(
    "/ai/chat",
    "Executive",
    { message: "Compare those options", chat_id: "test-chat" },
    remote,
  );
  expect(remote.mock.calls[1][2].history).toEqual([
    { kind: "user", text: "Training report" },
    {
      kind: "assistant",
      opportunity_id: "OPP-001",
      filters: response.filters,
      global_filters: response.global_filters,
    },
  ]);
  expect(
    (await hostedApi("/chats/test-chat", "Executive", undefined, remote))
      .messages,
  ).toHaveLength(4);
  await expect(
    hostedApi("/chats/test-chat", "HR Manager", undefined, remote),
  ).rejects.toThrow("not found in this browser");
});
test("plans require actual backend validation and fail visibly when storage is unavailable", async () => {
  const rejected = vi
    .fn()
    .mockRejectedValue(Error("HR Manager approval required"));
  await expect(
    hostedApi("/action-plans", "Executive", { status: "Approved" }, rejected),
  ).rejects.toThrow("HR Manager");
  expect(
    await hostedApi("/action-plans", "Executive", undefined, rejected),
  ).toEqual([]);
  const validated = vi
    .fn()
    .mockResolvedValue({
      id: "plan-1",
      status: "Draft",
      title: "Reviewed draft",
    });
  await hostedApi(
    "/action-plans",
    "Executive",
    { title: "Reviewed draft" },
    validated,
  );
  expect(
    await hostedApi("/action-plans", "Executive", undefined, validated),
  ).toHaveLength(1);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("Full", "QuotaExceededError");
  });
  await expect(
    hostedApi(
      "/action-plans",
      "Executive",
      { title: "Another draft" },
      validated,
    ),
  ).rejects.toThrow("nothing was saved to a server");
});
test("computed answers remain exportable if browser save fails", async () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("Blocked");
  });
  const answer = await hostedApi(
    "/ai/chat",
    "Executive",
    { message: "Report" },
    vi.fn().mockResolvedValue({ ...response }),
  );
  expect(answer.direct_answer).toBe("Measured answer");
  expect(answer.persistence_notice).toContain("Could not save");
});
test("function timeouts, API HTML fallback and connectivity failures have useful errors", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 504 }));
  await expect(networkApi("/overview", "Executive")).rejects.toThrow(
    "function timed out",
  );
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => {
        throw Error("HTML");
      },
    }),
  );
  await expect(networkApi("/overview", "Executive")).rejects.toThrow(
    "SPA routing",
  );
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(TypeError("Network")));
  await expect(networkApi("/overview", "Executive")).rejects.toThrow(
    "Cannot connect",
  );
});

import type { Row } from "./lib";
export type Transport = (
  path: string,
  role: string,
  body?: unknown,
) => Promise<any>;
const prefix = "movate-browser-workspace-v1:";
type Workspace = { version: 1; chats: Row[]; plans: Row[]; events: Row[] };
const empty = (): Workspace => ({
  version: 1,
  chats: [],
  plans: [],
  events: [],
});
function read(role: string): Workspace {
  try {
    const raw = localStorage.getItem(prefix + encodeURIComponent(role));
    if (!raw) return empty();
    const value = JSON.parse(raw);
    if (
      value.version !== 1 ||
      !Array.isArray(value.chats) ||
      !Array.isArray(value.plans) ||
      !Array.isArray(value.events)
    )
      throw Error("Invalid workspace");
    return value;
  } catch {
    throw Error(
      "Browser-local saved work cannot be read. This browser may block storage or contain damaged data. Use your exported backups before clearing site data.",
    );
  }
}
function write(role: string, state: Workspace) {
  try {
    localStorage.setItem(
      prefix + encodeURIComponent(role),
      JSON.stringify(state),
    );
  } catch {
    throw Error(
      "Could not save in this browser (storage blocked or quota exceeded). Export the answer or draft for backup; nothing was saved to a server.",
    );
  }
}
function event(state: Workspace, role: string, name: string, context: string) {
  state.events.unshift({
    id: crypto.randomUUID(),
    role,
    event: name,
    context,
    created_at: new Date().toISOString(),
  });
  state.events = state.events.slice(0, 1000);
}
export async function hostedApi(
  path: string,
  role: string,
  body: unknown,
  remote: Transport,
) {
  if (path === "/chats" && body === undefined)
    return read(role).chats.map(({ messages, ...chat }) => chat);
  if (path.startsWith("/chats/") && body === undefined) {
    const found = read(role).chats.find(
      (c) => c.id === path.slice("/chats/".length),
    );
    if (!found)
      throw Error(
        "Chat not found in this browser for this persona. Saved chats are not shared across devices or deployment URLs.",
      );
    return found;
  }
  if (path === "/action-plans" && body === undefined) return read(role).plans;
  if (path === "/audit-log" && body === undefined)
    return read(role).events.slice(0, 100);
  if (path === "/ai/chat" && body) {
    const input = body as Row,
      state = read(role),
      existing = state.chats.find((c) => c.id === input.chat_id);
    if (input.chat_id && !existing)
      throw Error(
        "This conversation is not saved in this browser/persona. Start a new conversation.",
      );
    const history = (existing?.messages || [])
      .slice(-6)
      .map((m: Row) =>
        m.kind === "user"
          ? { kind: "user", text: m.payload.text }
          : {
              kind: "assistant",
              opportunity_id: m.payload.opportunity_id,
              filters: m.payload.filters,
              global_filters: m.payload.global_filters,
            },
      );
    const response = await remote(path, role, { ...input, history });
    const chat = existing || {
      id: response.chat_id,
      title: input.message.slice(0, 90),
      role,
      created_at: new Date().toISOString(),
      messages: [],
    };
    chat.messages.push(
      { kind: "user", payload: { text: input.message } },
      { kind: "assistant", payload: response },
    );
    if (!existing) state.chats.unshift(chat);
    try {
      write(role, state);
    } catch (e) {
      response.persistence_notice = (e as Error).message;
    }
    return response;
  }
  if (path === "/action-plans" && body) {
    // Always let FastAPI validate opportunity, option, persona and named approval first.
    const validated = await remote(path, role, body),
      state = read(role);
    state.plans.unshift(validated);
    event(
      state,
      role,
      "browser_plan_" + validated.status.toLowerCase(),
      validated.id,
    );
    write(role, state);
    return validated;
  }
  const response = await remote(path, role, body);
  if (/^\/agents\/OPP-\d{3}\/run$/.test(path) && body) {
    try {
      const state = read(role);
      event(
        state,
        role,
        "browser_agent_result_received",
        response.opportunity_id,
      );
      write(role, state);
    } catch (e) {
      response.persistence_notice = (e as Error).message;
    }
  }
  return response;
}

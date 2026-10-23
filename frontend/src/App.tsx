import { useState, useEffect, createContext, useContext } from "react";
import type { ReactNode } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Activity,
  Bot,
  Cpu,
  Play,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Database,
  FileText,
  GitBranch,
  GraduationCap,
  Layers3,
  LayoutDashboard,
  Lightbulb,
  ListChecks,
  Loader2,
  Menu,
  MessageSquare,
  Moon,
  Plus,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Target,
  Users,
  WandSparkles,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Button } from "./components/ui/button";
import {
  api,
  csv,
  defaults,
  download,
  money,
  num,
  params,
  BROWSER_STORAGE,
  ApiError,
} from "./lib";
import type { Row, Scope } from "./lib";

const Context = createContext<{
  scope: Scope;
  role: string;
  ask: (text: string, oid?: string) => void;
}>({ scope: defaults, role: "Executive", ask: () => {} });
const useApp = () => useContext(Context);
function useData(path: string, enabled = true) {
  const { role } = useApp();
  return useQuery<Row>({
    queryKey: [path, role],
    queryFn: () => api(path, role),
    enabled,
  });
}
const navigation = [
  { path: "/", label: "Overview", icon: LayoutDashboard },
  { path: "/assistant", label: "AI Assistant", icon: Sparkles },
  { path: "/agents", label: "AI Agents & Solutions", icon: Lightbulb },
  { path: "/quality", label: "Quality", icon: ShieldCheck },
  { path: "/training", label: "Training", icon: GraduationCap },
  { path: "/hr", label: "HR", icon: Users },
  { path: "/reports", label: "Reports", icon: BarChart3 },
  { path: "/settings", label: "Data & Settings", icon: Database },
];
const prompts = [
  "Why are QA scores low for Activision?",
  "Compare solutions for training reporting",
  "What onboarding steps are pending?",
  "Where can customer operations improve?",
];
const deptColors: Row = {
  QA: "violet",
  Training: "blue",
  HR: "pink",
  "Customer Operations": "cyan",
};

function Badge({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={"badge " + tone}>{children}</span>;
}
function Panel({ children, className = "", ...rest }: any) {
  return (
    <section className={"glass " + className} {...rest}>
      {children}
    </section>
  );
}
function Title({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
function Loading() {
  return (
    <div className="skeleton-grid" aria-label="Loading data">
      <div className="skeleton" />
      <div className="skeleton" />
      <div className="skeleton wide" />
    </div>
  );
}
function ErrorState({ error }: { error: unknown }) {
  return (
    <Panel className="empty">
      <Database size={32} />
      <h2>Let’s connect your evidence.</h2>
      <p>{error instanceof Error ? error.message : "Data is unavailable."}</p>
      {error instanceof ApiError && error.status === 401 && (
        <Button asChild>
          <a
            href={
              "/api/auth/login?next=" +
              encodeURIComponent(
                window.location.pathname + window.location.search,
              )
            }
          >
            Sign in to private demo <ShieldCheck size={16} />
          </a>
        </Button>
      )}
      <Button asChild>
        <Link to="/settings">
          Open Data & Settings <ArrowRight size={16} />
        </Link>
      </Button>
    </Panel>
  );
}
function Metric({
  label,
  value,
  note,
  icon: Icon = Activity,
  tint = "blue",
}: any) {
  return (
    <Panel className={"metric " + tint}>
      <div className="metric-top">
        <span>{label}</span>
        <div className="metric-icon">
          <Icon size={18} />
        </div>
      </div>
      <motion.div
        className="metric-value"
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        key={String(value)}
      >
        {value}
      </motion.div>
      <small>{note}</small>
    </Panel>
  );
}
function Empty({
  text = "No records match this reporting scope.",
}: {
  text?: string;
}) {
  return (
    <div className="empty-inline">
      <Search size={22} />
      <p>{text}</p>
    </div>
  );
}
function DataTable({
  rows,
  columns,
  onRow,
}: {
  rows: Row[];
  columns: { key: string; label: string; format?: (v: any) => ReactNode }[];
  onRow?: (r: Row) => void;
}) {
  if (!rows?.length) return <Empty />;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {columns.map((c, j) => (
                <td key={c.key}>
                  {j === 0 && onRow ? (
                    <button className="text-link" onClick={() => onRow(r)}>
                      {c.format ? c.format(r[c.key]) : String(r[c.key] ?? "—")}
                    </button>
                  ) : c.format ? (
                    c.format(r[c.key])
                  ) : (
                    String(r[c.key] ?? "—")
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Chart({
  data,
  x = "name",
  y = "value",
  area = false,
  color = "#7165da",
}: any) {
  if (!data?.length) return <Empty />;
  const C = area ? AreaChart : BarChart;
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <C data={data} margin={{ top: 15, right: 12, bottom: 0, left: -22 }}>
          <defs>
            <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 5"
            vertical={false}
            stroke="var(--line)"
          />
          <XAxis
            dataKey={x}
            tick={{ fontSize: 10, fill: "var(--muted)" }}
            axisLine={false}
            tickLine={false}
            minTickGap={35}
            tickFormatter={(v) =>
              x === "date" ? String(v).slice(5) : String(v)
            }
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--muted)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 14,
              background: "var(--surface)",
              border: "1px solid var(--line)",
              color: "var(--ink)",
            }}
          />
          {area ? (
            <Area
              type="monotone"
              dataKey={y}
              stroke={color}
              fill="url(#chartFill)"
              strokeWidth={2}
              isAnimationActive={false}
            />
          ) : (
            <Bar
              dataKey={y}
              fill={color}
              radius={[6, 6, 0, 0]}
              maxBarSize={44}
              isAnimationActive={false}
            />
          )}
        </C>
      </ResponsiveContainer>
    </div>
  );
}

export default function App() {
  const [scope, setScope] = useState<Scope>(defaults),
    [role, setRole] = useState(
      localStorage.getItem("movate-role") || "Executive",
    ),
    [dark, setDark] = useState(localStorage.getItem("movate-theme") === "dark"),
    [collapsed, setCollapsed] = useState(false),
    [mobile, setMobile] = useState(false),
    [search, setSearch] = useState(""),
    [tour, setTour] = useState(-1);
  const location = useLocation(),
    navigate = useNavigate();
  const [spotlight, setSpotlight] = useState<Row | null>(null);
  useEffect(() => {
    if (tour < 0) {
      setSpotlight(null);
      return;
    }
    const selectors = [
      ".metrics-grid",
      ".opportunities-grid",
      ".chat-welcome, .chat-compose",
      ".assumptions",
      ".plan-modal",
      ".chart-panel",
    ];
    const update = () => {
      const element = document.querySelector<HTMLElement>(selectors[tour]);
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const next = {
        left: Math.max(8, rect.left - 7),
        top: Math.max(8, rect.top - 7),
        width: Math.min(rect.width + 14, window.innerWidth - 16),
        height: Math.min(
          rect.height + 14,
          window.innerHeight - Math.max(8, rect.top - 7) - 8,
        ),
      };
      setSpotlight((previous) =>
        JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
      );
    };
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const frame = requestAnimationFrame(update);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [tour, location.pathname, location.search]);
  const programs = useQuery<Row[]>({
    queryKey: ["programs"],
    queryFn: () => api("/programs", role),
    retry: false,
  });
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("movate-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    localStorage.setItem("movate-role", role);
  }, [role]);
  useEffect(() => {
    setMobile(false);
    window.scrollTo({ top: 0 });
  }, [location.pathname]);
  const ask = (text: string, oid?: string) =>
    navigate(
      "/assistant?" +
        new URLSearchParams({ q: text, ...(oid ? { opportunity: oid } : {}) }),
    );
  useEffect(() => {
    const trapDialog = (event: KeyboardEvent) => {
      const dialog = Array.from(
        document.querySelectorAll<HTMLElement>('[role="dialog"]'),
      ).at(-1);
      if (!dialog) return;
      if (event.key === "Escape") {
        dialog
          .querySelector<HTMLButtonElement>('button[aria-label^="Close"]')
          ?.click();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), textarea, select, [tabindex="0"]',
        ),
      ).filter((el) => el.getClientRects().length);
      const first = controls[0],
        last = controls[controls.length - 1];
      if (!first) return;
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trapDialog);
    return () => document.removeEventListener("keydown", trapDialog);
  }, []);
  const steps = [
    {
      title: "Your operations, in focus",
      text: "Start with four computed metrics, then explore a business problem.",
      path: "/",
      target: "overview",
    },
    {
      title: "Explore a dedicated local agent",
      text: "Find a source problem, open its agent, and run a local rules-based workflow.",
      path: "/agents",
      target: "opportunities",
    },
    {
      title: "Ask a business question",
      text: "Get measured evidence, source references, and explicit assumptions.",
      path: "/assistant",
      target: "assistant",
    },
    {
      title: "Compare the paths forward",
      text: "Open an opportunity, compare three alternatives, and adjust modeled economics.",
      path: "/agents/OPP-001?compare=1",
      target: "compare",
    },
    {
      title: "Draft a plan for review",
      text: "Create an editable plan from the comparison. A human must approve it.",
      path: "/agents/OPP-001?plan=1",
      target: "plan",
    },
    {
      title: "Explore your teams",
      text: "Quality, Training and HR turn source records into focused views. Finish in Data & Settings to inspect provenance.",
      path: "/quality",
      target: "quality",
    },
  ];
  const moveTour = (index: number) => {
    if (index >= steps.length) {
      setTour(-1);
      toast.success("Tour complete. Explore your evidence.");
      return;
    }
    setTour(index);
    navigate(steps[index].path);
  };
  return (
    <Context.Provider value={{ scope, role, ask }}>
      <div
        className={
          "app " + (collapsed ? "compact " : "") + (mobile ? "mobile-open" : "")
        }
      >
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />
        <aside className="sidebar">
          <Link to="/" className="brand">
            <div className="brand-mark">
              <Layers3 size={23} />
            </div>
            <div className="brand-text">
              movate<span>INTELLIGENCE</span>
            </div>
          </Link>
          <div className="workspace-label">OPERATIONS WORKSPACE</div>
          <nav aria-label="Main navigation">
            {navigation.map(({ path, label, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                end={path === "/"}
                title={label}
                className={({ isActive }) =>
                  "nav-item " + (isActive ? "active" : "")
                }
              >
                <Icon size={19} />
                <span>{label}</span>
                {path === "/assistant" && <span className="nav-new">AI</span>}
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="local-card">
              <span className="status-dot" />
              <div>
                <strong>
                  {BROWSER_STORAGE ? "Browser workspace" : "Local workspace"}
                </strong>
                <small>
                  {BROWSER_STORAGE
                    ? "Saved only in this browser."
                    : "Your evidence. On your device."}
                </small>
              </div>
              <ShieldCheck size={17} />
            </div>
            <button className="tour-trigger" onClick={() => moveTour(0)}>
              <CircleHelp size={17} />
              <span>Take the demo tour</span>
              <ArrowUpRight size={15} />
            </button>
            <div className="persona">
              <div className="avatar">
                {role
                  .split(" ")
                  .map((s) => s[0])
                  .join("")}
              </div>
              <label>
                <span>Demo persona</span>
                <select
                  aria-label="Demo persona"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  {[
                    "Executive",
                    "QA Manager",
                    "Training Manager",
                    "HR Manager",
                  ].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <button
            className="collapse"
            aria-label="Collapse sidebar"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={20} />
            </button>
            <div className="breadcrumb">
              Workspace <ChevronRight size={13} />
              <strong>
                {navigation.find((n) =>
                  n.path === "/"
                    ? location.pathname === "/"
                    : location.pathname.startsWith(n.path),
                )?.label || "Opportunity detail"}
              </strong>
            </div>
            <form
              className="workspace-search"
              onSubmit={(e) => {
                e.preventDefault();
                navigate("/agents?search=" + encodeURIComponent(search));
              }}
            >
              <Search size={16} />
              <input
                aria-label="Search workspace"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search agents & solutions…"
              />
              <kbd>↵</kbd>
            </form>
            <Badge tone="synthetic">
              <span className="status-dot" />
              Synthetic Demo Data
            </Badge>
            <button
              className="icon-button"
              aria-label="Toggle theme"
              title="Toggle theme"
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <Button
              size="sm"
              onClick={() =>
                ask("Summarize the highest-priority operations problems")
              }
            >
              <Sparkles size={15} />
              Ask AI
            </Button>
          </header>
          <div className="scopebar">
            <div className="scope-left">
              <span className="status-dot" />
              Synthetic operational window <span className="scope-divider" />{" "}
              <select
                aria-label="Program filter"
                value={scope.program}
                onChange={(e) =>
                  setScope({ ...scope, program: e.target.value })
                }
              >
                <option value="">All programs</option>
                {programs.data?.map((p) => (
                  <option key={p.program_id} value={p.program_id}>
                    {p.program_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="date-range">
              <input
                aria-label="Start date"
                type="date"
                min={defaults.start}
                max={scope.end}
                value={scope.start}
                onChange={(e) =>
                  e.target.value &&
                  setScope({ ...scope, start: e.target.value })
                }
              />
              <span>—</span>
              <input
                aria-label="End date"
                type="date"
                min={scope.start}
                max={defaults.end}
                value={scope.end}
                onChange={(e) =>
                  e.target.value && setScope({ ...scope, end: e.target.value })
                }
              />
              <button
                title="Reset reporting scope"
                className="text-link"
                onClick={() => setScope(defaults)}
              >
                Reset
              </button>
            </div>
          </div>
          <main>
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -7 }}
                transition={{ duration: 0.18 }}
              >
                <Routes location={location}>
                  <Route path="/" element={<Overview />} />
                  <Route path="/assistant" element={<Assistant key={role} />} />
                  <Route path="/agents" element={<Opportunities />} />
                  <Route
                    path="/opportunities/*"
                    element={<LegacyOpportunityLink />}
                  />
                  <Route path="/agents/:id" element={<OpportunityDetail />} />
                  <Route path="/quality" element={<Quality />} />
                  <Route path="/training" element={<Training />} />
                  <Route path="/hr" element={<HR />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route
                    path="*"
                    element={
                      <ErrorState
                        error={new Error("This page was not found.")}
                      />
                    }
                  />
                </Routes>
              </motion.div>
            </AnimatePresence>
            <footer>
              <span>Movate AI Operations Intelligence</span>
              <span>Synthetic records · Local-first · Human-led decisions</span>
            </footer>
          </main>
        </div>
        {tour >= 0 && (
          <div className="tour-backdrop">
            {spotlight && (
              <div
                className="tour-spotlight"
                aria-hidden="true"
                style={spotlight}
              />
            )}
            <div
              className="tour-card"
              role="dialog"
              aria-modal="true"
              aria-label="Demo tour"
            >
              <div className="section-heading">
                <Badge tone="violet">
                  GUIDED DEMO · {tour + 1} / {steps.length}
                </Badge>
                <button
                  autoFocus
                  aria-label="Close tour"
                  className="icon-button"
                  onClick={() => setTour(-1)}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="tour-orbit">
                <Sparkles size={34} />
              </div>
              <h2>{steps[tour].title}</h2>
              <p>{steps[tour].text}</p>
              <div className="tour-progress">
                {steps.map((_, i) => (
                  <span key={i} className={i === tour ? "on" : ""} />
                ))}
              </div>
              <div className="section-heading">
                <Button variant="ghost" onClick={() => setTour(-1)}>
                  Explore on my own
                </Button>
                <Button onClick={() => moveTour(tour + 1)}>
                  {tour === steps.length - 1 ? "Finish tour" : "Next"}
                  <ArrowRight size={16} />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Context.Provider>
  );
}

function Overview() {
  const { scope, ask } = useApp(),
    { data, error, isPending } = useData("/overview?" + params(scope)),
    opportunities = useData("/agents");
  const [question, setQuestion] = useState("");
  if (isPending) return <Loading />;
  if (error) return <ErrorState error={error} />;
  const k = data!.kpis,
    list = (opportunities.data || []) as Row[];
  const priorities = ["OPP-010", "OPP-002", "OPP-012"]
    .map((id) => list.find((o) => o.opportunity_id === id))
    .filter(Boolean) as Row[];
  return (
    <>
      <Title
        eyebrow="THE BIG PICTURE"
        title="Clarity for every decision."
        description="Connect the evidence. Understand the opportunity. Move forward with confidence."
        action={
          <Badge tone="ready">
            <CheckCheck size={13} />
            Dataset connected
          </Badge>
        }
      />
      <div className="metrics-grid">
        <Metric
          label="Customer interactions"
          value={num(k.interactions)}
          note="Observed · contacts created in period"
          icon={MessageSquare}
        />
        <Metric
          label="Average QA score"
          value={
            <>
              {num(k.qa_average, 2)}
              <em>/100</em>
            </>
          }
          note={`${num(k.audits)} audits · dated in period`}
          icon={ShieldCheck}
          tint="violet"
        />
        <Metric
          label="AI agents & solutions"
          value={num(k.opportunities)}
          note={`${num(k.source_entries)} original source entries · catalog-wide`}
          icon={Lightbulb}
          tint="pink"
        />
        <Metric
          label="First-contact resolution"
          value={
            <>
              {num(k.fcr_pct, 2)}
              <em>%</em>
            </>
          }
          note="Observed · resolved contacts / all contacts"
          icon={Target}
          tint="cyan"
        />
      </div>
      <Panel className="ask-hero">
        <div className="hero-orbit orbit-a" />
        <div className="hero-orbit orbit-b" />
        <div className="hero-content">
          <div className="eyebrow">
            <Sparkles size={14} /> YOUR OPERATIONS, A CONVERSATION AWAY
          </div>
          <h2>
            Good questions.
            <br />
            <span>Grounded answers.</span>
          </h2>
          <p>
            Turn operational complexity into your next clear move.
            <br />
            Ask about quality, training, people, or a business opportunity.
          </p>
          <form
            className="ask-input"
            onSubmit={(e) => {
              e.preventDefault();
              if (question.trim()) ask(question);
            }}
          >
            <Sparkles size={21} />
            <input
              aria-label="Ask Movate AI"
              placeholder="Ask Movate AI anything about your operations…"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
            <button aria-label="Send question" disabled={!question.trim()}>
              <ArrowRight size={20} />
            </button>
          </form>
          <div className="suggested-prompts">
            {prompts.map((p, i) => (
              <button key={p} onClick={() => ask(p)}>
                {
                  [
                    <ShieldCheck size={13} />,
                    <GraduationCap size={13} />,
                    <Users size={13} />,
                    <Activity size={13} />,
                  ][i]
                }
                {p}
                <ArrowUpRight size={12} />
              </button>
            ))}
          </div>
          <div className="hero-footnote">
            <ShieldCheck size={13} />
            Evidence-grounded · Source-linked · Rules-based analysis available
            without an LLM
          </div>
        </div>
        <div className="intelligence-sculpture" aria-hidden="true">
          <div className="sculpture-ring ring-one" />
          <div className="sculpture-ring ring-two" />
          <div className="sculpture-ring ring-three" />
          <div className="sculpture-core">
            <Sparkles size={42} />
          </div>
          <span className="floating-label label-one">
            <span className="status-dot" />
            Connected evidence
          </span>
          <span className="floating-label label-two">
            <GitBranch size={13} />
            Smarter possibilities
          </span>
          <div className="sculpture-dot dot-one" />
          <div className="sculpture-dot dot-two" />
        </div>
      </Panel>
      <div className="section-heading section-space">
        <div>
          <div className="eyebrow">FROM PROBLEM TO POSSIBILITY</div>
          <h2>Where to focus next</h2>
          <p>Three starting points from the original worksheet proposals.</p>
        </div>
        <Button asChild variant="ghost">
          <Link to="/agents">
            All AI agents <ArrowRight size={16} />
          </Link>
        </Button>
      </div>
      <div className="priority-grid">
        {priorities.map((o) => (
          <AgentCard opportunity={o} compact key={o.opportunity_id} />
        ))}
      </div>
      <div className="bottom-grid">
        <Panel className="journey">
          <div className="section-heading">
            <h3>A clearer path to action</h3>
            <Badge>YOUR WORKFLOW</Badge>
          </div>
          <div className="journey-steps">
            {[
              ["Identify problem", Search],
              ["Analyze evidence", BarChart3],
              ["Compare solutions", GitBranch],
              ["Create action plan", ListChecks],
            ].map(([label, Icon]: any, i) => (
              <div key={label}>
                <span className={"step-icon step-" + i}>
                  <Icon size={19} />
                </span>
                <small>0{i + 1}</small>
                <strong>{label}</strong>
                {i < 3 && <ChevronRight className="step-arrow" size={16} />}
              </div>
            ))}
          </div>
          <p>
            Every recommendation starts with evidence and ends with human
            review.
          </p>
        </Panel>
        <Panel className="mini-chart">
          <div className="section-heading">
            <h3>Daily contact volume</h3>
            <Badge tone="blue">OBSERVED</Badge>
          </div>
          <Chart
            data={data!.trend}
            x="date"
            y="contacts"
            area
            color="#6d90d9"
          />
          <small>Source: interactions · selected reporting period</small>
        </Panel>
      </div>
    </>
  );
}

function AgentCard({
  opportunity: o,
  compact = false,
}: {
  opportunity: Row;
  compact?: boolean;
}) {
  const agent = o.agent;
  return (
    <Panel
      className={
        "agent-card opportunity-card " + (compact ? "agent-card-compact" : "")
      }
      data-agent-id={o.opportunity_id}
    >
      <div className="agent-card-top">
        <div className={"agent-avatar " + deptColors[o.department]}>
          <Bot size={24} />
        </div>
        <div>
          <Badge tone={deptColors[o.department]}>{o.department}</Badge>
          <span className="agent-id">{o.opportunity_id}</span>
        </div>
        <span className="agent-local-dot" title="Local rules-based workflow">
          <span className="status-dot" />
          Local
        </span>
      </div>
      <h3>
        <Link to={"/agents/" + o.opportunity_id}>{agent.name}</Link>
      </h3>
      <span className="agent-card-mode">{agent.mode}</span>
      <div className="agent-card-problem">
        <span className="agent-field-label">ORIGINAL BUSINESS PROBLEM</span>
        <p className="preserve">{o.primary_problem}</p>
      </div>
      <div className="agent-card-solution">
        <span className="agent-field-label">PROPOSED AGENT SOLUTION</span>
        <p>{agent.objective}</p>
      </div>
      <div className="agent-capabilities" aria-label="Agent capabilities">
        {agent.capabilities.map((c: string) => (
          <span key={c}>
            <Check size={12} />
            {c}
          </span>
        ))}
      </div>
      <div className="agent-table-tags">
        <span className="agent-field-label">
          <Database size={11} />
          SYNTHETIC DATA SOURCES
        </span>
        <div>
          {agent.tables.map((t: string) => (
            <span key={t}>{t}.csv</span>
          ))}
        </div>
      </div>
      <div className="agent-card-footer">
        <small>
          {o.source_count ?? o.source_reference_count} original source reference
          {(o.source_count ?? o.source_reference_count) === 1 ? "" : "s"}
        </small>
        <Button asChild size="sm">
          <Link
            to={"/agents/" + o.opportunity_id}
            aria-label={"Explore Agent: " + agent.name}
          >
            Explore Agent <ArrowUpRight size={15} />
          </Link>
        </Button>
      </div>
    </Panel>
  );
}

function Opportunities() {
  const { scope } = useApp(),
    [url] = useSearchParams();
  const [search, setSearch] = useState(url.get("search") || ""),
    [department, setDepartment] = useState(""),
    [complexity, setComplexity] = useState(""),
    [priority, setPriority] = useState("");
  useEffect(() => setSearch(url.get("search") || ""), [url]);
  const { data, error, isPending } = useData(
    "/agents?" +
      new URLSearchParams({
        search,
        department,
        complexity,
        priority,
        program: scope.program,
      }),
  );
  return (
    <>
      <Title
        eyebrow="ORIGINAL MOVATE PROBLEMS → WORKING LOCAL SOLUTIONS"
        title="AI Agents & Solutions"
        description="A dedicated agent for every source problem. Explore the workflow, run the evidence, and plan the next step."
        action={
          <Badge tone="violet">
            <Bot size={13} />
            AI Agent Demo — Rules-Based
          </Badge>
        }
      />
      <Panel className="agent-directory-intro">
        <div className="agent-intro-icon">
          <Cpu size={29} />
        </div>
        <div>
          <h2>From a business problem to a working demonstration.</h2>
          <p>
            Each agent runs a specific local analysis of your synthetic records.
            Original requirements stay intact; observations, recommendations and
            scenario assumptions remain distinct.
          </p>
        </div>
        <div className="agent-intro-proof">
          <span>
            <ShieldCheck size={14} />
            No API keys
          </span>
          <span>
            <Database size={14} />
            Local DuckDB
          </span>
          <span>
            <Users size={14} />
            Human-led decisions
          </span>
        </div>
      </Panel>
      <Panel className="filter-panel">
        <label className="search-field">
          <Search size={16} />
          <input
            aria-label="Search agents"
            placeholder="Find an agent, capability or original problem…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <select
          aria-label="Department filter"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
        >
          <option value="">All departments</option>
          {["QA", "Training", "HR", "Customer Operations"].map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <select
          aria-label="Complexity filter"
          value={complexity}
          onChange={(e) => setComplexity(e.target.value)}
        >
          <option value="">Any solution complexity</option>
          {["Low", "Medium", "High"].map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <select
          aria-label="Priority filter"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        >
          <option value="">All focus areas</option>
          {["Quality review", "People workflows", "Enablement"].map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </Panel>
      <div className="list-caption">
        <span>{data?.length ?? "…"} matching agents</span>
        <span>
          Source-grounded workflows · simulations are explicitly labeled
        </span>
      </div>
      {isPending ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} />
      ) : !data?.length ? (
        <Empty text="No agents match these filters." />
      ) : (
        <div className="agent-grid opportunities-grid">
          {(data as Row[]).map((o) => (
            <AgentCard key={o.opportunity_id} opportunity={o} />
          ))}
        </div>
      )}
    </>
  );
}

function LegacyOpportunityLink() {
  const location = useLocation();
  return (
    <Navigate
      replace
      to={
        location.pathname.replace(/^\/opportunities/, "/agents") +
        location.search +
        location.hash
      }
    />
  );
}

function OpportunityDetail() {
  const { id } = useParams(),
    { role, scope } = useApp();
  // Remount on scope/persona change so an in-flight restricted response cannot cross views.
  return (
    <AgentWorkspace key={id + "|" + role + "|" + params(scope)} id={id!} />
  );
}

function AgentWorkspace({ id }: { id: string }) {
  const { scope, role, ask } = useApp(),
    [url, setUrl] = useSearchParams();
  const { data, error, isPending } = useData("/agents/" + id);
  const [run, setRun] = useState<Row | null>(null),
    [busy, setBusy] = useState(false),
    [failure, setFailure] = useState(""),
    [plan, setPlan] = useState<Row | null>(null);
  const [compareOpen, setCompareOpen] = useState(
    url.has("compare") || url.has("plan"),
  );
  const [sourcesOpen, setSourcesOpen] = useState(url.has("sources"));
  useEffect(() => {
    if (url.has("compare") || url.has("plan")) setCompareOpen(true);
    if (url.has("sources")) setSourcesOpen(true);
  }, [url]);
  useEffect(() => {
    if (!data) return;
    const section = url.has("compare")
      ? "agent-solutions"
      : url.has("sources")
        ? "agent-problem"
        : "";
    if (section)
      requestAnimationFrame(() =>
        document.getElementById(section)?.scrollIntoView({ block: "start" }),
      );
  }, [data, url]);
  useEffect(() => {
    if (url.has("plan") && data)
      setPlan({
        opportunity_id: id,
        title: "Pilot: " + data.agent.name,
        content:
          "Original problem: " +
          data.primary_problem +
          "\n\n1. Review original source requirements and assign the process owner.\n2. Run the local rules-based agent and validate its evidence.\n3. Compare source alternatives and validate financial assumptions.\n4. Run a reviewed pilot and record human approval before rollout.",
      });
  }, [data, url, id]);
  const execute = async () => {
    setBusy(true);
    setFailure("");
    try {
      setRun(await api("/agents/" + id + "/run", role, { filters: scope }));
      requestAnimationFrame(() =>
        document.getElementById("agent-results")?.scrollIntoView({
          block: "start",
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "auto"
            : "smooth",
        }),
      );
      toast.success("Local agent analysis completed.");
    } catch (e) {
      setFailure((e as Error).message);
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const createDraft = () => {
    if (!run) return;
    setPlan({
      opportunity_id: id,
      title: "Agent review: " + data!.agent.name,
      content:
        "AI Agent Demo — Rules-Based\nOpportunity: " +
        id +
        "\nOriginal problem: " +
        data!.primary_problem +
        "\n\nObserved synthetic findings\n" +
        run.findings.join("\n") +
        "\n\nRecommended actions for human review\n" +
        run.recommended_actions
          .map((s: string, i: number) => i + 1 + ". " + s)
          .join("\n") +
        "\n\nLimitations\n" +
        run.limitations.join("\n") +
        "\n\nSources: " +
        run.source_ids.join(", ") +
        "\nNo operational changes have been applied. Financial assumptions must be validated separately.",
    });
  };
  if (isPending) return <Loading />;
  if (error) return <ErrorState error={error} />;
  const o = data!,
    agent = o.agent;
  return (
    <>
      <Link className="back-link" to="/agents">
        <ArrowLeft size={15} />
        AI Agents & Solutions
      </Link>
      <Title
        eyebrow={id + " / " + o.department.toUpperCase()}
        title={agent.name}
        description={o.opportunity_title}
        action={
          <Button disabled={busy} onClick={execute}>
            {busy ? <Loader2 className="spin" size={17} /> : <Play size={17} />}{" "}
            {busy ? "Running locally…" : "Run Agent"}
          </Button>
        }
      />
      <div className="agent-workspace-mode">
        <Badge tone="violet">
          <Bot size={13} />
          AI Agent Demo — Rules-Based
        </Badge>
        <span>
          <ShieldCheck size={13} />
          No LLM, API key or cloud service
        </span>
        <span>
          <Users size={13} />
          Human review required
        </span>
      </div>
      <nav className="agent-section-nav" aria-label="Agent workspace sections">
        {[
          ["agent-problem", "Original problem"],
          ["agent-objective", "Objective"],
          ["agent-data", "Synthetic data"],
          ["agent-workflow", "Workflow"],
          ["agent-results", "Results"],
          ["agent-solutions", "Compare & plan"],
        ].map(([anchor, label], i) => (
          <a key={anchor} href={"#" + anchor}>
            <span>0{i + 1}</span>
            {label}
          </a>
        ))}
      </nav>
      <Panel className="agent-workspace-section" id="agent-problem">
        <div className="agent-section-title">
          <span>01</span>
          <div>
            <Badge tone="blue">Original Movate requirements</Badge>
            <h2>Original Movate Problem</h2>
          </div>
        </div>
        <h3>{o.opportunity_title}</h3>
        <p className="preserve agent-original-problem">{o.primary_problem}</p>
        <details
          open={sourcesOpen}
          onToggle={(e) => setSourcesOpen(e.currentTarget.open)}
        >
          <summary>View original requirements</summary>
          <div className="agent-original-sources">
            {o.sources.map((s: Row) => (
              <div className="agent-source-record" key={s.source_id}>
                <Badge tone="blue">{s.source_id}</Badge>
                <h4>{s.source_file}</h4>
                <p>
                  Sheet {s.source_sheet} · Row {s.source_row} ·{" "}
                  {s.program_context}
                </p>
                <h4>Original problem statement</h4>
                <p className="preserve">{s.problem_statement}</p>
                <h4>Original proposed solution</h4>
                <p className="preserve">{s.proposed_solution}</p>
                <h4>Original claimed impact · unvalidated proposal</h4>
                <p className="preserve">{s.claimed_impact_original}</p>
                {s.workbook_original && (
                  <details>
                    <summary>
                      Exact original workbook cells (including whitespace)
                    </summary>
                    <pre>{JSON.stringify(s.workbook_original, null, 2)}</pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </details>
      </Panel>
      <div className="agent-workspace-pair">
        <Panel className="agent-workspace-section" id="agent-objective">
          <div className="agent-section-title">
            <span>02</span>
            <div>
              <Badge tone="violet">Proposed agent solution</Badge>
              <h2>AI Agent Objective</h2>
            </div>
          </div>
          <p>{agent.objective}</p>
          <ul className="agent-objective-capabilities">
            {agent.capabilities.map((c: string) => (
              <li key={c}>
                <Check size={15} />
                {c}
              </li>
            ))}
          </ul>
          <small>
            This objective describes the local demo implementation. The original
            worksheet remains the source requirement.
          </small>
        </Panel>
        <Panel className="agent-workspace-section" id="agent-data">
          <div className="agent-section-title">
            <span>03</span>
            <div>
              <Badge tone="cyan">Existing local records</Badge>
              <h2>Relevant Synthetic Data</h2>
            </div>
          </div>
          <div className="agent-source-links">
            {agent.tables.map((t: string) => (
              <Link to={"/settings?tab=dictionary&table=" + t} key={t}>
                <Database size={15} />
                <span>{t}.csv</span>
                <ArrowUpRight size={13} />
              </Link>
            ))}
          </div>
          <p>
            Program and date scope is applied by the backend. A program-specific
            source problem defaults to its original program when All programs is
            selected.
          </p>
        </Panel>
      </div>
      <Panel className="agent-workspace-section" id="agent-workflow">
        <div className="section-heading">
          <div className="agent-section-title">
            <span>04</span>
            <div>
              <Badge>Deterministic local workflow</Badge>
              <h2>Agent Workflow</h2>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() =>
              ask(
                "Explain the original problem and solution alternatives for " +
                  o.opportunity_title,
                id,
              )
            }
          >
            <MessageSquare size={15} />
            Ask AI about this
          </Button>
        </div>
        <ol className="agent-workflow-steps">
          {agent.workflow.map((s: string, i: number) => (
            <li key={s}>
              <span>{i + 1}</span>
              <p>{s}</p>
            </li>
          ))}
        </ol>
        <p className="agent-simulation-note">
          <CircleHelp size={15} />A simulated AI agent workflow, not an
          autonomous LLM agent. Live integrations and unavailable inputs are
          disclosed in the run results.
        </p>
      </Panel>
      <Panel
        className="agent-workspace-section agent-results-panel"
        id="agent-results"
      >
        <div className="section-heading">
          <div className="agent-section-title">
            <span>05</span>
            <div>
              <Badge tone="ready">Observed synthetic data</Badge>
              <h2>Generated Results and Recommendations</h2>
            </div>
          </div>
          {run && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                download(
                  id + "-agent-results.json",
                  JSON.stringify(run, null, 2),
                )
              }
            >
              <ArrowDownToLine size={15} />
              Export results
            </Button>
          )}
        </div>
        {busy && (
          <div className="thinking agent-thinking" role="status">
            <Loader2 className="spin" size={20} />
            <div>
              <strong>Executing the local workflow…</strong>
              <p>Querying scoped records and applying declared rules.</p>
            </div>
          </div>
        )}
        {failure && (
          <div role="alert" className="notice error-notice">
            {failure}
          </div>
        )}
        {!run && !busy && (
          <div className="agent-run-empty">
            <div className="agent-intro-icon">
              <Play size={27} />
            </div>
            <h3>Your records. A specific workflow. Reviewable results.</h3>
            <p>
              Run this agent to calculate evidence from the listed synthetic
              tables. No demonstration numbers are prefilled.
            </p>
            <Button onClick={execute}>
              <Play size={16} />
              Run Agent
            </Button>
          </div>
        )}
        {run && (
          <div className="agent-run-results" data-testid="agent-results">
            <div className="agent-run-scope">
              <Badge tone={run.status === "restricted" ? "amber" : "ready"}>
                {run.status === "restricted"
                  ? "Restricted · HR Manager required"
                  : "Local run complete"}
              </Badge>
              <strong>{run.program_name}</strong>
              <span>
                {run.filters.start} → {run.filters.end}
              </span>
            </div>
            <p className="agent-scope-note">{run.scope_note}</p>
            {!!run.metrics.length && (
              <div className="metrics-grid agent-metrics">
                {run.metrics.map((m: Row) => (
                  <Metric
                    key={m.label}
                    label={m.label}
                    value={num(m.value, 2)}
                    note={m.unit}
                    icon={Activity}
                  />
                ))}
              </div>
            )}
            <h3>Observed findings</h3>
            <ul className="agent-findings">
              {run.findings.map((f: string) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <details className="agent-method">
              <summary>Calculation method and scope</summary>
              <p>{run.method}</p>
            </details>
            {run.tables.map((t: Row, i: number) => (
              <details
                className="agent-evidence-table"
                key={t.title}
                open={i === 0}
              >
                <summary>
                  {t.title}
                  <span>
                    {t.rows.length} aggregate groups / returned records
                  </span>
                </summary>
                <DataTable rows={t.rows} columns={t.columns} />
                <small>
                  Sources:{" "}
                  {t.source_tables.map((s: string) => s + ".csv").join(", ")} ·{" "}
                  {t.method}
                </small>
              </details>
            ))}
            <div className="agent-recommendation-grid">
              <div className="agent-action-box">
                <Badge tone="violet">Recommended actions</Badge>
                <h3>Next steps for human review</h3>
                <ol>
                  {run.recommended_actions.map((s: string) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
                <Button variant="outline" onClick={createDraft}>
                  <ListChecks size={15} />
                  Draft action plan from results
                </Button>
              </div>
              <div className="agent-limitation-box">
                <Badge tone="amber">Simulation & unavailable inputs</Badge>
                <h3>What this demo does not establish</h3>
                <ul>
                  {run.limitations.map((s: string) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="agent-run-provenance">
              <FileText size={14} />
              <span>Original source IDs: {run.source_ids.join(" · ")}</span>
              <span>No external calls · No operational changes</span>
            </div>
          </div>
        )}
      </Panel>
      <Panel
        className="agent-workspace-section agent-solution-section"
        id="agent-solutions"
      >
        <div className="section-heading">
          <div className="agent-section-title">
            <span>06</span>
            <div>
              <Badge tone="amber">Scenario assumptions · reviewed drafts</Badge>
              <h2>Solution Comparison and Action Plan</h2>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setCompareOpen(!compareOpen);
              if (!compareOpen) setUrl({ compare: "1" }, { replace: true });
            }}
          >
            <GitBranch size={16} />
            {compareOpen ? "Hide solution comparison" : "Compare Solutions"}
          </Button>
        </div>
        <p>
          The original solution alternatives and financial equations are
          preserved. Costs, reduction rates and savings remain illustrative USD
          assumptions, separate from agent observations.
        </p>
        <div className="agent-alternative-strip">
          {o.alternatives.map((option: Row) => (
            <div key={option.option_id}>
              <span>{option.option_id}</span>
              <strong>{option.solution_variant}</strong>
              <small>
                {option.implementation_complexity} complexity ·{" "}
                {option.implementation_weeks_assumed} weeks assumed
              </small>
            </div>
          ))}
        </div>
        {compareOpen && <Comparison id={id} onPlan={setPlan} />}
      </Panel>
      {plan && <PlanEditor initial={plan} onClose={() => setPlan(null)} />}
    </>
  );
}

function Comparison({ id, onPlan }: { id: string; onPlan: (p: Row) => void }) {
  const { role } = useApp(),
    [adoption, setAdoption] = useState(100),
    [hours, setHours] = useState(""),
    [hourly, setHourly] = useState(""),
    [reduction, setReduction] = useState(""),
    [caseName, setCase] = useState("Base"),
    [maxWeeks, setMaxWeeks] = useState(52),
    [selected, setSelected] = useState("");
  const payload = {
    opportunity_id: id,
    adoption_pct: adoption,
    case: caseName,
    max_weeks: maxWeeks,
    ...(hours !== "" ? { hours: Number(hours) } : {}),
    ...(hourly !== "" ? { hourly_cost: Number(hourly) } : {}),
    ...(reduction !== "" ? { reduction_pct: Number(reduction) } : {}),
  };
  const { data, error, isPending } = useQuery<Row>({
    queryKey: ["compare", payload, role],
    queryFn: () => api("/scenarios/compare", role, payload),
  });
  const [explain, setExplain] = useState(false);
  return (
    <>
      <Panel className="assumptions">
        <div className="section-heading">
          <div>
            <div className="eyebrow">SCENARIO LAB</div>
            <h2>Three paths. One informed choice.</h2>
          </div>
          <Badge tone="amber">Illustrative assumptions · USD</Badge>
        </div>
        <p>
          Adjust the inputs to explore possibilities. Source estimates are
          unvalidated; no savings are observed or guaranteed.
        </p>
        <div className="scenario-controls">
          <label>
            Adoption <strong>{adoption}%</strong>
            <input
              aria-label="Adoption rate"
              type="range"
              min="0"
              max="100"
              value={adoption}
              onChange={(e) => setAdoption(+e.target.value)}
            />
          </label>
          <label>
            Annual hours affected
            <input
              aria-label="Annual hours affected"
              type="number"
              min="0"
              max="10000000"
              placeholder="Use source per option"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
          </label>
          <label>
            Loaded hourly cost · USD
            <input
              aria-label="Hourly cost"
              type="number"
              min="0"
              max="10000"
              placeholder="Use source per option"
              value={hourly}
              onChange={(e) => setHourly(e.target.value)}
            />
          </label>
          <label>
            Effort reduction · %
            <input
              aria-label="Effort reduction"
              type="number"
              min="0"
              max="100"
              placeholder="Use source per option"
              value={reduction}
              onChange={(e) => setReduction(e.target.value)}
            />
          </label>
          <label>
            Time constraint · weeks
            <input
              aria-label="Maximum weeks"
              type="number"
              min="1"
              max="104"
              value={maxWeeks}
              onChange={(e) => setMaxWeeks(+e.target.value)}
            />
          </label>
        </div>
        <div className="segmented">
          {["Conservative", "Base", "Optimistic"].map((c) => (
            <button
              key={c}
              className={caseName === c ? "selected" : ""}
              onClick={() => setCase(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <small>
          Effort multiplier: Conservative ×0.75 · Base ×1 · Optimistic ×1.2,
          capped at 100%. Adoption applies to annual savings.
        </small>
      </Panel>
      {isPending ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} />
      ) : (
        <>
          <div className="comparison-grid">
            {data!.options.map((o: Row, i: number) => (
              <Panel
                key={o.option_id}
                className={
                  "option-card " +
                  (o.option_id === data!.recommended_option
                    ? "recommended "
                    : "") +
                  (selected === o.option_id ? "chosen" : "")
                }
              >
                <div className="section-heading">
                  <span className="option-letter">
                    {String.fromCharCode(65 + i)}
                  </span>
                  {o.option_id === data!.recommended_option ? (
                    <Badge tone="violet">
                      <Sparkles size={12} />
                      Highest modeled net
                    </Badge>
                  ) : (
                    <Badge>{o.implementation_complexity} complexity</Badge>
                  )}
                </div>
                <h3>{o.solution_variant}</h3>
                <p className="option-subtitle">
                  {o.implementation_weeks_assumed} weeks to value assumed ·{" "}
                  {o.data_readiness} data readiness
                </p>
                <div className="option-value">
                  <small>First-year net benefit</small>
                  <strong>{money(o.first_year_net_benefit)}</strong>
                  <span>Illustrative USD · {caseName.toLowerCase()} case</span>
                </div>
                <dl className="economics">
                  <div>
                    <dt>Gross annual savings</dt>
                    <dd>{money(o.gross_annual_savings)}</dd>
                  </div>
                  <div>
                    <dt>One-time implementation</dt>
                    <dd>{money(o.one_time_cost_usd_assumed)}</dd>
                  </div>
                  <div>
                    <dt>Monthly running cost</dt>
                    <dd>{money(o.monthly_operating_cost_usd_assumed)}</dd>
                  </div>
                  <div>
                    <dt>First-year total cost</dt>
                    <dd>{money(o.first_year_cost)}</dd>
                  </div>
                  <div>
                    <dt>First-year ROI</dt>
                    <dd>
                      {o.roi_pct == null
                        ? "Not meaningful"
                        : num(o.roi_pct, 1) + "%"}
                    </dd>
                  </div>
                  <div>
                    <dt>Recurring-year net</dt>
                    <dd>{money(o.recurring_year_net_benefit)}</dd>
                  </div>
                </dl>
                <details>
                  <summary>Assumptions, risks & dependencies</summary>
                  <p>
                    Annual hours: {num(o.parameters.annual_hours)} · Hourly
                    cost: {money(o.parameters.hourly_cost_usd)} · Effort
                    reduction: {num(o.parameters.effort_reduction_pct, 1)}% ·
                    Adoption: {o.parameters.adoption_pct}%
                  </p>
                  <p>{o.rationale}</p>
                  <p>
                    Dependencies: validated inputs, system access and process
                    ownership. Risks: integration effort, low adoption and
                    unproven impact.
                  </p>
                </details>
                <Button
                  variant={selected === o.option_id ? "default" : "outline"}
                  disabled={!o.eligible}
                  onClick={() => setSelected(o.option_id)}
                >
                  {selected === o.option_id ? (
                    <>
                      <Check size={16} />
                      Selected
                    </>
                  ) : o.eligible ? (
                    "Select this option"
                  ) : (
                    "Outside time constraint"
                  )}
                </Button>
              </Panel>
            ))}
          </div>
          {!data!.options.length && (
            <Empty text="No solution alternatives were supplied for this opportunity." />
          )}
          <Panel className="decision-bar">
            <div>
              <h3>Make the tradeoff explicit.</h3>
              <p>{data!.rationale}</p>
              <small>{data!.assumptions}</small>
            </div>
            <Button
              disabled={!selected}
              onClick={() => {
                const o = data!.options.find(
                  (o: Row) => o.option_id === selected,
                );
                onPlan({
                  opportunity_id: id,
                  option_id: selected,
                  title: "Pilot: " + o.solution_variant,
                  content: `Opportunity: ${id}\nPreferred alternative: ${selected} — ${o.solution_variant}\n\n1. Assign a process owner and review original source requirements.\n2. Validate ${num(o.parameters.annual_hours)} annual hours, ${money(o.parameters.hourly_cost_usd)} loaded hourly cost, ${o.parameters.effort_reduction_pct}% effort reduction and ${adoption}% adoption assumptions.\n3. Confirm implementation dependencies, privacy and human review controls.\n4. Run a limited ${o.implementation_weeks_assumed}-week pilot; measure effort, quality and adoption against an agreed baseline.\n5. Review results and seek explicit rollout approval.\n\nIllustrative first-year net benefit: ${money(o.first_year_net_benefit)}. This is not an approved forecast. No operational changes are applied.`,
                });
              }}
            >
              <ListChecks size={16} />
              Create action plan
            </Button>
          </Panel>
          <Button variant="ghost" onClick={() => setExplain(!explain)}>
            <CircleHelp size={16} />
            {explain ? "Hide" : "Show"} calculation definitions
          </Button>
          {explain && (
            <Panel className="detail-panel">
              <p>
                Gross annual savings = annual hours × hourly cost × effort
                reduction / 100 × adoption / 100.
              </p>
              <p>
                First-year cost = implementation cost + 12 × monthly running
                cost. First-year net = gross savings − first-year cost. ROI =
                first-year net / first-year cost × 100.
              </p>
              <p>
                Recurring-year net excludes the one-time implementation cost.
                Full-year steady state is assumed; ramp-up and discounting are
                not modeled. Do not sum overlapping alternatives or
                opportunities.
              </p>
            </Panel>
          )}
        </>
      )}
    </>
  );
}

function PlanEditor({
  initial,
  onClose,
}: {
  initial: Row;
  onClose: () => void;
}) {
  const { role } = useApp(),
    client = useQueryClient(),
    [title, setTitle] = useState(initial.title),
    [content, setContent] = useState(initial.content),
    [reviewer, setReviewer] = useState(""),
    [approved, setApproved] = useState(false),
    [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await api("/action-plans", role, {
        ...initial,
        title,
        content,
        status: approved ? "Approved" : "Draft",
        reviewer,
      });
      toast.success(
        approved
          ? "Human approval recorded. No operational changes applied."
          : "Draft saved locally.",
      );
      client.invalidateQueries({ queryKey: ["/action-plans", role] });
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      className="modal-backdrop"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <Panel
        className="plan-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Action plan editor"
      >
        <div className="section-heading">
          <div>
            <Badge tone="violet">HUMAN REVIEW GATE</Badge>
            <h2>Your next step, thoughtfully planned.</h2>
          </div>
          <button
            aria-label="Close plan"
            className="icon-button"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <label>
          Plan title
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          Editable action plan
          <textarea
            aria-label="Action plan content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={12}
          />
        </label>
        <p className="notice">
          <ShieldCheck size={17} />
          {BROWSER_STORAGE
            ? "Saved only in this browser and deployment URL; not shared across devices. Export for backup. No operational or personnel records are changed."
            : "Saving this plan never changes operational or personnel records."}
        </p>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={approved}
            onChange={(e) => setApproved(e.target.checked)}
          />
          Record human approval (requires the responsible department persona)
        </label>
        {approved && (
          <label>
            Named human reviewer
            <input
              aria-label="Human reviewer"
              value={reviewer}
              onChange={(e) => setReviewer(e.target.value)}
              placeholder="Reviewer name"
            />
          </label>
        )}
        <div className="modal-actions">
          <Button
            variant="ghost"
            onClick={() =>
              download(
                "movate-action-plan.txt",
                title + "\n\n" + content,
                "text/plain",
              )
            }
          >
            <ArrowDownToLine size={16} />
            Export draft
          </Button>
          <Button
            disabled={
              busy ||
              !title.trim() ||
              !content.trim() ||
              (approved && !reviewer.trim())
            }
            onClick={save}
          >
            {busy ? (
              <Loader2 className="spin" size={16} />
            ) : (
              <Check size={16} />
            )}
            Save {approved ? "approval" : "draft"}
          </Button>
        </div>
      </Panel>
    </div>
  );
}

function Assistant() {
  const { scope, role } = useApp(),
    [url, setUrl] = useSearchParams(),
    client = useQueryClient(),
    [question, setQuestion] = useState(url.get("q") || ""),
    [messages, setMessages] = useState<Row[]>([]),
    [chatId, setChatId] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [plan, setPlan] = useState<Row | null>(null),
    [showExamples, setShowExamples] = useState(false);
  const chats = useData("/chats"),
    examples = useData("/ai/prompts"),
    provider = useData("/ai/provider");
  useEffect(() => {
    if (url.get("q")) setQuestion(url.get("q")!);
  }, [url]);
  const send = async () => {
    if (!question.trim() || busy) return;
    const text = question;
    setQuestion("");
    setMessages((m) => [...m, { kind: "user", payload: { text } }]);
    setBusy(true);
    try {
      const res = await api("/ai/chat", role, {
        message: text,
        chat_id: chatId,
        filters: scope,
        ...(url.get("opportunity")
          ? { opportunity_id: url.get("opportunity") }
          : {}),
      });
      if (res.persistence_notice) toast.error(res.persistence_notice);
      setChatId(res.chat_id);
      setMessages((m) => [...m, { kind: "assistant", payload: res }]);
      client.invalidateQueries({ queryKey: ["/chats", role] });
      setUrl({}, { replace: true });
    } catch (e) {
      toast.error((e as Error).message);
      setMessages((m) => [
        ...m,
        { kind: "error", payload: { text: (e as Error).message } },
      ]);
      setQuestion(text);
    } finally {
      setBusy(false);
    }
  };
  const resume = async (id: string) => {
    try {
      const res = await api("/chats/" + id, role);
      setChatId(id);
      setMessages(res.messages);
      setUrl({});
      setQuestion("");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const draft = (r: Row) =>
    setPlan({
      opportunity_id: r.opportunity_id,
      option_id: r.recommended_option,
      title: "Recommendation: " + r.opportunity_id,
      content:
        r.direct_answer +
        "\n\nRecommended alternative: " +
        (r.recommended_option || "Needs discovery") +
        "\n\nNext actions\n" +
        r.next_actions
          .map((s: string, i: number) => `${i + 1}. ${s}`)
          .join("\n") +
        "\n\nEvidence: " +
        r.citations.map((c: Row) => c.id).join(", ") +
        "\n\nDraft for human review; no operational changes applied.",
    });
  return (
    <>
      <Title
        eyebrow="YOUR EVIDENCE, CONNECTED"
        title="Meet your operations copilot."
        description="Ask a question. Explore the evidence. Find a path forward."
        action={
          <Badge tone="violet">
            <Sparkles size={13} />
            {provider.data?.provider === "disabled"
              ? "Rules-based analysis"
              : "Provider configured · test in Settings"}
          </Badge>
        }
      />
      <div className="chat-layout">
        <Panel className="chat-history">
          <Button
            variant="outline"
            onClick={() => {
              setChatId(null);
              setMessages([]);
              setQuestion("");
              setUrl({});
            }}
          >
            <Plus size={16} />
            New conversation
          </Button>
          <div className="eyebrow">
            {BROWSER_STORAGE
              ? "BROWSER-ONLY CONVERSATIONS"
              : "LOCAL CONVERSATIONS"}
          </div>
          {chats.data?.length ? (
            (chats.data as Row[]).map((c) => (
              <button
                className={
                  "chat-history-item " + (chatId === c.id ? "selected" : "")
                }
                key={c.id}
                onClick={() => resume(c.id)}
              >
                <MessageSquare size={15} />
                <span>{c.title}</span>
              </button>
            ))
          ) : (
            <p className="muted">
              {BROWSER_STORAGE
                ? "Saved only in this browser and site URL. Not shared across devices; clearing site data removes saved work."
                : "Your conversations will appear here, stored on this device."}
            </p>
          )}
          <div className="history-footer">
            <ShieldCheck size={18} />
            <small>
              {BROWSER_STORAGE
                ? "Browser-specific storage, separated by demo persona. Export answers for backup. No raw HR cases in AI context."
                : "Bounded evidence. No raw HR cases in AI context. Chats are separated by demo persona."}
            </small>
          </div>
        </Panel>
        <div className="chat-main">
          {!messages.length && (
            <Panel className="chat-welcome">
              <div className="ai-orb">
                <Sparkles size={30} />
              </div>
              <h2>What would you like to understand?</h2>
              <p>
                Explore a business problem with measured numbers,
                <br />
                original requirements, and transparent alternatives.
              </p>
              <div className="prompt-grid">
                {prompts.map((p, i) => (
                  <button key={p} onClick={() => setQuestion(p)}>
                    <span>
                      {
                        [
                          "Quality intelligence",
                          "Training effectiveness",
                          "People workflows",
                          "Customer operations",
                        ][i]
                      }
                    </span>
                    <strong>{p}</strong>
                    <ArrowUpRight size={17} />
                  </button>
                ))}
              </div>
              <button
                className="text-link"
                onClick={() => setShowExamples(!showExamples)}
              >
                {showExamples ? "Hide" : "Explore all"} demo questions{" "}
                <ChevronDown size={14} />
              </button>
              {showExamples && (
                <div className="all-prompts">
                  {((examples.data as string[]) || []).map((p) => (
                    <button
                      key={p}
                      onClick={() => {
                        setQuestion(p);
                        setShowExamples(false);
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </Panel>
          )}
          <div className="messages" aria-live="polite">
            {messages.map((m, i) =>
              m.kind === "user" ? (
                <div className="user-message" key={i}>
                  <div className="avatar small-avatar">YOU</div>
                  <p>{m.payload.text}</p>
                </div>
              ) : m.kind === "error" ? (
                <Panel key={i} className="notice error-notice">
                  {m.payload.text}
                </Panel>
              ) : (
                <Answer
                  key={i}
                  r={m.payload}
                  onPlan={() => draft(m.payload)}
                  onFollow={() =>
                    setQuestion(
                      "Compare those options and explain the recommendation",
                    )
                  }
                />
              ),
            )}
            {busy && (
              <Panel className="thinking">
                <Loader2 size={20} className="spin" />
                <div>
                  <strong>Connecting the evidence…</strong>
                  <p>
                    Checking scoped metrics, original sources and alternatives.
                  </p>
                </div>
              </Panel>
            )}
          </div>
          <form
            className="chat-compose glass"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <div className="compose-top">
              <Sparkles size={19} />
              <textarea
                rows={2}
                aria-label="Message Movate AI"
                placeholder="Ask about a problem, a pattern, or your next move…"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              <Button
                type="submit"
                size="icon"
                aria-label="Send message"
                disabled={busy || !question.trim()}
              >
                {busy ? (
                  <Loader2 size={18} className="spin" />
                ) : (
                  <ArrowRight size={19} />
                )}
              </Button>
            </div>
            <div className="compose-footer">
              <span>
                Sources are linked. Assumptions are labeled. Decisions stay
                human.
              </span>
              <small>Enter to send · Shift + Enter for newline</small>
            </div>
          </form>
        </div>
      </div>
      {plan && <PlanEditor initial={plan} onClose={() => setPlan(null)} />}
    </>
  );
}

function Answer({
  r,
  onPlan,
  onFollow,
}: {
  r: Row;
  onPlan: () => void;
  onFollow: () => void;
}) {
  const [detail, setDetail] = useState(false);
  return (
    <Panel className="answer">
      <div className="answer-heading">
        <div className="ai-orb small-orb">
          <Sparkles size={18} />
        </div>
        <strong>Movate Intelligence</strong>
        <Badge tone="violet">{r.mode}</Badge>
      </div>
      <h3>Direct answer</h3>
      <p className="direct-answer">{r.direct_answer}</p>
      {r.persistence_notice && (
        <p role="alert" className="notice error-notice">
          {r.persistence_notice}
        </p>
      )}
      {r.provider_notice && <p className="notice">{r.provider_notice}</p>}
      <div className="answer-scope">
        <Badge tone="blue">{r.department}</Badge>
        <small>
          {r.filters.start} → {r.filters.end} ·{" "}
          {r.filters.program || "All programs"}
        </small>
      </div>
      <div className="evidence-strip">
        {r.evidence
          .filter((e: Row) => e.kind === "Observed in synthetic records")
          .map((e: Row) => (
            <Link
              to={
                r.citations.find((c: Row) => c.id === e.id)?.href || "/reports"
              }
              key={e.id}
            >
              <Database size={14} />
              {e.label}
              <ArrowUpRight size={13} />
            </Link>
          ))}
      </div>
      <Button variant="ghost" size="sm" onClick={() => setDetail(!detail)}>
        {detail ? "Hide" : "Explore"} evidence & alternatives{" "}
        <ChevronDown size={14} />
      </Button>
      {detail && (
        <div className="answer-details">
          {r.explanation && (
            <>
              <h4>AI inference · explanatory narrative</h4>
              <p>{r.explanation}</p>
            </>
          )}
          <h4>Evidence & key numbers</h4>
          {r.evidence
            .filter((e: Row) => e.kind === "Observed in synthetic records")
            .map((e: Row) => (
              <details key={e.id}>
                <summary>
                  {e.label} · {e.id}
                </summary>
                <pre>{JSON.stringify(e.data, null, 2)}</pre>
              </details>
            ))}
          <h4>Possible causes · hypotheses</h4>
          {r.hypotheses.map((h: string) => (
            <p key={h}>{h}</p>
          ))}
          <h4>Three alternatives · scenario assumptions</h4>
          <DataTable
            rows={r.options}
            columns={[
              { key: "solution_variant", label: "Alternative" },
              { key: "first_year_cost", label: "Year 1 cost", format: money },
              {
                key: "first_year_net_benefit",
                label: "Year 1 net",
                format: money,
              },
              { key: "implementation_complexity", label: "Complexity" },
              { key: "implementation_weeks_assumed", label: "Weeks assumed" },
            ]}
          />
          <p>
            Risks: integration feasibility, adoption, unvalidated impact and
            access requirements. All costs and benefits are illustrative USD
            assumptions.
          </p>
          <h4>Recommended option</h4>
          <p>
            {r.recommended_option} · {r.recommendation_rationale}
          </p>
          <Link
            className="text-link"
            to={"/agents/" + r.opportunity_id + "?compare=1"}
          >
            Open interactive comparison <ArrowRight size={14} />
          </Link>
          <h4>Suggested next actions</h4>
          <ol>
            {r.next_actions.map((s: string) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <h4>Sources & assumptions</h4>
          <div className="citation-list">
            {r.citations.map((c: Row) => (
              <Link key={c.id} to={c.href || "/settings"}>
                <FileText size={13} />
                {c.id}
                <span>{c.label}</span>
              </Link>
            ))}
          </div>
          {r.limitations.map((s: string) => (
            <p key={s} className="muted">
              {s}
            </p>
          ))}
          <small>{r.evidence_quality}</small>
        </div>
      )}
      <div className="answer-actions">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            download("movate-answer.json", JSON.stringify(r, null, 2))
          }
        >
          <ArrowDownToLine size={14} />
          Export answer
        </Button>
        <Button variant="ghost" size="sm" onClick={onPlan}>
          <BookOpen size={14} />
          Save recommendation
        </Button>
        <Button variant="ghost" size="sm" onClick={onPlan}>
          <ListChecks size={14} />
          Generate action plan
        </Button>
        <Button variant="ghost" size="sm" onClick={onFollow}>
          <MessageSquare size={14} />
          Ask follow-up
        </Button>
      </div>
    </Panel>
  );
}

function Quality() {
  const { scope, ask, role } = useApp(),
    { data, error, isPending } = useData("/qa/summary?" + params(scope)),
    [offset, setOffset] = useState(0),
    [search, setSearch] = useState(""),
    [audit, setAudit] = useState<Row | null>(null);
  const canView = ["Executive", "QA Manager"].includes(role),
    audits = useData(
      "/qa/audits?" +
        params(scope) +
        "&" +
        new URLSearchParams({ offset: String(offset), search }),
      canView,
    );
  useEffect(() => setOffset(0), [scope, search]);
  if (isPending) return <Loading />;
  if (error) return <ErrorState error={error} />;
  const d = data!;
  return (
    <>
      <Title
        eyebrow="QUALITY INTELLIGENCE"
        title="A better view of better service."
        description="Understand audit findings, focus coaching, and keep the sample in perspective."
        action={
          <Button
            onClick={() =>
              ask("Find the major quality issues and groups needing coaching")
            }
          >
            <Sparkles size={16} />
            Analyze quality
          </Button>
        }
      />
      <div className="metrics-grid">
        <Metric
          label="Audits reviewed"
          value={num(d.audit_count)}
          note="Audits dated in reporting period"
          icon={ShieldCheck}
        />
        <Metric
          label="Average QA score"
          value={
            <>
              {num(d.qa_average, 2)}
              <em>/100</em>
            </>
          }
          note="Mean across selected audit records"
          icon={Activity}
          tint="violet"
        />
        <Metric
          label="Critical-error audits"
          value={num(d.high_risk_count)}
          note="Source critical_error = 1"
          icon={Target}
          tint="pink"
        />
        <Metric
          label="Coaching queue"
          value={num(d.coaching_queue)}
          note="Coaching status other than Completed"
          icon={Users}
          tint="cyan"
        />
      </div>
      <div className="notice">
        <CircleHelp size={18} />
        <span>
          <strong>{num(d.coverage.pct, 2)}% linked audit coverage</strong> ·{" "}
          {num(d.coverage.audited_contacts)} of {num(d.coverage.contacts)}{" "}
          contacts. {d.coverage.definition} This sample does not establish
          automated review accuracy.
        </span>
      </div>
      <div className="two-col">
        <Panel className="chart-panel">
          <div className="section-heading">
            <h3>QA score by program</h3>
            <Badge tone="blue">OBSERVED</Badge>
          </div>
          <Chart data={d.by_program} />
        </Panel>
        <Panel className="chart-panel">
          <h3>QA over the reporting period</h3>
          <Chart data={d.trend} x="date" y="score" area />
        </Panel>
      </div>
      <div className="two-col">
        <Panel className="detail-panel">
          <h3>What the audits found</h3>
          <DataTable
            rows={d.issues}
            columns={[
              { key: "name", label: "Finding category" },
              { key: "value", label: "Audits", format: num },
            ]}
          />
        </Panel>
        <Panel className="detail-panel">
          <h3>Coaching follow-through</h3>
          <Chart data={d.coaching_status} color="#7d9bc5" />
          <Button
            variant="outline"
            onClick={() =>
              ask(
                "Which groups need coaching and what evidence supports the priority?",
              )
            }
          >
            Find coaching priorities <ArrowRight size={15} />
          </Button>
        </Panel>
      </div>
      <Panel className="detail-panel section-space">
        <div className="section-heading">
          <div>
            <h3>Follow the evidence</h3>
            <p>Audit → employee → coaching action</p>
          </div>
          <label className="search-field">
            <Search size={15} />
            <input
              aria-label="Search audits"
              placeholder="Audit ID, name or finding…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        {canView ? (
          <>
            <DataTable
              rows={(audits.data as Row[]) || []}
              onRow={setAudit}
              columns={[
                { key: "audit_id", label: "Audit · open details" },
                { key: "display_name", label: "Synthetic employee" },
                { key: "qa_score", label: "QA score" },
                { key: "finding_category", label: "Finding" },
                { key: "coaching_status", label: "Coaching status" },
              ]}
            />
            <div className="pagination">
              <Button
                variant="ghost"
                disabled={!offset}
                onClick={() => setOffset(Math.max(0, offset - 25))}
              >
                Previous
              </Button>
              <span>
                Records {offset + 1}–{offset + (audits.data?.length || 0)}
              </span>
              <Button
                variant="ghost"
                disabled={audits.data?.length < 25}
                onClick={() => setOffset(offset + 25)}
              >
                Next
              </Button>
            </div>
          </>
        ) : (
          <p className="notice">
            Audit details require the Executive or QA Manager demo persona.
            Aggregate evidence remains available.
          </p>
        )}
      </Panel>
      {audit && (
        <div className="modal-backdrop">
          <Panel
            className="plan-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Audit evidence"
          >
            <div className="section-heading">
              <h2>{audit.audit_id}</h2>
              <button
                className="icon-button"
                aria-label="Close audit"
                onClick={() => setAudit(null)}
              >
                <X size={20} />
              </button>
            </div>
            <DataTable
              rows={Object.entries(audit).map(([name, value]) => ({
                name,
                value,
              }))}
              columns={[
                { key: "name", label: "Field" },
                { key: "value", label: "Value" },
              ]}
            />
          </Panel>
        </div>
      )}
    </>
  );
}

function Training() {
  const { scope, ask } = useApp(),
    { data, error, isPending } = useData("/training/summary?" + params(scope));
  if (isPending) return <Loading />;
  if (error) return <ErrorState error={error} />;
  const d = data!,
    a = d.association;
  return (
    <>
      <Title
        eyebrow="TRAINING INTELLIGENCE"
        title="Learning, with a line of sight."
        description="Connect course participation and assessments with a careful view of operational performance."
        action={
          <Button
            onClick={() =>
              ask(
                "Which courses need refresher modules and what evidence supports this?",
              )
            }
          >
            <Sparkles size={16} />
            Explore training priorities
          </Button>
        }
      />
      <div className="metrics-grid">
        <Metric
          label="Course enrollments"
          value={num(d.enrollments)}
          note="Assigned in reporting period"
          icon={GraduationCap}
        />
        <Metric
          label="Completed by period end"
          value={num(d.completed)}
          note={`${num(d.completion_pct, 1)}% of selected enrollments`}
          icon={CheckCheck}
          tint="violet"
        />
        <Metric
          label="Pre-assessment average"
          value={num(d.pre_assessment, 2)}
          note="All selected enrollments"
          icon={BookOpen}
          tint="pink"
        />
        <Metric
          label="Completed assessment average"
          value={num(d.post_assessment, 2)}
          note="Completed enrollments by end date"
          icon={Target}
          tint="cyan"
        />
      </div>
      <div className="section-heading section-space">
        <h2>The course portfolio</h2>
        <Badge tone="blue">OBSERVED SYNTHETIC RECORDS</Badge>
      </div>
      <div className="course-grid">
        {d.courses.map((c: Row) => (
          <Panel className="course-card" key={c.course_id}>
            <div className="course-icon">
              <GraduationCap size={23} />
            </div>
            <small>
              {c.course_id} · {c.duration_hours} hours
            </small>
            <h3>{c.name}</h3>
            <p>{c.topic}</p>
            <div className="course-stats">
              <strong>
                {c.completed}
                <small>of {c.enrollments} complete</small>
              </strong>
              <span>
                {num(c.assessment, 1)}
                <small>Assessment avg.</small>
              </span>
            </div>
            <div className="progress-track">
              <span
                style={{
                  width:
                    (c.enrollments ? (100 * c.completed) / c.enrollments : 0) +
                    "%",
                }}
              />
            </div>
          </Panel>
        ))}
      </div>
      <div className="two-col section-space">
        <Panel className="detail-panel">
          <div className="section-heading">
            <h3>QA around completed training</h3>
            <Badge tone="amber">ASSOCIATION ONLY</Badge>
          </div>
          <div className="paired-stats">
            <div>
              <small>Before · employee mean</small>
              <strong>{num(a.before_qa, 2)}</strong>
              <span>{num(a.before_audits)} audits</span>
            </div>
            <ArrowRight size={25} />
            <div>
              <small>After · employee mean</small>
              <strong>{num(a.after_qa, 2)}</strong>
              <span>{num(a.after_audits)} audits</span>
            </div>
          </div>
          <p>
            <strong>{num(a.employees)} paired employees</strong>
          </p>
          <details>
            <summary>How this comparison is computed</summary>
            <p>{a.method}</p>
          </details>
          <p className="muted">
            Independent synthetic training events and uncontrolled differences
            prevent causal conclusions.
          </p>
        </Panel>
        <Panel className="chart-panel">
          <h3>Enrollments by course</h3>
          <Chart
            data={d.courses.map((c: Row) => ({
              name: c.course_id,
              value: c.enrollments,
            }))}
          />
        </Panel>
      </div>
      <Panel className="detail-panel section-space">
        <h3>Trainer overview</h3>
        <p>
          Assessment averages use completed enrollments assigned in the selected
          period and completed by its end. Facilitation scores are provided
          source fields, not inferred trainer effectiveness.
        </p>
        <DataTable
          rows={d.trainers}
          columns={[
            { key: "trainer_id", label: "Trainer" },
            { key: "location", label: "Location" },
            { key: "certification_level", label: "Certification" },
            { key: "enrollments", label: "Enrollments" },
            {
              key: "mean_completed_assessment",
              label: "Completed assessment avg.",
            },
            { key: "facilitation_score", label: "Source facilitation score" },
          ]}
        />
      </Panel>
    </>
  );
}

function HR() {
  const { scope, ask, role } = useApp(),
    { data, error, isPending } = useData("/hr/summary?" + params(scope));
  if (isPending) return <Loading />;
  if (error) return <ErrorState error={error} />;
  const d = data!;
  return (
    <>
      <Title
        eyebrow="HR AUTOMATION"
        title="Make room for the human work."
        description="Bring clarity to onboarding, recognition and review-led people processes."
        action={
          <Button
            onClick={() =>
              ask("Draft an HR onboarding checklist based on pending steps")
            }
          >
            <Sparkles size={16} />
            Draft a process checklist
          </Button>
        }
      />
      <div className="metrics-grid">
        <Metric
          label="Onboarding records"
          value={num(d.employees)}
          note="Program-scoped imported snapshot"
          icon={Users}
        />
        <Metric
          label="Outstanding documents"
          value={num(d.missing_documents)}
          note="Required documents minus received"
          icon={FileText}
          tint="violet"
        />
        <Metric
          label="Identity checks pending"
          value={num(d.verification_pending)}
          note="Status other than Verified"
          icon={ShieldCheck}
          tint="pink"
        />
        <Metric
          label="Policy signatures pending"
          value={num(d.policy_pending)}
          note="Status other than Signed"
          icon={ListChecks}
          tint="cyan"
        />
      </div>
      <p className="notice">
        <CircleHelp size={17} />
        {d.scope_note}
      </p>
      <Panel className="detail-panel section-space">
        <h3>The onboarding path</h3>
        <div className="pipeline">
          {[
            [
              "Collect documents",
              d.missing_documents,
              "documents outstanding",
              FileText,
            ],
            [
              "Verify identity",
              d.verification_pending,
              "people pending",
              ShieldCheck,
            ],
            [
              "Acknowledge policy",
              d.policy_pending,
              "people pending",
              CheckCheck,
            ],
            ["Set up access", d.access_pending, "people pending", Settings2],
          ].map(([label, value, note, Icon]: any) => (
            <div key={label}>
              <Icon size={22} />
              <h4>{label}</h4>
              <strong>{num(value)}</strong>
              <small>{note}</small>
            </div>
          ))}
        </div>
        <small>
          Parallel checklist stages; counts are not mutually exclusive.
        </small>
      </Panel>
      <div className="two-col section-space">
        <Panel className="chart-panel">
          <h3>Recognition in the reporting period</h3>
          <Chart data={d.recognitions} color="#bd8db8" />
        </Panel>
        <Panel className="detail-panel soft-violet">
          <ShieldCheck size={29} />
          <h2>People decisions stay human.</h2>
          <p>{d.review_gate}</p>
          <p>
            Disciplinary cases are masked and restricted to the HR Manager
            persona. Raw case records are excluded from AI prompts and general
            data exports.
          </p>
          <Button
            variant="outline"
            onClick={() =>
              ask(
                "What human review requirements apply to disciplinary workflows?",
              )
            }
          >
            Review process guidance <ArrowRight size={15} />
          </Button>
        </Panel>
      </div>
      <Panel className="detail-panel section-space">
        <div className="section-heading">
          <h3>Restricted HR case workflow</h3>
          <Badge tone={d.case_access ? "pink" : "amber"}>
            {d.case_access
              ? "HR Manager · masked access"
              : "Restricted · HR Manager required"}
          </Badge>
        </div>
        {d.case_access ? (
          <>
            <DataTable
              rows={d.cases}
              columns={[
                { key: "case_id", label: "Case ID" },
                { key: "employee", label: "Employee" },
                { key: "case_type", label: "Case type" },
                { key: "case_status", label: "Stage" },
                { key: "hr_approval_status", label: "Human approval" },
                { key: "employee_acknowledged", label: "Acknowledged" },
              ]}
            />
            <p className="muted">
              Access is logged in the local append-only audit trail.
            </p>
          </>
        ) : (
          <div className="empty-inline">
            <ShieldCheck size={27} />
            <p>
              Switch to the HR Manager demo persona to inspect masked workflow
              records.
            </p>
          </div>
        )}
      </Panel>
      {d.case_access && (
        <Panel className="detail-panel section-space">
          <h3>Onboarding checklist records</h3>
          <DataTable
            rows={d.onboarding}
            columns={[
              { key: "onboarding_id", label: "Onboarding ID" },
              { key: "employee", label: "Employee" },
              {
                key: "document_checklist_received",
                label: "Documents received",
              },
              { key: "document_checklist_total", label: "Required" },
              { key: "identity_verification_status", label: "Verification" },
              { key: "workstation_access_status", label: "Access" },
            ]}
          />
        </Panel>
      )}
    </>
  );
}

function Reports() {
  const { scope, role } = useApp(),
    [department, setDepartment] = useState(""),
    { data, error, isPending } = useData(
      "/reports/summary?" +
        params(scope) +
        "&department=" +
        encodeURIComponent(department),
    ),
    plans = useData("/action-plans"),
    [plan, setPlan] = useState<Row | null>(null);
  const exportReport = () => {
    if (data)
      download("movate-summary-report.json", JSON.stringify(data, null, 2));
  };
  return (
    <>
      <Title
        eyebrow="REPORTS & ACTIONS"
        title="Turn the view into a next step."
        description="Take the evidence with you. Keep recommendations and human review in one place."
        action={
          <Button disabled={!data} onClick={exportReport}>
            <ArrowDownToLine size={16} />
            Download report
          </Button>
        }
      />
      <Panel className="filter-panel">
        <select
          aria-label="Report department"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
        >
          <option value="">All departments</option>
          {["QA", "Training", "HR", "Customer Operations"].map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <Button
          variant="outline"
          disabled={!data}
          onClick={() =>
            download(
              "movate-metrics.csv",
              csv(
                Object.entries(data!.overview.kpis).map(([metric, value]) => ({
                  metric,
                  value,
                  synthetic: true,
                  start: scope.start,
                  end: scope.end,
                  program: scope.program || "All",
                })),
              ),
              "text/csv",
            )
          }
        >
          <ArrowDownToLine size={15} />
          Export KPI CSV
        </Button>
        <Button variant="ghost" onClick={() => window.print()}>
          <FileText size={15} />
          Print / Save PDF
        </Button>
      </Panel>
      {isPending ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} />
      ) : (
        <>
          <Panel className="detail-panel report-summary">
            <div className="section-heading">
              <Badge tone="blue">SYNTHETIC DEMO DATA</Badge>
              <span>
                {scope.start} — {scope.end}
              </span>
            </div>
            <h2>Operations, at a glance.</h2>
            <p>
              For the selected period, {num(data!.overview.kpis.interactions)}{" "}
              interactions were recorded with a{" "}
              {num(data!.overview.kpis.fcr_pct, 2)}% first-contact resolution
              rate. The audit sample contains {num(data!.overview.kpis.audits)}{" "}
              audits averaging {num(data!.overview.kpis.qa_average, 2)} points.
            </p>
            <p>
              {data!.opportunities.length} original opportunities are included
              in this department scope. Their impact claims are proposals, and
              all financial scenarios use unvalidated illustrative USD
              assumptions.
            </p>
            <DataTable
              rows={data!.overview.programs}
              columns={[
                { key: "program_name", label: "Program" },
                { key: "contacts", label: "Interactions", format: num },
                { key: "aht", label: "Average handle time · min" },
                { key: "fcr_pct", label: "FCR · %" },
              ]}
            />
            {data!.customer_operations && (
              <p>
                Customer operations:{" "}
                {num(data!.customer_operations.sales.leads)} linked sales leads,{" "}
                {num(data!.customer_operations.sales.completed_sales)} completed
                sales, and{" "}
                {num(data!.customer_operations.sales.verification_not_verified)}{" "}
                required verifications not marked Verified. Linked tickets
                include {num(data!.customer_operations.tickets.escalations)}{" "}
                escalations. Revenue and outcomes are synthetic records.
              </p>
            )}
            {data!.quality && (
              <p>
                Quality: {num(data!.quality.high_risk_count)} critical-error
                audits and {num(data!.quality.coaching_queue)} coaching actions
                not marked Completed.
              </p>
            )}
            {data!.training && (
              <p>
                Training: {num(data!.training.completed)} completed out of{" "}
                {num(data!.training.enrollments)} assigned enrollments. Paired
                QA analysis includes {num(data!.training.association.employees)}{" "}
                employees and does not establish causality.
              </p>
            )}
            {data!.hr && (
              <p>
                HR snapshot: {num(data!.hr.missing_documents)} missing documents
                across {num(data!.hr.employees)} onboarding records, including
                historical hires.
              </p>
            )}
            <div className="notice">
              <CircleHelp size={17} />
              Demo estimates are illustrative and are not validated financial
              forecasts. Program names are scenario labels, not proof of client
              relationships.
            </div>
          </Panel>
        </>
      )}
      <div className="section-heading section-space">
        <div>
          <h2>Saved action plans</h2>
          <p>
            {BROWSER_STORAGE
              ? "Browser-only drafts and review artifacts (not shared across devices) for "
              : "Local drafts and recorded approvals for "}
            {role} persona.
          </p>
        </div>
        <Badge>{plans.data?.length || 0} saved</Badge>
      </div>
      {!plans.data?.length ? (
        <Panel className="empty-inline">
          <ListChecks size={27} />
          <p>
            Create a plan from a solution comparison or save an assistant
            recommendation.
          </p>
          <Button asChild variant="outline">
            <Link to="/agents">
              Explore AI agents <ArrowRight size={15} />
            </Link>
          </Button>
        </Panel>
      ) : (
        <div className="priority-grid">
          {(plans.data as Row[]).map((p) => (
            <Panel className="detail-panel" key={p.id}>
              <Badge tone={p.status === "Approved" ? "ready" : "violet"}>
                {p.status}
              </Badge>
              <h3>{p.title}</h3>
              <p>
                {p.opportunity_id} · {p.option_id || "Recommendation"}
              </p>
              {p.reviewer && <small>Reviewer: {p.reviewer}</small>}
              <div className="card-bottom">
                <Button variant="ghost" onClick={() => setPlan(p)}>
                  Open & edit
                </Button>
                <button
                  title="Export plan"
                  aria-label={"Export " + p.title}
                  className="icon-button"
                  onClick={() =>
                    download("movate-plan.json", JSON.stringify(p, null, 2))
                  }
                >
                  <ArrowDownToLine size={17} />
                </button>
              </div>
            </Panel>
          ))}
        </div>
      )}
      {plan && (
        <PlanEditor
          initial={{
            opportunity_id: plan.opportunity_id,
            option_id: plan.option_id,
            title: plan.title,
            content: plan.content,
          }}
          onClose={() => setPlan(null)}
        />
      )}
    </>
  );
}

function Settings() {
  const [settingsUrl] = useSearchParams();
  const { role } = useApp(),
    client = useQueryClient(),
    { data, error, isPending } = useData("/data/status"),
    provider = useData("/ai/provider"),
    [tab, setTab] = useState(settingsUrl.get("tab") || "health"),
    [zipPath, setZipPath] = useState(""),
    [busy, setBusy] = useState(false),
    [test, setTest] = useState<Row | null>(null),
    [table, setTable] = useState(settingsUrl.get("table") || "interactions"),
    [offset, setOffset] = useState(0);
  const preview = useData(
      "/data/table/" + table + "?offset=" + offset,
      tab === "dictionary" &&
        !!data?.ready &&
        !["hr_cases", "hr_onboarding", "employees"].includes(table),
    ),
    log = useData("/audit-log", tab === "audit");
  const refresh = async () => {
    setBusy(true);
    try {
      const r = await api("/data/import", role, { zip_path: zipPath || null });
      if (r.ready)
        toast.success("Sources refreshed. Saved chats and plans preserved.");
      else toast.error(r.errors.join("; "));
      client.invalidateQueries();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const testProvider = async () => {
    setBusy(true);
    try {
      const r = await api("/ai/provider/test", role, {});
      setTest(r);
      r.connected ? toast.success(r.message) : toast.info(r.message);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (isPending) return <Loading />;
  if (error) return <ErrorState error={error} />;
  const d = data!;
  return (
    <>
      <Title
        eyebrow="DATA & SETTINGS"
        title="Trust starts with traceability."
        description="Inspect the import, follow the original sources, and configure your local intelligence workspace."
        action={
          <Badge tone={d.ready ? "ready" : "amber"}>
            {d.ready ? <CheckCheck size={14} /> : <CircleHelp size={14} />}{" "}
            {d.ready ? "Dataset validated" : "Import required"}
          </Badge>
        }
      />
      <div className="tabs" role="tablist">
        {[
          ["health", "Data health"],
          ["mapping", "Source mapping"],
          ["dictionary", "Data dictionary"],
          ["provider", "AI provider"],
          ["audit", "Audit trail"],
        ].map(([key, label]) => (
          <button
            role="tab"
            aria-selected={tab === key}
            key={key}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "health" && (
        <>
          <div className="metrics-grid">
            <Metric
              label="CSV tables"
              value={Object.keys(d.schema || {}).length}
              note="Discovered and imported tables"
              icon={Database}
            />
            <Metric
              label="Source entries"
              value={d.source_entries ?? "—"}
              note={`${d.workbook_requirement_rows ?? 0} original workbook requirement rows`}
              icon={FileText}
              tint="violet"
            />
            <Metric
              label="Canonical opportunities"
              value={d.canonical_opportunities ?? "—"}
              note="Deduplicated with all source references"
              icon={Lightbulb}
              tint="pink"
            />
            <Metric
              label="Relationship violations"
              value={
                d.relationships?.reduce(
                  (s: number, r: Row) =>
                    s + r.orphan_rows + r.duplicate_parent_keys,
                  0,
                ) ?? "—"
              }
              note="Declared and additional ID-link checks"
              icon={GitBranch}
              tint="cyan"
            />
          </div>
          <Panel className="detail-panel section-space">
            <h3>Refresh the local evidence</h3>
            <p>
              Source originals are preserved. Reimport replaces analytics only
              after validation; saved conversations, plans and audit events stay
              intact.
            </p>
            <div className="import-controls">
              <input
                aria-label="Dataset ZIP path"
                disabled={BROWSER_STORAGE}
                placeholder={
                  BROWSER_STORAGE
                    ? "Bundled read-only snapshot; refresh locally and redeploy"
                    : "Optional absolute path to Movate_Synthetic_Dataset_v1.zip"
                }
                value={zipPath}
                onChange={(e) => setZipPath(e.target.value)}
              />
              <Button
                disabled={busy || role !== "Executive" || BROWSER_STORAGE}
                onClick={refresh}
              >
                {busy ? (
                  <Loader2 size={16} className="spin" />
                ) : (
                  <Database size={16} />
                )}
                Import & revalidate
              </Button>
            </div>
            {role !== "Executive" && (
              <p>Switch to the Executive persona to refresh imports.</p>
            )}
            <div className="source-path">
              <strong>Imported archive</strong>
              <code>
                {d.archive || "Not found. Configure MOVATE_DATA_ZIP in .env."}
              </code>
              <small>
                Last import:{" "}
                {d.imported_at
                  ? new Date(d.imported_at).toLocaleString()
                  : "Never"}{" "}
                · Window: {d.window?.start || "2026-07-01"} →{" "}
                {d.window?.end || "2026-10-15"}
              </small>
            </div>
            {(d.errors || []).map((e: string) => (
              <p className="notice error-notice" key={e}>
                {e}
              </p>
            ))}
            {(d.warnings || []).map((e: string) => (
              <p className="notice" key={e}>
                {e}
              </p>
            ))}
            {!d.ready && <pre>{d.needed_paths?.join("\n")}</pre>}
          </Panel>
          <div className="two-col section-space">
            <Panel className="detail-panel">
              <h3>Daily KPI reconciliation</h3>
              <p>
                Computed from interactions by program and day, compared at the
                source’s rounding precision.
              </p>
              <DataTable
                rows={Object.entries(d.reconciliation || {}).map(
                  ([name, v]) => ({ name, ...(v as Row) }),
                )}
                columns={[
                  { key: "name", label: "Metric" },
                  { key: "mismatched_groups", label: "Mismatched groups" },
                  { key: "tolerance", label: "Tolerance" },
                ]}
              />
            </Panel>
            <Panel className="detail-panel">
              <h3>Source preservation</h3>
              <p>
                {d.workbooks?.length || 0} original workbooks discovered. Every
                nonempty requirement row is preserved with workbook, worksheet
                and row coordinates.
              </p>
              <details>
                <summary>Read the dataset’s original notes</summary>
                <pre>{d.source_readme}</pre>
              </details>
              <details>
                <summary>Original file paths</summary>
                <pre>{d.workbooks?.join("\n")}</pre>
              </details>
              <p className="muted">
                Names are synthetic. Financial assumptions use USD. Program
                labels do not prove client relationships.
              </p>
            </Panel>
          </div>
          <Panel className="detail-panel section-space">
            <h3>Relationship validation</h3>
            <DataTable
              rows={d.relationships || []}
              columns={[
                { key: "parent_table", label: "Parent" },
                { key: "parent_key", label: "Key" },
                { key: "child_table", label: "Child" },
                { key: "foreign_key", label: "Foreign key" },
                { key: "orphan_rows", label: "Orphans" },
                { key: "duplicate_parent_keys", label: "Duplicate keys" },
              ]}
            />
          </Panel>
        </>
      )}
      {tab === "mapping" && (
        <>
          <Panel className="mapping-flow">
            <span>
              <FileText />
              Original workbooks<strong>{d.workbooks?.length ?? 0}</strong>
            </span>
            <ArrowRight />
            <span>
              <Layers3 />
              Source entries<strong>{d.source_entries ?? "—"}</strong>
            </span>
            <ArrowRight />
            <span>
              <Lightbulb />
              Canonical opportunities
              <strong>{d.canonical_opportunities ?? "—"}</strong>
            </span>
            <ArrowRight />
            <span>
              <GitBranch />
              Source alternatives
              <strong>{d.schema?.solution_alternatives?.rows ?? "—"}</strong>
            </span>
          </Panel>
          <Panel className="detail-panel section-space">
            <h3>Every source row has a destination</h3>
            <p>
              Repeated training requirements are intentionally retained across
              workbooks. Source impact claims are not observed performance.
            </p>
            <DataTable
              rows={
                d.source_matches?.map((m: Row) => ({
                  id: m.source_id,
                  file: m.workbook?.filename || "CSV fallback",
                  sheet: m.workbook?.sheet || "See source CSV",
                  row: m.workbook?.row,
                  matched: m.matched
                    ? "Exact text"
                    : m.normalized_match
                      ? "Whitespace difference"
                      : "Inspect original",
                  opportunity: m.opportunity_id,
                })) || []
              }
              columns={[
                { key: "id", label: "Source ID" },
                { key: "file", label: "Original workbook" },
                { key: "sheet", label: "Worksheet" },
                { key: "row", label: "Row" },
                { key: "matched", label: "Text validation" },
                {
                  key: "opportunity",
                  label: "Canonical ID",
                  format: (v) => (
                    <Link className="text-link" to={"/agents/" + v}>
                      {v}
                    </Link>
                  ),
                },
              ]}
            />
          </Panel>
        </>
      )}
      {tab === "dictionary" && (
        <>
          <Panel className="filter-panel">
            <select
              aria-label="Dictionary table"
              value={table}
              onChange={(e) => {
                setTable(e.target.value);
                setOffset(0);
              }}
            >
              {Object.keys(d.schema || {}).map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <Badge>{num(d.schema?.[table]?.rows)} source rows</Badge>
            <Button
              variant="outline"
              disabled={!preview.data?.length}
              onClick={() =>
                download(
                  table + "-page.csv",
                  csv(preview.data as Row[]),
                  "text/csv",
                )
              }
            >
              <ArrowDownToLine size={15} />
              Export visible page
            </Button>
          </Panel>
          <Panel className="detail-panel">
            <h3>{table.replaceAll("_", " ")}</h3>
            <DataTable
              rows={d.schema?.[table]?.columns || []}
              columns={[
                { key: "name", label: "Column" },
                { key: "type", label: "Source inferred type" },
                { key: "database_type", label: "Stored database type" },
                { key: "nulls", label: "Null values" },
                { key: "distinct", label: "Distinct values" },
                { key: "description", label: "Description" },
              ]}
            />
          </Panel>
          <Panel className="detail-panel section-space">
            <h3>Source record inspector</h3>
            {["hr_cases", "hr_onboarding", "employees"].includes(table) ? (
              <p className="notice">
                Raw people records are restricted. Use the masked department
                view.
              </p>
            ) : preview.error ? (
              <p>{preview.error.message}</p>
            ) : (
              <>
                <DataTable
                  rows={(preview.data as Row[]) || []}
                  columns={Object.keys(preview.data?.[0] || {}).map((k) => ({
                    key: k,
                    label: k,
                  }))}
                />
                <div className="pagination">
                  <Button
                    variant="ghost"
                    disabled={!offset}
                    onClick={() => setOffset(Math.max(0, offset - 25))}
                  >
                    Previous
                  </Button>
                  <span>
                    Records {offset + 1}–{offset + (preview.data?.length || 0)}
                  </span>
                  <Button
                    variant="ghost"
                    disabled={preview.data?.length < 25}
                    onClick={() => setOffset(offset + 25)}
                  >
                    Next
                  </Button>
                </div>
              </>
            )}
          </Panel>
        </>
      )}
      {tab === "provider" && (
        <Panel className="provider-panel glass">
          <div className="ai-orb">
            <Sparkles size={28} />
          </div>
          <h2>Intelligence on your terms.</h2>
          <p>
            {BROWSER_STORAGE
              ? "The hosted demo uses deterministic, source-linked analysis only. External inference is disabled on the server. No AI API key is required."
              : "Deterministic, source-linked analysis works without an API key. Add an OpenAI-compatible endpoint or a local Ollama model for optional grounded explanations."}
          </p>
          <div className="provider-status">
            <span>
              Provider<strong>{provider.data?.provider || "disabled"}</strong>
            </span>
            <span>
              Model<strong>{provider.data?.model || "Not configured"}</strong>
            </span>
            <span>
              Connection
              <strong>
                {test
                  ? test.connected
                    ? "Test passed"
                    : "Not connected"
                  : "Not tested"}
              </strong>
            </span>
          </div>
          <Button disabled={busy} onClick={testProvider}>
            {busy ? (
              <Loader2 className="spin" size={16} />
            ) : (
              <Activity size={16} />
            )}
            Test connection
          </Button>
          {test && <p className="notice">{test.message}</p>}
          {!BROWSER_STORAGE && (
            <details open>
              <summary>Configure in the project .env file</summary>
              <pre>
                {
                  "LLM_PROVIDER=openai  # or ollama / disabled\nLLM_BASE_URL=       # OpenAI-compatible: API root ending /v1\n                    # Ollama native: http://127.0.0.1:11434\nLLM_MODEL=          # your installed / available model\nLLM_API_KEY=        # optional for local Ollama"
                }
              </pre>
              <p>
                Restart the backend after changing configuration, then test
                here. Provider credentials remain on the server. No model is
                selected automatically. Compact evidence is sent only when
                configured; individual HR records are never included.
              </p>
            </details>
          )}
          <p className="muted">
            {BROWSER_STORAGE
              ? "Server authentication protects this private synthetic demo. Selectable personas are demo roles, not individual user authorization. Browser-saved work is private to this browser and origin."
              : "This local demo uses selectable personas rather than production authentication. Bind to localhost and use synthetic records only."}
          </p>
        </Panel>
      )}
      {tab === "audit" && (
        <Panel className="detail-panel">
          <h3>
            {BROWSER_STORAGE
              ? "Browser-local activity history"
              : "Local append-only audit trail"}
          </h3>
          <p>
            {BROWSER_STORAGE
              ? "Recent activity in this browser; editable and not a durable server audit trail. Function access events are emitted to platform logs. Persona: "
              : "Showing source import, HR access and plan events. The local SQLite trail is append-only through the application, not tamper-proof against a database administrator. Persona: "}
            {role}.
          </p>
          <DataTable
            rows={(log.data as Row[]) || []}
            columns={[
              { key: "created_at", label: "UTC timestamp" },
              { key: "role", label: "Persona" },
              { key: "event", label: "Event" },
              { key: "context", label: "Context" },
            ]}
          />
        </Panel>
      )}
    </>
  );
}

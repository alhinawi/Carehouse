"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  Activity,
  LayoutDashboard,
  Users,
  CalendarDays,
  ClipboardPlus,
  Stethoscope,
  Building2,
  BedDouble,
  Pill,
  FlaskConical,
  Receipt,
  UserRoundCog,
  UserRound,
  ChartNoAxesCombined,
  ShieldCheck,
  Settings,
  Search,
  Bell,
  Plus,
  ArrowUpRight,
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  LogOut,
  Globe,
  Download,
  Printer,
  Filter,
  RefreshCw,
  Check,
  MoreHorizontal,
  HeartPulse,
  Clock,
  Eye,
  Pencil,
  Trash2,
  AlertTriangle,
  ArrowLeftRight,
  CreditCard,
  PackageCheck,
  LockKeyhole,
  FileText,
  Mail,
  KeyRound,
  LoaderCircle,
  CheckCircle2,
  Phone,
  ExternalLink,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import {
  modules,
  moduleKeys,
  can,
  canAccessPatientField,
  roles,
  departments,
  type ModuleKey,
  type RecordData,
  type Field,
} from "./domain";
import { t } from "./i18n";
import "@fontsource/ibm-plex-sans-arabic/arabic-400.css";
import "@fontsource/ibm-plex-sans-arabic/arabic-500.css";
import "@fontsource/ibm-plex-sans-arabic/arabic-600.css";
import "@fontsource/ibm-plex-sans-arabic/arabic-700.css";
import "@fontsource/manrope/latin-500.css";
import "@fontsource/manrope/latin-600.css";
import "@fontsource/manrope/latin-700.css";
import "@fontsource/manrope/latin-800.css";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/dm-sans/latin-700.css";
const icons: Record<string, React.ElementType> = {
  dashboard: LayoutDashboard,
  patients: Users,
  appointments: CalendarDays,
  emr: ClipboardPlus,
  staff: Stethoscope,
  departments: Building2,
  beds: BedDouble,
  pharmacy: Pill,
  lab: FlaskConical,
  billing: Receipt,
  hr: UserRoundCog,
  reports: ChartNoAxesCombined,
  audit: ShieldCheck,
  settings: Settings,
};
let csrf = "";
async function api(path: string, method = "GET", body?: unknown) {
  const r = await fetch("/api" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(csrf ? { "X-CSRF-Token": csrf } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json: any = await r.json();
  if (!r.ok) throw new Error(json.error || "Request failed");
  return json;
}
type Session = {
  user: { name: string; role: string };
  workspace?: { name: string; retention_days: number; demo: number };
  csrf: string;
};
const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });
function money(v: unknown, lang = "en") {
  return (
    new Intl.NumberFormat(lang === "ar" ? "ar-EG-u-nu-latn" : "en-EG", {
      maximumFractionDigits: 0,
    }).format(Number(v || 0)) + (lang === "ar" ? " ج.م" : " EGP")
  );
}
function date(v: unknown, lang = "en", time = false) {
  if (!v) return "—";
  const raw = String(v),
    d = new Date(raw);
  return Number.isNaN(d.getTime())
    ? String(v)
    : new Intl.DateTimeFormat(lang === "ar" ? "ar-EG-u-nu-latn" : "en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        ...(!time ? { timeZone: "UTC" } : {}),
        ...(time ? { hour: "2-digit", minute: "2-digit" } : {}),
      }).format(d);
}
function initials(name: unknown) {
  return String(name || "?")
    .split(" ")
    .filter((v) => v !== "Dr.")
    .slice(0, 2)
    .map((n) => n[0])
    .join("");
}
const Btn = ({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }) => (
  <button
    className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 ${variant === "primary" ? "bg-teal-700 text-white hover:bg-teal-800 shadow-sm shadow-teal-900/10" : variant === "danger" ? "bg-rose-600 text-white hover:bg-rose-700" : variant === "ghost" ? "text-slate-500 hover:bg-slate-100" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"} ${className}`}
    {...props}
  >
    {children}
  </button>
);
const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className={`w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 disabled:bg-slate-50 ${props.className || ""}`}
  />
);
const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    {...props}
    className={`w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-teal-500/20 ${props.className || ""}`}
  />
);
function Badge({ value, lang = "en" }: { value: unknown; lang?: string }) {
  const v = String(value || "—"),
    red = [
      "Emergency",
      "Urgent",
      "Out of stock",
      "Absent",
      "Rejected",
      "Quarantined",
    ].includes(v),
    amber = [
      "Scheduled",
      "Requested",
      "Low stock",
      "Processing",
      "Partially paid",
      "Busy",
      "Cleaning",
      "Pending",
      "Draft",
      "On leave",
      "Maintenance",
      "Issued",
    ].includes(v),
    blue = [
      "Checked-in",
      "In consultation",
      "Collected",
      "Submitted",
      "Follow-up",
    ].includes(v);
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] font-semibold ${red ? "bg-rose-50 text-rose-700" : amber ? "bg-amber-50 text-amber-700" : blue ? "bg-blue-50 text-blue-700" : "bg-teal-50 text-teal-700"}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {t(v, lang)}
    </span>
  );
}
function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement;
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && dialogRef.current) {
        const elements = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
          ),
        ).filter((el) => el.offsetParent !== null);
        const first = elements[0],
          last = elements.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", listener);
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", listener);
      document.body.style.overflow = old;
      previouslyFocused?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-3 backdrop-blur-sm"
      onClick={onClose}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ${wide ? "max-w-4xl" : "max-w-2xl"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-5">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button
            autoFocus
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto p-6">{children}</div>
      </section>
    </div>
  );
}
export default function App() {
  const [lang, setLanguage] = useState(
      localStorage.getItem("carehouse-lang") ||
        (navigator.languages.some((l) => /^ar(?:-|$)/i.test(l)) ||
        navigator.language.toUpperCase().endsWith("-EG") ||
        Intl.DateTimeFormat().resolvedOptions().timeZone === "Africa/Cairo"
          ? "ar"
          : "en"),
    ),
    [session, setSession] = useState<Session | null>(null),
    [ready, setReady] = useState(false),
    [records, setRecords] = useState<RecordData[]>([]),
    recordsVersion = useRef(0),
    [page, setPage] = useState(location.hash.slice(1) || "dashboard"),
    [mobile, setMobile] = useState(false),
    [search, setSearch] = useState(""),
    [toast, setToast] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [modal, setModal] = useState<{
      kind: string;
      module?: ModuleKey;
      record?: RecordData;
    } | null>(null),
    [notify, setNotify] = useState(false),
    [accountMenu, setAccountMenu] = useState(false);
  const setLang = (value: string) => {
    localStorage.setItem("carehouse-lang", value);
    setLanguage(value);
  };
  const tr = (s: string) => t(s, lang);
  const role = session?.user.role || "";
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.classList.toggle("font-arabic", lang === "ar");
  }, [lang]);
  useEffect(() => {
    if (!localStorage.getItem("carehouse-lang"))
      api("/locale")
        .then((r) => {
          if (!localStorage.getItem("carehouse-lang") && r.language === "ar")
            setLanguage("ar");
        })
        .catch(() => {});
    api("/session")
      .then((s) => {
        csrf = s.csrf;
        setSession(s);
      })
      .catch(() => {})
      .finally(() => setReady(true));
    const h = () => {
      setPage(location.hash.slice(1) || "dashboard");
      setSearch("");
      setMobile(false);
    };
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);
  async function load() {
    setLoading(true);
    try {
      const r = await api("/records?v=" + recordsVersion.current);
      if (!r.unchanged) {
        setRecords(r.records);
        recordsVersion.current = r.version;
      }
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    recordsVersion.current = 0;
    if (session) load();
  }, [session]);
  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(""), 4000);
      return () => clearTimeout(id);
    }
  }, [toast]);
  const go = (p: string) => {
    location.hash = p;
    if (p === page) {
      setSearch("");
      setMobile(false);
    }
  };
  const lookup = (id: unknown) => records.find((r) => r.id === id)?.name || "—";
  const list = (m: ModuleKey) => records.filter((r) => r.module === m);
  const notices = [
    {
      label: "Low-stock medicines",
      count: list("pharmacy").filter(
        (r) => Number(r.stock) <= Number(r.reorder),
      ).length,
      module: "pharmacy",
    },
    {
      label: "Pending lab results",
      count: list("lab").filter(
        (r) => !["Completed", "Cancelled"].includes(r.status),
      ).length,
      module: "lab",
    },
    {
      label: "Upcoming appointments",
      count: list("appointments").filter(
        (r) =>
          r.status === "Scheduled" &&
          String(r.scheduledAt).slice(0, 10) === today(),
      ).length,
      module: "appointments",
    },
    {
      label: "Due invoices",
      count: list("billing").filter(
        (r) =>
          !["Paid", "Void", "Draft"].includes(r.status) &&
          String(r.dueDate) <= today(),
      ).length,
      module: "billing",
    },
  ].filter((n) => n.count > 0 && can(role, n.module));
  const allSearch =
    search.trim().length > 1
      ? records
          .filter((r) =>
            (r.name + " " + lookup(r.patientId) + " " + r.id + " " + r.status)
              .toLowerCase()
              .includes(search.toLowerCase()),
          )
          .slice(0, 12)
      : [];
  async function execute(fn: () => Promise<any>, message = "Record saved") {
    setLoading(true);
    setError("");
    try {
      await fn();
      setModal(null);
      setToast(tr(message));
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  if (!ready)
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoaderCircle className="animate-spin text-teal-600" size={32} />
      </div>
    );
  if (!session)
    return (
      <Login
        lang={lang}
        setLang={setLang}
        onLogin={async (s) => {
          csrf = s.csrf;
          setSession(await api("/session"));
        }}
      />
    );
  const navGroups = [
    { name: "Workspace", keys: ["dashboard"] },
    {
      name: "Clinical care",
      keys: ["patients", "appointments", "emr", "staff", "departments", "beds"],
    },
    { name: "Operations", keys: ["pharmacy", "lab", "billing", "hr"] },
    {
      name: "Administration",
      keys: [
        "reports",
        ...(["admin", "auditor"].includes(role) ? ["audit"] : []),
        "settings",
      ],
    },
  ];
  const current = modules[page as ModuleKey];
  return (
    <div className="min-h-screen bg-[#f6f8fb] text-slate-700">
      {mobile && (
        <div
          onClick={() => setMobile(false)}
          className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden"
        />
      )}
      <aside
        className={`fixed inset-y-0 start-0 z-40 flex w-64 flex-col border-e border-slate-200/80 bg-white transition-transform print:hidden ${mobile ? "flex" : "hidden lg:flex"}`}
      >
        <div className="flex h-[90px] shrink-0 items-center gap-3 px-7">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-white shadow-lg shadow-teal-700/20">
            <HeartPulse size={25} />
          </div>
          <div>
            <div className="font-display text-xl font-extrabold tracking-tight text-slate-900">
              carehouse<span className="text-teal-600">.</span>
            </div>
            <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-[.18em] text-slate-400">
              HOSPITAL MANAGEMENT
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-4 pb-3">
          {navGroups.map((group) => (
            <div key={group.name}>
              <p className="mb-2 px-3 text-[9px] font-bold uppercase tracking-[.17em] text-slate-400">
                {tr(group.name)}
              </p>
              <div className="space-y-1">
                {group.keys
                  .filter(
                    (k) => !moduleKeys.includes(k as ModuleKey) || can(role, k),
                  )
                  .map((k) => {
                    const Icon = icons[k],
                      active = page === k;
                    return (
                      <button
                        key={k}
                        onClick={() => go(k)}
                        className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[12px] font-semibold ${active ? "bg-teal-50 text-teal-800" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}
                      >
                        <Icon size={17} strokeWidth={active ? 2.2 : 1.7} />
                        {tr(
                          modules[k as ModuleKey]?.title ||
                            {
                              dashboard: "Dashboard",
                              reports: "Reports & analytics",
                              audit: "Audit trail",
                              settings: "Settings",
                            }[k] ||
                            k,
                        )}
                        {k === "appointments" && (
                          <span className="ms-auto rounded-md bg-white px-1.5 py-0.5 text-[10px] text-teal-700">
                            {
                              list("appointments").filter(
                                (r) =>
                                  String(r.scheduledAt).slice(0, 10) ===
                                  today(),
                              ).length
                            }
                          </span>
                        )}
                        {active && k !== "appointments" && (
                          <span className="ms-auto h-1.5 w-1.5 rounded-full bg-teal-600" />
                        )}
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </nav>
        <div className="m-4 rounded-xl border border-teal-100 bg-gradient-to-br from-teal-50 to-white p-3.5">
          <div className="flex items-center gap-2 text-[11px] font-bold text-teal-800">
            <ShieldCheck size={16} />
            {tr("Protected workspace")}
          </div>
          <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">
            {tr("Fictional data only")}.{" "}
            {tr("Not for real patient data or clinical decisions.")}
          </p>
        </div>
        <button
          onClick={() => go("settings")}
          className="mx-4 mb-4 flex items-center gap-2.5 border-t border-slate-100 pt-3 text-start"
        >
          <Avatar name={session.user.name} />
          <div className="min-w-0">
            <div className="truncate text-xs font-bold text-slate-800">
              {session.user.name.startsWith("Demo ") && lang === "ar"
                ? "مستخدم تجريبي"
                : session.user.name}
            </div>
            <div className="mt-0.5 text-[10px] capitalize text-slate-400">
              {tr(role.charAt(0).toUpperCase() + role.slice(1))}
            </div>
          </div>
          <Settings size={15} className="ms-auto text-slate-400" />
        </button>
      </aside>
      <div className="lg:ms-64 print:ms-0">
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between gap-4 border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur-md sm:px-8 print:hidden">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobile(true)}
              aria-label="Open navigation"
              className="lg:hidden"
            >
              <Menu size={22} />
            </button>
            <a
              href="#dashboard"
              aria-label={
                lang === "ar" ? "Carehouse، الرئيسية" : "Carehouse home"
              }
              onClick={() => {
                setMobile(false);
                setAccountMenu(false);
              }}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg py-2 font-display text-[15px] font-extrabold tracking-tight text-slate-900 focus-visible:outline-2 focus-visible:outline-teal-600"
              dir="ltr"
            >
              <span className="hidden rounded-lg bg-teal-700 p-1.5 text-white sm:inline-flex">
                <HeartPulse size={17} />
              </span>
              Carehouse<span className="-ms-2 text-teal-600">.</span>
            </a>
            <div className="hidden text-[12px] text-slate-400 xl:block">
              {tr("Workspace")}
              <span className="mx-2.5 text-slate-300">/</span>
              <span className="font-semibold text-slate-700">
                {tr(
                  current?.title ||
                    {
                      dashboard: "Overview",
                      reports: "Reports & analytics",
                      audit: "Audit trail",
                      settings: "Settings",
                    }[page] ||
                    "Overview",
                )}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-5">
            <div className="relative hidden xl:block">
              <Search
                size={15}
                className="absolute start-3 top-3 text-slate-400"
              />
              <input
                aria-label="Global search"
                placeholder={tr("Search anything...")}
                className="w-60 rounded-xl border border-slate-200/70 bg-slate-50 py-2.5 pe-9 ps-9 text-xs outline-none focus:border-teal-400"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <span className="absolute end-3 top-2.5 text-[11px] text-slate-300">
                ⌕
              </span>
              {search.length > 1 && (
                <div className="absolute end-0 top-12 max-h-96 w-96 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                  {!allSearch.length ? (
                    <p className="p-4 text-xs">{tr("No records found")}</p>
                  ) : (
                    allSearch.map((r) => (
                      <button
                        key={r.id}
                        className="flex w-full items-center justify-between gap-4 rounded-xl p-3 text-start hover:bg-slate-50"
                        onClick={() => {
                          setModal({
                            kind: "detail",
                            module: r.module,
                            record: r,
                          });
                          setSearch("");
                        }}
                      >
                        <div>
                          <b className="text-xs text-slate-800">{r.name}</b>
                          <p className="mt-1 text-[10px] text-slate-400">
                            {tr(modules[r.module].title)}
                          </p>
                        </div>
                        <ArrowUpRight size={15} />
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <button
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-500"
              onClick={() => setLang(lang === "en" ? "ar" : "en")}
              aria-label="Change language"
            >
              <Globe size={16} />
              <span className="hidden sm:inline">
                {lang === "en" ? "العربية" : "English"}
              </span>
            </button>
            <div className="relative">
              <button
                aria-label={tr("Notifications")}
                onClick={() => {
                  setNotify(!notify);
                  setAccountMenu(false);
                }}
                className="relative rounded-xl border border-slate-200 p-2.5 text-slate-500"
              >
                <Bell size={17} />
                {notices.length > 0 && (
                  <span className="absolute end-2 top-2 h-1.5 w-1.5 rounded-full border border-white bg-rose-400" />
                )}
              </button>
              {notify && (
                <div className="absolute end-0 top-12 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
                  <h3 className="mb-3 font-bold">{tr("Notifications")}</h3>
                  {notices.length ? (
                    notices.map((n) => (
                      <button
                        key={n.module}
                        onClick={() => {
                          go(n.module);
                          setNotify(false);
                        }}
                        className="mb-2 flex w-full items-center justify-between rounded-xl bg-slate-50 p-3 text-xs"
                      >
                        <span>{tr(n.label)}</span>
                        <b className="text-teal-700">{n.count}</b>
                      </button>
                    ))
                  ) : (
                    <p className="text-sm text-slate-400">
                      {tr("Nothing needs your attention")}
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="hidden h-7 w-px bg-slate-200 sm:block" />
            <div className="relative">
              <button
                aria-label={tr("Account")}
                aria-haspopup="menu"
                aria-expanded={accountMenu}
                onClick={() => {
                  setAccountMenu(!accountMenu);
                  setNotify(false);
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600 hover:bg-teal-50 hover:text-teal-700"
              >
                <UserRound size={18} />
              </button>
              {accountMenu && (
                <>
                  <button
                    aria-label={tr("Close")}
                    className="fixed inset-0 z-20 cursor-default"
                    onClick={() => setAccountMenu(false)}
                  />
                  <div
                    role="menu"
                    aria-label={tr("Account")}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setAccountMenu(false);
                    }}
                    className="absolute end-0 top-12 z-30 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl"
                  >
                    <div className="border-b border-slate-100 px-3 py-3">
                      <p className="text-xs font-bold text-slate-800">
                        {session.user.name.startsWith("Demo ")
                          ? lang === "ar"
                            ? "مستخدم تجريبي"
                            : "Demo user"
                          : session.user.name}
                      </p>
                      <p className="mt-1 text-[10px] capitalize text-slate-400">
                        {tr(role.charAt(0).toUpperCase() + role.slice(1))}
                      </p>
                    </div>
                    <button
                      role="menuitem"
                      className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start text-xs hover:bg-slate-50"
                      onClick={() => {
                        go("settings");
                        setAccountMenu(false);
                      }}
                    >
                      <Settings size={15} />
                      {tr("Settings")}
                    </button>
                    <button
                      role="menuitem"
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start text-xs hover:bg-slate-50"
                      onClick={() => setLang(lang === "en" ? "ar" : "en")}
                    >
                      <Globe size={15} />
                      {tr("Language")}
                      <span className="ms-auto text-teal-700">
                        {lang === "en" ? "العربية" : "English"}
                      </span>
                    </button>
                    <button
                      role="menuitem"
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start text-xs text-rose-600 hover:bg-rose-50"
                      onClick={async () => {
                        await api("/logout", "POST");
                        csrf = "";
                        setSession(null);
                        setRecords([]);
                        setAccountMenu(false);
                      }}
                    >
                      <LogOut size={15} />
                      {tr("Sign out")}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1700px] space-y-6 px-4 py-7 sm:px-8">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
            >
              <AlertTriangle size={19} />
              <span className="flex-1">{tr(error)}</span>
              <button onClick={() => setError("")}>
                <X size={18} />
              </button>
            </div>
          )}
          {page === "dashboard" ? (
            <Dashboard
              records={records}
              lang={lang}
              go={go}
              open={(m, r) =>
                setModal({ kind: r ? "detail" : "edit", module: m, record: r })
              }
              role={role}
              notices={notices}
            />
          ) : current ? (
            can(role, page) ? (
              <ModulePage
                key={page}
                module={page as ModuleKey}
                records={records}
                lang={lang}
                role={role}
                open={(kind, r) => {
                  setError("");
                  setModal({ kind, module: page as ModuleKey, record: r });
                }}
                refresh={load}
                loading={loading}
              />
            ) : (
              <Empty
                title={tr("No access")}
                subtitle={tr("Your role does not allow this module.")}
              />
            )
          ) : page === "reports" ? (
            <Reports records={records} lang={lang} />
          ) : page === "audit" ? (
            <Audit lang={lang} role={role} />
          ) : page === "settings" ? (
            <SettingsPage
              session={session}
              lang={lang}
              setLang={setLang}
              onLogout={async () => {
                await api("/logout", "POST");
                csrf = "";
                setSession(null);
                setRecords([]);
              }}
              execute={execute}
              hasDemo={records.some((r) => r.demo)}
            />
          ) : (
            <Empty title={tr("No records found")} subtitle="" />
          )}
          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/70 pt-5 text-[10px] text-slate-400">
            <span>
              © {new Date().getFullYear()} Carehouse ·{" "}
              {tr("Demonstration workspace")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
              {tr("Fictional data only")} · {tr("Record access is logged")}
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div
          role="status"
          className="fixed bottom-6 start-1/2 z-[70] flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-slate-900 px-6 py-4 text-sm text-white shadow-xl"
        >
          <CheckCircle2 size={20} className="text-teal-300" />
          {toast}
        </div>
      )}
      {modal && modal.module && (
        <Modal
          title={
            modal.kind === "edit"
              ? `${tr(modal.record ? "Edit" : "Add")} ${lang === "ar" ? modules[modal.module].arSingular : modules[modal.module].singular}`
              : modal.kind === "delete"
                ? tr("Delete record?")
                : modal.record?.name || ""
          }
          onClose={() => {
            setModal(null);
            setError("");
          }}
          wide={modal.kind === "detail"}
        >
          {error && (
            <p
              role="alert"
              className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700"
            >
              {tr(error)}
            </p>
          )}
          {modal.kind === "edit" ? (
            <RecordForm
              role={session.user.role}
              module={modal.module}
              record={modal.record}
              records={records}
              lang={lang}
              busy={loading}
              onClose={() => setModal(null)}
              onSave={(data) =>
                execute(() =>
                  api(
                    `/records/${modal.module}${modal.record ? "/" + modal.record.id : ""}`,
                    modal.record ? "PUT" : "POST",
                    data,
                  ),
                )
              }
            />
          ) : modal.kind === "delete" ? (
            <>
              <p className="text-sm leading-7 text-slate-500">
                {tr(
                  "This cannot be undone. Linked, signed, and paid records are protected.",
                )}
              </p>
              <p className="mt-3 font-semibold">{modal.record?.name}</p>
              <div className="mt-6 flex justify-end gap-3">
                <Btn variant="secondary" onClick={() => setModal(null)}>
                  {tr("Cancel")}
                </Btn>
                <Btn
                  variant="danger"
                  disabled={loading}
                  onClick={() =>
                    execute(
                      () =>
                        api(
                          `/records/${modal.module}/${modal.record!.id}`,
                          "DELETE",
                        ),
                      "Record deleted",
                    )
                  }
                >
                  {tr("Delete")}
                </Btn>
              </div>
            </>
          ) : modal.kind === "detail" ? (
            <RecordDetail
              record={modal.record!}
              records={records}
              lang={lang}
              role={role}
              open={setModal}
            />
          ) : (
            <Workflow
              kind={modal.kind}
              record={modal.record!}
              records={records}
              lang={lang}
              busy={loading}
              submit={(data) =>
                execute(
                  () =>
                    api(
                      `/workflow/${modal.module}/${modal.record!.id}`,
                      "POST",
                      data,
                    ),
                  "Workflow completed",
                )
              }
            />
          )}
        </Modal>
      )}
    </div>
  );
}
function Avatar({ name, small = false }: { name: unknown; small?: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-[#e4efee] font-bold text-teal-800 ${small ? "h-8 w-8 text-[10px]" : "h-9 w-9 text-[11px]"}`}
    >
      {initials(name)}
    </span>
  );
}
function Empty({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
      <FileText size={30} className="mb-3 text-slate-300" />
      <h3 className="font-bold text-slate-600">{title}</h3>
      <p className="mt-2 text-sm text-slate-400">{subtitle}</p>
    </div>
  );
}
function Dashboard({
  records,
  lang,
  go,
  open,
  role,
  notices,
}: {
  records: RecordData[];
  lang: string;
  go: (p: string) => void;
  open: (m: ModuleKey, r?: RecordData) => void;
  role: string;
  notices: { label: string; count: number; module: string }[];
}) {
  const tr = (s: string) => t(s, lang),
    list = (m: string) => records.filter((r) => r.module === m),
    lookup = (id: unknown) => records.find((r) => r.id === id)?.name || "—";
  const patients = list("patients"),
    staff = list("staff"),
    appointments = list("appointments")
      .filter((r) => String(r.scheduledAt).slice(0, 10) === today())
      .sort((a, b) =>
        String(a.scheduledAt).localeCompare(String(b.scheduledAt)),
      ),
    beds = list("beds"),
    occupied = beds.filter((r) => r.status === "Occupied").length,
    paid = list("billing").reduce((s, r) => s + Number(r.paid || 0), 0);
  const stats = [
    {
      title: "Total patients",
      value: patients.length,
      icon: Users,
      note: `${patients.filter((r) => r.status === "Active").length} ${tr("Active")}`,
      color: "teal",
      module: "patients",
    },
    {
      title: "Available doctors",
      value: staff.filter((r) => r.job === "Doctor" && r.status === "Available")
        .length,
      icon: Stethoscope,
      note: `${staff.filter((r) => r.job === "Doctor").length} ${tr("Care team")}`,
      color: "blue",
      module: "staff",
    },
    {
      title: "Today’s appointments",
      value: appointments.length,
      icon: CalendarDays,
      note: `${appointments.filter((r) => r.status === "Scheduled").length} ${tr("Scheduled")}`,
      color: "violet",
      module: "appointments",
    },
    {
      title: "Bed occupancy",
      value: beds.length
        ? Math.round((occupied / beds.length) * 100) + "%"
        : "0%",
      icon: BedDouble,
      note: `${occupied} / ${beds.length} ${tr("Beds")}`,
      color: "amber",
      module: "beds",
    },
  ].filter((s) => can(role, s.module));
  const activity = departments.map((d) => ({
    name: tr(d),
    value: list("appointments").filter((r) => r.department === d).length,
  }));
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    const iso = d.toLocaleDateString("en-CA");
    return {
      name: d.toLocaleDateString(lang === "ar" ? "ar-EG-u-nu-latn" : "en-US", {
        weekday: "short",
      }),
      visits: list("appointments").filter(
        (r) => String(r.scheduledAt).slice(0, 10) === iso,
      ).length,
    };
  });
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-1.5 flex items-center gap-2 text-xs text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
            {tr("Live workspace")}
          </div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900">
            {tr("Hospital overview")}
          </h1>
          <p className="mt-1.5 text-xs text-slate-400">
            {tr("Here is how your hospital is doing today.")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-500">
            <CalendarDays size={14} />
            {new Intl.DateTimeFormat(
              lang === "ar" ? "ar-EG-u-nu-latn" : "en-GB",
              {
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: "Africa/Cairo",
              },
            ).format(new Date())}
          </div>
          {can(role, "appointments", true) && (
            <Btn onClick={() => open("appointments")}>
              <Plus size={16} />
              {tr("New")} {tr("Appointments")}
            </Btn>
          )}
        </div>
      </div>
      <section className="relative flex min-h-[186px] overflow-hidden rounded-2xl border border-teal-100 bg-[#e8f5f2]">
        <div className="relative z-10 flex flex-1 flex-col justify-center p-6 sm:p-7">
          <div className="mb-3 text-[10px] font-bold uppercase tracking-[.15em] text-teal-700">
            CAREHOUSE HOSPITAL
          </div>
          <h2 className="max-w-md font-display text-[25px] font-extrabold leading-[1.3] tracking-tight text-slate-900">
            {tr("A little more clarity. A lot more care.")}
          </h2>
          <p className="mb-5 mt-2.5 max-w-sm text-xs leading-5 text-slate-500">
            {tr("Everything your care team needs, in one connected workspace.")}
          </p>
          <div>
            <button
              onClick={() =>
                go(can(role, "appointments") ? "appointments" : "reports")
              }
              className="inline-flex items-center gap-2 text-xs font-bold text-teal-800"
            >
              {tr(
                can(role, "appointments") ? "View appointments" : "View report",
              )}
              <ArrowRight className="rtl:rotate-180" size={15} />
            </button>
          </div>
        </div>
        <div className="relative hidden w-[36%] max-w-md sm:block">
          <img
            src="/care-team.jpg"
            className="absolute inset-0 h-full w-full object-cover object-center"
            alt={
              lang === "ar"
                ? "فريق طبي بيتناقش"
                : "Medical colleagues discussing care"
            }
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#e8f5f2] via-[#e8f5f2]/10 to-transparent rtl:bg-gradient-to-l" />
        </div>
      </section>
      {stats.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((s) => (
            <button
              onClick={() => go(s.module)}
              key={s.title}
              className="rounded-2xl border border-slate-200/80 bg-white p-5 text-start shadow-xs transition-shadow hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span
                  className={`rounded-xl p-2.5 ${s.color === "blue" ? "bg-blue-50 text-blue-500" : s.color === "violet" ? "bg-violet-50 text-violet-500" : s.color === "amber" ? "bg-amber-50 text-amber-500" : "bg-teal-50 text-teal-600"}`}
                >
                  <s.icon size={19} strokeWidth={1.8} />
                </span>
                <ArrowUpRight size={15} className="text-slate-300" />
              </div>
              <div className="mt-4 text-[11px] font-medium text-slate-400">
                {tr(s.title)}
              </div>
              <div className="mt-1 flex items-end justify-between gap-2">
                <b className="font-display text-3xl tracking-tight text-slate-900">
                  {s.value}
                </b>
                <span className="mb-1 text-[10px] font-semibold text-teal-600">
                  {s.note}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
      <div className="grid gap-5 xl:grid-cols-[1.65fr_1fr]">
        <section className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-5">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {tr("Patient visits")}
              </h3>
              <p className="mt-1 text-[10px] text-slate-400">
                {tr("Weekly visits")} · {list("appointments").length}{" "}
                {tr("Appointments")}
              </p>
            </div>
            <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <span className="h-2 w-2 rounded-full bg-teal-500" />
              {tr("Visits")}
            </span>
          </div>
          <div className="h-52 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={week}
                margin={{ top: 10, right: 8, left: -24, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="visitsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 6"
                  vertical={false}
                  stroke="#f0f3f6"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  dy={10}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    borderColor: "#e2e8f0",
                    fontSize: 12,
                  }}
                />
                <Area
                  name={tr("Visits")}
                  type="monotone"
                  dataKey="visits"
                  stroke="#0d9488"
                  strokeWidth={2.5}
                  fill="url(#visitsFill)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              {tr("Department activity")}
            </h3>
            <button
              onClick={() => go("reports")}
              aria-label={tr("View report")}
              className="text-slate-300"
            >
              <MoreHorizontal size={20} />
            </button>
          </div>
          <div className="space-y-4">
            {activity.slice(0, 5).map((d, i) => (
              <div key={d.name}>
                <div className="mb-2 flex justify-between text-[11px]">
                  <span className="font-medium text-slate-500">{d.name}</span>
                  <span className="font-bold text-slate-800">{d.value}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${["bg-teal-600", "bg-blue-400", "bg-indigo-400", "bg-amber-400", "bg-teal-300"][i]}`}
                    style={{
                      width: `${Math.max(2, (d.value / Math.max(1, ...activity.map((v) => v.value))) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[1.65fr_1fr]">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 p-5">
            <h3 className="text-sm font-bold text-slate-900">
              {tr("Today’s appointments overview")}
            </h3>
            <button
              onClick={() => go("appointments")}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-teal-700"
            >
              {tr("View all")}
              <ArrowRight size={13} />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-start">
              <thead className="bg-slate-50/60 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                <tr>
                  {["Patient", "Doctor", "Time", "Status"].map((s) => (
                    <th key={s} className="px-5 py-3 text-start">
                      {tr(s)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {appointments.slice(0, 5).map((r) => (
                  <tr
                    key={r.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => open("appointments", r)}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={lookup(r.patientId)} small />
                        <div>
                          <div className="whitespace-nowrap text-[11px] font-bold text-slate-700">
                            {lookup(r.patientId)}
                          </div>
                          <div className="mt-1 text-[9px] text-slate-400">
                            #{String(r.patientId).slice(0, 6).toUpperCase()}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-[10px] text-slate-500">
                      {lookup(r.staffId)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-[10px] text-slate-500">
                      {String(r.scheduledAt).slice(11, 16)}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge value={r.status} lang={lang} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!appointments.length && (
              <p className="p-8 text-center text-xs text-slate-400">
                {tr("No appointments on this date")}
              </p>
            )}
          </div>
        </section>
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                {tr("Stay on top of the day")}
              </h3>
              <span className="rounded-lg bg-amber-50 p-2 text-amber-500">
                <Activity size={17} />
              </span>
            </div>
            <p className="mt-1 text-[10px] text-slate-400">
              {tr("Your next steps, in one place.")}
            </p>
            <div className="mt-4 space-y-2">
              {notices.map((n) => (
                <button
                  key={n.module}
                  onClick={() => go(n.module)}
                  className="flex w-full items-center justify-between rounded-xl bg-slate-50 p-3 text-start text-[11px]"
                >
                  <span className="text-slate-500">{tr(n.label)}</span>
                  <span className="flex items-center gap-3">
                    <b className="text-slate-800">{n.count}</b>
                    <ChevronRight size={13} className="rtl:rotate-180" />
                  </span>
                </button>
              ))}
              {!notices.length && (
                <p className="text-xs text-slate-400">
                  {tr("Nothing needs your attention")}
                </p>
              )}
            </div>
          </section>
          <section className="flex items-center gap-4 rounded-2xl border border-teal-100 bg-teal-50/60 p-5">
            <div className="rounded-xl bg-white p-3 text-teal-600">
              <Receipt size={23} />
            </div>
            <div>
              <div className="text-[10px] text-slate-500">
                {tr("Collected revenue")}
              </div>
              <div className="mt-1 font-display text-2xl font-extrabold text-slate-900">
                {money(paid, lang)}
              </div>
              <div className="mt-1 text-[9px] text-slate-400">
                {tr("Generated from fictional workspace data")}
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
const columns: Record<ModuleKey, { key: string; label: string }[]> = {
  patients: [
    { key: "name", label: "Patient" },
    { key: "dob", label: "Date of birth" },
    { key: "bloodGroup", label: "Blood group" },
    { key: "phone", label: "Phone" },
  ],
  appointments: [
    { key: "patientId", label: "Patient" },
    { key: "staffId", label: "Doctor" },
    { key: "scheduledAt", label: "Time" },
    { key: "department", label: "Department" },
  ],
  emr: [
    { key: "name", label: "Record" },
    { key: "patientId", label: "Patient" },
    { key: "staffId", label: "Doctor" },
    { key: "updatedAt", label: "Last updated" },
  ],
  staff: [
    { key: "name", label: "Name" },
    { key: "specialty", label: "Specialty" },
    { key: "department", label: "Department" },
    { key: "scheduleStart", label: "Working hours" },
  ],
  departments: [
    { key: "name", label: "Department" },
    { key: "head", label: "Name" },
    { key: "location", label: "Room" },
    { key: "capacity", label: "Total" },
  ],
  beds: [
    { key: "name", label: "Beds" },
    { key: "ward", label: "Ward" },
    { key: "room", label: "Room" },
    { key: "patientId", label: "Patient" },
  ],
  pharmacy: [
    { key: "name", label: "Medicine" },
    { key: "stock", label: "Stock" },
    { key: "expiry", label: "Expiry" },
    { key: "supplier", label: "Supplier" },
  ],
  lab: [
    { key: "name", label: "Test / request" },
    { key: "patientId", label: "Patient" },
    { key: "kind", label: "Service" },
    { key: "scheduledAt", label: "Date" },
  ],
  billing: [
    { key: "name", label: "Service" },
    { key: "patientId", label: "Patient" },
    { key: "amount", label: "Amount" },
    { key: "paid", label: "Paid" },
  ],
  hr: [
    { key: "name", label: "Record" },
    { key: "staffId", label: "Name" },
    { key: "kind", label: "Type" },
    { key: "approval", label: "Approval" },
  ],
};
function exportCSV(rows: Record<string, unknown>[], name: string) {
  if (!rows.length) return;
  const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const value = (v: unknown) => {
    let s = typeof v === "object" ? JSON.stringify(v) : String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  const csv =
    "\ufeff" +
    keys.map(value).join(",") +
    "\r\n" +
    rows.map((r) => keys.map((k) => value(r[k])).join(",")).join("\r\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `carehouse-${name}-${today()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
function ModulePage({
  module: m,
  records,
  lang,
  role,
  open,
  refresh,
  loading,
}: {
  module: ModuleKey;
  records: RecordData[];
  lang: string;
  role: string;
  open: (kind: string, r?: RecordData) => void;
  refresh: () => void;
  loading: boolean;
}) {
  const mod = modules[m],
    tr = (s: string) => t(s, lang),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState(false),
    [status, setStatus] = useState(""),
    [department, setDepartment] = useState(""),
    [sort, setSort] = useState("name"),
    [desc, setDesc] = useState(false),
    [page, setPage] = useState(1),
    [view, setView] = useState(m === "beds" ? "grid" : "list"),
    [day, setDay] = useState(today());
  const lookup = (id: unknown) => records.find((r) => r.id === id)?.name || "—";
  const rows = records
    .filter((r) => r.module === m)
    .filter(
      (r) =>
        (!query ||
          (
            r.name +
            " " +
            lookup(r.patientId) +
            " " +
            lookup(r.staffId) +
            " " +
            r.status +
            " " +
            r.id
          )
            .toLowerCase()
            .includes(query.toLowerCase())) &&
        (!status || r.status === status) &&
        (!department || r.department === department),
    );
  const sorted = [...rows].sort((a, b) => {
    const av = String(a[sort] ?? ""),
      bv = String(b[sort] ?? "");
    return av.localeCompare(bv, undefined, { numeric: true }) * (desc ? -1 : 1);
  });
  const pages = Math.max(1, Math.ceil(sorted.length / 8)),
    current = sorted.slice(
      (Math.min(page, pages) - 1) * 8,
      Math.min(page, pages) * 8,
    );
  useEffect(() => setPage(1), [query, status, department]);
  const summary = [
    {
      label: tr("Total records"),
      value: records.filter((r) => r.module === m).length,
    },
    ...mod.statuses.slice(0, 3).map((s) => ({
      label: tr(s),
      value: records.filter((r) => r.module === m && r.status === s).length,
    })),
  ];
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-teal-600">
            CAREHOUSE / {tr("Workspace")}
          </div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900">
            {lang === "ar" ? mod.ar : mod.title}
          </h1>
          <p className="mt-2 text-xs text-slate-400">
            {lang === "ar" ? mod.arSubtitle : mod.subtitle}
          </p>
        </div>
        <div className="flex gap-2">
          <Btn
            variant="secondary"
            onClick={() => exportCSV(sorted, m)}
            disabled={!sorted.length}
          >
            <Download size={15} />
            <span className="hidden sm:inline">{tr("Export CSV")}</span>
          </Btn>
          {can(role, m, true) && (
            <Btn onClick={() => open("edit")}>
              <Plus size={16} />
              {tr("Add")} {lang === "ar" ? mod.arSingular : mod.singular}
            </Btn>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summary.map((s, i) => (
          <div
            key={s.label}
            className="rounded-2xl border border-slate-200/80 bg-white px-5 py-4"
          >
            <div className="text-[11px] text-slate-400">{s.label}</div>
            <div
              className={`mt-2 font-display text-2xl font-extrabold ${i === 0 ? "text-slate-900" : i === 1 ? "text-teal-700" : i === 2 ? "text-blue-600" : "text-amber-600"}`}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <div className="relative min-w-44 flex-1 sm:max-w-72">
            <Search
              size={15}
              className="absolute start-3 top-3 text-slate-400"
            />
            <Input
              aria-label={tr("Search records...")}
              placeholder={tr("Search records...")}
              className="ps-9 text-xs"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            {(m === "appointments" || m === "beds") && (
              <div className="flex rounded-lg bg-slate-100 p-1">
                <button
                  onClick={() => setView("list")}
                  className={`rounded-md px-3 py-1.5 text-[11px] ${view === "list" ? "bg-white font-bold text-teal-700 shadow-sm" : "text-slate-400"}`}
                >
                  {tr("List")}
                </button>
                <button
                  onClick={() => setView(m === "beds" ? "grid" : "calendar")}
                  className={`rounded-md px-3 py-1.5 text-[11px] ${view !== "list" ? "bg-white font-bold text-teal-700 shadow-sm" : "text-slate-400"}`}
                >
                  {tr(m === "beds" ? "Beds" : "Calendar")}
                </button>
              </div>
            )}
            <button
              aria-label={tr("Filter")}
              aria-expanded={filter}
              onClick={() => setFilter(!filter)}
              className={`rounded-lg border p-2.5 ${filter ? "border-teal-300 bg-teal-50 text-teal-700" : "border-slate-200 text-slate-400"}`}
            >
              <Filter size={15} />
            </button>
            <button
              aria-label={tr("Refresh")}
              onClick={refresh}
              disabled={loading}
              className="rounded-lg border border-slate-200 p-2.5 text-slate-400"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
        {filter && (
          <div className="flex flex-wrap gap-3 border-b border-slate-100 bg-slate-50 p-4">
            <Select
              aria-label={tr("Status")}
              className="max-w-52"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">{tr("All statuses")}</option>
              {mod.statuses.map((s) => (
                <option key={s} value={s}>
                  {tr(s)}
                </option>
              ))}
            </Select>
            {mod.fields.some((f) => f.key === "department") && (
              <Select
                aria-label={tr("Department")}
                className="max-w-52"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              >
                <option value="">{tr("All departments")}</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {tr(d)}
                  </option>
                ))}
              </Select>
            )}
          </div>
        )}
        {view === "calendar" ? (
          <div className="p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <Btn
                variant="secondary"
                onClick={() => {
                  const d = new Date(day + "T12:00");
                  d.setDate(d.getDate() - 1);
                  setDay(d.toLocaleDateString("en-CA"));
                }}
              >
                <ChevronLeft size={16} />
              </Btn>
              <div className="flex items-center gap-3">
                <Input
                  type="date"
                  aria-label={tr("Date")}
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                />
                <Btn variant="ghost" onClick={() => setDay(today())}>
                  {tr("Today")}
                </Btn>
              </div>
              <Btn
                variant="secondary"
                onClick={() => {
                  const d = new Date(day + "T12:00");
                  d.setDate(d.getDate() + 1);
                  setDay(d.toLocaleDateString("en-CA"));
                }}
              >
                <ChevronRight size={16} />
              </Btn>
            </div>
            <div className="space-y-0">
              {Array.from({ length: 13 }, (_, i) => i + 8).map((hour) => {
                const slots = rows.filter(
                  (r) =>
                    String(r.scheduledAt).slice(0, 10) === day &&
                    Number(String(r.scheduledAt).slice(11, 13)) === hour,
                );
                return (
                  <div
                    key={hour}
                    className="flex min-h-20 gap-4 border-t border-slate-100 py-3"
                  >
                    <div className="w-14 shrink-0 pt-2 text-[11px] text-slate-400">
                      {String(hour).padStart(2, "0")}:00
                    </div>
                    <div className="grid flex-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {slots.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => open("detail", r)}
                          className="rounded-xl border-s-[3px] border-teal-600 bg-teal-50 px-3 py-3 text-start"
                        >
                          <div className="text-xs font-bold text-teal-900">
                            {lookup(r.patientId)}
                          </div>
                          <div className="mt-1 text-[10px] text-teal-700">
                            {String(r.scheduledAt).slice(11, 16)} ·{" "}
                            {lookup(r.staffId)}
                          </div>
                          <div className="mt-2">
                            <Badge value={r.status} lang={lang} />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : view === "grid" ? (
          <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
            {sorted.map((r) => (
              <button
                onClick={() => open("detail", r)}
                key={r.id}
                className={`rounded-2xl border p-5 text-start transition-shadow hover:shadow-md ${r.status === "Available" ? "border-teal-200 bg-teal-50/40" : r.status === "Occupied" ? "border-blue-100 bg-blue-50/40" : "border-slate-200 bg-slate-50"}`}
              >
                <div className="mb-4 flex items-center justify-between">
                  <span
                    className={
                      r.status === "Available"
                        ? "text-teal-600"
                        : "text-blue-500"
                    }
                  >
                    <BedDouble size={23} />
                  </span>
                  <b className="text-sm text-slate-800">{r.name}</b>
                </div>
                <Badge value={r.status} lang={lang} />
                <p className="mt-3 text-[11px] text-slate-500">
                  {String(r.ward)} · {tr("Room")} {String(r.room)}
                </p>
                <p className="mt-2 truncate text-xs font-semibold text-slate-700">
                  {r.patientId ? lookup(r.patientId) : tr(String(r.bedType))}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50/60 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  <tr>
                    {columns[m].map((c) => (
                      <th
                        key={c.key}
                        className="whitespace-nowrap px-5 py-4 text-start"
                      >
                        <button
                          onClick={() => {
                            if (sort === c.key) setDesc(!desc);
                            else {
                              setSort(c.key);
                              setDesc(false);
                            }
                          }}
                          className="flex items-center gap-1.5"
                        >
                          {tr(c.label)}
                          <ChevronDown size={11} />
                        </button>
                      </th>
                    ))}
                    <th className="px-5 py-4 text-start">{tr("Status")}</th>
                    <th className="px-5 py-4 text-end">{tr("Actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {current.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70">
                      {columns[m].map((c, i) => {
                        let v = r[c.key];
                        if (c.key === "patientId" || c.key === "staffId")
                          v = lookup(v);
                        else if (
                          c.key === "amount" ||
                          (m === "billing" && c.key === "paid")
                        )
                          v = money(v, lang);
                        else if (
                          [
                            "dob",
                            "expiry",
                            "scheduledAt",
                            "updatedAt",
                          ].includes(c.key)
                        )
                          v = date(v, lang, c.key === "scheduledAt");
                        else if (c.key === "scheduleStart")
                          v = String(v) + " - " + String(r.scheduleEnd);
                        else v = tr(String(v ?? "—"));
                        return (
                          <td key={c.key} className="px-5 py-4 text-xs">
                            <button
                              className={`flex items-center gap-3 text-start ${i === 0 ? "font-semibold text-slate-800" : "text-slate-500"}`}
                              onClick={() => open("detail", r)}
                            >
                              {i === 0 &&
                                ["patients", "staff", "appointments"].includes(
                                  m,
                                ) && <Avatar name={v} />}
                              <span className="max-w-60">
                                <span className="block min-w-16">
                                  {String(v || "—")}
                                </span>
                                {i === 0 && (
                                  <span className="mt-1 block font-normal text-[9px] text-slate-400">
                                    #{r.id.slice(0, 8).toUpperCase()}
                                  </span>
                                )}
                                {i === 0 && r.demo === true && (
                                  <span className="mt-1 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-600">
                                    {tr("Demo")}
                                  </span>
                                )}
                              </span>
                            </button>
                          </td>
                        );
                      })}
                      <td className="px-5 py-4">
                        <Badge value={r.status} lang={lang} />
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => open("detail", r)}
                            aria-label={`${tr("View record")} ${r.name}`}
                            className="rounded-lg p-2 text-slate-400 hover:bg-teal-50 hover:text-teal-700"
                          >
                            <Eye size={15} />
                          </button>
                          {can(role, m, true) &&
                            !(m === "emr" && r.status === "Signed") && (
                              <button
                                onClick={() => open("edit", r)}
                                aria-label={`${tr("Edit")} ${r.name}`}
                                className="rounded-lg p-2 text-slate-400 hover:bg-teal-50 hover:text-teal-700"
                              >
                                <Pencil size={14} />
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!current.length && (
                <Empty
                  title={tr("No records found")}
                  subtitle={tr("Try another search or add your first record.")}
                />
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 text-[10px] text-slate-400">
              <span>
                {tr("Showing")}{" "}
                {sorted.length ? (Math.min(page, pages) - 1) * 8 + 1 : 0}–
                {Math.min(Math.min(page, pages) * 8, sorted.length)} {tr("of")}{" "}
                {sorted.length} {tr("Records")}
              </span>
              <div className="flex items-center gap-1">
                <button
                  disabled={page === 1}
                  aria-label={tr("Previous")}
                  onClick={() => setPage(page - 1)}
                  className="rounded-lg border border-slate-200 p-2 disabled:opacity-30"
                >
                  <ChevronLeft size={13} />
                </button>
                {Array.from({ length: pages }, (_, i) => i + 1)
                  .slice(0, 7)
                  .map((p) => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`h-7 min-w-7 rounded-lg px-2 ${Math.min(page, pages) === p ? "bg-teal-700 font-bold text-white" : "text-slate-400 hover:bg-slate-50"}`}
                    >
                      {p}
                    </button>
                  ))}
                <button
                  disabled={page >= pages}
                  aria-label={tr("Next")}
                  onClick={() => setPage(page + 1)}
                  className="rounded-lg border border-slate-200 p-2 disabled:opacity-30"
                >
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </>
  );
}
function RecordForm({
  role,
  module: m,
  record,
  records,
  lang,
  busy,
  onClose,
  onSave,
}: {
  role: string;
  module: ModuleKey;
  record?: RecordData;
  records: RecordData[];
  lang: string;
  busy: boolean;
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => void;
}) {
  const tr = (s: string) => t(s, lang);
  const [data, setData] = useState<Record<string, any>>(() => {
    const defaults: Record<string, any> = {
      status: modules[m].statuses[0],
      ...(m === "staff"
        ? {
            scheduleStart: "08:00",
            scheduleEnd: "17:00",
            workingDays: "0,1,2,3,4",
          }
        : {}),
      ...(m === "appointments"
        ? {
            duration: "30",
            priority: "Routine",
            scheduledAt: today() + "T10:00",
          }
        : {}),
      ...(m === "lab"
        ? {
            kind: "Laboratory",
            priority: "Routine",
            scheduledAt: today() + "T09:00",
          }
        : {}),
      ...(m === "pharmacy" ? { stock: 0, reorder: 10 } : {}),
      ...(m === "billing"
        ? { dueDate: today(), claimStatus: "Not applicable" }
        : {}),
    };
    return { ...defaults, ...record };
  });
  const locked = m === "emr" && record?.status === "Signed";
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(data);
      }}
      className="space-y-5"
    >
      {m === "patients" && role === "reception" && (
        <div className="flex items-center gap-2 rounded-xl bg-blue-50 p-3 text-xs text-blue-800">
          <ShieldCheck size={16} className="shrink-0" />
          {tr(
            "Registration details only. Protected patient fields are managed by the clinical team.",
          )}
        </div>
      )}
      {m === "emr" && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-700">
          <LockKeyhole size={16} />
          {tr(
            "Clinical signing is final. Add a new encounter for corrections.",
          )}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {modules[m].fields
          .filter((f) => m !== "patients" || canAccessPatientField(role, f.key))
          .map((f) => (
            <label
              className={`block ${f.type === "textarea" ? "sm:col-span-2" : ""}`}
              key={f.key}
            >
              <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">
                {lang === "ar" ? f.ar : f.label}
                {f.required && <span className="ms-1 text-rose-400">*</span>}
              </span>
              {f.ref ? (
                <Select
                  disabled={locked}
                  required={f.required}
                  value={data[f.key] ?? ""}
                  onChange={(e) =>
                    setData({ ...data, [f.key]: e.target.value })
                  }
                >
                  <option value="">{tr("Select...")}</option>
                  {records
                    .filter(
                      (r) =>
                        r.module === f.ref &&
                        (f.key !== "staffId" ||
                          m !== "appointments" ||
                          r.job === "Doctor"),
                    )
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                        {r.specialty ? " · " + r.specialty : ""}
                      </option>
                    ))}
                </Select>
              ) : f.options ? (
                <Select
                  disabled={locked}
                  required={f.required}
                  value={data[f.key] ?? ""}
                  onChange={(e) =>
                    setData({ ...data, [f.key]: e.target.value })
                  }
                >
                  <option value="">{tr("Select...")}</option>
                  {(f.key === "department"
                    ? records
                        .filter((r) => r.module === "departments")
                        .map((r) => r.name)
                    : f.options
                  ).map((o) => (
                    <option key={o} value={o}>
                      {tr(o)}
                    </option>
                  ))}
                </Select>
              ) : f.type === "textarea" ? (
                <textarea
                  disabled={locked}
                  rows={3}
                  maxLength={10000}
                  required={f.required}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20"
                  value={data[f.key] ?? ""}
                  onChange={(e) =>
                    setData({ ...data, [f.key]: e.target.value })
                  }
                />
              ) : (
                <Input
                  disabled={locked}
                  required={f.required}
                  maxLength={f.type === "text" ? 500 : undefined}
                  type={f.type || "text"}
                  min={f.type === "number" ? 0 : undefined}
                  step={f.type === "number" ? "any" : undefined}
                  value={data[f.key] ?? ""}
                  onChange={(e) =>
                    setData({ ...data, [f.key]: e.target.value })
                  }
                />
              )}
            </label>
          ))}
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">
            {tr("Status")} *
          </span>
          <Select
            disabled={locked}
            required
            value={data.status}
            onChange={(e) => setData({ ...data, status: e.target.value })}
          >
            {modules[m].statuses.map((s) => (
              <option key={s} value={s}>
                {tr(s)}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
        <Btn variant="secondary" onClick={onClose} type="button">
          {tr("Cancel")}
        </Btn>
        <Btn type="submit" disabled={busy || locked}>
          {busy ? (
            <LoaderCircle size={16} className="animate-spin" />
          ) : (
            <Check size={16} />
          )}{" "}
          {tr(record ? "Save changes" : "Create record")}
        </Btn>
      </div>
    </form>
  );
}
function RecordDetail({
  record: r,
  records,
  lang,
  role,
  open,
}: {
  record: RecordData;
  records: RecordData[];
  lang: string;
  role: string;
  open: (m: { kind: string; module?: ModuleKey; record?: RecordData }) => void;
}) {
  useEffect(() => {
    api("/access/" + r.module + "/" + r.id, "POST").catch(() => {});
  }, [r.id]);
  const tr = (s: string) => t(s, lang),
    mod = modules[r.module],
    lookup = (id: unknown) => records.find((r) => r.id === id)?.name || "—",
    linked = records
      .filter((x) => x.patientId === r.id || x.staffId === r.id)
      .sort((a, b) =>
        String(b.scheduledAt || b.updatedAt).localeCompare(
          String(a.scheduledAt || a.updatedAt),
        ),
      );
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-4">
          <Avatar name={r.name} />
          <div>
            <div className="mb-2 text-xs text-slate-400">
              {tr(mod.title)} · #{r.id.slice(0, 8).toUpperCase()}
            </div>
            <Badge value={r.status} lang={lang} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {can(role, r.module, true) &&
            !(r.module === "emr" && r.status === "Signed") && (
              <Btn
                variant="secondary"
                onClick={() =>
                  open({ kind: "edit", module: r.module, record: r })
                }
              >
                <Pencil size={14} />
                {tr("Edit")}
              </Btn>
            )}
          <Btn variant="secondary" onClick={() => window.print()}>
            <Printer size={14} />
            {tr("Print / PDF")}
          </Btn>
          {role === "admin" && (
            <button
              aria-label={tr("Delete")}
              onClick={() =>
                open({ kind: "delete", module: r.module, record: r })
              }
              className="rounded-xl border border-rose-100 p-2.5 text-rose-500"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
      {r.module === "patients" && (
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ["Allergies", r.allergies],
            ["Chronic conditions", r.conditions],
          ].map(([k, v]) =>
            v ? (
              <div
                key={String(k)}
                className="rounded-xl border border-amber-100 bg-amber-50 p-4"
              >
                <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">
                  {tr(String(k))}
                </p>
                <p className="mt-2 text-sm text-slate-700">{String(v)}</p>
              </div>
            ) : null,
          )}
        </div>
      )}
      <div className="grid gap-x-8 gap-y-5 rounded-2xl bg-slate-50 p-5 sm:grid-cols-2">
        {mod.fields
          .filter(
            (f) =>
              r[f.key] !== undefined &&
              r[f.key] !== "" &&
              f.key !== "name" &&
              !(
                r.module === "patients" &&
                ["allergies", "conditions"].includes(f.key)
              ),
          )
          .map((f) => {
            const v = r[f.key];
            return (
              <div
                key={f.key}
                className={f.type === "textarea" ? "sm:col-span-2" : ""}
              >
                <div className="mb-1.5 text-[10px] font-semibold text-slate-400">
                  {lang === "ar" ? f.ar : f.label}
                </div>
                <div className="whitespace-pre-wrap break-words text-xs leading-6 text-slate-700">
                  {f.ref ? (
                    lookup(v)
                  ) : f.type === "url" && String(v).startsWith("https://") ? (
                    <a
                      href={String(v)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-teal-700 underline"
                    >
                      {tr("Open")} <ExternalLink size={13} />
                    </a>
                  ) : f.key === "amount" ? (
                    money(v, lang)
                  ) : (
                    tr(String(v))
                  )}
                </div>
              </div>
            );
          })}
      </div>
      {r.module === "appointments" && (
        <Btn
          variant="secondary"
          onClick={() =>
            downloadAppointment(r, lookup(r.patientId), lookup(r.staffId))
          }
        >
          <CalendarDays size={16} />
          {lang === "ar"
            ? "ضيف للتقويم مع تنبيه"
            : "Add to calendar with reminder"}
        </Btn>
      )}
      {can(role, r.module, true) && (
        <div className="flex flex-wrap gap-3">
          {r.module === "billing" &&
            Number(r.paid || 0) < Number(r.amount) &&
            !["Draft", "Void"].includes(r.status) && (
              <Btn
                onClick={() =>
                  open({ kind: "payment", module: r.module, record: r })
                }
              >
                <CreditCard size={16} />
                {tr("Record payment")}
              </Btn>
            )}
          {r.module === "pharmacy" && (
            <Btn
              onClick={() =>
                open({ kind: "dispense", module: r.module, record: r })
              }
            >
              <PackageCheck size={16} />
              {tr("Dispense medicine")}
            </Btn>
          )}
          {r.module === "beds" && r.status === "Occupied" && (
            <>
              <Btn
                onClick={() =>
                  open({ kind: "transfer", module: r.module, record: r })
                }
              >
                <ArrowLeftRight size={16} />
                {tr("Transfer patient")}
              </Btn>
              <Btn
                variant="secondary"
                onClick={() =>
                  open({ kind: "discharge", module: r.module, record: r })
                }
              >
                {tr("Discharge patient")}
              </Btn>
            </>
          )}
        </div>
      )}
      {r.module === "billing" && (
        <div>
          <div className="mb-5 grid grid-cols-3 gap-3">
            {[
              ["Total", r.amount],
              ["Paid", r.paid],
              ["Outstanding", Number(r.amount) - Number(r.paid || 0)],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-xl border border-slate-200 p-4"
              >
                <p className="text-[10px] text-slate-400">
                  {tr(String(label))}
                </p>
                <p className="mt-2 text-sm font-bold text-slate-800">
                  {money(value, lang)}
                </p>
              </div>
            ))}
          </div>
          <h3 className="mb-3 text-sm font-bold">{tr("Payment history")}</h3>
          {Array.isArray(r.payments) && r.payments.length ? (
            r.payments.map((p: any, i: number) => (
              <div
                key={i}
                className="flex justify-between border-t border-slate-100 py-3 text-xs"
              >
                <span>
                  {date(p.at, lang, true)} · {tr(p.method)}
                </span>
                <b>{money(p.amount, lang)}</b>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-400">
              {tr("No payments recorded")}
            </p>
          )}
        </div>
      )}
      {r.module === "hr" && r.kind === "Payroll" && (
        <div className="rounded-xl bg-teal-50 p-4 text-sm font-bold text-teal-800">
          {lang === "ar" ? "صافي المرتب" : "Net pay"}:{" "}
          {money(
            Number(r.amount || 0) +
              Number(r.bonus || 0) -
              Number(r.deduction || 0),
            lang,
          )}
        </div>
      )}
      {r.module === "patients" &&
        ["admin", "doctor", "nurse"].includes(role) && (
          <Documents
            patientId={r.id}
            lang={lang}
            writable={role === "admin" || role === "doctor"}
          />
        )}{" "}
      {["patients", "staff"].includes(r.module) && (
        <div>
          <h3 className="mb-4 text-sm font-bold text-slate-800">
            {tr(r.module === "patients" ? "Care timeline" : "Linked records")}
          </h3>
          {linked.length ? (
            <div className="space-y-3">
              {linked.map((x) => {
                const Icon = icons[x.module];
                return (
                  <button
                    key={x.id}
                    onClick={() =>
                      open({ kind: "detail", module: x.module, record: x })
                    }
                    className="flex w-full items-center gap-4 rounded-xl border border-slate-100 p-4 text-start hover:bg-slate-50"
                  >
                    <span className="rounded-xl bg-teal-50 p-2.5 text-teal-600">
                      <Icon size={17} />
                    </span>
                    <div className="flex-1">
                      <b className="text-xs text-slate-700">{x.name}</b>
                      <p className="mt-1.5 text-[10px] text-slate-400">
                        {tr(modules[x.module].title)} ·{" "}
                        {date(x.scheduledAt || x.updatedAt, lang, true)}
                      </p>
                    </div>
                    <Badge value={x.status} lang={lang} />
                    <ChevronRight size={14} />
                  </button>
                );
              })}
            </div>
          ) : (
            <Empty title={tr("No linked records yet")} subtitle="" />
          )}
        </div>
      )}
      <div className="border-t border-slate-100 pt-4 text-[10px] text-slate-400">
        {tr("Record ID")}: {r.id} · v{r.version} · {tr("Last updated")}:{" "}
        {date(r.updatedAt, lang, true)}
      </div>
    </div>
  );
}
function Workflow({
  kind,
  record: r,
  records,
  lang,
  busy,
  submit,
}: {
  kind: string;
  record: RecordData;
  records: RecordData[];
  lang: string;
  busy: boolean;
  submit: (b: Record<string, unknown>) => void;
}) {
  const tr = (s: string) => t(s, lang),
    [data, setData] = useState<Record<string, any>>({
      action: kind,
      method: "Cash",
      quantity: 1,
      amount: "",
    });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(data);
      }}
      className="space-y-5"
    >
      <div className="rounded-xl bg-teal-50 p-4 text-sm font-bold text-teal-800">
        {tr(
          {
            payment: "Record payment",
            dispense: "Dispense medicine",
            transfer: "Transfer patient",
            discharge: "Discharge patient",
          }[kind] || kind,
        )}
      </div>
      {kind === "payment" && (
        <>
          <p className="text-sm text-slate-500">
            {tr("Outstanding")}:{" "}
            <b>{money(Number(r.amount) - Number(r.paid || 0), lang)}</b>
          </p>
          <label className="block text-xs font-semibold">
            {tr("Amount (EGP)")}
            <Input
              className="mt-2"
              autoFocus
              required
              type="number"
              min="0.01"
              step="0.01"
              max={Number(r.amount) - Number(r.paid || 0)}
              value={data.amount}
              onChange={(e) => setData({ ...data, amount: e.target.value })}
            />
          </label>
          <label className="block text-xs font-semibold">
            {tr("Payment method")}
            <Select
              className="mt-2"
              value={data.method}
              onChange={(e) => setData({ ...data, method: e.target.value })}
            >
              {["Cash", "Card", "Bank transfer", "Insurance"].map((v) => (
                <option value={v} key={v}>
                  {tr(v)}
                </option>
              ))}
            </Select>
          </label>
          <p className="text-xs text-slate-400">
            {lang === "ar"
              ? "تسجيل دفعة تجريبية بس. مش بيتخصم أي مبلغ حقيقي."
              : "Records a fictional payment only. No real money is charged."}
          </p>
        </>
      )}
      {kind === "dispense" && (
        <>
          <label className="block text-xs font-semibold">
            {tr("Quantity")}
            <Input
              className="mt-2"
              required
              type="number"
              min="1"
              step="1"
              max={Number(r.stock)}
              value={data.quantity}
              onChange={(e) => setData({ ...data, quantity: e.target.value })}
            />
          </label>
          <label className="block text-xs font-semibold">
            {tr("Signed encounter ID")}
            <Select
              className="mt-2"
              required
              value={data.encounterId || ""}
              onChange={(e) =>
                setData({ ...data, encounterId: e.target.value })
              }
            >
              <option value="">{tr("Select...")}</option>
              {records
                .filter((x) => x.module === "emr" && x.status === "Signed")
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name} · #{x.id.slice(0, 8)}
                  </option>
                ))}
            </Select>
          </label>
          <p className="text-xs text-slate-400">
            {lang === "ar"
              ? "لازم رقم كشف موقّع فيه روشتة نشطة. الصرف بيتسجّل في سجل النشاط."
              : "Use a signed encounter with an active prescription. Dispensing is recorded in the audit trail."}
          </p>
        </>
      )}
      {kind === "transfer" && (
        <label className="block text-xs font-semibold">
          {tr("Destination bed")}
          <Select
            required
            className="mt-2"
            value={data.targetId || ""}
            onChange={(e) => setData({ ...data, targetId: e.target.value })}
          >
            <option value="">{tr("Select...")}</option>
            {records
              .filter((b) => b.module === "beds" && b.status === "Available")
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} · {String(b.ward)} · {tr("Room")} {String(b.room)}
                </option>
              ))}
          </Select>
        </label>
      )}
      {kind === "discharge" && (
        <p className="text-sm leading-7 text-slate-500">
          {lang === "ar"
            ? "المريض هيخرج والسرير هيتحوّل للتنظيف. الدخول السابق هيفضل محفوظ."
            : "The patient will be discharged and the bed will be marked for cleaning. The previous admission will be retained."}
        </p>
      )}
      <div className="flex justify-end">
        <Btn type="submit" disabled={busy}>
          <Check size={16} />
          {tr("Confirm")}
        </Btn>
      </div>
    </form>
  );
}
function Reports({ records, lang }: { records: RecordData[]; lang: string }) {
  const tr = (s: string) => t(s, lang),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const filtered = records.filter(
    (r) =>
      (!from || String(r.scheduledAt || r.createdAt).slice(0, 10) >= from) &&
      (!to || String(r.scheduledAt || r.createdAt).slice(0, 10) <= to),
  );
  const list = (m: string) => filtered.filter((r) => r.module === m);
  const total = list("billing")
      .filter((r) => r.status !== "Void")
      .reduce((s, r) => s + Number(r.amount), 0),
    paid = list("billing").reduce((s, r) => s + Number(r.paid || 0), 0);
  const status = modules.beds.statuses
    .map((s) => ({
      name: tr(s),
      value: list("beds").filter((r) => r.status === s).length,
    }))
    .filter((d) => d.value);
  const dept = departments.map((d) => ({
    name: tr(d),
    value: list("staff").filter((r) => r.department === d).length,
  }));
  const services = modules.lab.statuses.map((d) => ({
    name: tr(d),
    value: list("lab").filter((r) => r.status === d).length,
  }));
  const stats = [
    ["Revenue collected", money(paid, lang)],
    ["Unpaid balance", money(total - paid, lang)],
    [
      "Active inpatients",
      list("beds").filter((r) => r.status === "Occupied").length,
    ],
    [
      "Staff on duty",
      list("staff").filter((r) => r.status === "Available").length,
    ],
  ];
  const colors = ["#0d9488", "#60a5fa", "#fbbf24", "#94a3b8"];
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-slate-900">
            {tr("Reports & analytics")}
          </h1>
          <p className="mt-2 text-xs text-slate-400">
            {tr("Operational insights, grounded in your workspace.")}
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Btn
            variant="secondary"
            onClick={() => exportCSV(filtered, "reports")}
          >
            <Download size={15} />
            {tr("Export CSV")}
          </Btn>
          <Btn onClick={() => window.print()}>
            <Printer size={15} />
            {tr("Print / PDF")}
          </Btn>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 print:hidden">
        <CalendarDays size={18} className="text-slate-400" />
        <Input
          aria-label={lang === "ar" ? "من تاريخ" : "From date"}
          className="max-w-48"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <span className="text-xs text-slate-400">{tr("to")}</span>
        <Input
          aria-label={lang === "ar" ? "لحد تاريخ" : "To date"}
          className="max-w-48"
          type="date"
          value={to}
          min={from}
          onChange={(e) => setTo(e.target.value)}
        />
        <p className="ms-auto text-[10px] text-slate-400">
          {tr("Export is limited to the records your role can access.")}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border border-slate-200 bg-white p-5"
          >
            <p className="text-xs text-slate-400">{tr(String(label))}</p>
            <p className="mt-3 font-display text-2xl font-extrabold text-slate-900">
              {value}
            </p>
          </div>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title={tr("Bed status distribution")}>
          <div className="flex h-full items-center">
            <div className="h-full w-1/2" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={status}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={5}
                    isAnimationActive={false}
                  >
                    {status.map((_, i) => (
                      <Cell key={i} fill={colors[i % 4]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-4">
              {status.map((s, i) => (
                <div key={s.name} className="flex items-center gap-3 text-xs">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: colors[i % 4] }}
                  />
                  <span className="text-slate-500">{s.name}</span>
                  <b>{s.value}</b>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>
        <ChartCard title={tr("Team by department")}>
          <div className="h-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dept}
                layout="vertical"
                margin={{ left: 0, right: 20, bottom: 0, top: 0 }}
              >
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={115}
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip />
                <Bar
                  dataKey="value"
                  name={tr("Care team")}
                  fill="#0d9488"
                  radius={[0, 4, 4, 0]}
                  barSize={14}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
        <ChartCard title={tr("Service activity")}>
          <div className="h-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={services} margin={{ left: -20, right: 10 }}>
                <CartesianGrid
                  strokeDasharray="3 5"
                  vertical={false}
                  stroke="#f0f3f6"
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip />
                <Bar
                  dataKey="value"
                  name={tr("Laboratory requests")}
                  fill="#60a5fa"
                  radius={[5, 5, 0, 0]}
                  maxBarSize={45}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
        <ChartCard title={tr("Patient status")}>
          <div className="space-y-5 pt-3">
            {modules.patients.statuses.map((s, i) => {
              const count = list("patients").filter(
                (r) => r.status === s,
              ).length;
              return (
                <div key={s}>
                  <div className="mb-2 flex justify-between text-xs">
                    <span>{tr(s)}</span>
                    <b>{count}</b>
                  </div>
                  <div className="h-3 rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full"
                      style={{
                        backgroundColor: colors[i],
                        width: `${(count / Math.max(1, list("patients").length)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </ChartCard>
      </div>
    </>
  );
}
function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-6">
      <h3 className="mb-5 text-sm font-bold text-slate-800">{title}</h3>
      <div className="h-60">{children}</div>
    </section>
  );
}
function Audit({ lang, role }: { lang: string; role: string }) {
  const tr = (s: string) => t(s, lang),
    [logs, setLogs] = useState<any[]>([]),
    [error, setError] = useState(""),
    [query, setQuery] = useState("");
  useEffect(() => {
    api("/audit")
      .then((r) => setLogs(r.logs))
      .catch((e) => setError(e.message));
  }, []);
  if (!["admin", "auditor"].includes(role))
    return <Empty title={tr("No access")} subtitle="" />;
  const rows = logs.filter((l) =>
    Object.values(l).join(" ").toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-slate-900">
            {tr("Audit trail")}
          </h1>
          <p className="mt-2 text-xs text-slate-400">
            {tr("Sensitive record reads and changes are recorded.")}
          </p>
        </div>
        <Btn
          variant="secondary"
          disabled={!rows.length}
          onClick={() => exportCSV(rows, "audit")}
        >
          <Download size={15} />
          {tr("Export CSV")}
        </Btn>
      </div>
      {error && (
        <p role="alert" className="text-rose-600">
          {tr(error)}
        </p>
      )}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-4">
          <Input
            placeholder={tr("Search records...")}
            className="max-w-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase text-slate-400">
              <tr>
                {["Date", "Actor", "Role", "Action", "Module", "Record ID"].map(
                  (v) => (
                    <th key={v} className="px-5 py-4 text-start">
                      {tr(v)}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-500">
                    {date(r.created_at, lang, true)}
                  </td>
                  <td className="px-5 py-4 font-semibold">{r.actor}</td>
                  <td className="px-5 py-4 capitalize">{r.role}</td>
                  <td className="px-5 py-4">
                    <Badge value={r.action} lang={lang} />
                  </td>
                  <td className="px-5 py-4">
                    {tr(modules[r.module as ModuleKey]?.title || r.module)}
                  </td>
                  <td className="px-5 py-4 text-slate-400">
                    {r.record_id?.slice(0, 8) || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
function SettingsPage({
  session,
  lang,
  setLang,
  onLogout,
  execute,
  hasDemo,
}: {
  session: Session;
  lang: string;
  setLang: (s: string) => void;
  onLogout: () => void;
  execute: (fn: () => Promise<any>, message?: string) => void;
  hasDemo: boolean;
}) {
  const tr = (s: string) => t(s, lang),
    [days, setDays] = useState(session.workspace?.retention_days || 90);
  return (
    <>
      <div>
        <h1 className="font-display text-2xl font-extrabold text-slate-900">
          {tr("Settings")}
        </h1>
        <p className="mt-2 text-xs text-slate-400">
          {tr("Your role controls what you can see and change.")}
        </p>
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h3 className="mb-6 text-sm font-bold text-slate-800">
              {tr("Account")}
            </h3>
            <div className="mb-6 flex items-center gap-4">
              <Avatar name={session.user.name} />
              <div>
                <p className="text-sm font-bold">{session.user.name}</p>
                <p className="mt-1 text-xs capitalize text-slate-400">
                  {tr(
                    session.user.role.charAt(0).toUpperCase() +
                      session.user.role.slice(1),
                  )}
                </p>
              </div>
              <Btn className="ms-auto" variant="secondary" onClick={onLogout}>
                <LogOut size={15} />
                {tr("Sign out")}
              </Btn>
            </div>
            <label className="text-xs font-semibold">
              {tr("Language")}
              <Select
                className="mt-2"
                value={lang}
                onChange={(e) => setLang(e.target.value)}
              >
                <option value="en">English</option>
                <option value="ar">العربي المصري</option>
              </Select>
            </label>
          </section>
          {session.user.role === "admin" && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="mb-4 flex items-center justify-between gap-4">
                <h3 className="text-sm font-bold text-slate-800">
                  {tr("Demo mode")}
                </h3>
                <button
                  role="switch"
                  aria-checked={hasDemo}
                  aria-label={tr("Demo mode")}
                  onClick={() =>
                    execute(
                      () => api("/settings/demo", "POST", { on: !hasDemo }),
                      hasDemo ? "Demo data removed" : "Demo data added",
                    )
                  }
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${hasDemo ? "bg-teal-600" : "bg-slate-300"}`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${hasDemo ? "start-[22px]" : "start-0.5"}`}
                  />
                </button>
              </div>
              <p className="text-xs leading-6 text-slate-500">
                {tr(
                  "Fill the workspace with realistic demo data so a client sees it populated. Demo rows are flagged, and turning demo mode off removes only those rows.",
                )}
              </p>
            </section>
          )}
          {session.user.role === "admin" && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <h3 className="mb-4 text-sm font-bold text-slate-800">
                {tr("Data retention")}
              </h3>
              <p className="mb-5 text-xs leading-6 text-slate-500">
                {tr(
                  "Retention is a review policy, not automatic deletion. Clinical records are never silently purged.",
                )}
              </p>
              <label className="text-xs font-semibold">
                {tr("Retention days")}
                <Input
                  className="mb-4 mt-2 max-w-48"
                  type="number"
                  min="7"
                  max="3650"
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                />
              </label>
              <Btn
                onClick={() =>
                  execute(
                    () => api("/settings", "PUT", { retentionDays: days }),
                    "Retention policy saved",
                  )
                }
              >
                {tr("Save policy")}
              </Btn>
            </section>
          )}
          {session.user.role === "admin" && (
            <Team lang={lang} session={session} />
          )}
        </div>
        <section className="rounded-2xl border border-teal-100 bg-teal-50/40 p-6">
          <h3 className="mb-6 flex items-center gap-2 text-sm font-bold text-slate-800">
            <ShieldCheck size={19} className="text-teal-600" />
            {tr("Security & privacy")}
          </h3>
          {[
            ["Encrypted sensitive records", "Clinical data encrypted at rest"],
            ["Role", "Your role controls what you can see and change."],
            [
              "Activity logging",
              "Sensitive record reads and changes are recorded.",
            ],
            [
              "Regulatory readiness",
              "This demonstration is not certified for healthcare compliance. Real deployment needs a legal, clinical and security review.",
            ],
          ].map(([a, b]) => (
            <div key={a} className="mb-6">
              <h4 className="mb-1.5 text-xs font-bold text-slate-700">
                {tr(a)}
              </h4>
              <p className="text-xs leading-6 text-slate-500">{tr(b)}</p>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
function Team({ lang, session }: { lang: string; session: Session }) {
  const tr = (s: string) => t(s, lang),
    [users, setUsers] = useState<any[]>([]),
    [show, setShow] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (!session.user.name.startsWith("Demo "))
      api("/users")
        .then((r) => setUsers(r.users))
        .catch((e) => setMessage(e.message));
  }, []);
  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const b = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await api("/users", "POST", b);
      setUsers((await api("/users")).users);
      setShow(false);
      setMessage(tr("User created"));
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex justify-between">
        <h3 className="text-sm font-bold">{tr("Access & team")}</h3>
        {!session.user.name.startsWith("Demo ") && (
          <button
            className="text-xs font-bold text-teal-700"
            onClick={() => setShow(!show)}
          >
            {tr("Add user")}
          </button>
        )}
      </div>
      {message && (
        <p role="status" className="mb-3 text-xs text-teal-700">
          {tr(message)}
        </p>
      )}
      {session.user.name.startsWith("Demo ") ? (
        <p className="text-xs leading-6 text-slate-400">
          {tr(
            "No users in this demo session. Create a private account to manage your team.",
          )}
        </p>
      ) : (
        <>
          {users.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between border-t border-slate-100 py-3 text-xs"
            >
              <div>
                <b>{u.name}</b>
                <p className="mt-1 text-slate-400">{u.email}</p>
              </div>
              {u.role === "admin" ? (
                <span className="text-slate-500">{u.role}</span>
              ) : (
                <div className="flex items-center gap-2">
                  <Select
                    aria-label={"Role for " + u.name}
                    value={u.role}
                    onChange={async (e) => {
                      try {
                        await api("/users/" + u.id, "PUT", {
                          role: e.target.value,
                        });
                        setUsers((await api("/users")).users);
                        setMessage(
                          lang === "ar"
                            ? "اتغيّرت الصلاحية والجلسات القديمة اتقفلت"
                            : "Role updated and previous sessions revoked",
                        );
                      } catch (e) {
                        setMessage((e as Error).message);
                      }
                    }}
                  >
                    {roles
                      .filter((r) => r !== "admin")
                      .map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                  </Select>
                  <button
                    aria-label={"Remove " + u.name}
                    className="p-2 text-rose-500"
                    onClick={async () => {
                      if (
                        !confirm(
                          lang === "ar"
                            ? "تحذف المستخدم ده؟"
                            : "Remove this user?",
                        )
                      )
                        return;
                      try {
                        await api("/users/" + u.id, "DELETE");
                        setUsers((await api("/users")).users);
                      } catch (e) {
                        setMessage((e as Error).message);
                      }
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </div>
          ))}
          {show && (
            <form className="mt-4 space-y-3" onSubmit={add}>
              <Input
                name="name"
                placeholder={tr("Display name")}
                required
                maxLength={100}
              />
              <Input
                name="email"
                type="email"
                placeholder={tr("Email address")}
                required
              />
              <Input
                name="password"
                type="password"
                placeholder={tr("Temporary password")}
                required
                minLength={12}
                maxLength={128}
              />
              <Select name="role">
                {roles
                  .filter((r) => r !== "admin")
                  .map((r) => (
                    <option value={r} key={r}>
                      {tr(r.charAt(0).toUpperCase() + r.slice(1))}
                    </option>
                  ))}
              </Select>
              <p className="text-xs leading-5 text-slate-400">
                {tr("Securely share credentials yourself. No email is sent.")}
              </p>
              <Btn type="submit">{tr("Add user")}</Btn>
            </form>
          )}
        </>
      )}
    </section>
  );
}
function Login({
  lang,
  setLang,
  onLogin,
}: {
  lang: string;
  setLang: (s: string) => void;
  onLogin: (s: Session) => void;
}) {
  const tr = (s: string) => t(s, lang),
    [register, setRegister] = useState(false),
    [demoRole, setDemoRole] = useState("admin"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function auth(path: string, b: unknown) {
    setBusy(true);
    setError("");
    try {
      onLogin(await api("/auth/" + path, "POST", b));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-slate-900 lg:flex lg:flex-col lg:justify-between">
        <img
          src="/care-team.jpg"
          alt={
            lang === "ar"
              ? "فريق طبي في المستشفى"
              : "Clinical team in a hospital"
          }
          className="absolute inset-0 h-full w-full object-cover opacity-50"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-teal-950 via-teal-950/30 to-transparent" />
        <div className="relative z-10 flex items-center gap-3 p-10 text-white">
          <HeartPulse size={32} />
          <span className="font-display text-3xl font-extrabold">
            carehouse.
          </span>
        </div>
        <div className="relative z-10 p-12">
          <span className="rounded-full border border-white/30 bg-white/10 px-4 py-2 text-[10px] uppercase tracking-widest text-teal-100">
            HOSPITAL MANAGEMENT
          </span>
          <h1 className="mt-7 max-w-md font-display text-5xl font-extrabold leading-tight text-white">
            {tr("Care that connects.")}
          </h1>
          <p className="mt-5 max-w-md text-base leading-8 text-teal-50/80">
            {tr("One workspace for every moment of care.")}{" "}
            {tr("Patients, people and operations. Finally, together.")}
          </p>
          <div className="mt-10 space-y-3">
            {[
              "Protected by role-based access",
              "Encrypted sensitive records",
              "Audited clinical workflows",
            ].map((s) => (
              <div
                className="flex items-center gap-3 text-xs text-white/80"
                key={s}
              >
                <CheckCircle2 size={17} className="text-teal-300" />
                {tr(s)}
              </div>
            ))}
          </div>
          <p className="mt-12 text-[10px] text-white/40">
            {tr("Built for demonstration, not clinical use.")}
          </p>
        </div>
      </section>
      <section className="relative flex flex-col items-center justify-center px-6 py-16 sm:px-16">
        <a
          href="/"
          aria-label="Carehouse home"
          className="absolute start-6 top-6 inline-flex items-center gap-2 font-display text-lg font-extrabold text-slate-900 lg:hidden"
        >
          <HeartPulse size={22} className="text-teal-700" />
          <span dir="ltr">Carehouse.</span>
        </a>
        <button
          onClick={() => setLang(lang === "en" ? "ar" : "en")}
          className="absolute end-7 top-7 flex items-center gap-2 text-xs text-slate-500"
        >
          <Globe size={15} />
          {lang === "en" ? "العربية" : "English"}
        </button>
        <div className="w-full max-w-sm">
          <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
            <HeartPulse size={26} />
          </div>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-slate-900">
            {tr(register ? "Create account" : "Welcome back")}
          </h2>
          <p className="mb-8 mt-3 text-sm text-slate-400">
            {tr("Sign in to your care workspace")}
          </p>
          {error && (
            <p
              role="alert"
              className="mb-5 rounded-xl bg-rose-50 p-3 text-xs leading-6 text-rose-700"
            >
              {tr(error)}
            </p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              auth(
                register ? "register" : "login",
                Object.fromEntries(new FormData(e.currentTarget)),
              );
            }}
            className="space-y-5"
          >
            {register && (
              <label className="block text-xs font-semibold text-slate-600">
                {tr("Full name")}
                <Input
                  className="mt-2"
                  name="name"
                  required
                  maxLength={100}
                  autoComplete="name"
                />
              </label>
            )}
            <label className="block text-xs font-semibold text-slate-600">
              {tr("Email address")}
              <Input
                className="mt-2"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              {tr("Password")}
              <Input
                className="mt-2"
                name="password"
                type="password"
                required
                minLength={register ? 12 : 1}
                maxLength={128}
                autoComplete={register ? "new-password" : "current-password"}
                placeholder="••••••••••••"
              />
              {register && (
                <span className="mt-2 block text-[10px] font-normal text-slate-400">
                  {tr("Password must be at least 12 characters.")}
                </span>
              )}
            </label>
            <Btn className="w-full" type="submit" disabled={busy}>
              {busy ? (
                <LoaderCircle size={17} className="animate-spin" />
              ) : (
                <>
                  <span>{tr(register ? "Create account" : "Sign in")}</span>
                  <ArrowRight size={16} />
                </>
              )}
            </Btn>
          </form>
          <p className="mt-5 text-center text-xs text-slate-400">
            {tr(register ? "Already have an account?" : "New here?")}{" "}
            <button
              className="font-bold text-teal-700"
              onClick={() => {
                setRegister(!register);
                setError("");
              }}
            >
              {tr(register ? "Sign in" : "Create account")}
            </button>
          </p>
          <div className="my-7 flex items-center gap-4">
            <div className="h-px flex-1 bg-slate-100" />
            <span className="text-[10px] font-semibold text-slate-400">
              {tr("Try a private demo")}
            </span>
            <div className="h-px flex-1 bg-slate-100" />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <label className="mb-2 block text-[10px] font-semibold text-slate-500">
              {tr("Choose your role")}
            </label>
            <div className="flex gap-2">
              <Select
                aria-label={tr("Choose your role")}
                value={demoRole}
                onChange={(e) => setDemoRole(e.target.value)}
              >
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {tr(r.charAt(0).toUpperCase() + r.slice(1))}
                  </option>
                ))}
              </Select>
              <Btn
                variant="secondary"
                className="shrink-0"
                disabled={busy}
                onClick={() => auth("demo", { role: demoRole })}
              >
                {tr("Start demo")}
                <ArrowRight size={14} />
              </Btn>
            </div>
            <p className="mt-3 text-[10px] leading-5 text-slate-400">
              {tr("Every demo starts with its own fictional records.")}
            </p>
          </div>
          <p className="mt-6 flex items-start justify-center gap-2 text-center text-[10px] leading-5 text-slate-400">
            <ShieldCheck size={14} className="mt-0.5 shrink-0" />
            {tr("Fictional data only")}.{" "}
            {tr("Not for real patient data or clinical decisions.")}
          </p>
        </div>
      </section>
    </div>
  );
}
function Documents({
  patientId,
  lang,
  writable,
}: {
  patientId: string;
  lang: string;
  writable: boolean;
}) {
  const [files, setFiles] = useState<any[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const tr = (s: string) => t(s, lang);
  async function load() {
    try {
      setFiles((await api("/documents/" + patientId)).documents);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    load();
  }, [patientId]);
  return (
    <section>
      <h3 className="mb-4 text-sm font-bold">
        {lang === "ar" ? "مستندات المريض" : "Patient documents"}
      </h3>
      {error && (
        <p role="alert" className="mb-3 text-xs text-rose-600">
          {tr(error)}
        </p>
      )}
      {files.map((f) => (
        <div
          key={f.id}
          className="mb-2 flex items-center justify-between rounded-xl border border-slate-100 p-3 text-xs"
        >
          <a
            href={"/api/document/" + f.id}
            className="inline-flex items-center gap-2 text-teal-700"
          >
            <Download size={14} />
            {f.filename}
          </a>
          <span className="text-slate-400">
            {Math.ceil(f.byte_size / 1024)} KB
          </span>
        </div>
      ))}
      {writable && (
        <label className="mt-3 block rounded-xl border border-dashed border-slate-200 p-4 text-xs text-slate-500">
          {lang === "ar"
            ? "ارفع مستند تجريبي (PDF، PNG، JPEG، لحد 128 KB)"
            : "Upload a fictional document (PDF, PNG, JPEG, up to 128 KB)"}
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            disabled={busy}
            className="mt-3 block w-full text-xs file:me-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-2 file:font-semibold file:text-teal-700"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setBusy(true);
              setError("");
              try {
                const data = new FormData();
                data.append("file", file);
                const r = await fetch("/api/documents/" + patientId, {
                  method: "POST",
                  headers: { "X-CSRF-Token": csrf },
                  body: data,
                });
                if (!r.ok) throw Error(((await r.json()) as any).error);
                await load();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
      )}
    </section>
  );
}
function downloadAppointment(r: RecordData, patient: string, doctor: string) {
  const format = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const escape = (s: string) => s.replace(/\n/g, "\\n").replace(/[,;]/g, " ");
  const local = String(r.scheduledAt);
  const date = local.replace(/[-:]/g, "") + "00";
  const end = new Date(
    new Date(local + "Z").getTime() + Number(r.duration || 30) * 60000,
  )
    .toISOString()
    .slice(0, 19)
    .replace(/[-:]/g, "");
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Carehouse//Appointments//EN",
    "BEGIN:VEVENT",
    "UID:" + r.id + "@carehouse",
    "DTSTAMP:" + format(new Date()),
    "DTSTART;TZID=Africa/Cairo:" + date,
    "DTEND;TZID=Africa/Cairo:" + end,
    "SUMMARY:" + escape("Fictional appointment: " + patient),
    "DESCRIPTION:" +
      escape(r.name + " · " + doctor + " · Fictional demonstration only."),
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Appointment in 30 minutes",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([body], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "carehouse-appointment.ics";
  a.click();
  URL.revokeObjectURL(url);
}

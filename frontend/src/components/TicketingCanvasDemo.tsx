import React, { useMemo, useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Priority = "Low" | "Medium" | "High" | "Urgent";
type Status = "New" | "In Progress" | "Resolved" | "Closed";
type Role = "client" | "agent";
type Attachment = { id: string | number; name: string; url: string; type: string; size: number };
type Ticket = {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  status: Status;
  createdAt: string;
  updatedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  attachments?: Attachment[];
};
type Comment = {
  id: string;
  ticketId: string;
  authorRole: Role;
  message: string;
  createdAt: string;
  attachments?: Attachment[];
};
type User = { id: number; email: string; name?: string | null; role: "ADMIN" | "AGENT" | "CLIENT" } | null;

function getInitialApiBase(): string {
  try {
    const qs = new URLSearchParams(window.location.search);
    const fromQuery = qs.get("api");
    if (fromQuery) return fromQuery;
    const fromLS = localStorage.getItem("apiBase");
    if (fromLS) return fromLS;
    const win = window as any;
    if (win.API_BASE) return win.API_BASE;
  } catch (error) {
    console.warn("Failed to resolve API base from window", error);
  }
  return "http://localhost:4000";
}

function toApiPriority(p: Priority): "LOW" | "MEDIUM" | "HIGH" | "URGENT" {
  return ({ Low: "LOW", Medium: "MEDIUM", High: "HIGH", Urgent: "URGENT" } as const)[p];
}
function fromApiPriority(p: "LOW" | "MEDIUM" | "HIGH" | "URGENT"): Priority {
  return ({ LOW: "Low", MEDIUM: "Medium", HIGH: "High", URGENT: "Urgent" } as const)[p];
}
function toApiStatus(s: Status): "NEW" | "IN_PROGRESS" | "RESOLVED" | "CLOSED" {
  return ({
    New: "NEW",
    "In Progress": "IN_PROGRESS",
    Resolved: "RESOLVED",
    Closed: "CLOSED",
  } as const)[s];
}
function fromApiStatus(s: "NEW" | "IN_PROGRESS" | "RESOLVED" | "CLOSED"): Status {
  return ({
    NEW: "New",
    IN_PROGRESS: "In Progress",
    RESOLVED: "Resolved",
    CLOSED: "Closed",
  } as const)[s];
}
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const now = () => new Date().toISOString();
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString() : "—");
const isImage = (type: string) => type.startsWith("image/");

async function apiJson(path: string, opts: RequestInit = {}, token?: string) {
  const base = ((window as any).__API_BASE__ as string) || getInitialApiBase();
  const headers: Record<string, string> = { ...(opts.headers as Record<string, string>) };
  if (!(opts.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${base}${path}`, { credentials: "omit", ...opts, headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

function mapTicketFromApi(t: any): Ticket {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    priority: fromApiPriority(t.priority),
    status: fromApiStatus(t.status),
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    acknowledgedAt: t.acknowledgedAt || undefined,
    resolvedAt: t.resolvedAt || undefined,
    attachments: (t.attachments || []).map((a: any) => ({
      id: a.id,
      name: a.name,
      url: a.url,
      type: a.mimeType,
      size: a.size,
    })),
  };
}

const PILL: Record<string, string> = {
  Low: "bg-green-100 text-green-800",
  Medium: "bg-yellow-100 text-yellow-800",
  High: "bg-orange-100 text-orange-800",
  Urgent: "bg-red-100 text-red-800",
  New: "bg-gray-100 text-gray-800",
  "In Progress": "bg-blue-100 text-blue-800",
  Resolved: "bg-emerald-100 text-emerald-800",
  Closed: "bg-slate-200 text-slate-700",
};

export default function TicketingCanvasDemo() {
  const [API_BASE_STATE, setApiBase] = useState<string>(getInitialApiBase());
  useEffect(() => {
    (window as any).__API_BASE__ = API_BASE_STATE;
    try {
      localStorage.setItem("apiBase", API_BASE_STATE);
    } catch (error) {
      console.warn("Unable to persist API base", error);
    }
  }, [API_BASE_STATE]);

  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User>(null);
  const [role, setRole] = useState<Role>("client");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [commentsMap, setCommentsMap] = useState<Record<string, Comment[]>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<Status | "All">("All");
  const [filterPriority, setFilterPriority] = useState<Priority | "All">("All");
  const [tempStatus, setTempStatus] = useState<Status | "All">("All");
  const [tempPriority, setTempPriority] = useState<Priority | "All">("All");
  const [showFilters, setShowFilters] = useState(false);
  const [expandedTicket, setExpandedTicket] = useState<Ticket | null>(null);
  const [showNewMobile, setShowNewMobile] = useState(false);
  const [banner, setBanner] = useState<{ id: string; text: string; tone?: "success" | "error" } | null>(null);
  const [showApiModal, setShowApiModal] = useState(false);
  const newSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await apiJson("/health");
      } catch (error: any) {
        setBanner({
          id: "health",
          text: `API not reachable at ${API_BASE_STATE}. Click “API” to change the URL. (${error.message})`,
          tone: "error",
        });
      }
      try {
        const data = await apiJson(`/tickets`);
        const mapped: Ticket[] = data.map(mapTicketFromApi);
        setTickets(mapped);
        if (mapped.length > 0) setSelectedId(mapped[0].id);
      } catch (error: any) {
        setBanner({ id: "err", text: `Failed to load tickets: ${error.message}`, tone: "error" });
      }
    })();
  }, [API_BASE_STATE]);

  useEffect(() => {
    if (!selectedId && tickets.length > 0) setSelectedId(tickets[0].id);
  }, [tickets, selectedId]);

  const canSeeRoleToggle = currentUser?.role === "ADMIN";

  const selected = useMemo(
    () => (selectedId ? tickets.find((t) => t.id === selectedId) || null : null),
    [tickets, selectedId]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qNorm = normalize(query);
    return tickets
      .filter((t) => (filterStatus === "All" ? true : t.status === filterStatus))
      .filter((t) => (filterPriority === "All" ? true : t.priority === filterPriority))
      .filter((t) => {
        if (!q) return true;
        const idNorm = normalize(t.id);
        return (
          idNorm.includes(qNorm) ||
          t.id.toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.status.toLowerCase().includes(q) ||
          t.priority.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [tickets, query, filterStatus, filterPriority]);

  async function signIn(email: string, password: string) {
    try {
      const data = await apiJson("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setToken(data.token);
      setCurrentUser(data.user);
      if (data.user.role === "AGENT" || data.user.role === "ADMIN") setRole("agent");
    } catch (error: any) {
      setBanner({
        id: "login",
        text: `Login failed: ${error.message}. Click “API” and make sure the URL is correct and CORS allows this origin.`,
        tone: "error",
      });
    }
  }

  async function refreshTickets() {
    const data = await apiJson(`/tickets`, {}, token || undefined);
    const mapped: Ticket[] = data.map(mapTicketFromApi);
    setTickets(mapped);
  }

  async function createTicket(data: Pick<Ticket, "title" | "description" | "priority">, files: File[]) {
    try {
      const fd = new FormData();
      fd.append("title", data.title);
      fd.append("description", data.description);
      fd.append("priority", toApiPriority(data.priority));
      for (const f of files) fd.append("files", f);
      const base = ((window as any).__API_BASE__ as string) || getInitialApiBase();
      const res = await fetch(`${base}/tickets/multipart`, { method: "POST", body: fd });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const payload = await res.json();
      const t = mapTicketFromApi(payload.ticket ?? payload);
      setTickets((prev) => [t, ...prev]);
      setSelectedId(t.id);
      setBanner({ id: t.id, text: `Ticket ${t.id} created successfully`, tone: "success" });
      setTimeout(() => setBanner(null), 4000);
      if (showNewMobile) setShowNewMobile(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error: any) {
      setBanner({ id: "create", text: `Create failed: ${error.message}`, tone: "error" });
    }
  }

  async function updateStatus(id: string, status: Status) {
    try {
      if (!token) throw new Error("Please sign in as agent/admin");
      const body = { status: toApiStatus(status) };
      await apiJson(`/tickets/${id}/status`, { method: "PATCH", body: JSON.stringify(body) }, token);
      await refreshTickets();
    } catch (error: any) {
      setBanner({ id: "status", text: `Update failed: ${error.message}`, tone: "error" });
    }
  }

  async function fetchComments(ticketId: string) {
    try {
      const list = await apiJson(`/tickets/${ticketId}/comments`);
      const mapped: Comment[] = (list as any[]).map((c) => ({
        id: String(c.id),
        ticketId,
        authorRole: c.authorRole === "AGENT" || c.authorRole === "ADMIN" ? "agent" : "client",
        message: c.message,
        createdAt: c.createdAt,
      }));
      setCommentsMap((prev) => ({ ...prev, [ticketId]: mapped }));
    } catch (error) {
      console.warn("Failed to fetch comments", error);
    }
  }

  async function addComment(ticketId: string, message: string, files: File[]) {
    try {
      if (files.length) {
        const fd = new FormData();
        for (const f of files) fd.append("files", f);
        const base = ((window as any).__API_BASE__ as string) || getInitialApiBase();
        await fetch(`${base}/tickets/${ticketId}/comments/attachments`, { method: "POST", body: fd });
      }
      const authorRole = currentUser?.role === "AGENT" || currentUser?.role === "ADMIN" ? "AGENT" : "CLIENT";
      await apiJson(
        `/tickets/${ticketId}/comments`,
        { method: "POST", body: JSON.stringify({ message, authorRole }) },
        token || undefined
      );

      const local: Comment = {
        id: Math.random().toString(36).slice(2),
        ticketId,
        authorRole: authorRole === "AGENT" ? "agent" : "client",
        message,
        createdAt: now(),
        attachments: files.map((f) => ({
          id: f.name,
          name: f.name,
          url: URL.createObjectURL(f),
          type: f.type,
          size: f.size,
        })),
      };
      setCommentsMap((prev) => ({ ...prev, [ticketId]: [...(prev[ticketId] || []), local] }));
    } catch (error: any) {
      setBanner({ id: "comment", text: `Send failed: ${error.message}`, tone: "error" });
    }
  }

  useEffect(() => {
    if (selectedId) fetchComments(selectedId);
  }, [selectedId]);
  useEffect(() => {
    if (expandedTicket) fetchComments(expandedTicket.id);
  }, [expandedTicket]);

  function openNewTicketMobile() {
    setShowNewMobile(true);
    setTimeout(() => newSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  return (
    <div className="relative min-h-[80vh] bg-gray-50">
      {banner && (
        <div
          className={`fixed inset-x-0 top-0 z-50 mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-b-xl border p-3 shadow ${
            banner.tone === "error"
              ? "border-red-200 bg-red-100 text-red-900"
              : "border-green-200 bg-green-100 text-green-900"
          }`}
        >
          <div className="text-sm font-medium">
            {banner.tone === "error" ? "⚠️" : "✅"} {banner.text}
          </div>
          <button
            className="rounded-md border px-2 py-1 text-xs bg-white/70 hover:bg-white"
            onClick={() => setBanner(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      <header className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-4">
            <span className="text-lg font-semibold">ITTickets · Demo</span>
            <button
              type="button"
              onClick={() => setShowApiModal(true)}
              className="hidden md:inline text-xs text-gray-600 underline underline-offset-2"
            >
              API: {API_BASE_STATE}
            </button>
            <button
              className="md:hidden inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm shadow-sm"
              onClick={openNewTicketMobile}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              New Ticket
            </button>
            <a className="hidden md:inline text-sm text-gray-600 hover:underline" href="#new">
              New Ticket
            </a>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canSeeRoleToggle && <RoleTabs role={role} onChange={setRole} />}

            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tickets… (ID, title, desc)"
              className="rounded-lg border px-3 py-1.5 text-sm"
            />
            <button
              onClick={() => {
                setTempStatus(filterStatus);
                setTempPriority(filterPriority);
                setShowFilters(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              <FilterIcon /> Filters
            </button>

            {!token ? (
              <LoginMini onSignIn={signIn} />
            ) : (
              <span className="ml-2 inline-flex items-center gap-2 rounded-lg border px-2 py-1 text-xs text-gray-700">
                <span className="rounded bg-gray-900 px-2 py-0.5 text-white">{currentUser?.role}</span>
                {currentUser?.email}
                <button
                  className="rounded border px-2"
                  onClick={() => {
                    setToken(null);
                    setCurrentUser(null);
                  }}
                >
                  Sign out
                </button>
              </span>
            )}
            <button onClick={() => setShowApiModal(true)} className="ml-2 rounded border px-2 py-1 text-xs">
              API
            </button>
          </div>
        </div>
        {(filterPriority !== "All" || filterStatus !== "All" || query.trim()) && (
          <div className="mx-auto max-w-6xl px-4 pb-2 flex gap-2 flex-wrap">
            {query.trim() && <Tag onClear={() => setQuery("")}>Search: “{query.trim()}”</Tag>}
            {filterPriority !== "All" && (
              <Tag onClear={() => setFilterPriority("All")}>Priority: {filterPriority}</Tag>
            )}
            {filterStatus !== "All" && <Tag onClear={() => setFilterStatus("All")}>Status: {filterStatus}</Tag>}
            <button
              className="ml-auto rounded-full border px-3 py-1 text-xs hover:bg-gray-50"
              onClick={() => {
                setQuery("");
                setFilterPriority("All");
                setFilterStatus("All");
              }}
            >
              Clear all
            </button>
          </div>
        )}
      </header>

      {showFilters && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowFilters(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl border border-white/20 bg-white/70 p-4 shadow-2xl backdrop-blur-xl">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Filters</h3>
                <button onClick={() => setShowFilters(false)} className="rounded-lg border px-2 py-1 text-sm">
                  Close
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm">Priority</label>
                  <select
                    value={tempPriority}
                    onChange={(e) => setTempPriority(e.target.value as Priority | "All")}
                    className="w-full rounded-xl border border-gray-300 bg-white/80 px-3 py-2 shadow-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-900/15"
                  >
                    {["All", "Low", "Medium", "High", "Urgent"].map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm">Status</label>
                  <select
                    value={tempStatus}
                    onChange={(e) => setTempStatus(e.target.value as Status | "All")}
                    className="w-full rounded-xl border border-gray-300 bg-white/80 px-3 py-2 shadow-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-900/15"
                  >
                    {["All", "New", "In Progress", "Resolved", "Closed"].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setTempPriority("All");
                    setTempStatus("All");
                  }}
                  className="rounded-lg border px-3 py-1.5 text-sm"
                >
                  Reset
                </button>
                <button
                  onClick={() => {
                    setFilterPriority(tempPriority);
                    setFilterStatus(tempStatus);
                    setShowFilters(false);
                  }}
                  className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm text-white"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showApiModal && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowApiModal(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl border bg-white/90 p-4 shadow-2xl backdrop-blur">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-semibold">API Settings</h3>
                <button onClick={() => setShowApiModal(false)} className="rounded-lg border px-2 py-1 text-sm">
                  Close
                </button>
              </div>
              <label className="block text-sm font-medium text-gray-700" htmlFor="api-base">
                API base URL
              </label>
              <input
                id="api-base"
                value={API_BASE_STATE}
                onChange={(event) => setApiBase(event.target.value)}
                className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
              />
              <p className="mt-3 text-xs text-gray-600">
                Change the API origin here or by setting <code>window.API_BASE</code>,
                <code>localStorage.apiBase</code>, or the <code>?api=</code> query parameter.
              </p>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto grid max-w-6xl gap-4 px-4 py-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border bg-white shadow">
          <header className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-base font-semibold">Tickets</h2>
            <button onClick={refreshTickets} className="text-sm text-gray-600 hover:text-gray-900">
              Refresh
            </button>
          </header>
          <ul className="divide-y">
            {filtered.map((ticket) => (
              <li
                key={ticket.id}
                className={`cursor-pointer px-4 py-3 transition hover:bg-gray-50 ${
                  selectedId === ticket.id ? "bg-gray-100" : ""
                }`}
                onClick={() => setSelectedId(ticket.id)}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{ticket.title}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${PILL[ticket.priority]}`}>{ticket.priority}</span>
                </div>
                <p className="mt-1 text-sm text-gray-600">{ticket.description}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  <span>ID: {ticket.id}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${PILL[ticket.status]}`}>{ticket.status}</span>
                  <span>Created: {fmt(ticket.createdAt)}</span>
                  <span>Updated: {fmt(ticket.updatedAt)}</span>
                </div>
                <button
                  className="mt-2 text-sm text-indigo-600 hover:text-indigo-800"
                  onClick={() => setExpandedTicket(ticket)}
                >
                  View details
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-4" id="new" ref={newSectionRef}>
          <div className="rounded-2xl border bg-white p-4 shadow">
            <h2 className="text-base font-semibold">Selected ticket</h2>
            {selected ? (
              <div className="mt-2 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold">{selected.title}</span>
                  <StatusMenu
                    status={selected.status}
                    onChange={(value) => updateStatus(selected.id, value)}
                    disabled={!token}
                  />
                </div>
                <p className="text-gray-700">{selected.description}</p>
                <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${PILL[selected.priority]}`}>
                    {selected.priority}
                  </span>
                  <span>ID: {selected.id}</span>
                  <span>Created: {fmt(selected.createdAt)}</span>
                  <span>Updated: {fmt(selected.updatedAt)}</span>
                  {selected.acknowledgedAt && <span>Acknowledged: {fmt(selected.acknowledgedAt)}</span>}
                  {selected.resolvedAt && <span>Resolved: {fmt(selected.resolvedAt)}</span>}
                </div>
                {selected.attachments?.length ? (
                  <div className="mt-3 space-y-2">
                    <h3 className="text-sm font-medium">Attachments</h3>
                    <ul className="space-y-1">
                      {selected.attachments.map((attachment) => (
                        <li key={attachment.id}>
                          <a
                            href={attachment.url}
                            className="text-indigo-600 hover:text-indigo-800"
                            target="_blank"
                            rel="noreferrer"
                          >
                            {attachment.name}
                          </a>
                          <span className="ml-2 text-xs text-gray-500">({Math.round(attachment.size / 1024)} KB)</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mt-2 text-sm text-gray-600">Select a ticket to see its details.</p>
            )}
          </div>

          <CommentComposer onSubmit={addComment} ticketId={selected?.id ?? null} role={role} />

          <NewTicketForm
            hiddenOnMobile={!showNewMobile}
            onCloseMobile={() => setShowNewMobile(false)}
            onSubmit={createTicket}
          />
        </section>
      </main>

      <AnimatePresence>
        {expandedTicket && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setExpandedTicket(null)}
          >
            <motion.div
              className="relative h-full w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                className="absolute right-4 top-4 rounded-full border px-3 py-1 text-xs"
                onClick={() => setExpandedTicket(null)}
              >
                Close
              </button>
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold">{expandedTicket.title}</h2>
                  <p className="text-gray-600">{expandedTicket.description}</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${PILL[expandedTicket.priority]}`}>
                    {expandedTicket.priority}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${PILL[expandedTicket.status]}`}>
                    {expandedTicket.status}
                  </span>
                  <span>ID: {expandedTicket.id}</span>
                  <span>Created: {fmt(expandedTicket.createdAt)}</span>
                  <span>Updated: {fmt(expandedTicket.updatedAt)}</span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Conversation</h3>
                  <ul className="mt-2 space-y-2">
                    {(commentsMap[expandedTicket.id] || []).map((comment) => (
                      <li key={comment.id} className="rounded-lg border bg-gray-50 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase text-gray-500">{comment.authorRole}</span>
                          <span className="text-xs text-gray-400">{fmt(comment.createdAt)}</span>
                        </div>
                        <p className="mt-1 text-sm text-gray-700">{comment.message}</p>
                        {comment.attachments?.length ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {comment.attachments.map((attachment) => (
                              <a
                                key={attachment.id}
                                href={attachment.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 rounded border bg-white px-2 py-1 text-xs text-indigo-600"
                              >
                                {isImage(attachment.type) ? "🖼" : "📎"} {attachment.name}
                              </a>
                            ))}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RoleTabs({ role, onChange }: { role: Role; onChange: (value: Role) => void }) {
  return (
    <div className="inline-flex rounded-full border bg-white p-0.5 text-xs">
      {["client", "agent"].map((value) => (
        <button
          key={value}
          onClick={() => onChange(value as Role)}
          className={`rounded-full px-3 py-1 capitalize transition ${role === value ? "bg-gray-900 text-white" : "text-gray-600"}`}
        >
          {value}
        </button>
      ))}
    </div>
  );
}

function FilterIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 6h16M7 12h10M10 18h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LoginMini({ onSignIn }: { onSignIn: (email: string, password: string) => void }) {
  const [email, setEmail] = useState("agent@example.com");
  const [password, setPassword] = useState("password");

  return (
    <form
      className="flex items-center gap-2 text-xs"
      onSubmit={(event) => {
        event.preventDefault();
        onSignIn(email, password);
      }}
    >
      <input
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="email"
        className="w-36 rounded border px-2 py-1"
      />
      <input
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="password"
        type="password"
        className="w-28 rounded border px-2 py-1"
      />
      <button type="submit" className="rounded border px-2 py-1 text-xs">
        Sign in
      </button>
    </form>
  );
}

function Tag({ children, onClear }: { children: React.ReactNode; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
      {children}
      <button onClick={onClear} className="rounded-full border px-1">
        ×
      </button>
    </span>
  );
}

function StatusMenu({
  status,
  onChange,
  disabled,
}: {
  status: Status;
  onChange: (value: Status) => void;
  disabled: boolean;
}) {
  return (
    <select
      value={status}
      onChange={(event) => onChange(event.target.value as Status)}
      disabled={disabled}
      className="rounded border px-2 py-1 text-xs"
    >
      {["New", "In Progress", "Resolved", "Closed"].map((state) => (
        <option key={state} value={state}>
          {state}
        </option>
      ))}
    </select>
  );
}

function CommentComposer({
  ticketId,
  role,
  onSubmit,
}: {
  ticketId: string | null;
  role: Role;
  onSubmit: (ticketId: string, message: string, files: File[]) => Promise<void>;
}) {
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  return (
    <form
      className="rounded-2xl border bg-white p-4 shadow"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!ticketId) return;
        await onSubmit(ticketId, message, files);
        setMessage("");
        setFiles([]);
      }}
    >
      <h2 className="text-base font-semibold">Add comment</h2>
      <p className="text-xs text-gray-500">Posting as: {role}</p>
      <textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        className="mt-2 h-24 w-full rounded border px-3 py-2 text-sm"
        placeholder="Share an update..."
        required
      />
      <input
        type="file"
        multiple
        className="mt-2 text-xs"
        onChange={(event) => {
          const list = event.target.files;
          if (!list) return;
          setFiles(Array.from(list));
        }}
      />
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          className="rounded border px-3 py-1 text-xs"
          onClick={() => {
            setMessage("");
            setFiles([]);
          }}
        >
          Clear
        </button>
        <button
          type="submit"
          disabled={!ticketId}
          className="rounded bg-gray-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </form>
  );
}

function NewTicketForm({
  onSubmit,
  onCloseMobile,
  hiddenOnMobile,
}: {
  onSubmit: (data: Pick<Ticket, "title" | "description" | "priority">, files: File[]) => Promise<void>;
  onCloseMobile: () => void;
  hiddenOnMobile: boolean;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("Medium");
  const [files, setFiles] = useState<File[]>([]);

  return (
    <form
      className={`rounded-2xl border bg-white p-4 shadow transition ${hiddenOnMobile ? "hidden md:block" : "block"}`}
      onSubmit={async (event) => {
        event.preventDefault();
        await onSubmit({ title, description, priority }, files);
        setTitle("");
        setDescription("");
        setPriority("Medium");
        setFiles([]);
      }}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Create new ticket</h2>
        {!hiddenOnMobile && (
          <button type="button" onClick={onCloseMobile} className="text-xs text-gray-600">
            Close
          </button>
        )}
      </div>
      <label className="mt-3 block text-xs font-semibold uppercase text-gray-600">Title</label>
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        className="mt-1 w-full rounded border px-3 py-2 text-sm"
        required
      />
      <label className="mt-3 block text-xs font-semibold uppercase text-gray-600">Description</label>
      <textarea
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        className="mt-1 h-28 w-full rounded border px-3 py-2 text-sm"
        required
      />
      <label className="mt-3 block text-xs font-semibold uppercase text-gray-600">Priority</label>
      <select
        value={priority}
        onChange={(event) => setPriority(event.target.value as Priority)}
        className="mt-1 w-full rounded border px-3 py-2 text-sm"
      >
        {["Low", "Medium", "High", "Urgent"].map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
      <label className="mt-3 block text-xs font-semibold uppercase text-gray-600">Attachments</label>
      <input
        type="file"
        multiple
        className="mt-1 text-xs"
        onChange={(event) => {
          const list = event.target.files;
          if (!list) return;
          setFiles(Array.from(list));
        }}
      />
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          className="rounded border px-3 py-1 text-xs"
          onClick={() => {
            setTitle("");
            setDescription("");
            setPriority("Medium");
            setFiles([]);
          }}
        >
          Reset
        </button>
        <button type="submit" className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white">
          Create ticket
        </button>
      </div>
    </form>
  );
}

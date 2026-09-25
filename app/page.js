"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
    DndContext,
    PointerSensor,
    KeyboardSensor,
    useSensor,
    useSensors,
    useDroppable,
    closestCorners,
    DragOverlay,
} from "@dnd-kit/core";
import {
    SortableContext,
    useSortable,
    arrayMove,
    verticalListSortingStrategy,
    sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import NotionEditor from "@/components/NotionEditor";
import Comments from "@/components/Comments";
import TableView from "@/components/TableView";
import TimelineView from "@/components/TimelineView";
import WorkflowGraph from "@/components/WorkflowGraph";
import AssigneePicker from "@/components/AssigneePicker";
import ActivityLog from "@/components/ActivityLog";
import SubtasksAndDependencies from "@/components/SubtasksAndDependencies";
import {
    Activity,
    ArrowLeft,
    ArrowUpRight,
    Bell,
    Calendar,
    CalendarDays,
    Check,
    ChevronDown,
    ChevronRight,
    CircleDot,
    Command,
    Filter,
    FolderKanban,
    GitBranch,
    Inbox,
    LayoutDashboard,
    ListFilter,
    ListTodo,
    Loader2,
    LogOut,
    Menu,
    Moon,
    MoreHorizontal,
    Plus,
    Search,
    Settings2,
    Sparkles,
    Sun,
    Table2,
    Trash2,
    User as UserIcon,
    Users,
    X,
} from "lucide-react";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

const DEFAULT_STATUSES = [
    { name: "Backlog", color: "#94a3b8" },
    { name: "In Progress", color: "#6366f1" },
    { name: "In Review", color: "#f59e0b" },
    { name: "Done", color: "#10b981" },
];

const PRIORITY_META = {
    urgent: { label: "Urgent", color: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300", dot: "bg-rose-500" },
    high: { label: "High", color: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300", dot: "bg-orange-500" },
    medium: { label: "Medium", color: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300", dot: "bg-amber-500" },
    low: { label: "Low", color: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300", dot: "bg-sky-500" },
    no_priority: { label: "No priority", color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400", dot: "bg-slate-400" },
};

const PRIORITY_OPTIONS = ["urgent", "high", "medium", "low", "no_priority"];

const initials = (value = "") =>
    value.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "TF";

const friendlyError = (error) => {
    if (!error) return "Something went wrong.";
    if (error.code === "42P01" || error.message?.includes("does not exist"))
        return "Workspace tables are not ready yet. Run supabase/schema.sql in the Supabase SQL Editor.";
    return error.message || "Something went wrong.";
};

const genKey = (name) => {
    const cleaned = (name || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (cleaned.length >= 2) return cleaned.slice(0, 4);
    return (cleaned + "PROJ").slice(0, 4).toUpperCase();
};

const formatDate = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const extractText = (node) => {
    if (!node) return "";
    if (typeof node === "string") return node;
    if (node.text) return node.text;
    if (Array.isArray(node.content)) return node.content.map(extractText).join(" ");
    if (node.type && Array.isArray(node.content)) return node.content.map(extractText).join(" ");
    return "";
};

const logActivity = async (workspaceId, taskId, actorId, action, metadata = {}) => {
    try { await supabase.from("activity_log").insert({ workspace_id: workspaceId, task_id: taskId, actor_id: actorId, action, metadata }); } catch { /* ignore */ }
};

function BrandMark() {
    return (
        <div className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950">
            <Sparkles size={14} strokeWidth={2.5} />
        </div>
    );
}

/* ---------- Auth Page ---------- */
function AuthPage() {
    const [mode, setMode] = useState("signin");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    const submit = async (event) => {
        event.preventDefault();
        setBusy(true); setError(""); setNotice("");
        try {
            if (mode === "signup") {
                const { data, error: e } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim() } } });
                if (e) throw e;
                if (!data.session) setNotice("Account created. Check your email to confirm, then sign in.");
            } else {
                const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
                if (e) throw e;
            }
        } catch (err) { setError(friendlyError(err)); } finally { setBusy(false); }
    };

    return (
        <main className="relative flex min-h-screen overflow-hidden bg-[#f7f8fa] text-slate-950 dark:bg-[#0b0d10] dark:text-white">
            <div className="pointer-events-none absolute -left-32 -top-40 h-[32rem] w-[32rem] rounded-full bg-indigo-200/45 blur-3xl dark:bg-indigo-950/30" />
            <div className="pointer-events-none absolute -bottom-48 -right-20 h-[30rem] w-[30rem] rounded-full bg-amber-100/70 blur-3xl dark:bg-amber-950/20" />
            <div className="relative mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 items-center gap-12 px-6 py-12 lg:grid-cols-[1.02fr_0.98fr] lg:px-12">
                <section className="hidden lg:block">
                    <div className="mb-12 flex items-center gap-3"><BrandMark /><span className="text-sm font-semibold tracking-tight">taskforge</span></div>
                    <p className="mb-5 max-w-xl text-5xl font-semibold leading-[1.05] tracking-[-0.045em] text-slate-900 dark:text-white">Make room for the work that matters.</p>
                    <p className="max-w-md text-lg leading-8 text-slate-500 dark:text-slate-400">A focused home for projects, decisions, and the small steps that move your team forward.</p>
                </section>
                <section className="mx-auto w-full max-w-md">
                    <div className="mb-8 flex items-center gap-3 lg:hidden"><BrandMark /><span className="text-sm font-semibold tracking-tight">taskforge</span></div>
                    <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-7 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.35)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90 sm:p-9">
                        <div className="mb-8">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-400">Your calm command center</p>
                            <h1 className="text-2xl font-semibold tracking-tight">{mode === "signin" ? "Welcome back" : "Start your workspace"}</h1>
                            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{mode === "signin" ? "Pick up where your team left off." : "Bring your team, projects, and momentum together."}</p>
                        </div>
                        <form className="space-y-4" onSubmit={submit}>
                            {mode === "signup" && <label className="field-label">Name<input className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Morgan" autoComplete="name" required /></label>}
                            <label className="field-label">Email<input className="field-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" required /></label>
                            <label className="field-label">Password<input className="field-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={6} required /></label>
                            {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm leading-5 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>}
                            {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm leading-5 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">{notice}</div>}
                            <button className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200" disabled={busy} type="submit">{busy && <Loader2 size={16} className="animate-spin" />}{mode === "signin" ? "Sign in" : "Create workspace"}<ArrowUpRight size={16} /></button>
                        </form>
                        <div className="mt-7 flex items-center justify-between border-t border-slate-100 pt-6 text-sm dark:border-slate-800"><span className="text-slate-500 dark:text-slate-400">{mode === "signin" ? "New to Taskforge?" : "Already have an account?"}</span><button className="font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); setNotice(""); }} type="button">{mode === "signin" ? "Create account" : "Sign in"}</button></div>
                    </div>
                </section>
            </div>
        </main>
    );
}

/* ---------- Modal ---------- */
function Modal({ open, onClose, title, children, footer, size = "md" }) {
    useEffect(() => {
        if (!open) return;
        const h = (e) => { if (e.key === "Escape") onClose?.(); };
        window.addEventListener("keydown", h);
        return () => window.removeEventListener("keydown", h);
    }, [open, onClose]);
    if (!open) return null;
    const maxWidth = size === "lg" ? "max-w-2xl" : "max-w-md";
    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/40 px-4 pt-[10vh] backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
            <div className={`w-full ${maxWidth} overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900`}>
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                    <h2 className="text-sm font-semibold">{title}</h2>
                    <button className="icon-button" onClick={onClose} aria-label="Close"><X size={16} /></button>
                </div>
                <div className="p-5">{children}</div>
                {footer && <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-3 dark:border-slate-800 dark:bg-slate-900/50">{footer}</div>}
            </div>
        </div>
    );
}

/* ---------- Create Project Dialog ---------- */
function CreateProjectDialog({ open, onClose, workspaceId, userId, onCreated }) {
    const [name, setName] = useState("");
    const [key, setKey] = useState("");
    const [description, setDescription] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => { if (!open) { setName(""); setKey(""); setDescription(""); setError(""); setBusy(false); } }, [open]);
    useEffect(() => { if (name && !key) setKey(genKey(name)); }, [name]); // eslint-disable-line

    const submit = async (e) => {
        e.preventDefault();
        setBusy(true); setError("");
        try {
            const projKey = (key || genKey(name)).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
            if (projKey.length < 2) throw new Error("Project key must be 2-8 letters/digits.");
            const { data: project, error: pe } = await supabase
                .from("projects")
                .insert({ workspace_id: workspaceId, name: name.trim(), key: projKey, description: description.trim() || null, created_by: userId })
                .select().single();
            if (pe) throw pe;
            const statusesPayload = DEFAULT_STATUSES.map((s, idx) => ({ project_id: project.id, name: s.name, color: s.color, position: idx }));
            const { error: se } = await supabase.from("statuses").insert(statusesPayload);
            if (se) throw se;
            onCreated?.(project);
            onClose?.();
        } catch (err) { setError(friendlyError(err)); } finally { setBusy(false); }
    };

    return (
        <Modal open={open} onClose={onClose} title="Create project" footer={
            <>
                <button className="ghost-button" onClick={onClose} type="button">Cancel</button>
                <button className="primary-button" onClick={submit} disabled={busy || !name.trim()}>{busy && <Loader2 size={14} className="animate-spin" />}Create project</button>
            </>
        }>
            <form onSubmit={submit} className="space-y-4">
                <div>
                    <label className="field-label">Project name</label>
                    <input className="modal-input mt-1.5" value={name} onChange={(e) => setName(e.target.value)} placeholder="Marketing launch" autoFocus required />
                </div>
                <div className="grid grid-cols-[1fr_140px] gap-3">
                    <div>
                        <label className="field-label">Description (optional)</label>
                        <input className="modal-input mt-1.5" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's this project about?" />
                    </div>
                    <div>
                        <label className="field-label">Key</label>
                        <input className="modal-input mt-1.5 uppercase" value={key} onChange={(e) => setKey(e.target.value.toUpperCase())} placeholder="PROJ" maxLength={8} />
                    </div>
                </div>
                {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>}
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Default workflow</p>
                    <div className="flex flex-wrap gap-1.5">
                        {DEFAULT_STATUSES.map((s) => <span key={s.name} className="inline-flex items-center gap-1.5 rounded-md bg-white px-2 py-1 text-[11px] font-medium text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-300"><span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.name}</span>)}
                    </div>
                </div>
                <button type="submit" hidden />
            </form>
        </Modal>
    );
}

/* ---------- Sidebar ---------- */
function Sidebar({ user, workspaces, activeWorkspace, setActiveWorkspace, projects, activeProject, onSelectProject, onNewProject, onLogout, onInvite, mobileOpen, setMobileOpen }) {
    const [workspaceOpen, setWorkspaceOpen] = useState(false);
    const [projectsOpen, setProjectsOpen] = useState(true);
    const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Teammate";

    return (
        <>
            {mobileOpen && <button className="fixed inset-0 z-30 bg-slate-950/30 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}
            <aside className={`fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col border-r border-slate-200/80 bg-[#fbfbfc] transition-transform dark:border-slate-800 dark:bg-[#111316] lg:static lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
                <div className="flex h-16 items-center justify-between border-b border-slate-200/70 px-4 dark:border-slate-800"><div className="flex items-center gap-2.5"><BrandMark /><span className="text-sm font-semibold tracking-tight">taskforge</span></div><button className="icon-button lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={17} /></button></div>
                <div className="relative p-3">
                    <button className="flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition hover:bg-slate-100 dark:hover:bg-slate-800/70" onClick={() => setWorkspaceOpen(!workspaceOpen)}><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300">{initials(activeWorkspace?.name || "My workspace")}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{activeWorkspace?.name || "My workspace"}</span><span className="block text-xs text-slate-400">{activeWorkspace?.role || "member"}</span></span><ChevronDown size={15} className={`text-slate-400 transition ${workspaceOpen ? "rotate-180" : ""}`} /></button>
                    {workspaceOpen && <div className="absolute left-3 right-3 top-[68px] z-20 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">{workspaces.map((workspace) => <button key={workspace.id} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => { setActiveWorkspace(workspace); setWorkspaceOpen(false); }}><span className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-100 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">{initials(workspace.name)}</span><span className="min-w-0 flex-1 truncate">{workspace.name}</span>{activeWorkspace?.id === workspace.id && <Check size={14} className="text-indigo-600" />}</button>)}</div>}
                </div>
                <nav className="flex-1 overflow-y-auto px-3 pb-4">
                    <div className="space-y-0.5">
                        <button className={`sidebar-item ${!activeProject ? "active" : ""}`} onClick={() => onSelectProject(null)}><LayoutDashboard size={16} /><span>Overview</span></button>
                        <button className="sidebar-item"><Inbox size={16} /><span>Inbox</span></button>
                        <button className="sidebar-item"><Activity size={16} /><span>Activity</span></button>
                    </div>
                    <div className="mb-2 mt-7 flex items-center justify-between px-2"><button className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 hover:text-slate-600" onClick={() => setProjectsOpen(!projectsOpen)}><ChevronRight size={12} className={`transition ${projectsOpen ? "rotate-90" : ""}`} />Projects</button><button className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800" aria-label="Add project" onClick={onNewProject}><Plus size={14} /></button></div>
                    {projectsOpen && (
                        <div className="space-y-0.5">
                            {projects.length === 0 && <div className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-xs leading-5 text-slate-400 dark:border-slate-800">No projects yet. Create your first one.</div>}
                            {projects.map((p) => (
                                <button key={p.id} className={`sidebar-item group ${activeProject?.id === p.id ? "active" : ""}`} onClick={() => onSelectProject(p)}>
                                    <span className="flex h-5 w-5 items-center justify-center rounded bg-indigo-100 text-[9px] font-bold text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300">{p.key?.slice(0, 2) || initials(p.name)}</span>
                                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                                </button>
                            ))}
                        </div>
                    )}
                    <div className="mb-2 mt-7 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Favorites</div>
                    <div className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-xs leading-5 text-slate-400 dark:border-slate-800">Star a project to keep it close.</div>
                </nav>
                <div className="border-t border-slate-200/70 p-3 dark:border-slate-800"><button className="flex w-full items-center gap-2.5 rounded-xl p-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800/70"><span className="avatar bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200">{initials(displayName)}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{displayName}</span><span className="block truncate text-[11px] text-slate-400">{user?.email}</span></span><MoreHorizontal size={16} className="text-slate-400" /></button><div className="mt-1 flex gap-1"><button className="sidebar-bottom-button" onClick={onInvite}><Users size={14} /> Invite</button><button className="sidebar-bottom-button" onClick={onLogout}><LogOut size={14} /> Sign out</button></div></div>
            </aside>
        </>
    );
}

/* ---------- Create Menu ---------- */
function CreateMenu({ open, setOpen, onNewProject, onNewTask, hasProject }) {
    if (!open) return null;
    return (
        <div className="absolute right-0 top-12 z-20 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="px-2.5 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Create new</div>
            <button className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800" onClick={() => { setOpen(false); onNewTask?.(); }} disabled={!hasProject}><span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800"><Check size={14} /></span>Task<span className="ml-auto text-xs text-slate-400">T</span></button>
            <button className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => { setOpen(false); onNewProject?.(); }}><span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800"><FolderKanban size={14} /></span>Project<span className="ml-auto text-xs text-slate-400">P</span></button>
        </div>
    );
}

/* ---------- Command Palette ---------- */
function CommandPalette({ open, setOpen, projects, tasks, onSelectProject, onSelectTask, onNewProject }) {
    const [query, setQuery] = useState("");
    useEffect(() => { if (!open) setQuery(""); }, [open]);
    if (!open) return null;
    const q = query.toLowerCase();
    const filteredProjects = projects.filter((p) => p.name.toLowerCase().includes(q));
    const filteredTasks = q ? tasks.filter((t) => {
        const desc = extractText(t.description).toLowerCase();
        return t.title.toLowerCase().includes(q) || desc.includes(q);
    }).slice(0, 12) : [];
    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/30 px-4 pt-[16vh] backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
            <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center gap-3 border-b border-slate-100 px-4 dark:border-slate-800"><Search size={18} className="text-slate-400" /><input autoFocus className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tasks, projects, or run a command…" /><kbd className="rounded-md bg-slate-100 px-1.5 py-1 text-[10px] text-slate-400 dark:bg-slate-800">ESC</kbd></div>
                <div className="max-h-[60vh] overflow-y-auto p-2">
                    {filteredTasks.length > 0 && (
                        <>
                            <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Tasks</div>
                            {filteredTasks.map((t) => (
                                <button key={t.id} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => { onSelectTask(t); setOpen(false); }}>
                                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-500 dark:bg-slate-800"><Check size={13} /></span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate">{t.title}</span>
                                        <span className="block truncate text-[10px] text-slate-400">{t.project_name} · {t.status_name || "No status"}</span>
                                    </span>
                                </button>
                            ))}
                        </>
                    )}
                    {filteredProjects.length > 0 && <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Projects</div>}
                    {filteredProjects.map((p) => (
                        <button key={p.id} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => { onSelectProject(p); setOpen(false); }}>
                            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-100 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">{p.key?.slice(0, 2) || initials(p.name)}</span>
                            <span className="flex-1 truncate">{p.name}</span>
                            <span className="text-[10px] text-slate-400">{p.key}</span>
                        </button>
                    ))}
                    <div className="mt-2 px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Actions</div>
                    <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => { setOpen(false); onNewProject?.(); }}>
                        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-500 dark:bg-slate-800"><Plus size={14} /></span>
                        Create new project
                    </button>
                    {filteredTasks.length === 0 && filteredProjects.length === 0 && query && <p className="px-3 py-8 text-center text-sm text-slate-400">No matches</p>}
                </div>
            </div>
        </div>
    );
}

/* ---------- Workspace Home ---------- */
function WorkspaceHome({ activeWorkspace, projects, dbReady, onNewProject, onOpenProject }) {
    return (
        <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-10">
            <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
                <div>
                    <div className="mb-3 flex items-center gap-2 text-xs font-medium text-slate-400"><span>Workspace</span><ChevronRight size={13} /><span className="text-slate-600 dark:text-slate-300">{activeWorkspace?.name || "Your workspace"}</span></div>
                    <h1 className="text-[28px] font-semibold tracking-[-0.035em] text-slate-900 dark:text-white">Good to see you<span className="text-indigo-500">.</span></h1>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Pick up a project or spin up something new.</p>
                </div>
                <button className="primary-button" onClick={onNewProject}><Plus size={15} /> New project</button>
            </div>
            {!dbReady && <div className="mb-7 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200"><span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/50"><Settings2 size={15} /></span><div><p className="text-sm font-semibold">One quick setup step remains</p><p className="mt-1 text-xs leading-5">Run supabase/schema.sql in Supabase SQL Editor.</p></div></div>}
            <div className="grid gap-4 sm:grid-cols-3">
                <div className="metric-card"><span className="metric-icon bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300"><FolderKanban size={17} /></span><span className="metric-label">Projects</span><strong>{projects.length}</strong><span className="metric-note">In this workspace</span></div>
                <div className="metric-card"><span className="metric-icon bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300"><Check size={17} /></span><span className="metric-label">Completed this week</span><strong>0</strong><span className="metric-note">A clean slate</span></div>
                <div className="metric-card"><span className="metric-icon bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300"><Activity size={17} /></span><span className="metric-label">Activity</span><strong>—</strong><span className="metric-note">Waiting for your first task</span></div>
            </div>
            <div className="mt-8">
                <h2 className="mb-3 text-sm font-semibold">Your projects</h2>
                {projects.length === 0 ? (
                    <div className="panel-card flex flex-col items-center justify-center px-6 py-16 text-center">
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800"><FolderKanban size={21} /></div>
                        <h3 className="text-sm font-semibold">Create your first project</h3>
                        <p className="mt-1 max-w-xs text-xs leading-5 text-slate-400">Projects hold your tasks, statuses, and workflow. Start one to unlock the board.</p>
                        <button className="mt-5 primary-button" onClick={onNewProject}><Plus size={14} /> New project</button>
                    </div>
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {projects.map((p) => (
                            <button key={p.id} className="panel-card p-4 text-left transition hover:border-slate-300 hover:shadow-md dark:hover:border-slate-700" onClick={() => onOpenProject(p)}>
                                <div className="mb-3 flex items-center justify-between"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-[11px] font-bold text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300">{p.key?.slice(0, 2) || initials(p.name)}</span><span className="chip bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">{p.key}</span></div>
                                <p className="text-sm font-semibold">{p.name}</p>
                                <p className="mt-1 line-clamp-2 text-xs text-slate-400">{p.description || "No description"}</p>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

/* ---------- Task Card ---------- */
function TaskCardContent({ task, project, statuses, dragging }) {
    const priority = PRIORITY_META[task.priority] || PRIORITY_META.no_priority;
    return (
        <div className={`group rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 hover:shadow dark:border-slate-800 dark:bg-slate-900 ${dragging ? "opacity-40" : ""}`}>
            <div className="mb-2 flex items-center gap-2">
                <span className="text-[10px] font-semibold text-slate-400">{project?.key}-{task.number || task.id.slice(0, 4).toUpperCase()}</span>
                <span className={`chip ${priority.color}`}><span className={`h-1.5 w-1.5 rounded-full ${priority.dot}`} />{priority.label}</span>
            </div>
            <p className="text-sm font-medium leading-5 text-slate-900 dark:text-white">{task.title}</p>
            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                <div className="flex items-center gap-2">
                    {task.due_date && <span className="inline-flex items-center gap-1"><Calendar size={11} />{formatDate(task.due_date)}</span>}
                </div>
                <span className="avatar h-6 w-6 bg-slate-100 text-[9px] text-slate-500 dark:bg-slate-800 dark:text-slate-300">{initials(task.assignee_name || "?")}</span>
            </div>
        </div>
    );
}

function SortableTaskCard({ task, project, statuses, onOpen }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, data: { type: "task", task } });
    const style = { transform: CSS.Transform.toString(transform), transition };
    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} onClick={(e) => { if (!isDragging) onOpen(task); }} className="cursor-pointer">
            <TaskCardContent task={task} project={project} statuses={statuses} dragging={isDragging} />
        </div>
    );
}

/* ---------- Board Column (droppable) ---------- */
function BoardColumn({ status, tasks, project, statuses, onOpenTask, onNewTask }) {
    const { setNodeRef, isOver } = useSortableColumn(status.id);
    const [adding, setAdding] = useState(false);
    const [title, setTitle] = useState("");
    const submit = async () => {
        if (!title.trim()) { setAdding(false); return; }
        await onNewTask(status.id, title.trim());
        setTitle(""); setAdding(false);
    };
    return (
        <div className="flex w-[300px] shrink-0 flex-col rounded-2xl bg-slate-100/60 p-3 dark:bg-slate-900/40">
            <div className="mb-3 flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: status.color }} />
                    <span className="text-xs font-semibold">{status.name}</span>
                    <span className="chip bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400">{tasks.length}</span>
                </div>
                <button className="icon-button h-7 w-7" aria-label="Add task" onClick={() => setAdding(true)}><Plus size={14} /></button>
            </div>
            <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                <div ref={setNodeRef} className={`flex min-h-[100px] flex-col gap-2 rounded-xl p-1 transition ${isOver ? "bg-indigo-50 dark:bg-indigo-950/20" : ""}`}>
                    {tasks.map((task) => <SortableTaskCard key={task.id} task={task} project={project} statuses={statuses} onOpen={onOpenTask} />)}
                    {adding && (
                        <div className="rounded-xl border border-indigo-200 bg-white p-2 dark:border-indigo-800 dark:bg-slate-900">
                            <textarea autoFocus className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-slate-400" placeholder="Task title..." value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } if (e.key === "Escape") { setAdding(false); setTitle(""); } }} rows={2} onBlur={submit} />
                        </div>
                    )}
                    {!adding && tasks.length === 0 && <div className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400 dark:border-slate-800">Empty</div>}
                </div>
            </SortableContext>
            {!adding && <button className="mt-2 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-200/50 hover:text-slate-800 dark:hover:bg-slate-800/60 dark:hover:text-white" onClick={() => setAdding(true)}><Plus size={13} /> Add task</button>}
        </div>
    );
}

// hook: droppable column via SortableContext id-empty trick
function useSortableColumn(id) { return useDroppable({ id, data: { type: "column", statusId: id } }); }

/* ---------- Board View ---------- */
function BoardView({ project, statuses, tasks, setTasks, onOpenTask, onNewTask, user }) {
    const [activeTask, setActiveTask] = useState(null);
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const findTask = (id) => tasks.find((t) => t.id === id);
    const findContainer = (id) => {
        if (statuses.some((s) => s.id === id)) return id;
        const t = tasks.find((task) => task.id === id);
        return t?.status_id || null;
    };

    const onDragStart = ({ active }) => setActiveTask(findTask(active.id));

    const onDragOver = ({ active, over }) => {
        if (!over) return;
        const activeContainer = findContainer(active.id);
        const overContainer = findContainer(over.id);
        if (!activeContainer || !overContainer || activeContainer === overContainer) return;
        setTasks((prev) => prev.map((t) => (t.id === active.id ? { ...t, status_id: overContainer } : t)));
    };

    const onDragEnd = async ({ active, over }) => {
        setActiveTask(null);
        if (!over) return;
        const activeContainer = findContainer(active.id);
        const overContainer = findContainer(over.id);
        if (!activeContainer || !overContainer) return;
        // reorder within same column
        if (active.id !== over.id && activeContainer === overContainer) {
            const columnTasks = tasks.filter((t) => t.status_id === activeContainer);
            const oldIndex = columnTasks.findIndex((t) => t.id === active.id);
            const newIndex = columnTasks.findIndex((t) => t.id === over.id);
            if (oldIndex !== -1 && newIndex !== -1) {
                const reordered = arrayMove(columnTasks, oldIndex, newIndex);
                setTasks((prev) => {
                    const others = prev.filter((t) => t.status_id !== activeContainer);
                    return [...others, ...reordered];
                });
                // persist positions
                await Promise.all(reordered.map((t, idx) => supabase.from("tasks").update({ position: idx }).eq("id", t.id)));
            }
        }
        // status changed
        const movedTask = tasks.find((t) => t.id === active.id);
        if (movedTask && movedTask.status_id !== activeContainer) {
            // handled by onDragOver already; persist
        }
        // persist new status if changed
        const currentTask = tasks.find((t) => t.id === active.id);
        if (currentTask) {
            await supabase.from("tasks").update({ status_id: currentTask.status_id }).eq("id", active.id);
        }
    };

    return (
        <div className="px-5 pb-8 sm:px-8 lg:px-10">
            <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
                <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                    {statuses.map((s) => {
                        const colTasks = tasks.filter((t) => t.status_id === s.id).sort((a, b) => (a.position || 0) - (b.position || 0));
                        return <BoardColumn key={s.id} status={s} tasks={colTasks} project={project} statuses={statuses} onOpenTask={onOpenTask} onNewTask={onNewTask} />;
                    })}
                </div>
                <DragOverlay>{activeTask && <TaskCardContent task={activeTask} project={project} statuses={statuses} />}</DragOverlay>
            </DndContext>
        </div>
    );
}

/* ---------- List View ---------- */
function ListView({ project, tasks, statuses, onOpenTask, onNewTask }) {
    const [newTitle, setNewTitle] = useState("");
    const firstStatus = statuses[0];
    const submitNew = async () => {
        if (!newTitle.trim() || !firstStatus) return;
        await onNewTask(firstStatus.id, newTitle.trim());
        setNewTitle("");
    };
    return (
        <div className="px-5 pb-8 sm:px-8 lg:px-10">
            <div className="panel-card overflow-hidden">
                <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                    <Plus size={14} className="text-slate-400" />
                    <input className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" placeholder="Add task, press Enter" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitNew()} />
                </div>
                {tasks.length === 0 ? (
                    <div className="px-6 py-16 text-center text-xs text-slate-400">No tasks yet</div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {tasks.map((t) => {
                            const status = statuses.find((s) => s.id === t.status_id);
                            const priority = PRIORITY_META[t.priority] || PRIORITY_META.no_priority;
                            return (
                                <button key={t.id} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/40" onClick={() => onOpenTask(t)}>
                                    <span className="text-[10px] font-semibold text-slate-400">{project?.key}</span>
                                    <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium dark:bg-slate-800"><span className="h-1.5 w-1.5 rounded-full" style={{ background: status?.color || "#94a3b8" }} />{status?.name || "Unknown"}</span>
                                    <span className="flex-1 truncate text-sm">{t.title}</span>
                                    <span className={`chip ${priority.color}`}>{priority.label}</span>
                                    {t.due_date && <span className="text-[11px] text-slate-400">{formatDate(t.due_date)}</span>}
                                    <span className="avatar h-6 w-6 bg-slate-100 text-[9px] text-slate-500 dark:bg-slate-800 dark:text-slate-300">{initials(t.assignee_name || "?")}</span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

/* ---------- Task Panel (side peek) ---------- */
function TaskPanel({ task, statuses, members, membersById, statusesById, projectTasks, user, onClose, onUpdate, onDelete, onOpenSibling, onTasksMutated }) {
    const [local, setLocal] = useState(task);
    const [saving, setSaving] = useState(false);
    const [savedAt, setSavedAt] = useState(null);
    const saveTimer = useRef();

    useEffect(() => { setLocal(task); setSavedAt(null); }, [task?.id]); // eslint-disable-line

    const patch = (changes) => {
        const next = { ...local, ...changes };
        setLocal(next);
        clearTimeout(saveTimer.current);
        setSaving(true);
        saveTimer.current = setTimeout(async () => {
            await onUpdate(next);
            setSaving(false);
            setSavedAt(new Date());
        }, 600);
    };

    if (!task) return null;
    return (
        <>
            <div className="fixed inset-0 z-40 bg-slate-950/20 backdrop-blur-sm" onClick={onClose} />
            <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[600px] flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-800">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span className="font-semibold">{task.project_key}-{task.number || task.id.slice(0, 4).toUpperCase()}</span>
                        <span>·</span>
                        {saving ? <span className="inline-flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> Saving…</span> : savedAt ? <span className="text-emerald-600">Saved</span> : <span>All changes saved</span>}
                    </div>
                    <div className="flex items-center gap-1">
                        <button className="icon-button" onClick={() => onDelete(task)} aria-label="Delete task"><Trash2 size={15} /></button>
                        <button className="icon-button" onClick={onClose} aria-label="Close panel"><X size={16} /></button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-5">
                    <textarea value={local.title} onChange={(e) => patch({ title: e.target.value })} className="w-full resize-none bg-transparent text-xl font-semibold leading-tight outline-none" rows={2} placeholder="Task title" />
                    <div className="mt-5 grid grid-cols-[100px_1fr] items-center gap-y-2 text-sm">
                        <span className="text-xs text-slate-500">Status</span>
                        <select className="modal-select h-8 w-fit min-w-[140px] py-0" value={local.status_id || ""} onChange={(e) => patch({ status_id: e.target.value })}>
                            {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <span className="text-xs text-slate-500">Priority</span>
                        <select className="modal-select h-8 w-fit min-w-[140px] py-0" value={local.priority || "no_priority"} onChange={(e) => patch({ priority: e.target.value })}>
                            {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
                        </select>
                        <span className="text-xs text-slate-500">Due date</span>
                        <input type="date" className="modal-input h-8 w-fit min-w-[140px] py-0" value={local.due_date || ""} onChange={(e) => patch({ due_date: e.target.value || null })} />
                        <span className="text-xs text-slate-500">Assignee</span>
                        <AssigneePicker value={local.assignee_id} members={members} onChange={(uid) => patch({ assignee_id: uid })} />
                    </div>
                    <div className="mt-8">
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Description</p>
                        <NotionEditor
                            value={typeof local.description === "object" && local.description?.type ? local.description : null}
                            onChange={(json) => patch({ description: json })}
                            placeholder="Type '/' for commands, or just start writing…"
                        />
                    </div>
                    <SubtasksAndDependencies task={task} projectTasks={projectTasks} statuses={statuses} user={user} onOpenTask={onOpenSibling} onTasksMutated={onTasksMutated} />
                    <ActivityLog taskId={task.id} membersById={membersById} statusesById={statusesById} />
                    <Comments taskId={task.id} user={user} />
                </div>
            </aside>
        </>
    );
}

/* ---------- Project View ---------- */
function ProjectView({ project, user, members, workspaceId, onBack, onTasksChanged, pendingOpenTaskId, clearPendingOpen }) {
    const [statuses, setStatuses] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("Board");
    const [openTask, setOpenTask] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        const [{ data: st }, { data: tk }] = await Promise.all([
            supabase.from("statuses").select("*").eq("project_id", project.id).order("position"),
            supabase.from("tasks").select("*").eq("project_id", project.id).order("position"),
        ]);
        setStatuses(st || []);
        setTasks(tk || []);
        setLoading(false);
    }, [project.id]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { onTasksChanged?.(tasks, statuses); }, [tasks, statuses]); // eslint-disable-line

    // Auto-open task from global search
    useEffect(() => {
        if (!pendingOpenTaskId || loading) return;
        const task = tasks.find((t) => t.id === pendingOpenTaskId);
        if (task) {
            setOpenTask({ ...task, project_key: project.key });
            clearPendingOpen?.();
        }
    }, [pendingOpenTaskId, tasks, loading]); // eslint-disable-line

    const membersById = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members]);
    const statusesById = useMemo(() => Object.fromEntries(statuses.map((s) => [s.id, s])), [statuses]);

    const attachDisplay = (t) => ({ ...t, assignee_name: t.assignee_id ? (membersById[t.assignee_id]?.full_name || membersById[t.assignee_id]?.email) : null });
    const enrichedTasks = tasks.map(attachDisplay);

    const newTask = async (statusId, title) => {
        const tmpId = "tmp-" + Math.random().toString(36).slice(2);
        const columnTasks = tasks.filter((t) => t.status_id === statusId);
        const position = columnTasks.length;
        const optimistic = { id: tmpId, project_id: project.id, status_id: statusId, title, priority: "no_priority", position, created_by: user.id, description: {} };
        setTasks((prev) => [...prev, optimistic]);
        const { data, error } = await supabase.from("tasks").insert({ project_id: project.id, status_id: statusId, title, position, created_by: user.id }).select().single();
        if (error) { setTasks((prev) => prev.filter((t) => t.id !== tmpId)); alert(friendlyError(error)); return; }
        setTasks((prev) => prev.map((t) => (t.id === tmpId ? data : t)));
        logActivity(workspaceId, data.id, user.id, "created", { title });
    };

    const updateTask = async (updated) => {
        const prev = tasks.find((t) => t.id === updated.id);
        setTasks((prevTasks) => prevTasks.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
        const payload = { title: updated.title, status_id: updated.status_id, priority: updated.priority, due_date: updated.due_date, description: updated.description, assignee_id: updated.assignee_id };
        const { error } = await supabase.from("tasks").update(payload).eq("id", updated.id);
        if (error) { alert(friendlyError(error)); return; }
        // Log changed fields
        if (prev) {
            if (prev.status_id !== updated.status_id) logActivity(workspaceId, updated.id, user.id, "status_changed", { from: prev.status_id, to: updated.status_id, from_name: statusesById[prev.status_id]?.name, to_name: statusesById[updated.status_id]?.name });
            if (prev.priority !== updated.priority) logActivity(workspaceId, updated.id, user.id, "priority_changed", { from: prev.priority, to: updated.priority });
            if ((prev.assignee_id || null) !== (updated.assignee_id || null)) {
                if (updated.assignee_id) logActivity(workspaceId, updated.id, user.id, "assigned", { to: updated.assignee_id });
                else logActivity(workspaceId, updated.id, user.id, "unassigned", {});
            }
            if ((prev.due_date || null) !== (updated.due_date || null)) logActivity(workspaceId, updated.id, user.id, "due_changed", { to: updated.due_date });
            if (prev.title !== updated.title) logActivity(workspaceId, updated.id, user.id, "title_changed", {});
        }
    };

    const deleteTask = async (task) => {
        if (!confirm(`Delete task "${task.title}"?`)) return;
        setTasks((prev) => prev.filter((t) => t.id !== task.id));
        setOpenTask(null);
        await supabase.from("tasks").delete().eq("id", task.id);
    };

    const openTaskFull = (task) => {
        const enriched = attachDisplay(task);
        setOpenTask({ ...enriched, project_key: project.key });
    };

    return (
        <div className="flex min-h-[calc(100vh-4rem)] flex-col">
            <div className="border-b border-slate-200/80 bg-white/50 px-5 pt-4 dark:border-slate-800 dark:bg-slate-950/30 sm:px-8 lg:px-10">
                <div className="mx-auto max-w-6xl">
                    <div className="mb-3 flex items-center gap-2 text-xs text-slate-400">
                        <button className="hover:text-slate-700 dark:hover:text-slate-200" onClick={onBack}>Overview</button>
                        <ChevronRight size={12} />
                        <span className="text-slate-600 dark:text-slate-300">{project.name}</span>
                    </div>
                    <div className="mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300">{project.key?.slice(0, 2) || initials(project.name)}</span>
                            <div>
                                <h1 className="text-lg font-semibold tracking-tight">{project.name}</h1>
                                <p className="text-xs text-slate-400">{project.description || "No description"}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button className="soft-button"><Filter size={13} /> Filter</button>
                            <button className="soft-button"><Users size={13} /> {members.length} member{members.length !== 1 ? "s" : ""}</button>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 overflow-x-auto">
                        {[
                            { id: "Board", icon: LayoutDashboard },
                            { id: "List", icon: ListTodo },
                            { id: "Table", icon: Table2 },
                            { id: "Timeline", icon: CalendarDays },
                            { id: "Workflow", icon: GitBranch },
                        ].map(({ id, icon: Icon }) => (
                            <button key={id} className={`tab-button ${activeTab === id ? "active" : ""}`} onClick={() => setActiveTab(id)}><Icon size={14} /> {id}</button>
                        ))}
                    </div>
                </div>
            </div>
            <div className="mx-auto w-full max-w-6xl pt-5">
                {loading ? (
                    <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-indigo-500" size={22} /></div>
                ) : activeTab === "Board" ? (
                    <BoardView project={project} statuses={statuses} tasks={enrichedTasks} setTasks={setTasks} onOpenTask={openTaskFull} onNewTask={newTask} user={user} />
                ) : activeTab === "List" ? (
                    <ListView project={project} tasks={enrichedTasks} statuses={statuses} onOpenTask={openTaskFull} onNewTask={newTask} />
                ) : activeTab === "Table" ? (
                    <TableView project={project} tasks={enrichedTasks} statuses={statuses} onOpenTask={openTaskFull} />
                ) : activeTab === "Timeline" ? (
                    <TimelineView project={project} tasks={enrichedTasks} statuses={statuses} onOpenTask={openTaskFull} />
                ) : activeTab === "Workflow" ? (
                    <WorkflowGraph project={project} statuses={statuses} tasks={enrichedTasks} />
                ) : null}
            </div>
            {openTask && <TaskPanel task={openTask} statuses={statuses} members={members} membersById={membersById} statusesById={statusesById} projectTasks={enrichedTasks} user={user} onClose={() => setOpenTask(null)} onUpdate={updateTask} onDelete={deleteTask} onOpenSibling={openTaskFull} onTasksMutated={load} />}
        </div>
    );
}

/* ---------- App Shell ---------- */
function AppShell({ user, onLogout }) {
    const [workspaces, setWorkspaces] = useState([]);
    const [activeWorkspace, setActiveWorkspace] = useState(null);
    const [projects, setProjects] = useState([]);
    const [members, setMembers] = useState([]);
    const [allTasks, setAllTasks] = useState([]); // for global search across workspace
    const [activeProject, setActiveProject] = useState(null);
    const [dbReady, setDbReady] = useState(true);
    const [loadingWorkspace, setLoadingWorkspace] = useState(true);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [commandOpen, setCommandOpen] = useState(false);
    const [dark, setDark] = useState(false);
    const [projectDialogOpen, setProjectDialogOpen] = useState(false);
    const [pendingOpenTaskId, setPendingOpenTaskId] = useState(null);

    const loadWorkspaces = useCallback(async () => {
        setLoadingWorkspace(true);
        const { data: memberships, error } = await supabase.from("workspace_members").select("workspace_id, role, workspaces(id, name, slug, owner_id)").eq("user_id", user.id);
        if (error) { setDbReady(false); setWorkspaces([]); setLoadingWorkspace(false); return; }
        let rows = (memberships || []).map((m) => ({ ...m.workspaces, role: m.role })).filter((w) => w?.id);
        if (!rows.length) {
            const workspaceName = `${user.user_metadata?.full_name || user.email?.split("@")[0] || "My"}'s workspace`;
            const slug = `workspace-${user.id.slice(0, 8)}`;
            const { data: created, error: createError } = await supabase.from("workspaces").insert({ name: workspaceName, slug, owner_id: user.id }).select().single();
            if (!createError && created) {
                const { error: memberError } = await supabase.from("workspace_members").insert({ workspace_id: created.id, user_id: user.id, role: "owner" });
                if (!memberError) rows = [{ ...created, role: "owner" }];
            }
        }
        setDbReady(true);
        setWorkspaces(rows);
        setActiveWorkspace((cur) => rows.find((w) => w.id === cur?.id) || rows[0] || null);
        setLoadingWorkspace(false);
    }, [user]);

    const loadProjects = useCallback(async (workspaceId) => {
        if (!workspaceId) { setProjects([]); return; }
        const { data, error } = await supabase.from("projects").select("*").eq("workspace_id", workspaceId).order("created_at");
        if (!error) setProjects(data || []);
    }, []);

    const loadMembers = useCallback(async (workspaceId) => {
        if (!workspaceId) { setMembers([]); return; }
        const { data: mem } = await supabase.from("workspace_members").select("user_id, role").eq("workspace_id", workspaceId);
        const ids = (mem || []).map((m) => m.user_id);
        if (ids.length === 0) { setMembers([]); return; }
        const { data: profs } = await supabase.from("profiles").select("id, email, full_name").in("id", ids);
        // fallback if profiles table missing: just use current user
        if (!profs || profs.length === 0) {
            setMembers([{ id: user.id, email: user.email, full_name: user.user_metadata?.full_name || user.email }]);
            return;
        }
        setMembers(profs);
    }, [user]);

    const loadAllTasks = useCallback(async (workspaceId) => {
        if (!workspaceId) { setAllTasks([]); return; }
        const { data: projs } = await supabase.from("projects").select("id, name, key").eq("workspace_id", workspaceId);
        if (!projs || projs.length === 0) { setAllTasks([]); return; }
        const projMap = Object.fromEntries(projs.map((p) => [p.id, p]));
        const projIds = projs.map((p) => p.id);
        const { data: tasks } = await supabase.from("tasks").select("id, title, description, status_id, project_id").in("project_id", projIds);
        const { data: statuses } = await supabase.from("statuses").select("id, name, project_id").in("project_id", projIds);
        const stMap = Object.fromEntries((statuses || []).map((s) => [s.id, s]));
        setAllTasks((tasks || []).map((t) => ({
            ...t,
            project_name: projMap[t.project_id]?.name,
            project_key: projMap[t.project_id]?.key,
            status_name: stMap[t.status_id]?.name,
        })));
    }, []);

    useEffect(() => { loadWorkspaces(); }, [loadWorkspaces]);
    useEffect(() => {
        if (!activeWorkspace?.id) return;
        loadProjects(activeWorkspace.id);
        loadMembers(activeWorkspace.id);
        loadAllTasks(activeWorkspace.id);
        setActiveProject(null);
    }, [activeWorkspace?.id, loadProjects, loadMembers, loadAllTasks]);

    useEffect(() => {
        const stored = window.localStorage.getItem("taskforge-theme");
        const shouldDark = stored === "dark" || (!stored && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
        setDark(shouldDark);
        document.documentElement.classList.toggle("dark", shouldDark);
    }, []);

    useEffect(() => {
        const handler = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCommandOpen(true); }
            if (e.key === "Escape") { setCommandOpen(false); setCreateOpen(false); }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);

    const toggleTheme = () => { const next = !dark; setDark(next); document.documentElement.classList.toggle("dark", next); window.localStorage.setItem("taskforge-theme", next ? "dark" : "light"); };
    const invite = () => window.alert("Invite flow is coming in a later phase.");

    const handleProjectCreated = (project) => {
        setProjects((prev) => [...prev, project]);
        setActiveProject(project);
    };

    const openTaskFromSearch = (task) => {
        const project = projects.find((p) => p.id === task.project_id);
        if (!project) return;
        setActiveProject(project);
        setPendingOpenTaskId(task.id);
    };

    return (
        <div className="flex min-h-screen bg-[#f7f8fa] text-slate-950 dark:bg-[#0b0d10] dark:text-white">
            <Sidebar
                user={user}
                workspaces={workspaces}
                activeWorkspace={activeWorkspace}
                setActiveWorkspace={setActiveWorkspace}
                projects={projects}
                activeProject={activeProject}
                onSelectProject={setActiveProject}
                onNewProject={() => setProjectDialogOpen(true)}
                onLogout={onLogout}
                onInvite={invite}
                mobileOpen={mobileOpen}
                setMobileOpen={setMobileOpen}
            />
            <div className="flex min-w-0 flex-1 flex-col">
                <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200/80 bg-[#f7f8fa]/90 px-4 backdrop-blur-xl dark:border-slate-800 dark:bg-[#0b0d10]/90 sm:px-6">
                    <div className="flex items-center gap-3">
                        <button className="icon-button lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={18} /></button>
                        <button className="search-trigger" onClick={() => setCommandOpen(true)}><Search size={15} /><span>Search anything</span><kbd>⌘ K</kbd></button>
                    </div>
                    <div className="relative flex items-center gap-1.5">
                        <button className="icon-button" aria-label="Notifications"><Bell size={17} /></button>
                        <button className="icon-button" onClick={toggleTheme} aria-label="Toggle theme">{dark ? <Sun size={17} /> : <Moon size={17} />}</button>
                        <div className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-800" />
                        <button className="primary-button" onClick={() => setCreateOpen(!createOpen)}><Plus size={15} /> <span className="hidden sm:inline">Create</span></button>
                        <CreateMenu open={createOpen} setOpen={setCreateOpen} hasProject={!!activeProject} onNewProject={() => setProjectDialogOpen(true)} onNewTask={() => {}} />
                    </div>
                </header>
                <main className="flex-1">
                    {loadingWorkspace ? (
                        <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-indigo-500" size={22} /></div>
                    ) : activeProject ? (
                        <ProjectView
                            project={activeProject}
                            user={user}
                            members={members}
                            workspaceId={activeWorkspace?.id}
                            onBack={() => setActiveProject(null)}
                            onTasksChanged={() => activeWorkspace?.id && loadAllTasks(activeWorkspace.id)}
                            pendingOpenTaskId={pendingOpenTaskId}
                            clearPendingOpen={() => setPendingOpenTaskId(null)}
                        />
                    ) : (
                        <WorkspaceHome activeWorkspace={activeWorkspace} projects={projects} dbReady={dbReady} onNewProject={() => setProjectDialogOpen(true)} onOpenProject={setActiveProject} />
                    )}
                </main>
                <CommandPalette
                    open={commandOpen}
                    setOpen={setCommandOpen}
                    projects={projects}
                    tasks={allTasks}
                    onSelectProject={setActiveProject}
                    onSelectTask={openTaskFromSearch}
                    onNewProject={() => setProjectDialogOpen(true)}
                />
                <CreateProjectDialog open={projectDialogOpen} onClose={() => setProjectDialogOpen(false)} workspaceId={activeWorkspace?.id} userId={user.id} onCreated={handleProjectCreated} />
            </div>
        </div>
    );
}

/* ---------- Root ---------- */
export default function App() {
    const [session, setSession] = useState(undefined);
    const [authLoading, setAuthLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        supabase.auth.getSession().then(({ data }) => { if (mounted) { setSession(data.session); setAuthLoading(false); } });
        const { data: listener } = supabase.auth.onAuthStateChange((_e, next) => { if (mounted) setSession(next); });
        return () => { mounted = false; listener.subscription.unsubscribe(); };
    }, []);

    const logout = async () => { await supabase.auth.signOut(); setSession(null); };
    if (authLoading) return <div className="flex min-h-screen items-center justify-center bg-[#f7f8fa] dark:bg-[#0b0d10]"><Loader2 className="animate-spin text-indigo-500" size={22} /></div>;
    if (!session?.user) return <AuthPage />;
    return <AppShell user={session.user} onLogout={logout} />;
}

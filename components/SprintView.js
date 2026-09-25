"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
    Calendar,
    CheckCircle2,
    ChevronRight,
    Circle,
    Loader2,
    Play,
    Plus,
    Target,
    Zap,
} from "lucide-react";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

const STATUS_META = {
    planned: { label: "Planned", color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
    active: { label: "Active", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300" },
    completed: { label: "Completed", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" },
};
const formatDate = (iso) => iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—";

function CreateSprintModal({ open, onClose, projectId, onCreated }) {
    const [name, setName] = useState("");
    const [goal, setGoal] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [busy, setBusy] = useState(false);
    useEffect(() => { if (!open) { setName(""); setGoal(""); setStartDate(""); setEndDate(""); setBusy(false); } }, [open]);
    if (!open) return null;
    const submit = async () => {
        if (!name.trim()) return;
        setBusy(true);
        const { data, error } = await supabase.from("sprints").insert({
            project_id: projectId,
            name: name.trim(),
            goal: goal.trim() || null,
            start_date: startDate || null,
            end_date: endDate || null,
            status: "planned",
        }).select().single();
        setBusy(false);
        if (error) return alert(error.message);
        onCreated?.(data);
        onClose?.();
    };
    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/40 px-4 pt-[10vh] backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                    <h2 className="text-sm font-semibold">New sprint</h2>
                </div>
                <div className="space-y-3 p-5">
                    <div>
                        <label className="field-label">Name</label>
                        <input autoFocus className="modal-input mt-1.5" placeholder="Sprint 1" value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div>
                        <label className="field-label">Goal (optional)</label>
                        <input className="modal-input mt-1.5" placeholder="What are we trying to achieve?" value={goal} onChange={(e) => setGoal(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="field-label">Start</label>
                            <input type="date" className="modal-input mt-1.5" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                        </div>
                        <div>
                            <label className="field-label">End</label>
                            <input type="date" className="modal-input mt-1.5" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                        </div>
                    </div>
                </div>
                <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-3 dark:border-slate-800 dark:bg-slate-900/50">
                    <button className="ghost-button" onClick={onClose}>Cancel</button>
                    <button className="primary-button" onClick={submit} disabled={busy || !name.trim()}>{busy && <Loader2 size={13} className="animate-spin" />}Create sprint</button>
                </div>
            </div>
        </div>
    );
}

export default function SprintView({ project, tasks, statuses, sprints, refreshSprints, onOpenTask }) {
    const [createOpen, setCreateOpen] = useState(false);
    const doneStatus = statuses.find((s) => s.name.toLowerCase() === "done") || statuses[statuses.length - 1];

    const grouped = useMemo(() => {
        const map = new Map();
        sprints.forEach((s) => map.set(s.id, { sprint: s, tasks: [] }));
        map.set(null, { sprint: null, tasks: [] });
        tasks.forEach((t) => {
            const key = t.sprint_id || null;
            if (map.has(key)) map.get(key).tasks.push(t); else map.get(null).tasks.push(t);
        });
        return Array.from(map.values());
    }, [tasks, sprints]);

    const updateSprintStatus = async (sprint, status) => {
        await supabase.from("sprints").update({ status }).eq("id", sprint.id);
        refreshSprints?.();
    };

    return (
        <div className="px-5 pb-8 sm:px-8 lg:px-10">
            <div className="mb-5 flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold tracking-tight">Sprints</h2>
                    <p className="text-xs text-slate-400">Plan work in iterations. Drag any task into a sprint via the task panel.</p>
                </div>
                <button className="primary-button" onClick={() => setCreateOpen(true)}><Plus size={14} /> New sprint</button>
            </div>
            <div className="space-y-4">
                {grouped.length === 0 && <p className="py-12 text-center text-sm text-slate-400">No sprints yet.</p>}
                {grouped.map(({ sprint, tasks: sprintTasks }) => {
                    const doneCount = sprintTasks.filter((t) => t.status_id === doneStatus?.id).length;
                    const total = sprintTasks.length;
                    const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
                    const meta = sprint ? STATUS_META[sprint.status] : null;
                    return (
                        <div key={sprint?.id || "backlog"} className="panel-card">
                            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        {sprint ? <Target size={14} className="text-indigo-500" /> : <Circle size={14} className="text-slate-400" />}
                                        <h3 className="text-sm font-semibold">{sprint?.name || "Backlog"}</h3>
                                        {sprint && <span className={`chip ${meta.color}`}>{meta.label}</span>}
                                        {sprint && (sprint.start_date || sprint.end_date) && (
                                            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400"><Calendar size={11} />{formatDate(sprint.start_date)} → {formatDate(sprint.end_date)}</span>
                                        )}
                                    </div>
                                    {sprint?.goal && <p className="mt-1 text-xs text-slate-500">{sprint.goal}</p>}
                                    <div className="mt-3 flex items-center gap-3">
                                        <div className="h-1.5 max-w-xs flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                                        </div>
                                        <span className="text-[11px] font-medium text-slate-500">{doneCount}/{total} done · {pct}%</span>
                                    </div>
                                </div>
                                {sprint && (
                                    <div className="flex items-center gap-1">
                                        {sprint.status === "planned" && <button className="soft-button h-8 text-[11px]" onClick={() => updateSprintStatus(sprint, "active")}><Play size={11} /> Start</button>}
                                        {sprint.status === "active" && <button className="soft-button h-8 text-[11px]" onClick={() => updateSprintStatus(sprint, "completed")}><CheckCircle2 size={11} /> Complete</button>}
                                    </div>
                                )}
                            </div>
                            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                {sprintTasks.length === 0 ? (
                                    <p className="px-5 py-8 text-center text-xs text-slate-400">No tasks in this {sprint ? "sprint" : "pool"} yet</p>
                                ) : (
                                    sprintTasks.map((t) => {
                                        const st = statuses.find((s) => s.id === t.status_id);
                                        const isDone = t.status_id === doneStatus?.id;
                                        return (
                                            <button key={t.id} className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/40" onClick={() => onOpenTask(t)}>
                                                <span className="text-[10px] font-semibold text-slate-400">{project?.key}-{t.number || t.id.slice(0, 4)}</span>
                                                <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium dark:bg-slate-800"><span className="h-1.5 w-1.5 rounded-full" style={{ background: st?.color || "#94a3b8" }} />{st?.name || "—"}</span>
                                                <span className={`flex-1 truncate text-sm ${isDone ? "text-slate-400 line-through" : ""}`}>{t.title}</span>
                                                <ChevronRight size={13} className="text-slate-400" />
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
            <CreateSprintModal open={createOpen} onClose={() => setCreateOpen(false)} projectId={project.id} onCreated={() => refreshSprints?.()} />
        </div>
    );
}

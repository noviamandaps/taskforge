"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
    ChevronDown,
    GitBranch,
    Link2,
    Loader2,
    Plus,
    Search,
    Trash2,
    X,
    ArrowRight,
    CheckSquare,
    Square,
} from "lucide-react";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

function Section({ title, count, icon: Icon, children, action }) {
    return (
        <div className="mt-6">
            <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    <Icon size={12} /> {title}
                    {count > 0 && <span className="rounded-md bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">{count}</span>}
                </div>
                {action}
            </div>
            {children}
        </div>
    );
}

function TaskPickerPopover({ tasks, onSelect, onClose, placeholder = "Search tasks…" }) {
    const [q, setQ] = useState("");
    const filtered = tasks.filter((t) => t.title.toLowerCase().includes(q.toLowerCase()));
    return (
        <div className="absolute right-0 top-9 z-20 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-slate-100 px-2.5 dark:border-slate-800">
                <Search size={13} className="text-slate-400" />
                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} className="h-9 flex-1 bg-transparent text-xs outline-none placeholder:text-slate-400" placeholder={placeholder} />
                <button className="icon-button h-7 w-7" onClick={onClose}><X size={13} /></button>
            </div>
            <div className="max-h-56 overflow-y-auto p-1">
                {filtered.length === 0 && <p className="px-3 py-4 text-center text-[11px] text-slate-400">No matches</p>}
                {filtered.map((t) => (
                    <button key={t.id} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => { onSelect(t); onClose(); }}>
                        <span className="h-2 w-2 rounded-full bg-slate-400" />
                        <span className="flex-1 truncate">{t.title}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

export default function SubtasksAndDependencies({ task, projectTasks, statuses, user, onOpenTask, onTasksMutated }) {
    const [subtasks, setSubtasks] = useState([]);
    const [deps, setDeps] = useState([]); // rows where task_id = current OR depends_on_task_id = current
    const [loading, setLoading] = useState(true);
    const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
    const [showBlockedByPicker, setShowBlockedByPicker] = useState(false);
    const [showBlocksPicker, setShowBlocksPicker] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        const [{ data: subs }, { data: dep1 }, { data: dep2 }] = await Promise.all([
            supabase.from("tasks").select("id, title, status_id, project_id").eq("parent_id", task.id),
            supabase.from("task_dependencies").select("*").eq("task_id", task.id),
            supabase.from("task_dependencies").select("*").eq("depends_on_task_id", task.id),
        ]);
        setSubtasks(subs || []);
        setDeps([...(dep1 || []), ...(dep2 || [])]);
        setLoading(false);
    }, [task.id]);

    useEffect(() => { load(); }, [load]);

    const firstStatus = statuses[0];

    const addSubtask = async () => {
        if (!newSubtaskTitle.trim() || !firstStatus) return;
        const { data, error } = await supabase.from("tasks").insert({
            project_id: task.project_id,
            status_id: firstStatus.id,
            parent_id: task.id,
            title: newSubtaskTitle.trim(),
            created_by: user.id,
        }).select().single();
        if (error) return alert(error.message);
        setSubtasks((prev) => [...prev, data]);
        setNewSubtaskTitle("");
        onTasksMutated?.();
    };

    const toggleSubtaskDone = async (subtask) => {
        const doneStatus = statuses.find((s) => s.name.toLowerCase() === "done") || statuses[statuses.length - 1];
        const isDone = subtask.status_id === doneStatus?.id;
        const newStatus = isDone ? firstStatus : doneStatus;
        setSubtasks((prev) => prev.map((s) => s.id === subtask.id ? { ...s, status_id: newStatus.id } : s));
        await supabase.from("tasks").update({ status_id: newStatus.id }).eq("id", subtask.id);
        onTasksMutated?.();
    };

    const deleteSubtask = async (subtask) => {
        if (!confirm(`Delete subtask "${subtask.title}"?`)) return;
        setSubtasks((prev) => prev.filter((s) => s.id !== subtask.id));
        await supabase.from("tasks").delete().eq("id", subtask.id);
        onTasksMutated?.();
    };

    const addDep = async (otherTask, iAmBlocked) => {
        // iAmBlocked = true: current task is blocked by otherTask -> row (task_id=current, depends_on=other)
        // iAmBlocked = false: current blocks other -> row (task_id=other, depends_on=current)
        const row = iAmBlocked
            ? { task_id: task.id, depends_on_task_id: otherTask.id, dependency_type: "blocks" }
            : { task_id: otherTask.id, depends_on_task_id: task.id, dependency_type: "blocks" };
        const { error } = await supabase.from("task_dependencies").insert(row);
        if (error) return alert(error.message);
        load();
    };

    const removeDep = async (row) => {
        await supabase.from("task_dependencies").delete().eq("task_id", row.task_id).eq("depends_on_task_id", row.depends_on_task_id);
        setDeps((prev) => prev.filter((d) => !(d.task_id === row.task_id && d.depends_on_task_id === row.depends_on_task_id)));
    };

    const taskById = Object.fromEntries(projectTasks.map((t) => [t.id, t]));
    const doneStatus = statuses.find((s) => s.name.toLowerCase() === "done") || statuses[statuses.length - 1];

    // From current task perspective
    const blockedByRows = deps.filter((d) => d.task_id === task.id); // current is blocked by depends_on_task_id
    const blocksRows = deps.filter((d) => d.depends_on_task_id === task.id); // current blocks task_id

    const eligible = projectTasks.filter((t) => t.id !== task.id && t.parent_id !== task.id);

    if (loading) return <div className="mt-6 flex items-center justify-center py-4"><Loader2 size={14} className="animate-spin text-slate-400" /></div>;

    return (
        <>
            {/* Subtasks */}
            <Section title="Subtasks" count={subtasks.length} icon={CheckSquare} action={<span className="text-[10px] text-slate-400">{subtasks.filter((s) => s.status_id === doneStatus?.id).length}/{subtasks.length}</span>}>
                <div className="space-y-1">
                    {subtasks.length > 0 && subtasks.map((s) => {
                        const isDone = s.status_id === doneStatus?.id;
                        return (
                            <div key={s.id} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                <button onClick={() => toggleSubtaskDone(s)} aria-label="Toggle done">
                                    {isDone ? <CheckSquare size={14} className="text-emerald-500" /> : <Square size={14} className="text-slate-400" />}
                                </button>
                                <button className={`flex-1 truncate text-left text-sm ${isDone ? "text-slate-400 line-through" : ""}`} onClick={() => onOpenTask(s)}>{s.title}</button>
                                <button className="opacity-0 transition group-hover:opacity-100" onClick={() => deleteSubtask(s)} aria-label="Delete"><Trash2 size={12} className="text-slate-400 hover:text-rose-500" /></button>
                            </div>
                        );
                    })}
                    <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-200 px-2 py-1.5 dark:border-slate-800">
                        <Plus size={14} className="text-slate-400" />
                        <input value={newSubtaskTitle} onChange={(e) => setNewSubtaskTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSubtask()} placeholder="Add subtask…" className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
                    </div>
                </div>
            </Section>

            {/* Dependencies */}
            <Section title="Dependencies" count={blockedByRows.length + blocksRows.length} icon={Link2}>
                <div className="space-y-3">
                    <div className="relative">
                        <div className="mb-1 flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-slate-500">Blocked by</span>
                            <button className="soft-button h-7 text-[11px]" onClick={() => setShowBlockedByPicker(true)}><Plus size={12} /> Add</button>
                        </div>
                        {showBlockedByPicker && <TaskPickerPopover tasks={eligible.filter((t) => !blockedByRows.some((r) => r.depends_on_task_id === t.id))} onSelect={(t) => addDep(t, true)} onClose={() => setShowBlockedByPicker(false)} placeholder="Add task that blocks this…" />}
                        <div className="space-y-1">
                            {blockedByRows.length === 0 && <p className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-center text-[11px] text-slate-400 dark:border-slate-800">Not blocked by anything</p>}
                            {blockedByRows.map((r) => {
                                const t = taskById[r.depends_on_task_id];
                                if (!t) return null;
                                const st = statuses.find((s) => s.id === t.status_id);
                                return (
                                    <div key={r.depends_on_task_id} className="group flex items-center gap-2 rounded-lg border border-slate-100 px-2 py-1.5 dark:border-slate-800">
                                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: st?.color || "#94a3b8" }} />
                                        <button className="flex-1 truncate text-left text-sm" onClick={() => onOpenTask(t)}>{t.title}</button>
                                        <button onClick={() => removeDep(r)} className="opacity-0 transition group-hover:opacity-100" aria-label="Remove"><X size={12} className="text-slate-400 hover:text-rose-500" /></button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div className="relative">
                        <div className="mb-1 flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-slate-500">Blocks</span>
                            <button className="soft-button h-7 text-[11px]" onClick={() => setShowBlocksPicker(true)}><Plus size={12} /> Add</button>
                        </div>
                        {showBlocksPicker && <TaskPickerPopover tasks={eligible.filter((t) => !blocksRows.some((r) => r.task_id === t.id))} onSelect={(t) => addDep(t, false)} onClose={() => setShowBlocksPicker(false)} placeholder="Add task that this blocks…" />}
                        <div className="space-y-1">
                            {blocksRows.length === 0 && <p className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-center text-[11px] text-slate-400 dark:border-slate-800">Doesn’t block anything</p>}
                            {blocksRows.map((r) => {
                                const t = taskById[r.task_id];
                                if (!t) return null;
                                const st = statuses.find((s) => s.id === t.status_id);
                                return (
                                    <div key={r.task_id} className="group flex items-center gap-2 rounded-lg border border-slate-100 px-2 py-1.5 dark:border-slate-800">
                                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: st?.color || "#94a3b8" }} />
                                        <button className="flex-1 truncate text-left text-sm" onClick={() => onOpenTask(t)}>{t.title}</button>
                                        <button onClick={() => removeDep(r)} className="opacity-0 transition group-hover:opacity-100" aria-label="Remove"><X size={12} className="text-slate-400 hover:text-rose-500" /></button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Mini dependency graph */}
                {(blockedByRows.length > 0 || blocksRows.length > 0) && (
                    <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/30">
                        <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400"><GitBranch size={11} /> Dependency graph</div>
                        <div className="flex items-start gap-2 overflow-x-auto text-[11px]">
                            <div className="flex flex-col gap-1">
                                {blockedByRows.length === 0 ? <div className="rounded-md border border-dashed border-slate-200 px-2 py-1 text-slate-400 dark:border-slate-700">—</div> :
                                    blockedByRows.map((r) => { const t = taskById[r.depends_on_task_id]; return t ? <button key={r.depends_on_task_id} onClick={() => onOpenTask(t)} className="max-w-[140px] truncate rounded-md border border-slate-200 bg-white px-2 py-1 text-left hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-900">{t.title}</button> : null; })
                                }
                            </div>
                            <ArrowRight size={14} className="mt-2 text-slate-400" />
                            <div className="max-w-[160px] truncate rounded-md border-2 border-indigo-500 bg-indigo-50 px-2 py-1 font-semibold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">{task.title}</div>
                            <ArrowRight size={14} className="mt-2 text-slate-400" />
                            <div className="flex flex-col gap-1">
                                {blocksRows.length === 0 ? <div className="rounded-md border border-dashed border-slate-200 px-2 py-1 text-slate-400 dark:border-slate-700">—</div> :
                                    blocksRows.map((r) => { const t = taskById[r.task_id]; return t ? <button key={r.task_id} onClick={() => onOpenTask(t)} className="max-w-[140px] truncate rounded-md border border-slate-200 bg-white px-2 py-1 text-left hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-900">{t.title}</button> : null; })
                                }
                            </div>
                        </div>
                    </div>
                )}
            </Section>
        </>
    );
}

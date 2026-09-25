"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Activity, ArrowRight, Loader2 } from "lucide-react";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

const initials = (v = "") => v.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";
const formatWhen = (iso) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

function describe(entry, membersById, statusesById) {
    const meta = entry.metadata || {};
    const actor = membersById[entry.actor_id]?.full_name || membersById[entry.actor_id]?.email || "Someone";
    switch (entry.action) {
        case "created":
            return { actor, verb: "created this task", detail: null };
        case "status_changed":
            return { actor, verb: "changed status", detail: <span className="inline-flex items-center gap-1 text-[11px]"><span className="chip bg-slate-100 dark:bg-slate-800">{meta.from_name || "—"}</span><ArrowRight size={10} /><span className="chip bg-slate-100 dark:bg-slate-800">{meta.to_name || "—"}</span></span> };
        case "priority_changed":
            return { actor, verb: "changed priority", detail: <span className="inline-flex items-center gap-1 text-[11px]"><span className="chip bg-slate-100 dark:bg-slate-800">{meta.from || "—"}</span><ArrowRight size={10} /><span className="chip bg-slate-100 dark:bg-slate-800">{meta.to || "—"}</span></span> };
        case "assigned":
            return { actor, verb: "assigned", detail: <span className="text-[11px] text-slate-500">to {membersById[meta.to]?.full_name || membersById[meta.to]?.email || "someone"}</span> };
        case "unassigned":
            return { actor, verb: "unassigned", detail: null };
        case "due_changed":
            return { actor, verb: "changed due date", detail: <span className="text-[11px] text-slate-500">to {meta.to || "none"}</span> };
        case "title_changed":
            return { actor, verb: "renamed the task", detail: null };
        case "commented":
            return { actor, verb: "commented", detail: null };
        default:
            return { actor, verb: entry.action.replace(/_/g, " "), detail: null };
    }
}

export default function ActivityLog({ taskId, membersById, statusesById }) {
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase
            .from("activity_log")
            .select("id, action, metadata, actor_id, created_at")
            .eq("task_id", taskId)
            .order("created_at", { ascending: false })
            .limit(50);
        setEntries(data || []);
        setLoading(false);
    }, [taskId]);

    useEffect(() => { if (taskId) load(); }, [taskId, load]);

    return (
        <div className="mt-8">
            <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                <Activity size={12} /> Activity
                {entries.length > 0 && <span className="rounded-md bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">{entries.length}</span>}
            </div>
            {loading ? (
                <div className="flex items-center justify-center py-4"><Loader2 size={14} className="animate-spin text-slate-400" /></div>
            ) : entries.length === 0 ? (
                <p className="py-3 text-center text-xs text-slate-400">No activity yet</p>
            ) : (
                <ol className="relative space-y-3 border-l border-slate-100 pl-4 dark:border-slate-800">
                    {entries.map((e) => {
                        const d = describe(e, membersById, statusesById);
                        return (
                            <li key={e.id} className="relative">
                                <span className="absolute -left-[21px] top-1 flex h-3 w-3 items-center justify-center rounded-full border-2 border-white bg-indigo-500 dark:border-slate-900" />
                                <div className="flex items-center gap-2 text-xs">
                                    <span className="avatar h-6 w-6 bg-indigo-100 text-[9px] text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">{initials(d.actor)}</span>
                                    <span className="font-semibold">{d.actor}</span>
                                    <span className="text-slate-500">{d.verb}</span>
                                    {d.detail}
                                    <span className="ml-auto text-[10px] text-slate-400">{formatWhen(e.created_at)}</span>
                                </div>
                            </li>
                        );
                    })}
                </ol>
            )}
        </div>
    );
}

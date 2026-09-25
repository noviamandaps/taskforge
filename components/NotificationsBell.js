"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Bell, CheckCheck, Loader2 } from "lucide-react";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

const initials = (v = "") => v.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";
const formatWhen = (iso) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

function describe(n, membersById) {
    const actor = membersById[n.actor_id]?.full_name || membersById[n.actor_id]?.email || "Someone";
    switch (n.type) {
        case "mention":
            return { actor, verb: "mentioned you", detail: n.metadata?.snippet || n.metadata?.task_title || "" };
        case "assigned":
            return { actor, verb: "assigned you a task", detail: n.metadata?.task_title || "" };
        case "comment_reply":
            return { actor, verb: "replied to your comment", detail: n.metadata?.task_title || "" };
        default:
            return { actor, verb: n.type.replace(/_/g, " "), detail: "" };
    }
}

export default function NotificationsBell({ user, workspaceId, membersById, onOpenTask }) {
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const ref = useRef();

    const load = useCallback(async () => {
        if (!workspaceId) return;
        setLoading(true);
        const { data } = await supabase
            .from("notifications")
            .select("*")
            .eq("user_id", user.id)
            .eq("workspace_id", workspaceId)
            .order("created_at", { ascending: false })
            .limit(30);
        setItems(data || []);
        setLoading(false);
    }, [user.id, workspaceId]);

    useEffect(() => { load(); }, [load]);

    // Realtime subscription for new notifications
    useEffect(() => {
        if (!workspaceId) return;
        const channel = supabase.channel(`notifs:${user.id}`)
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, (payload) => {
                setItems((prev) => [payload.new, ...prev]);
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [user.id, workspaceId]);

    useEffect(() => {
        if (!open) return;
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        window.addEventListener("mousedown", handler);
        return () => window.removeEventListener("mousedown", handler);
    }, [open]);

    const unread = items.filter((i) => !i.read).length;

    const markAllRead = async () => {
        setItems((prev) => prev.map((i) => ({ ...i, read: true })));
        await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    };

    const openItem = async (n) => {
        if (!n.read) {
            setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, read: true } : i)));
            await supabase.from("notifications").update({ read: true }).eq("id", n.id);
        }
        if (n.task_id) onOpenTask?.(n.task_id);
        setOpen(false);
    };

    return (
        <div className="relative" ref={ref}>
            <button className="icon-button relative" aria-label="Notifications" onClick={() => setOpen(!open)}>
                <Bell size={17} />
                {unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>}
            </button>
            {open && (
                <div className="absolute right-0 top-11 z-30 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
                        <span className="text-sm font-semibold">Inbox</span>
                        {unread > 0 && <button className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-700" onClick={markAllRead}><CheckCheck size={12} /> Mark all read</button>}
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                        {loading ? (
                            <div className="flex items-center justify-center py-6"><Loader2 size={16} className="animate-spin text-slate-400" /></div>
                        ) : items.length === 0 ? (
                            <p className="px-4 py-10 text-center text-xs text-slate-400">Nothing new</p>
                        ) : (
                            items.map((n) => {
                                const d = describe(n, membersById);
                                return (
                                    <button key={n.id} className={`flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40 ${!n.read ? "bg-indigo-50/30 dark:bg-indigo-950/10" : ""}`} onClick={() => openItem(n)}>
                                        {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />}
                                        <span className={`avatar h-7 w-7 shrink-0 bg-indigo-100 text-[10px] text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 ${n.read ? "ml-2" : ""}`}>{initials(d.actor)}</span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-sm"><span className="font-semibold">{d.actor}</span> <span className="text-slate-500">{d.verb}</span></span>
                                            {d.detail && <span className="block truncate text-[11px] text-slate-500">{d.detail}</span>}
                                            <span className="block text-[10px] text-slate-400">{formatWhen(n.created_at)}</span>
                                        </span>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

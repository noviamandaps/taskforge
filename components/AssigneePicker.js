"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, UserX } from "lucide-react";

const initials = (v = "") => v.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";

export default function AssigneePicker({ value, members, onChange }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const ref = useRef();

    useEffect(() => {
        if (!open) return;
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        window.addEventListener("mousedown", handler);
        return () => window.removeEventListener("mousedown", handler);
    }, [open]);

    const selected = members.find((m) => m.id === value);
    const filtered = useMemo(() => {
        const q = query.toLowerCase();
        if (!q) return members;
        return members.filter((m) => (m.full_name || "").toLowerCase().includes(q) || (m.email || "").toLowerCase().includes(q));
    }, [members, query]);

    return (
        <div className="relative" ref={ref}>
            <button className="inline-flex items-center gap-2 rounded-md border border-transparent bg-transparent px-2 py-1 text-xs text-slate-700 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" onClick={() => setOpen(!open)}>
                {selected ? (
                    <>
                        <span className="avatar h-6 w-6 bg-indigo-100 text-[9px] text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">{initials(selected.full_name || selected.email)}</span>
                        <span className="truncate">{selected.full_name || selected.email}</span>
                    </>
                ) : (
                    <>
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800"><UserX size={11} /></span>
                        <span className="text-slate-500">Unassigned</span>
                    </>
                )}
                <ChevronDown size={12} className="text-slate-400" />
            </button>
            {open && (
                <div className="absolute left-0 top-8 z-20 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex items-center gap-2 border-b border-slate-100 px-2.5 dark:border-slate-800">
                        <Search size={13} className="text-slate-400" />
                        <input autoFocus className="h-8 flex-1 bg-transparent text-xs outline-none placeholder:text-slate-400" placeholder="Search people…" value={query} onChange={(e) => setQuery(e.target.value)} />
                    </div>
                    <div className="max-h-64 overflow-y-auto p-1">
                        <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => { onChange(null); setOpen(false); }}>
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800"><UserX size={11} /></span>
                            <span className="flex-1 text-slate-500">Unassigned</span>
                            {value == null && <Check size={13} className="text-indigo-600" />}
                        </button>
                        {filtered.length === 0 && <p className="px-3 py-4 text-center text-[11px] text-slate-400">No matches</p>}
                        {filtered.map((m) => (
                            <button key={m.id} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => { onChange(m.id); setOpen(false); }}>
                                <span className="avatar h-6 w-6 bg-indigo-100 text-[9px] text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">{initials(m.full_name || m.email)}</span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-xs font-medium">{m.full_name || m.email}</span>
                                    <span className="block truncate text-[10px] text-slate-400">{m.email}</span>
                                </span>
                                {value === m.id && <Check size={13} className="text-indigo-600" />}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

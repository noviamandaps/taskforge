"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

const PRIORITY_COLORS = {
    urgent: "#e11d48", high: "#f97316", medium: "#f59e0b", low: "#0ea5e9", no_priority: "#94a3b8",
};

function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d; }
function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function diffDays(a, b) { return Math.round((startOfDay(a) - startOfDay(b)) / 86400000); }
function formatDay(d) { return d.toLocaleDateString(undefined, { day: "numeric", month: "short" }); }
function formatMonth(d) { return d.toLocaleDateString(undefined, { month: "long", year: "numeric" }); }

export default function TimelineView({ project, tasks, statuses, onOpenTask }) {
    const [anchor, setAnchor] = useState(startOfDay(new Date()));
    const DAYS = 30;
    const start = addDays(anchor, -7);
    const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => addDays(start, i)), [start.getTime()]); // eslint-disable-line
    const statusById = Object.fromEntries(statuses.map((s) => [s.id, s]));

    const withDue = tasks.filter((t) => t.due_date);
    const noDue = tasks.filter((t) => !t.due_date);

    const cellWidth = 44;

    return (
        <div className="px-5 pb-8 sm:px-8 lg:px-10">
            <div className="panel-card">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                        <button className="icon-button h-8 w-8" onClick={() => setAnchor(addDays(anchor, -14))} aria-label="Previous"><ChevronLeft size={15} /></button>
                        <button className="soft-button" onClick={() => setAnchor(startOfDay(new Date()))}><CalendarDays size={13} /> Today</button>
                        <button className="icon-button h-8 w-8" onClick={() => setAnchor(addDays(anchor, 14))} aria-label="Next"><ChevronRight size={15} /></button>
                        <span className="ml-2 text-sm font-semibold">{formatMonth(anchor)}</span>
                    </div>
                    <span className="text-[11px] text-slate-400">{withDue.length} scheduled · {noDue.length} unscheduled</span>
                </div>
                <div className="overflow-x-auto">
                    {/* Date header */}
                    <div className="relative flex border-b border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/30">
                        <div className="sticky left-0 z-10 w-[220px] shrink-0 border-r border-slate-100 bg-slate-50/80 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:border-slate-800 dark:bg-slate-800/60">Task</div>
                        {days.map((d) => {
                            const isToday = d.getTime() === startOfDay(new Date()).getTime();
                            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                            return (
                                <div key={d.getTime()} className={`flex shrink-0 flex-col items-center justify-center border-r border-slate-100 py-1.5 text-[10px] dark:border-slate-800 ${isToday ? "bg-indigo-50 text-indigo-700 font-semibold dark:bg-indigo-950/40 dark:text-indigo-300" : isWeekend ? "text-slate-400" : "text-slate-500"}`} style={{ width: cellWidth }}>
                                    <span className="text-[9px] uppercase">{d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2)}</span>
                                    <span>{d.getDate()}</span>
                                </div>
                            );
                        })}
                    </div>
                    {/* Rows */}
                    <div className="relative">
                        {withDue.length === 0 && <div className="px-4 py-14 text-center text-xs text-slate-400">No tasks with due dates yet. Set a due date in the task panel to see them here.</div>}
                        {withDue.map((t) => {
                            const due = new Date(t.due_date);
                            const daysFromStart = diffDays(due, start);
                            const isVisible = daysFromStart >= 0 && daysFromStart < DAYS;
                            const st = statusById[t.status_id];
                            const barColor = PRIORITY_COLORS[t.priority] || "#6366f1";
                            return (
                                <div key={t.id} className="relative flex border-b border-slate-100 hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/30">
                                    <button className="sticky left-0 z-10 flex w-[220px] shrink-0 items-center gap-2 border-r border-slate-100 bg-white px-4 py-2 text-left text-xs dark:border-slate-800 dark:bg-slate-900" onClick={() => onOpenTask(t)}>
                                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: st?.color || "#94a3b8" }} />
                                        <span className="truncate">{t.title}</span>
                                    </button>
                                    <div className="relative flex" style={{ width: cellWidth * DAYS }}>
                                        {days.map((d) => <div key={d.getTime()} className="h-full shrink-0 border-r border-slate-100 dark:border-slate-800" style={{ width: cellWidth }} />)}
                                        {isVisible && (
                                            <button
                                                onClick={() => onOpenTask(t)}
                                                className="absolute top-1/2 flex h-6 -translate-y-1/2 items-center gap-1.5 rounded-md px-2 text-[10px] font-medium text-white shadow-sm transition hover:opacity-90"
                                                style={{ left: daysFromStart * cellWidth + 4, background: barColor, minWidth: cellWidth - 8 }}
                                                title={t.title}
                                            >
                                                <span className="truncate">{t.title}</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        {/* Today indicator */}
                        {(() => {
                            const today = startOfDay(new Date());
                            const idx = diffDays(today, start);
                            if (idx < 0 || idx >= DAYS) return null;
                            const leftOffset = 220 + idx * cellWidth + cellWidth / 2;
                            return <div className="pointer-events-none absolute inset-y-0 z-0 w-px bg-indigo-400/60" style={{ left: leftOffset, top: 0 }} />;
                        })()}
                    </div>
                </div>
            </div>
        </div>
    );
}

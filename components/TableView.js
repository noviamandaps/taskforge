"use client";

import { useMemo, useState } from "react";
import {
    createColumnHelper,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, ArrowUp, ArrowDown, Columns3, Search } from "lucide-react";

const PRIORITY_META = {
    urgent: { label: "Urgent", color: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" },
    high: { label: "High", color: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300" },
    medium: { label: "Medium", color: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" },
    low: { label: "Low", color: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300" },
    no_priority: { label: "None", color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
};
const initials = (v = "") => v.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";
const formatDate = (iso) => iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—";

export default function TableView({ project, tasks, statuses, onOpenTask }) {
    const [sorting, setSorting] = useState([]);
    const [globalFilter, setGlobalFilter] = useState("");
    const [columnVisibility, setColumnVisibility] = useState({});
    const [columnsMenu, setColumnsMenu] = useState(false);

    const statusById = useMemo(() => Object.fromEntries(statuses.map((s) => [s.id, s])), [statuses]);

    const columns = useMemo(() => {
        const ch = createColumnHelper();
        return [
            ch.accessor((row) => `${project?.key || ""}-${row.number || row.id.slice(0, 4).toUpperCase()}`, {
                id: "key", header: "Key", cell: (info) => <span className="text-[11px] font-semibold text-slate-500">{info.getValue()}</span>, size: 90,
            }),
            ch.accessor("title", { id: "title", header: "Title", cell: (info) => <span className="text-sm font-medium">{info.getValue()}</span> }),
            ch.accessor((row) => statusById[row.status_id]?.name || "—", {
                id: "status", header: "Status", cell: (info) => {
                    const st = statusById[info.row.original.status_id];
                    return <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium dark:bg-slate-800"><span className="h-1.5 w-1.5 rounded-full" style={{ background: st?.color || "#94a3b8" }} />{st?.name || "—"}</span>;
                }, size: 130,
            }),
            ch.accessor("priority", {
                id: "priority", header: "Priority", cell: (info) => { const p = PRIORITY_META[info.getValue()] || PRIORITY_META.no_priority; return <span className={`chip ${p.color}`}>{p.label}</span>; }, size: 100,
            }),
            ch.accessor("due_date", {
                id: "due", header: "Due", cell: (info) => <span className="text-[11px] text-slate-500">{formatDate(info.getValue())}</span>, size: 90,
            }),
            ch.accessor("assignee_name", {
                id: "assignee", header: "Assignee", cell: (info) => info.getValue() ? <span className="inline-flex items-center gap-1.5 text-xs"><span className="avatar h-6 w-6 bg-slate-100 text-[9px] text-slate-500 dark:bg-slate-800 dark:text-slate-300">{initials(info.getValue())}</span>{info.getValue()}</span> : <span className="text-xs text-slate-400">Unassigned</span>, size: 160,
            }),
            ch.accessor("created_at", { id: "created", header: "Created", cell: (info) => <span className="text-[11px] text-slate-500">{formatDate(info.getValue())}</span>, size: 100 }),
        ];
    }, [project, statusById]);

    const table = useReactTable({
        data: tasks,
        columns,
        state: { sorting, globalFilter, columnVisibility },
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        onColumnVisibilityChange: setColumnVisibility,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        globalFilterFn: (row, columnId, value) => {
            const q = String(value || "").toLowerCase();
            if (!q) return true;
            const t = row.original;
            const status = statusById[t.status_id]?.name || "";
            return [t.title, status, t.priority, t.assignee_name].some((v) => String(v || "").toLowerCase().includes(q));
        },
    });

    return (
        <div className="px-5 pb-8 sm:px-8 lg:px-10">
            <div className="panel-card">
                <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                    <div className="flex flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 dark:border-slate-700 dark:bg-slate-950">
                        <Search size={14} className="text-slate-400" />
                        <input value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} placeholder="Filter tasks…" className="h-8 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
                    </div>
                    <div className="relative">
                        <button className="soft-button" onClick={() => setColumnsMenu(!columnsMenu)}><Columns3 size={13} /> Columns</button>
                        {columnsMenu && (
                            <div className="absolute right-0 top-10 z-10 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                                <div className="px-1 pb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Toggle columns</div>
                                {table.getAllLeafColumns().map((col) => (
                                    <label key={col.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800">
                                        <input type="checkbox" checked={col.getIsVisible()} onChange={col.getToggleVisibilityHandler()} className="accent-indigo-600" />
                                        <span className="capitalize">{col.id}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            {table.getHeaderGroups().map((hg) => (
                                <tr key={hg.id} className="border-b border-slate-100 dark:border-slate-800">
                                    {hg.headers.map((h) => {
                                        const canSort = h.column.getCanSort();
                                        const sorted = h.column.getIsSorted();
                                        return (
                                            <th key={h.id} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500" style={{ width: h.getSize() }}>
                                                <button className={`inline-flex items-center gap-1 ${canSort ? "hover:text-slate-900 dark:hover:text-white" : ""}`} onClick={h.column.getToggleSortingHandler()} disabled={!canSort}>
                                                    {flexRender(h.column.columnDef.header, h.getContext())}
                                                    {canSort && (sorted === "asc" ? <ArrowUp size={11} /> : sorted === "desc" ? <ArrowDown size={11} /> : <ArrowUpDown size={11} className="opacity-40" />)}
                                                </button>
                                            </th>
                                        );
                                    })}
                                </tr>
                            ))}
                        </thead>
                        <tbody>
                            {table.getRowModel().rows.length === 0 && (
                                <tr><td colSpan={columns.length} className="px-4 py-10 text-center text-xs text-slate-400">No tasks yet</td></tr>
                            )}
                            {table.getRowModel().rows.map((row) => (
                                <tr key={row.id} className="cursor-pointer border-b border-slate-100 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40" onClick={() => onOpenTask(row.original)}>
                                    {row.getVisibleCells().map((cell) => (
                                        <td key={cell.id} className="px-4 py-3">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400 dark:border-slate-800">
                    <span>{table.getRowModel().rows.length} of {tasks.length} tasks</span>
                    {globalFilter && <button className="hover:text-slate-700" onClick={() => setGlobalFilter("")}>Clear filter</button>}
                </div>
            </div>
        </div>
    );
}

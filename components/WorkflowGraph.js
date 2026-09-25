"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    addEdge,
    useNodesState,
    useEdgesState,
    MarkerType,
    Handle,
    Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Info, Save, RefreshCw } from "lucide-react";

function StatusNode({ data }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-900" style={{ borderColor: data.color }}>
            <Handle type="target" position={Position.Left} className="!bg-slate-300 dark:!bg-slate-600" />
            <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: data.color }} />
                <span className="text-sm font-semibold">{data.name}</span>
                <span className="chip bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">{data.count}</span>
            </div>
            <Handle type="source" position={Position.Right} className="!bg-slate-300 dark:!bg-slate-600" />
        </div>
    );
}

const NODE_TYPES = { status: StatusNode };

export default function WorkflowGraph({ project, statuses, tasks }) {
    const storageKey = `taskforge-workflow-${project.id}`;
    const initial = useMemo(() => {
        const raw = typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null;
        try { return raw ? JSON.parse(raw) : null; } catch { return null; }
    }, [storageKey]);

    // Build default nodes/edges in sequence: s1 -> s2 -> ... -> sN
    const buildDefault = useCallback(() => {
        const nodes = statuses.map((s, idx) => ({
            id: s.id,
            type: "status",
            position: { x: 60 + idx * 220, y: 120 + (idx % 2) * 30 },
            data: { name: s.name, color: s.color, count: tasks.filter((t) => t.status_id === s.id).length },
        }));
        const edges = statuses.slice(0, -1).map((s, i) => ({
            id: `${s.id}-${statuses[i + 1].id}`,
            source: s.id,
            target: statuses[i + 1].id,
            markerEnd: { type: MarkerType.ArrowClosed, color: "#6366f1" },
            style: { stroke: "#6366f1", strokeWidth: 1.5 },
        }));
        return { nodes, edges };
    }, [statuses, tasks]);

    const seed = initial ? {
        nodes: statuses.map((s, idx) => {
            const saved = initial.nodes?.find((n) => n.id === s.id);
            return {
                id: s.id, type: "status",
                position: saved?.position || { x: 60 + idx * 220, y: 120 },
                data: { name: s.name, color: s.color, count: tasks.filter((t) => t.status_id === s.id).length },
            };
        }),
        edges: initial.edges || [],
    } : buildDefault();

    const [nodes, setNodes, onNodesChange] = useNodesState(seed.nodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(seed.edges);
    const [saved, setSaved] = useState(true);

    // Refresh counts when tasks change
    useEffect(() => {
        setNodes((ns) => ns.map((n) => ({ ...n, data: { ...n.data, count: tasks.filter((t) => t.status_id === n.id).length } })));
    }, [tasks, setNodes]);

    const onConnect = useCallback((params) => {
        setEdges((eds) => addEdge({ ...params, markerEnd: { type: MarkerType.ArrowClosed, color: "#6366f1" }, style: { stroke: "#6366f1", strokeWidth: 1.5 } }, eds));
        setSaved(false);
    }, [setEdges]);

    const persist = () => {
        const payload = { nodes: nodes.map((n) => ({ id: n.id, position: n.position })), edges };
        window.localStorage.setItem(storageKey, JSON.stringify(payload));
        setSaved(true);
    };

    const reset = () => {
        const def = buildDefault();
        setNodes(def.nodes);
        setEdges(def.edges);
        window.localStorage.removeItem(storageKey);
        setSaved(true);
    };

    return (
        <div className="px-5 pb-8 sm:px-8 lg:px-10">
            <div className="panel-card">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">Status workflow</span>
                        <span className="chip bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">{statuses.length} statuses · {edges.length} transitions</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="soft-button" onClick={reset}><RefreshCw size={13} /> Reset</button>
                        <button className="primary-button" onClick={persist} disabled={saved}><Save size={13} /> {saved ? "Saved" : "Save layout"}</button>
                    </div>
                </div>
                <div className="h-[520px]">
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={(c) => { onNodesChange(c); if (c.some((x) => x.type === "position")) setSaved(false); }}
                        onEdgesChange={(c) => { onEdgesChange(c); if (c.some((x) => x.type === "remove")) setSaved(false); }}
                        onConnect={onConnect}
                        nodeTypes={NODE_TYPES}
                        fitView
                        fitViewOptions={{ padding: 0.2 }}
                        proOptions={{ hideAttribution: true }}
                    >
                        <Background gap={20} size={1} color="#e2e8f0" />
                        <Controls className="!border-slate-200 dark:!border-slate-700" />
                        <MiniMap pannable zoomable className="!border !border-slate-200 dark:!border-slate-700" />
                    </ReactFlow>
                </div>
                <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400 dark:border-slate-800">
                    <Info size={11} /> Drag from the right handle of a node to the left handle of another to allow a transition. Layout is stored in your browser.
                </div>
            </div>
        </div>
    );
}

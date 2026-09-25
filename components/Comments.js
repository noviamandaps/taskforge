"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Loader2, Reply, Trash2, MessageSquare } from "lucide-react";
import NotionEditor from "./NotionEditor";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

const initials = (v = "") => v.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";
const formatWhen = (iso) => { const d = new Date(iso); return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); };

function RenderedContent({ content }) {
    // Read-only preview of tiptap JSON via a mini editor
    return <NotionEditor value={content} onChange={() => {}} minimal readOnly />;
}

function CommentComposer({ taskId, user, parentId, onDone, onCancel, placeholder }) {
    const [content, setContent] = useState(null);
    const [busy, setBusy] = useState(false);
    const [key, setKey] = useState(0);
    const submit = async () => {
        if (!content || !hasContent(content)) return;
        setBusy(true);
        const { data, error } = await supabase.from("comments").insert({
            task_id: taskId,
            author_id: user.id,
            parent_id: parentId || null,
            body: content,
        }).select().single();
        setBusy(false);
        if (error) { alert(error.message); return; }
        onDone?.({ ...data, author_name: user.user_metadata?.full_name || user.email });
        setContent(null);
        setKey((k) => k + 1);
    };
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/50">
            <div key={key} className="min-h-[60px]">
                <NotionEditor value={content} onChange={setContent} placeholder={placeholder || "Write a comment…"} minimal />
            </div>
            <div className="mt-2 flex items-center justify-end gap-2">
                {onCancel && <button className="ghost-button" onClick={onCancel} type="button">Cancel</button>}
                <button className="primary-button" onClick={submit} disabled={busy || !content || !hasContent(content)}>
                    {busy && <Loader2 size={13} className="animate-spin" />} {parentId ? "Reply" : "Comment"}
                </button>
            </div>
        </div>
    );
}

function hasContent(json) {
    if (!json) return false;
    const walk = (node) => {
        if (node?.text && node.text.trim()) return true;
        if (node?.type === "taskItem") return true;
        if (node?.content) return node.content.some(walk);
        return false;
    };
    return walk(json);
}

const textOf = (json) => { let out = ""; (function walk(n) { if (!n) return; if (n.type === "text" && n.text) out += n.text + " "; (n.content || []).forEach(walk); })(json); return out; };

function CommentItem({ comment, user, workspaceId, taskTitle, children, onReply, onDelete }) {
    const [replying, setReplying] = useState(false);
    return (
        <div>
            <div className="flex gap-3">
                <span className="avatar h-8 w-8 shrink-0 bg-indigo-100 text-[10px] text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">{initials(comment.author_name || "?")}</span>
                <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                        <span className="text-sm font-semibold">{comment.author_name || "Unknown"}</span>
                        <span className="text-[11px] text-slate-400">{formatWhen(comment.created_at)}</span>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900">
                        <NotionEditor value={comment.body} onChange={() => {}} minimal />
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-400">
                        <button className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200" onClick={() => setReplying((v) => !v)}><Reply size={11} /> Reply</button>
                        {comment.author_id === user.id && <button className="inline-flex items-center gap-1 hover:text-rose-600" onClick={() => onDelete(comment)}><Trash2 size={11} /> Delete</button>}
                    </div>
                    {replying && (
                        <div className="mt-2">
                            <CommentComposer taskId={comment.task_id} user={user} parentId={comment.id} onDone={(reply) => {
                                onReply(reply); setReplying(false);
                                if (comment.author_id !== user.id) supabase.from("notifications").insert({ user_id: comment.author_id, workspace_id: workspaceId, task_id: comment.task_id, comment_id: reply.id, actor_id: user.id, type: "comment_reply", metadata: { task_title: taskTitle } });
                            }} onCancel={() => setReplying(false)} placeholder="Reply…" />
                        </div>
                    )}
                    {children && <div className="mt-3 space-y-3 border-l-2 border-slate-100 pl-4 dark:border-slate-800">{children}</div>}
                </div>
            </div>
        </div>
    );
}

// ponytail: mention dicocokkan dari teks "@nama" tanpa picker di editor —
// first-name match bisa kena orang dengan nama sama. Dropdown beneran?
// @tiptap/extension-mention sudah terpasang, tinggal disetel di NotionEditor.
export default function Comments({ taskId, user, workspaceId, taskTitle, members = [], taskAssigneeId }) {
    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("comments")
            .select("id, task_id, author_id, parent_id, body, created_at, updated_at")
            .eq("task_id", taskId)
            .order("created_at", { ascending: true });
        if (error) { setLoading(false); return; }
        // fetch author names lazily (we only have user auth; store user's own name for own comments)
        const withNames = (data || []).map((c) => ({
            ...c,
            author_name: c.author_id === user.id ? (user.user_metadata?.full_name || user.email) : "Teammate",
        }));
        setComments(withNames);
        setLoading(false);
    }, [taskId, user]);

    useEffect(() => { if (taskId) load(); }, [taskId, load]);

    const addComment = (c) => {
        setComments((prev) => [...prev, c]);
        // Notif funnel: mention (@nama) di semua komentar; root comment -> assignee.
        // Parent author di-reply sudah dinotif lewat comment_reply — jangan dobel.
        const text = textOf(c.body).toLowerCase();
        const parentAuthor = comments.find((x) => x.id === c.parent_id)?.author_id;
        const targets = new Map();
        members.forEach((m) => {
            if (!m.id || m.id === user.id || m.id === parentAuthor) return;
            const name = (m.full_name || m.email?.split("@")[0] || "").trim().toLowerCase();
            if (name && (text.includes(`@${name}`) || text.includes(`@${name.split(" ")[0]}`))) targets.set(m.id, "mention");
        });
        if (!c.parent_id && taskAssigneeId && taskAssigneeId !== user.id && !targets.has(taskAssigneeId)) targets.set(taskAssigneeId, "comment");
        targets.forEach((type, uid) => {
            supabase.from("notifications").insert({ user_id: uid, workspace_id: workspaceId, task_id: c.task_id, comment_id: c.id, actor_id: user.id, type, metadata: { task_title: taskTitle } });
        });
    };
    const deleteComment = async (comment) => {
        if (!confirm("Delete this comment?")) return;
        setComments((prev) => prev.filter((c) => c.id !== comment.id && c.parent_id !== comment.id));
        await supabase.from("comments").delete().eq("id", comment.id);
    };

    // build tree
    const roots = comments.filter((c) => !c.parent_id);
    const childrenOf = (id) => comments.filter((c) => c.parent_id === id);

    return (
        <div className="mt-8">
            <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                <MessageSquare size={12} /> Comments {comments.length > 0 && <span className="rounded-md bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">{comments.length}</span>}
            </div>
            <div className="mb-4">
                <CommentComposer taskId={taskId} user={user} onDone={addComment} />
            </div>
            {loading ? (
                <div className="flex items-center justify-center py-6"><Loader2 size={16} className="animate-spin text-slate-400" /></div>
            ) : roots.length === 0 ? (
                <p className="py-4 text-center text-xs text-slate-400">No comments yet. Start the conversation.</p>
            ) : (
                <div className="space-y-5">
                    {roots.map((c) => (
                        <CommentItem key={c.id} comment={c} user={user} workspaceId={workspaceId} taskTitle={taskTitle} onReply={addComment} onDelete={deleteComment}>
                            {childrenOf(c.id).map((reply) => (
                                <CommentItem key={reply.id} comment={reply} user={user} workspaceId={workspaceId} taskTitle={taskTitle} onReply={addComment} onDelete={deleteComment} />
                            ))}
                        </CommentItem>
                    ))}
                </div>
            )}
        </div>
    );
}

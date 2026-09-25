"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useEditor, EditorContent, BubbleMenu } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Image from "@tiptap/extension-image";
import {
    Bold,
    Italic,
    Code,
    Highlighter,
    Link as LinkIcon,
    Heading1,
    Heading2,
    Heading3,
    List,
    ListOrdered,
    CheckSquare,
    Quote,
    Minus,
    Code2,
    Type,
    ImageIcon,
} from "lucide-react";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

async function uploadImage(file, onProgress) {
    const ext = file.name.split(".").pop() || "png";
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    onProgress?.(10);
    const { data, error } = await supabase.storage.from("task-attachments").upload(path, file, { upsert: false, cacheControl: "3600" });
    if (error) throw error;
    onProgress?.(90);
    const { data: publicData } = supabase.storage.from("task-attachments").getPublicUrl(data.path);
    onProgress?.(100);
    return publicData.publicUrl;
}

const SLASH_ITEMS = [
    { key: "text", label: "Text", desc: "Just start writing plain text.", icon: Type, keywords: ["text", "paragraph"], run: (e) => e.chain().focus().setParagraph().run() },
    { key: "h1", label: "Heading 1", desc: "Big section heading.", icon: Heading1, keywords: ["heading", "h1", "title"], run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run() },
    { key: "h2", label: "Heading 2", desc: "Medium section heading.", icon: Heading2, keywords: ["heading", "h2"], run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
    { key: "h3", label: "Heading 3", desc: "Small section heading.", icon: Heading3, keywords: ["heading", "h3"], run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
    { key: "todo", label: "To-do list", desc: "Track things with checkboxes.", icon: CheckSquare, keywords: ["todo", "task", "check"], run: (e) => e.chain().focus().toggleTaskList().run() },
    { key: "bullet", label: "Bulleted list", desc: "A simple bullet list.", icon: List, keywords: ["bullet", "list", "ul"], run: (e) => e.chain().focus().toggleBulletList().run() },
    { key: "ordered", label: "Numbered list", desc: "An ordered list.", icon: ListOrdered, keywords: ["ordered", "list", "numbered"], run: (e) => e.chain().focus().toggleOrderedList().run() },
    { key: "quote", label: "Quote", desc: "Capture a quote.", icon: Quote, keywords: ["quote", "blockquote"], run: (e) => e.chain().focus().toggleBlockquote().run() },
    { key: "code", label: "Code block", desc: "Fenced code with syntax.", icon: Code2, keywords: ["code", "snippet", "pre"], run: (e) => e.chain().focus().toggleCodeBlock().run() },
    { key: "divider", label: "Divider", desc: "Visually divide sections.", icon: Minus, keywords: ["divider", "hr", "separator"], run: (e) => e.chain().focus().setHorizontalRule().run() },
    { key: "image", label: "Image", desc: "Upload an image from your device.", icon: ImageIcon, keywords: ["image", "photo", "picture"], run: (e) => { e._triggerImageUpload?.(); } },
];

function SlashMenu({ query, position, onSelect, onClose, activeIndex, setActiveIndex }) {
    const filtered = SLASH_ITEMS.filter((i) => {
        const q = query.toLowerCase();
        if (!q) return true;
        return i.label.toLowerCase().includes(q) || i.keywords.some((k) => k.includes(q));
    });
    useEffect(() => { setActiveIndex(0); }, [query]); // eslint-disable-line
    if (!filtered.length) return null;
    return (
        <div
            className="fixed z-50 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            style={{ top: position.top + 4, left: position.left }}
            onMouseDown={(e) => e.preventDefault()}
        >
            <div className="max-h-72 overflow-y-auto p-1">
                <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Basic blocks</div>
                {filtered.map((item, idx) => {
                    const Icon = item.icon;
                    return (
                        <button
                            key={item.key}
                            className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm ${idx === activeIndex ? "bg-indigo-50 dark:bg-indigo-950/40" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}
                            onMouseEnter={() => setActiveIndex(idx)}
                            onClick={() => onSelect(item)}
                        >
                            <span className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"><Icon size={15} /></span>
                            <span className="flex-1">
                                <span className="block text-sm font-medium">{item.label}</span>
                                <span className="block text-[11px] text-slate-400">{item.desc}</span>
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export function NotionEditor({ value, onChange, placeholder = "Type '/' for commands, or just start writing…", minimal = false, autoFocus = false }) {
    const [slash, setSlash] = useState({ open: false, query: "", position: { top: 0, left: 0 } });
    const [activeIndex, setActiveIndex] = useState(0);
    const slashOpenRef = useRef(false);
    slashOpenRef.current = slash.open;

    const extensions = [
        StarterKit.configure({
            heading: { levels: [1, 2, 3] },
            codeBlock: { HTMLAttributes: { class: "rounded-lg bg-slate-100 p-3 text-[13px] font-mono text-slate-800 dark:bg-slate-800 dark:text-slate-200" } },
            blockquote: { HTMLAttributes: { class: "border-l-2 border-slate-300 pl-3 italic text-slate-600 dark:border-slate-600 dark:text-slate-300" } },
            bulletList: { HTMLAttributes: { class: "list-disc pl-6" } },
            orderedList: { HTMLAttributes: { class: "list-decimal pl-6" } },
            horizontalRule: { HTMLAttributes: { class: "my-3 border-slate-200 dark:border-slate-700" } },
        }),
        Placeholder.configure({ placeholder, showOnlyCurrent: true }),
        Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-indigo-600 underline hover:text-indigo-700 dark:text-indigo-400" } }),
        Highlight.configure({ HTMLAttributes: { class: "bg-amber-200 dark:bg-amber-500/40" } }),
        Image.configure({ HTMLAttributes: { class: "rounded-lg my-2 max-w-full inline-block", draggable: "true" } }),
    ];
    if (!minimal) {
        extensions.push(
            TaskList.configure({ HTMLAttributes: { class: "pl-2" } }),
            TaskItem.configure({ nested: true, HTMLAttributes: { class: "flex gap-2 items-start [&_p]:m-0" } }),
        );
    }

    const editor = useEditor({
        extensions,
        content: value || "",
        editorProps: {
            attributes: { class: "prose-editor focus:outline-none" },
            handleDrop: (view, event, slice, moved) => {
                if (moved) return false;
                const files = Array.from(event.dataTransfer?.files || []).filter((f) => f.type.startsWith("image/"));
                if (files.length === 0) return false;
                event.preventDefault();
                const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
                const pos = coords?.pos || view.state.selection.from;
                files.forEach((file) => insertImageWithProgress(file, pos));
                return true;
            },
            handlePaste: (view, event) => {
                const files = Array.from(event.clipboardData?.files || []).filter((f) => f.type.startsWith("image/"));
                if (files.length === 0) return false;
                event.preventDefault();
                files.forEach((file) => insertImageWithProgress(file, view.state.selection.from));
                return true;
            },
        },
        immediatelyRender: false,
        autofocus: autoFocus,
        onUpdate: ({ editor }) => {
            onChange?.(editor.getJSON());
        },
    });

    const insertImageWithProgress = useCallback(async (file, pos) => {
        if (!editor) return;
        // insert placeholder paragraph with a loading marker (data URL preview)
        const previewUrl = URL.createObjectURL(file);
        editor.chain().focus().insertContentAt(pos, { type: "image", attrs: { src: previewUrl, alt: `Uploading ${file.name}` } }).run();
        try {
            const publicUrl = await uploadImage(file);
            // replace the last image node with the uploaded URL
            const { state } = editor;
            state.doc.descendants((node, nodePos) => {
                if (node.type.name === "image" && node.attrs.src === previewUrl) {
                    editor.chain().setNodeSelection(nodePos).updateAttributes("image", { src: publicUrl, alt: file.name }).run();
                    return false;
                }
            });
            URL.revokeObjectURL(previewUrl);
        } catch (err) {
            alert("Image upload failed: " + (err.message || "unknown"));
            // remove the placeholder image
            const { state } = editor;
            state.doc.descendants((node, nodePos) => {
                if (node.type.name === "image" && node.attrs.src === previewUrl) {
                    editor.chain().setNodeSelection(nodePos).deleteSelection().run();
                    return false;
                }
            });
        }
    }, [editor]);

    // File input for slash command image
    const fileInputRef = useRef(null);
    useEffect(() => {
        if (!editor) return;
        editor._triggerImageUpload = () => fileInputRef.current?.click();
    }, [editor]);

    // sync external value changes (e.g., switching tasks)
    useEffect(() => {
        if (!editor) return;
        const current = editor.getJSON();
        if (JSON.stringify(current) !== JSON.stringify(value) && !editor.isFocused) {
            editor.commands.setContent(value || "", false);
        }
    }, [value, editor]);

    // Slash menu detection
    useEffect(() => {
        if (!editor) return;
        const handleUpdate = () => {
            const { $from } = editor.state.selection;
            const parent = $from.parent;
            const text = parent.textContent;
            const type = parent.type.name;
            if (type === "paragraph" && text.startsWith("/") && !text.includes(" ")) {
                const query = text.slice(1);
                try {
                    const coords = editor.view.coordsAtPos($from.pos);
                    setSlash({ open: true, query, position: { top: coords.bottom, left: coords.left } });
                } catch { /* noop */ }
            } else if (slashOpenRef.current) {
                setSlash({ open: false, query: "", position: { top: 0, left: 0 } });
            }
        };
        editor.on("update", handleUpdate);
        editor.on("selectionUpdate", handleUpdate);
        return () => {
            editor.off("update", handleUpdate);
            editor.off("selectionUpdate", handleUpdate);
        };
    }, [editor]);

    // Keyboard nav in slash menu
    useEffect(() => {
        if (!editor || !slash.open) return;
        const filtered = SLASH_ITEMS.filter((i) => {
            const q = slash.query.toLowerCase();
            if (!q) return true;
            return i.label.toLowerCase().includes(q) || i.keywords.some((k) => k.includes(q));
        });
        const handler = (e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, filtered.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
            else if (e.key === "Enter") {
                e.preventDefault();
                const item = filtered[activeIndex];
                if (item) applySlash(item);
            } else if (e.key === "Escape") {
                setSlash({ open: false, query: "", position: { top: 0, left: 0 } });
            }
        };
        editor.view.dom.addEventListener("keydown", handler, true);
        return () => editor.view.dom.removeEventListener("keydown", handler, true);
    }, [editor, slash.open, slash.query, activeIndex]); // eslint-disable-line

    const applySlash = useCallback((item) => {
        if (!editor) return;
        const { $from } = editor.state.selection;
        const start = $from.start();
        const end = $from.end();
        editor.chain().focus().deleteRange({ from: start, to: end }).run();
        item.run(editor);
        setSlash({ open: false, query: "", position: { top: 0, left: 0 } });
    }, [editor]);

    if (!editor) return <div className="min-h-[80px] rounded-lg bg-slate-50 p-3 text-sm text-slate-400 dark:bg-slate-800/40">Loading editor…</div>;

    return (
        <div className="relative">
            <BubbleMenu editor={editor} tippyOptions={{ duration: 100, placement: "top" }}>
                <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                    <button className={`bubble-btn ${editor.isActive("bold") ? "active" : ""}`} onClick={() => editor.chain().focus().toggleBold().run()} aria-label="Bold"><Bold size={14} /></button>
                    <button className={`bubble-btn ${editor.isActive("italic") ? "active" : ""}`} onClick={() => editor.chain().focus().toggleItalic().run()} aria-label="Italic"><Italic size={14} /></button>
                    <button className={`bubble-btn ${editor.isActive("code") ? "active" : ""}`} onClick={() => editor.chain().focus().toggleCode().run()} aria-label="Code"><Code size={14} /></button>
                    <button className={`bubble-btn ${editor.isActive("highlight") ? "active" : ""}`} onClick={() => editor.chain().focus().toggleHighlight().run()} aria-label="Highlight"><Highlighter size={14} /></button>
                    <button
                        className={`bubble-btn ${editor.isActive("link") ? "active" : ""}`}
                        onClick={() => {
                            const prev = editor.getAttributes("link").href;
                            const url = window.prompt("Link URL", prev || "https://");
                            if (url === null) return;
                            if (url === "") editor.chain().focus().unsetLink().run();
                            else editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
                        }}
                        aria-label="Link"
                    ><LinkIcon size={14} /></button>
                </div>
            </BubbleMenu>
            <EditorContent editor={editor} className={minimal ? "tiptap-minimal" : "tiptap-full"} />
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && editor) insertImageWithProgress(file, editor.state.selection.from);
                    e.target.value = "";
                }}
            />
            {slash.open && (
                <SlashMenu
                    query={slash.query}
                    position={slash.position}
                    onSelect={applySlash}
                    onClose={() => setSlash({ open: false, query: "", position: { top: 0, left: 0 } })}
                    activeIndex={activeIndex}
                    setActiveIndex={setActiveIndex}
                />
            )}
        </div>
    );
}

export default NotionEditor;

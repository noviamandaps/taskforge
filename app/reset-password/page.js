"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { ArrowUpRight, Loader2 } from "lucide-react";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

// ponytail: password reset is Supabase-native — resetPasswordForEmail sent the
// link, this page just calls updateUser. Swap Supabase's mailer in the dashboard
// if deliverability matters.
export default function ResetPasswordPage() {
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [done, setDone] = useState(false);

    const submit = async (event) => {
        event.preventDefault();
        setError("");
        if (password !== confirm) { setError("Passwords do not match."); return; }
        setBusy(true);
        try {
            const { error: e } = await supabase.auth.updateUser({ password });
            if (e) throw e;
            await supabase.auth.signOut();
            setDone(true);
        } catch (err) { setError(err.message || "Something went wrong."); } finally { setBusy(false); }
    };

    return (
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f7f8fa] text-slate-950 dark:bg-[#0b0d10] dark:text-white">
            <div className="pointer-events-none absolute -left-32 -top-40 h-[32rem] w-[32rem] rounded-full bg-indigo-200/45 blur-3xl dark:bg-indigo-950/30" />
            <div className="relative mx-auto w-full max-w-md px-6">
                <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-7 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.35)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90 sm:p-9">
                    <div className="mb-8">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-400">Password reset</p>
                        <h1 className="text-2xl font-semibold tracking-tight">{done ? "Password updated" : "Choose a new password"}</h1>
                        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{done ? "Sign in with your new password." : "Pick something at least 6 characters long."}</p>
                    </div>
                    {done ? (
                        <a className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200" href="/">Sign in<ArrowUpRight size={16} /></a>
                    ) : (
                        <form className="space-y-4" onSubmit={submit}>
                            <label className="field-label">New password<input className="field-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" minLength={6} required /></label>
                            <label className="field-label">Confirm password<input className="field-input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat new password" autoComplete="new-password" minLength={6} required /></label>
                            {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm leading-5 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>}
                            <button className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200" disabled={busy} type="submit">{busy && <Loader2 size={16} className="animate-spin" />}Update password<ArrowUpRight size={16} /></button>
                        </form>
                    )}
                </div>
            </div>
        </main>
    );
}

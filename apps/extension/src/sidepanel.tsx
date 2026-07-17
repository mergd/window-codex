import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@window-codex/ui";
import "@window-codex/ui/tokens.css";
import styles from "./sidepanel.module.css";

type Pending = { id: string; origin: string; method: string; params: Record<string, unknown>; createdAt: number };
const labels: Record<string, [string, string]> = {
  connect: ["Connect this site?", "Choose which Codex capabilities this origin can request."],
  "permissions.request": ["Grant additional access?", "Review the exact scope and how long it will last."],
  "workspace.select": ["Choose a workspace", "The site receives an opaque label, never the filesystem path."],
  "threads.analyze": ["Analyze selected work?", "Codex reads the selected threads once. Only structured findings return."],
  "tasks.start": ["Start this Codex task?", "Review the exact origin, workspace, and prompt before starting."],
  "tasks.send": ["Send this follow-up?", "This message will steer the active Codex task."],
  "runtime.approval": ["Codex needs your approval", "Review this command or filesystem action before Codex continues."],
};

function Panel() {
  const pending = useQuery<Pending[]>({ queryKey: ["pending"], queryFn: () => chrome.runtime.sendMessage({ type: "ui.pending.list" }), refetchInterval: 500 });
  const runtime = useQuery({ queryKey: ["runtime"], queryFn: () => chrome.runtime.sendMessage({ type: "ui.runtime.check" }), retry: false, refetchInterval: 5000 });
  const resolve = useMutation({ mutationFn: ({ id, allowed, result }: { id: string; allowed: boolean; result?: unknown }) => chrome.runtime.sendMessage({ type: "ui.pending.resolve", id, allowed, result }), onSuccess: () => void pending.refetch() });
  const request = pending.data?.[0];
  return <main className={styles.panel}><header><div className={styles.logo}>wc</div><div><b>window.codex</b><span><i className={runtime.data?.ok ? styles.online : styles.offline}/>{runtime.data?.ok ? "Codex ready" : "Bridge unavailable"}</span></div><button aria-label="Settings">•••</button></header>{request ? <Request request={request} onResolve={(allowed, result) => resolve.mutate({ id: request.id, allowed, result })}/> : <Home online={Boolean(runtime.data?.ok)}/>}<footer><span>Protocol 0.1</span><span>{pending.data?.length ?? 0} pending</span></footer></main>;
}

function Home({ online }: { online: boolean }) { return <section className={styles.home}><div className={styles.heroIcon}>{online ? "✓" : "!"}</div><h1>{online ? "Codex is ready" : "Connect the local bridge"}</h1><p>{online ? "Requests from connected sites will appear here for review." : "Run the native setup, then reopen this panel."}</p><div className={styles.stat}><span>Trusted boundary</span><b>Extension-owned</b></div><div className={styles.stat}><span>Runtime transport</span><b>Local stdio</b></div><div className={styles.tip}><b>Nothing waiting</b><span>Open Reflex or the provider explorer to make a request.</span></div></section>; }

function Request({ request, onResolve }: { request: Pending; onResolve: (allowed: boolean, result?: unknown) => void }) {
  const [title, description] = labels[request.method] ?? ["Approve request?", "Review this request before continuing."];
  const prompt = typeof request.params.prompt === "string" ? request.params.prompt : typeof request.params.message === "string" ? request.params.message : null;
  const scopes = Array.isArray(request.params.scopes) ? request.params.scopes as string[] : [];
  const count = Array.isArray(request.params.threadIds) ? request.params.threadIds.length : null;
  const displayOrigin = request.origin === "Codex runtime" ? "Codex runtime" : new URL(request.origin).hostname;
  const runtimeCommand = typeof request.params.command === "string" ? request.params.command : null;
  const questions = Array.isArray(request.params.questions) ? request.params.questions as Array<{ id: string; header: string; question: string; options?: Array<{ label: string }> }> : [];
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const answerResult = questions.length ? { answers: Object.fromEntries(questions.map(question => [question.id, { answers: [answers[question.id] ?? ""] }])) } : undefined;
  return <section className={styles.request}><div className={styles.origin}><span>{displayOrigin.slice(0, 1).toUpperCase()}</span><div><small>REQUEST FROM</small><b>{displayOrigin}</b></div></div><div className={styles.divider}/><small className={styles.kicker}>{request.method}</small><h1>{questions.length ? "Codex needs your input" : title}</h1><p>{description}</p>{scopes.length > 0 && <div className={styles.detail}><small>REQUESTED ACCESS</small>{scopes.map(scope => <b key={scope}>✓ {scope}</b>)}</div>}{count && <div className={styles.detail}><small>SELECTION</small><b>{count} Codex threads · one use</b></div>}{(prompt || runtimeCommand) && <div className={styles.prompt}><small>EXACT MESSAGE</small><p>{prompt ?? runtimeCommand}</p></div>}{questions.map(question => <label className={styles.question} key={question.id}><small>{question.header}</small><b>{question.question}</b>{question.options?.length ? <select value={answers[question.id] ?? ""} onChange={event => setAnswers(current => ({ ...current, [question.id]: event.target.value }))}><option value="">Choose…</option>{question.options.map(option => <option key={option.label}>{option.label}</option>)}</select> : <input value={answers[question.id] ?? ""} onChange={event => setAnswers(current => ({ ...current, [question.id]: event.target.value }))}/>}</label>)}<div className={styles.warning}>The website cannot approve commands, filesystem changes, or additional permissions. Those stay here.</div><div className={styles.actions}><Button onClick={() => onResolve(false)} className={styles.reject}>Reject</Button><Button onClick={() => onResolve(true, answerResult)} disabled={questions.length > 0 && questions.some(question => !answers[question.id])} className={styles.approve}>{questions.length ? "Submit" : "Approve"}</Button></div></section>;
}
const queryClient = new QueryClient();
createRoot(document.getElementById("root")!).render(<React.StrictMode><QueryClientProvider client={queryClient}><Panel/></QueryClientProvider></React.StrictMode>);

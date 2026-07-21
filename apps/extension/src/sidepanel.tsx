import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, Button, Check, CheckCircle, DotsThree, FolderOpen, WarningCircle } from "@window-codex/ui";
import "@window-codex/ui/tokens.css";
import "./font.css";
import styles from "./sidepanel.module.css";

document.documentElement.dataset.theme = "dark";

type Pending = { id: string; origin: string; method: string; params: Record<string, unknown>; createdAt: number };
type RuntimeProfile = { type: "chatgpt" | "apiKey"; email: string | null; planType: string | null };
type RuntimeCheck = { ok: boolean; value?: { ready: boolean; runtime: string; profile: RuntimeProfile | null }; message?: string };
const hasExtensionRuntime = () => typeof globalThis.chrome !== "undefined" && Boolean(globalThis.chrome.runtime?.id);
const assetUrl = (path: string) => hasExtensionRuntime() ? chrome.runtime.getURL(path) : `/${path}`;
const preview = new URLSearchParams(location.search);
const demoPending: Pending[] = preview.has("home") ? [] : [{ id: "preview", origin: "https://cm.fldr.zip", method: "connect", params: { scopes: ["threads:metadata"] }, createdAt: Date.now() }];
const demoRuntime: RuntimeCheck = { ok: true, value: { ready: true, runtime: "codex app-server", profile: { type: "chatgpt", email: "william@example.com", planType: "pro" } } };
const send = (message: unknown) => hasExtensionRuntime() ? chrome.runtime.sendMessage(message) : preview.has("loading") ? new Promise(() => undefined) : Promise.resolve((message as { type?: string }).type === "ui.pending.list" ? demoPending : (message as { type?: string }).type === "ui.runtime.check" ? demoRuntime : { ok: true });
const labels: Record<string, [string, string]> = {
  connect: ["Connect this site?", "Choose which Codex capabilities this origin can request."],
  "permissions.request": ["Grant additional access?", "Review the exact scope and how long it will last."],
  "workspace.select": ["Choose a workspace", "The site receives an opaque label, never the filesystem path."],
  "threads.analyze": ["Analyze selected work?", "Codex reads the selected threads once. Only structured findings return."],
  "tasks.start": ["Start this Codex task?", "Review the exact origin, workspace, and prompt before starting."],
  "tasks.send": ["Send this follow-up?", "This message will steer the active Codex task."],
  "runtime.approval": ["Codex needs your approval", "Review this command or filesystem action before Codex continues."],
};
const permissionCopy: Record<string, { title: string; description: string }> = {
  "threads:metadata": { title: "View Codex activity", description: "See task titles, dates, and workspace labels. Message content stays private." },
  "threads:analyze": { title: "Analyze selected tasks", description: "Let Codex review selected tasks once and return themes without transcript excerpts." },
  "tasks:create": { title: "Start Codex tasks", description: "Submit a task only after you confirm its workspace and exact prompt." },
  "tasks:control": { title: "Manage started tasks", description: "View progress, send confirmed follow-ups, or cancel tasks started by this site." },
};
const approveLabels: Record<string, string> = { connect: "Connect", "permissions.request": "Allow", "workspace.select": "Choose", "threads.analyze": "Analyze", "tasks.start": "Start task", "tasks.send": "Send" };

function Panel() {
  const pending = useQuery<Pending[]>({ queryKey: ["pending"], queryFn: () => send({ type: "ui.pending.list" }), refetchInterval: hasExtensionRuntime() ? 500 : false });
  const runtime = useQuery<RuntimeCheck>({ queryKey: ["runtime"], queryFn: () => send({ type: "ui.runtime.check" }), retry: false, refetchInterval: hasExtensionRuntime() ? 5000 : false });
  const resolve = useMutation({ mutationFn: ({ id, allowed, result }: { id: string; allowed: boolean; result?: unknown }) => send({ type: "ui.pending.resolve", id, allowed, result }), onSuccess: () => void pending.refetch() });
  const request = pending.data?.[0];
  const online = Boolean(runtime.data?.ok);
  const profile = online ? runtime.data?.value?.profile ?? null : null;
  const handleResolve = (allowed: boolean, result?: unknown) => resolve.mutate({ id: request!.id, allowed, result }, { onSuccess: () => { if (document.body.dataset.mode === "popup") window.setTimeout(() => window.close(), 120); } });
  if (runtime.isPending || pending.isPending) return <PanelSkeleton/>;
  return <main className={styles.panel}><header><img className={styles.logo} src={assetUrl("icons/icon-32.png")}/><div><b>Codemask</b><span><i className={online ? styles.online : styles.offline}/>{online ? "Connected to Codex" : "Setup required"}</span></div><button aria-label="Open setup" onClick={() => void send({ type: "ui.onboarding.open" })}><DotsThree size={18} weight="bold"/></button></header><div className={styles.network}><span>LOCAL</span><b>{online ? "Codex connected" : "Codex runtime"}</b><i>{pending.data?.length ?? 0} pending</i></div>{profile && <Account profile={profile}/>} {!online ? <BridgeSetup request={request} onOpen={() => void send({ type: "ui.onboarding.open" })} onRetry={() => void runtime.refetch()} onCancel={request ? () => handleResolve(false) : undefined}/> : request ? <Request request={request} onResolve={handleResolve}/> : <Home/>}</main>;
}

function PanelSkeleton() {
  return <main className={`${styles.panel} ${styles.loading}`} aria-busy="true" aria-label="Loading Codemask"><header><img className={styles.logo} src={assetUrl("icons/icon-32.png")}/><div><b>Codemask</b><span className={styles.skeletonShort}/></div></header><div className={styles.network}><i className={styles.skeletonPill}/><i className={styles.skeletonMedium}/></div><section><i className={styles.skeletonAvatar}/><div><i className={styles.skeletonMedium}/><i className={styles.skeletonLong}/></div></section><article><i className={styles.skeletonKicker}/><i className={styles.skeletonTitle}/><i className={styles.skeletonLong}/><i className={styles.skeletonCard}/></article><div className={styles.skeletonActions}><i/><i/></div></main>;
}

function profileName(profile: RuntimeProfile) {
  if (!profile.email) return profile.type === "apiKey" ? "API key account" : "Codex account";
  return profile.email.split("@")[0].split(/[._-]+/).filter(Boolean).map(part => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`).join(" ") || "Codex account";
}

function Account({ profile }: { profile: RuntimeProfile }) {
  const name = profileName(profile);
  const detail = profile.email ?? "Authenticated with an API key";
  const plan = profile.planType ? profile.planType.replaceAll("_", " ") : profile.type === "apiKey" ? "API" : "Codex";
  return <section className={styles.account} aria-label="Connected Codex account"><span className={styles.avatar} aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span><div><b>{name}</b><small>{detail}</small></div><em>{plan}</em></section>;
}

function BridgeSetup({ request, onOpen, onRetry, onCancel }: { request?: Pending; onOpen: () => void; onRetry: () => void; onCancel?: () => void }) {
  const site = request && request.origin !== "Codex runtime" ? new URL(request.origin).hostname : null;
  return <section className={styles.bridgeSetup}><div className={styles.setupIcon}><WarningCircle size={24}/></div><small>ONE-TIME SETUP</small><h1>Finish setting up Codemask</h1><p>{site ? `${site} is waiting to connect, but the local bridge is not ready yet.` : "Install the local macOS bridge to let approved websites talk to Codex on this computer."}</p><div className={styles.setupList}><div><span>1</span><p><b>Codemask installed</b><small>This browser can receive permission requests.</small></p><CheckCircle size={18} weight="fill"/></div><div><span>2</span><p><b>Install the local bridge</b><small>Connect directly to your authenticated Codex runtime.</small></p></div></div><Button className={styles.setupPrimary} onClick={onOpen}>Set up local bridge <ArrowRight size={17}/></Button><Button className={styles.setupSecondary} onClick={onRetry}>I installed it — check again</Button>{onCancel && <button className={styles.cancelSetup} onClick={onCancel}>Cancel this request</button>}<p className={styles.localNote}>Your Codex data stays on this Mac.</p></section>;
}

function Home() { return <section className={styles.home}><div className={styles.heroIcon}><CheckCircle size={21} weight="fill"/></div><h1>Connected to Codex</h1><p>Codemask is listening for requests from sites you approve.</p><div className={styles.stat}><span>Security boundary</span><b>Extension owned</b></div><div className={styles.stat}><span>Data path</span><b>Local only</b></div><div className={styles.tip}><span className={styles.dot}/><div><b>Listening</b><span>No requests are waiting.</span></div></div></section>; }

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
  return <section className={styles.request}><div className={styles.origin}><span>{displayOrigin.slice(0, 1).toUpperCase()}</span><div><small>REQUEST FROM</small><b>{displayOrigin}</b></div><em>Verified origin</em></div><div className={styles.divider}/><small className={styles.kicker}>{request.method}</small><h1>{questions.length ? "Codex needs your input" : title}</h1><p>{description}</p>{scopes.length > 0 && <div className={styles.detail}><small>REQUESTED ACCESS</small>{scopes.map(scope => { const copy = permissionCopy[scope] ?? { title: scope, description: "Review this capability before allowing access." }; return <div className={styles.permission} key={scope}><span><Check size={12} weight="bold"/></span><div className={styles.permissionCopy}><b>{copy.title}</b><small>{copy.description}</small></div><i>Allow</i></div>; })}</div>}{count && <div className={styles.detail}><small>SELECTION</small><div className={styles.permission}><span><FolderOpen size={12}/></span><div className={styles.permissionCopy}><b>{count} Codex tasks</b><small>Only the tasks selected in the requesting site.</small></div><i>Once</i></div></div>}{(prompt || runtimeCommand) && <div className={styles.prompt}><small>EXACT MESSAGE</small><p>{prompt ?? runtimeCommand}</p></div>}{questions.map(question => <label className={styles.question} key={question.id}><small>{question.header}</small><b>{question.question}</b>{question.options?.length ? <select value={answers[question.id] ?? ""} onChange={event => setAnswers(current => ({ ...current, [question.id]: event.target.value }))}><option value="">Choose…</option>{question.options.map(option => <option key={option.label}>{option.label}</option>)}</select> : <input value={answers[question.id] ?? ""} onChange={event => setAnswers(current => ({ ...current, [question.id]: event.target.value }))}/>}</label>)}<div className={styles.warning}><b>Trusted confirmation</b><span>The site cannot approve commands or filesystem changes.</span></div><div className={styles.actions}><Button onClick={() => onResolve(false)} className={styles.reject}>Reject</Button><Button onClick={() => onResolve(true, answerResult)} disabled={questions.length > 0 && questions.some(question => !answers[question.id])} className={styles.approve}>{questions.length ? "Submit" : approveLabels[request.method] ?? "Approve"}</Button></div></section>;
}
const queryClient = new QueryClient();
createRoot(document.getElementById("root")!).render(<React.StrictMode><QueryClientProvider client={queryClient}><Panel/></QueryClientProvider></React.StrictMode>);

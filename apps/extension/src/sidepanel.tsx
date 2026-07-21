import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, Button, Check, Checkbox, CheckCircle, DotsThree, FolderOpen, WarningCircle } from "@window-codex/ui";
import "@window-codex/ui/tokens.css";
import "./font.css";
import styles from "./sidepanel.module.css";

document.documentElement.dataset.theme = "dark";

type Pending = { id: string; origin: string; method: string; params: Record<string, unknown>; createdAt: number };
type RuntimeProfile = { type: "chatgpt" | "apiKey"; email: string | null; planType: string | null };
type RuntimeCheck = { ok: boolean; value?: { ready: boolean; runtime: string; profile: RuntimeProfile | null }; message?: string };
type Confirmation = { title: string; description: string };
type SiteActivity = { origin: string; connected: boolean; fastMode?: boolean; blocked?: boolean; scopes: string[]; actionCount: number; inputTokens: number; outputTokens: number; totalTokens: number; connectedAt: number; lastActiveAt: number; recentActions: Array<{ method: string; label: string; at: number }> };
const hasExtensionRuntime = () => typeof globalThis.chrome !== "undefined" && Boolean(globalThis.chrome.runtime?.id);
const preview = new URLSearchParams(location.search);
const demoPending: Pending[] = preview.has("home") ? [] : preview.has("task") ? [{ id: "preview-task", origin: "https://reflex.cm.fldr.zip", method: "tasks.start", params: { workspaceLabel: "window.codex", prompt: "Create a reusable release workflow for this project, run its checks, and report the results." }, createdAt: Date.now() }] : [{ id: "preview", origin: "https://cm.fldr.zip", method: "connect", params: { scopes: ["threads:metadata"] }, createdAt: Date.now() }];
const demoRuntime: RuntimeCheck = { ok: true, value: { ready: true, runtime: "codex app-server", profile: { type: "chatgpt", email: "william@example.com", planType: "pro" } } };
const now = Math.floor(Date.now() / 1000);
const demoActivity: SiteActivity[] = [
  { origin: "https://reflex.cm.fldr.zip", connected: true, scopes: ["threads:metadata", "threads:analyze", "tasks:create"], actionCount: 7, inputTokens: 38240, outputTokens: 6310, totalTokens: 44550, connectedAt: now - 86400, lastActiveAt: now - 180, recentActions: [{ method: "threads.analyze", label: "Analyzed selected tasks", at: now - 180 }] },
  { origin: "https://cm.fldr.zip", connected: true, scopes: ["threads:metadata"], actionCount: 3, inputTokens: 0, outputTokens: 0, totalTokens: 0, connectedAt: now - 172800, lastActiveAt: now - 7200, recentActions: [{ method: "threads.list", label: "Viewed Codex history", at: now - 7200 }] },
];
const send = (message: unknown): Promise<any> => {
  if (hasExtensionRuntime()) return chrome.runtime.sendMessage(message);
  if (preview.has("loading")) return new Promise(() => undefined);
  const type = (message as { type?: string }).type;
  return Promise.resolve(type === "ui.pending.list" ? demoPending : type === "ui.runtime.check" ? demoRuntime : type === "ui.activity.list" ? demoActivity : { ok: true });
};
const labels: Record<string, [string, string]> = {
  connect: ["Connect this site?", "Choose which Codex capabilities this origin can request."],
  "permissions.request": ["Grant additional access?", "Review the exact scope and how long it will last."],
  "workspace.select": ["Choose a workspace", "The site receives an opaque label, never the filesystem path."],
  "threads.analyze": ["Analyze your Codex history?", "Codex reviews these conversations locally in temporary read-only threads. Only structured findings return."],
  "tasks.start": ["Start this Codex task?", "Review the exact origin, workspace, and prompt before starting."],
  "tasks.send": ["Send this follow-up?", "This message will steer the active Codex task."],
  "runtime.approval": ["Codex needs your approval", "Review this command or filesystem action before Codex continues."],
};
const permissionCopy: Record<string, { title: string; description: string }> = {
  "threads:metadata": { title: "View Codex activity", description: "See task titles, dates, and workspace labels. Message content stays private." },
  "threads:analyze": { title: "Analyze Codex history", description: "Let Codex review the requested conversations once and return themes without transcript excerpts." },
  "workspace:select": { title: "Choose a project", description: "Select a workspace without exposing its filesystem path to the site." },
  "tasks:create": { title: "Start Codex tasks", description: "Submit a task only after you confirm its workspace and exact prompt." },
  "tasks:control": { title: "Manage started tasks", description: "View progress, send confirmed follow-ups, or cancel tasks started by this site." },
  "events:subscribe": { title: "View task progress", description: "Receive sanitized status updates for tasks started by this site." },
};
const approveLabels: Record<string, string> = { connect: "Connect", "permissions.request": "Allow", "workspace.select": "Choose", "threads.analyze": "Analyze", "tasks.start": "Start task", "tasks.send": "Send" };

function Panel() {
  const [confirmation, setConfirmation] = React.useState<Confirmation | null>(null);
  const pending = useQuery<Pending[]>({ queryKey: ["pending"], queryFn: () => send({ type: "ui.pending.list" }), refetchInterval: hasExtensionRuntime() ? 500 : false });
  const runtime = useQuery<RuntimeCheck>({ queryKey: ["runtime"], queryFn: () => send({ type: "ui.runtime.check" }), retry: false, refetchInterval: hasExtensionRuntime() ? 5000 : false });
  const activity = useQuery<SiteActivity[]>({ queryKey: ["activity"], queryFn: () => send({ type: "ui.activity.list" }), refetchInterval: hasExtensionRuntime() ? 2000 : false });
  const resolve = useMutation({ mutationFn: ({ id, allowed, result }: { id: string; allowed: boolean; result?: unknown }) => send({ type: "ui.pending.resolve", id, allowed, result }), onSuccess: () => void pending.refetch() });
  const request = pending.data?.[0];
  const online = Boolean(runtime.data?.ok);
  const profile = online ? runtime.data?.value?.profile ?? null : null;
  const handleResolve = (allowed: boolean, result?: unknown) => {
    const resolvedRequest = request!;
    resolve.mutate({ id: resolvedRequest.id, allowed, result }, { onSuccess: () => {
      if (!allowed) {
        if (document.body.dataset.mode === "popup" && hasExtensionRuntime()) window.setTimeout(() => window.close(), 120);
        return;
      }
      const site = resolvedRequest.origin === "Codex runtime" ? "Codex" : new URL(resolvedRequest.origin).hostname;
      setConfirmation(resolvedRequest.method === "connect"
        ? { title: "Connected", description: `${site} can now request the access you approved.` }
        : { title: "Approved", description: "Your approval was securely sent to Codex." });
      window.setTimeout(() => {
        if (document.body.dataset.mode === "popup" && hasExtensionRuntime()) window.close();
        else setConfirmation(null);
      }, 1400);
    } });
  };
  if (runtime.isPending || pending.isPending || activity.isPending) return <PanelSkeleton/>;
  return <main className={styles.panel}>{confirmation ? <ConfirmationView confirmation={confirmation}/> : !online ? <BridgeSetup request={request} onOpen={() => void send({ type: "ui.onboarding.open" })} onRetry={() => void runtime.refetch()} onCancel={request ? () => handleResolve(false) : undefined}/> : request ? <Request request={request} onResolve={handleResolve}/> : <Home activities={activity.data ?? []} profile={profile} onManage={() => void send({ type: "ui.onboarding.open" })} onPreference={(origin, patch) => void send({ type: "ui.site.preference", origin, ...patch }).then(() => activity.refetch())}/>}</main>;
}

function PanelSkeleton() {
  return <main className={`${styles.panel} ${styles.loading}`} aria-busy="true" aria-label="Loading Codemask"><article><i className={styles.skeletonKicker}/><i className={styles.skeletonTitle}/><i className={styles.skeletonLong}/><i className={styles.skeletonCard}/><i className={styles.skeletonCard}/></article></main>;
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

function compactNumber(value: number) { return value ? new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value) : "—"; }
function relativeTime(value: number) { const seconds = Math.max(0, Math.floor(Date.now() / 1000) - value); if (seconds < 60) return "Just now"; if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`; if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`; return `${Math.floor(seconds / 86400)}d ago`; }
function siteName(origin: string) { try { return new URL(origin).hostname; } catch { return origin; } }

function Home({ activities, profile, onManage, onPreference }: { activities: SiteActivity[]; profile: RuntimeProfile | null; onManage: () => void; onPreference: (origin: string, patch: { fastMode?: boolean; blocked?: boolean }) => void }) {
  const actions = activities.reduce((sum, site) => sum + site.actionCount, 0);
  const tokens = activities.reduce((sum, site) => sum + site.totalTokens, 0);
  return <section className={styles.home}><div className={styles.homeHeader}><div><small>CODEX ACCESS</small><h1>Connected apps</h1><p>See which sites have used Codex through this browser.</p></div><button aria-label="Manage Codemask" onClick={onManage}><DotsThree size={18} weight="bold"/></button></div>{profile && <Account profile={profile}/>}<div className={styles.metrics}><div><b>{activities.filter(site => site.connected).length}</b><span>connected</span></div><div><b>{actions}</b><span>actions</span></div><div><b>{compactNumber(tokens)}</b><span>tokens</span></div></div><div className={styles.sectionTitle}><h2>Previously connected</h2><span>{activities.length} apps</span></div>{activities.length ? <div className={styles.siteList}>{activities.map(site => <article className={styles.site} key={site.origin}><div className={styles.siteHead}><span>{siteName(site.origin).slice(0, 1).toUpperCase()}</span><div><b>{siteName(site.origin)}</b><small>{site.blocked ? "Requests blocked" : site.fastMode ? "Fast mode" : site.connected ? "Connected" : "Previously connected"}</small></div><em className={site.blocked || !site.connected ? styles.disconnected : styles.connected}>{site.blocked ? "Blocked" : site.fastMode ? "Fast" : site.connected ? "Active" : "Past"}</em></div><div className={styles.siteStats}><span><b>{site.actionCount}</b> actions</span><span><b>{compactNumber(site.totalTokens)}</b> tokens</span></div><div className={styles.latest}><i/><div><b>{site.recentActions[0]?.label ?? "Connected to Codex"}</b><small>{relativeTime(site.recentActions[0]?.at ?? site.lastActiveAt)}</small></div></div><p>{site.scopes.map(scope => permissionCopy[scope]?.title ?? scope).join(" · ") || "No active permissions"}</p><div className={styles.siteControls}><button onClick={() => onPreference(site.origin, { fastMode: !site.fastMode, blocked: false })}>{site.fastMode ? "Turn off fast mode" : "Enable fast mode"}</button><button onClick={() => onPreference(site.origin, { blocked: !site.blocked, fastMode: false })}>{site.blocked ? "Unblock" : "Block"}</button></div></article>)}</div> : <div className={styles.empty}><b>No connected apps yet</b><p>Approved sites and their Codex activity will appear here.</p></div>}<p className={styles.usageNote}>Fast mode skips Codemask prompts, never Codex command or file approvals. Usage data stays in this extension.</p></section>;
}

function ConfirmationView({ confirmation }: { confirmation: Confirmation }) {
  return <section className={styles.confirmation} role="status" aria-live="polite"><div><CheckCircle size={24} weight="fill"/></div><h1>{confirmation.title}</h1><p>{confirmation.description}</p><small>Closing…</small></section>;
}

function Request({ request, onResolve }: { request: Pending; onResolve: (allowed: boolean, result?: unknown) => void }) {
  const [title, description] = labels[request.method] ?? ["Approve request?", "Review this request before continuing."];
  const prompt = typeof request.params.prompt === "string" ? request.params.prompt : typeof request.params.message === "string" ? request.params.message : null;
  const scopes = Array.isArray(request.params.scopes) ? request.params.scopes as string[] : [];
  const count = Array.isArray(request.params.threadIds) ? request.params.threadIds.length : null;
  const displayOrigin = request.origin === "Codex runtime" ? "Codex runtime" : new URL(request.origin).hostname;
  const runtimeCommand = typeof request.params.command === "string" ? request.params.command : null;
  const questions = Array.isArray(request.params.questions) ? request.params.questions as Array<{ id: string; header: string; question: string; options?: Array<{ label: string }> }> : [];
  const workspaceLabel = typeof request.params.workspaceLabel === "string" ? request.params.workspaceLabel : null;
  const canSetPreference = request.origin !== "Codex runtime" && ["connect", "workspace.select", "threads.analyze", "tasks.start", "tasks.send"].includes(request.method);
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [fastMode, setFastMode] = React.useState(false);
  const answerResult = questions.length ? { answers: Object.fromEntries(questions.map(question => [question.id, { answers: [answers[question.id] ?? ""] }])) } : undefined;
  const approvalResult = { ...(answerResult ?? {}), fastMode };
  return <section className={styles.request}><div className={styles.origin}><span>{displayOrigin.slice(0, 1).toUpperCase()}</span><div><small>REQUEST FROM</small><b>{displayOrigin}</b></div><em>Verified origin</em></div><div className={styles.divider}/><small className={styles.kicker}>{request.method}</small><h1>{questions.length ? "Codex needs your input" : title}</h1><p>{description}</p>{workspaceLabel && <div className={styles.detail}><small>TARGET PROJECT</small><div className={styles.permission}><span><FolderOpen size={12}/></span><div className={styles.permissionCopy}><b>{workspaceLabel}</b><small>The task will run inside this project.</small></div><i>Local</i></div></div>}{scopes.length > 0 && <div className={styles.detail}><small>REQUESTED ACCESS</small>{scopes.map(scope => { const copy = permissionCopy[scope] ?? { title: scope, description: "Review this capability before allowing access." }; return <div className={styles.permission} key={scope}><span><Check size={12} weight="bold"/></span><div className={styles.permissionCopy}><b>{copy.title}</b><small>{copy.description}</small></div><i>Allow</i></div>; })}</div>}{count && <div className={styles.detail}><small>HISTORY COVERAGE</small><div className={styles.permission}><span><FolderOpen size={12}/></span><div className={styles.permissionCopy}><b>{count} Codex conversations</b><small>All requested conversations are analyzed locally; transcripts never return to the site.</small></div><i>Once</i></div></div>}{(prompt || runtimeCommand) && <div className={styles.prompt}><small>EXACT MESSAGE</small><p>{prompt ?? runtimeCommand}</p></div>}{questions.map(question => <label className={styles.question} key={question.id}><small>{question.header}</small><b>{question.question}</b>{question.options?.length ? <select value={answers[question.id] ?? ""} onChange={event => setAnswers(current => ({ ...current, [question.id]: event.target.value }))}><option value="">Choose…</option>{question.options.map(option => <option key={option.label}>{option.label}</option>)}</select> : <input value={answers[question.id] ?? ""} onChange={event => setAnswers(current => ({ ...current, [question.id]: event.target.value }))}/>}</label>)}<div className={styles.warning}><b>Trusted confirmation</b><span>The site cannot approve commands or filesystem changes.</span></div>{canSetPreference && <div className={styles.preferenceList}><label><Checkbox.Root checked={fastMode} onCheckedChange={checked => setFastMode(checked === true)} className={styles.preferenceCheck}><Checkbox.Indicator><Check size={11} weight="bold"/></Checkbox.Indicator></Checkbox.Root><span><b>Enable fast mode</b><small>Skip future Codemask prompts for this site. Codex command and file approvals still appear.</small></span></label></div>}<div className={canSetPreference ? `${styles.actions} ${styles.actionsWithBlock}` : styles.actions}>{canSetPreference && <Button onClick={() => onResolve(false, { blockOrigin: true })} className={styles.block}>Block site</Button>}<Button onClick={() => onResolve(false)} className={styles.reject}>Reject</Button><Button onClick={() => onResolve(true, approvalResult)} disabled={questions.length > 0 && questions.some(question => !answers[question.id])} className={styles.approve}>{questions.length ? "Submit" : approveLabels[request.method] ?? "Approve"}</Button></div></section>;
}
const queryClient = new QueryClient();
createRoot(document.getElementById("root")!).render(<React.StrictMode><QueryClientProvider client={queryClient}><Panel/></QueryClientProvider></React.StrictMode>);

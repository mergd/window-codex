import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query";
import { Link, Outlet, RouterProvider, createRootRoute, createRoute, createRouter, useNavigate } from "@tanstack/react-router";
import { getCodexProvider, type CodexProvider, type ReflectionResult, type TaskSnapshot, type ThreadMetadata } from "@window-codex/sdk";
import { Button, Progress } from "@window-codex/ui";
import { format, formatDistanceToNow } from "date-fns";
import "@window-codex/ui/tokens.css";
import styles from "./styles.module.css";

type AppState = { provider: CodexProvider | null; selected: string[]; reflection: ReflectionResult | null; workspace: { id: string; label: string } | null; task: TaskSnapshot | null };
const state: AppState = { provider: null, selected: [], reflection: null, workspace: null, task: null };

function Shell() {
  const profile = useQuery({ queryKey: ["provider-profile"], queryFn: async () => { const provider = state.provider ?? await getCodexProvider({ timeoutMs: 500 }); state.provider = provider; const info = await provider.request({ method: "provider.info", params: {} }); return info.connected ? info.profile : null; }, retry: false, staleTime: 10_000 });
  const account = profile.data; const accountName = account?.email?.split("@")[0].split(/[._-]+/).filter(Boolean).map(part => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`).join(" ") || (account?.type === "apiKey" ? "API account" : "Codex account");
  return <div className={styles.shell}><header><Link to="/" className={styles.brand}><span>R</span> Reflex</Link><div className={styles.powered}>Powered by <b>Codemask</b></div><div className={styles.headerRight}>{account && <div className={styles.account} aria-label={`Connected as ${account.email ?? accountName}`}><span>{accountName.slice(0, 1)}</span><div><b>{accountName}</b><small>{account.email ?? "Authenticated with API key"}</small></div>{account.planType && <em>{account.planType.replaceAll("_", " ")}</em>}</div>}<a href="https://cm.fldr.zip">Docs ↗</a></div></header><Outlet/></div>;
}

function Landing() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const connect = useMutation({ mutationFn: async () => { const provider = await getCodexProvider({ timeoutMs: 1200 }); await provider.request({ method: "connect", params: { protocolVersion: "0.1", scopes: ["threads:metadata", "events:subscribe"] } }); state.provider = provider; return provider; }, onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["provider-profile"] }); void navigate({ to: "/threads" }); }, onError: error => setError(error instanceof Error ? error.message : String(error)) });
  return <main className={styles.landing}><section><div className={styles.eyebrow}>A clearer view of how you work</div><h1>Your Codex history,<br/><em>turned into momentum.</em></h1><p>Reflex reviews your complete Codex history to find themes, repeated friction, and high-leverage improvements—without giving the page your transcripts.</p><Button className={styles.primary} onClick={() => connect.mutate()} disabled={connect.isPending}>{connect.isPending ? "Opening Codemask…" : "Connect with Codemask"}</Button>{error && <div className={styles.error}>{error}<small>Load the Codemask extension, then refresh this page.</small></div>}<div className={styles.trust}><span>◇ Uses your signed-in Codex plan</span><span>◇ No separate API key</span><span>◇ Your data stays local</span></div></section><aside className={styles.preview}><div className={styles.previewHead}><span>Complete history reflection</span><span className={styles.pill}>All conversations</span></div><div className={styles.score}><small>PRIMARY OPPORTUNITY</small><strong>Turn repeated setup work into a reusable workflow.</strong><p>Configuration and deployment steps recur across your recent Codex work.</p></div><div className={styles.miniGrid}><div><span>128</span><small>turns reviewed</small></div><div><span>6</span><small>clear themes</small></div><div><span>4h</span><small>potential saved</small></div></div><div className={styles.themeBars}><label>Automation <i style={{ width: "84%" }}/></label><label>Deployment <i style={{ width: "68%" }}/></label><label>Debugging <i style={{ width: "44%" }}/></label></div></aside></main>;
}

function Steps({ active }: { active: number }) { return <div className={styles.steps}>{["Review history", "Analyze", "Improve"].map((label, index) => <React.Fragment key={label}><div className={index <= active ? styles.activeStep : ""}><span>{index < active ? "✓" : index + 1}</span>{label}</div>{index < 2 && <i/>}</React.Fragment>)}</div>; }

async function loadHistoryPartition(provider: CodexProvider, archived: boolean) {
  const threads: ThreadMetadata[] = []; const seenCursors = new Set<string>(); let cursor: string | undefined;
  do {
    const page = await provider.request({ method: "threads.list", params: { cursor, limit: 50, archived, includeTurnCounts: true } });
    threads.push(...page.data);
    cursor = page.nextCursor ?? undefined;
    if (cursor && seenCursors.has(cursor)) throw new Error("Codex returned a repeated history cursor");
    if (cursor) seenCursors.add(cursor);
  } while (cursor);
  return threads;
}

async function loadCompleteHistory(provider: CodexProvider) {
  const partitions = await Promise.all([loadHistoryPartition(provider, false), loadHistoryPartition(provider, true)]);
  return [...new Map(partitions.flat().map(thread => [thread.id, thread])).values()].sort((left, right) => right.updatedAt - left.updatedAt);
}

function Threads() {
  const navigate = useNavigate();
  const providerQuery = useQuery({ queryKey: ["provider"], queryFn: async () => state.provider ?? getCodexProvider(), staleTime: Infinity });
  const threadsQuery = useQuery({ queryKey: ["threads", "all"], enabled: Boolean(providerQuery.data), queryFn: () => loadCompleteHistory(providerQuery.data!) });
  const threads = threadsQuery.data ?? [];
  const stats = useMemo(() => ({ turns: threads.reduce((sum, thread) => sum + thread.turnCount, 0), projects: new Set(threads.map(thread => thread.workspaceLabel).filter(Boolean)).size, activeDays: new Set(threads.map(thread => thread.updatedAt ? format(new Date(thread.updatedAt * 1000), "yyyy-MM-dd") : null).filter(Boolean)).size }), [threads]);
  const continueFlow = () => { state.selected = threads.map(thread => thread.id); void navigate({ to: "/reflect" }); };
  return <Flow><Steps active={0}/><div className={styles.flowHead}><div><div className={styles.eyebrow}>Complete Codex history</div><h1>Your work is ready to reflect.</h1><p>Reflex automatically found every available conversation. Titles, dates, projects, and turn counts are metadata; transcript content stays local until you approve one complete-history analysis.</p></div><div className={styles.counter}><b>{threadsQuery.isLoading ? "…" : threads.length}</b><span>conversations found</span></div></div>{threadsQuery.isLoading ? <ThreadSkeleton/> : threadsQuery.isError ? <Empty title="Couldn’t load your history" text={String(threadsQuery.error)}/> : <><section className={styles.historyStats}><div><b>{threads.length}</b><span>conversations</span></div><div><b>{stats.turns}</b><span>turns</span></div><div><b>{stats.projects}</b><span>projects</span></div><div><b>{stats.activeDays}</b><span>active days</span></div></section><div className={styles.historyHeader}><div><h2>Recent conversations</h2><p>All {threads.length} conversations will be analyzed, including older work not shown below.</p></div>{threads[0]?.updatedAt ? <span>Latest activity {formatDistanceToNow(new Date(threads[0].updatedAt * 1000), { addSuffix: true })}</span> : null}</div><div className={styles.threadList}>{threads.slice(0, 12).map(thread => <ThreadRow key={thread.id} thread={thread}/>)}</div>{threads.length > 12 && <div className={styles.historyMore}>+ {threads.length - 12} earlier conversations included</div>}</>}<div className={styles.stickyAction}><span>Uses the Codex account signed in on this Mac · one-time approval</span><Button className={styles.primary} disabled={!threads.length || threadsQuery.isLoading} onClick={continueFlow}>Analyze all {threads.length || ""} conversations →</Button></div></Flow>;
}

function ThreadRow({ thread }: { thread: ThreadMetadata }) { return <div className={styles.thread}><div><b>{thread.title}</b><span>{thread.workspaceLabel ?? "Codex workspace"} · {thread.turnCount} {thread.turnCount === 1 ? "turn" : "turns"}</span></div><time title={thread.updatedAt ? format(new Date(thread.updatedAt * 1000), "PPpp") : undefined}>{thread.updatedAt ? formatDistanceToNow(new Date(thread.updatedAt * 1000), { addSuffix: true }) : "Unknown date"}</time></div>; }
function ThreadSkeleton() { return <div className={styles.threadList}>{Array.from({ length: 5 }, (_, index) => <div className={styles.skeleton} key={index}/>)}</div>; }

function Reflect() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState(0);
  const [progress, setProgress] = useState<{ message: string; completed: number; total: number; text: string } | null>(null);
  const [startupError, setStartupError] = useState("");
  const analysis = useMutation({ mutationFn: async () => { const provider = state.provider ?? await getCodexProvider(); const timer = window.setInterval(() => setPhase(value => Math.min(value + 1, 3)), 4000); try { return await provider.request({ method: "threads.analyze", params: { recipe: "reflection.v1", threadIds: state.selected } }); } finally { clearInterval(timer); } }, onSuccess: result => { state.reflection = result; void navigate({ to: "/findings" }); } });
  useEffect(() => { let provider: CodexProvider | null = null; let disposed = false; const update = (event: { phase: "reading" | "analyzing" | "synthesizing"; message: string; completed: number; total: number; text: string }) => { setProgress(event); setPhase(event.phase === "reading" ? 1 : event.phase === "analyzing" ? 2 : 3); }; void (async () => { provider = state.provider ?? await getCodexProvider(); state.provider = provider; if (disposed) return; provider.on("analysis.progress", update); analysis.mutate(); })().catch(error => setStartupError(error instanceof Error ? error.message : String(error))); return () => { disposed = true; provider?.removeListener("analysis.progress", update); }; }, []);
  const labels = ["Requesting one-time access", "Reading your complete history", "Analyzing conversations in batches", "Synthesizing your reflection"];
  const progressValue = progress?.total ? progress.text ? progress.message.startsWith("Synthesizing") ? 86 : 45 + (progress.completed / progress.total) * 35 : 18 + (progress.completed / progress.total) * 27 : [18, 42, 68, 88][phase];
  return <Flow><Steps active={1}/><div className={styles.analysis}><div className={styles.orbit}><span>R</span><i/><i/><i/></div><div className={styles.eyebrow}>Private account-wide analysis</div><h1>{progress?.message ?? labels[phase]}</h1><p>Reflex uses the Codex account already signed in on this Mac. Analysis runs in temporary read-only Codex threads; only structured findings return to this page.</p><Progress.Root value={progressValue} className={styles.progress}><Progress.Track><Progress.Indicator/></Progress.Track></Progress.Root>{progress?.text ? <div className={styles.liveAnalysis} aria-live="polite"><small>LIVE FROM CODEX</small><p>{progress.text}</p></div> : <small className={styles.analysisNote}>Large histories may take a few minutes.</small>}{(startupError || analysis.isError) && <div className={styles.error}>{startupError || String(analysis.error)}</div>}</div></Flow>;
}

function Findings() {
  const navigate = useNavigate();
  const result = state.reflection;
  if (!result) return <Flow><Empty title="No reflection yet" text="Load your history and run a reflection first."/><Button className={styles.primary} onClick={() => void navigate({ to: "/threads" })}>Review history</Button></Flow>;
  const range = result.coverage.from && result.coverage.to ? `${format(new Date(result.coverage.from), "MMM d, yyyy")} – ${format(new Date(result.coverage.to), "MMM d, yyyy")}` : "All available history";
  return <Flow><Steps active={2}/><div className={styles.findingHead}><div><div className={styles.eyebrow}>Complete history reflection</div><h1>A few patterns are doing most of the work.</h1><p className={styles.coverageRange}>{range} · {result.coverage.analyzedThreads} of {result.coverage.selectedThreads} conversations analyzed{result.coverage.truncatedThreads ? ` · ${result.coverage.truncatedThreads} long conversations partially sampled` : ""}</p></div><div className={styles.coverage}><b>{result.activity.threadCount}</b><span>conversations</span><b>{result.activity.turnCount}</b><span>turns</span><b>{result.activity.activeDays}</b><span>active days</span></div></div><section className={styles.findingGrid}><div className={styles.card}><small>THEMES</small>{result.themes.map((theme, index) => <div className={styles.theme} key={theme.label}><span>{index + 1}</span><div><b>{theme.label}</b><small>{theme.count} supporting conversations</small></div></div>)}</div><div className={styles.card}><small>REPEATED FRICTION</small>{result.frictions.map(item => <div className={styles.friction} key={item.label}><b>{item.label}</b><p>{item.description}</p></div>)}</div></section><h2 className={styles.sectionTitle}>Turn insight into improvement</h2><div className={styles.suggestions}>{result.suggestions.map((suggestion, index) => <article key={suggestion.id}><span>0{index + 1}</span><div><h3>{suggestion.title}</h3><p>{suggestion.rationale}</p><code>{suggestion.proposedPrompt}</code></div><Button className={styles.secondaryButton} onClick={() => { sessionStorage.setItem("suggestion", suggestion.id); void navigate({ to: "/improve" }); }}>Build this with Codex →</Button></article>)}</div></Flow>;
}

function Improve() {
  const navigate = useNavigate();
  const suggestion = state.reflection?.suggestions.find(item => item.id === sessionStorage.getItem("suggestion")) ?? state.reflection?.suggestions[0];
  const [workspace, setWorkspace] = useState(state.workspace);
  const [task, setTask] = useState(state.task);
  const selectWorkspace = useMutation({ mutationFn: async () => (state.provider ?? await getCodexProvider()).request({ method: "workspace.select", params: {} }), onSuccess: value => { state.workspace = value; setWorkspace(value); } });
  const start = useMutation({ mutationFn: async () => { if (!workspace || !suggestion) throw new Error("Choose a workspace first"); return (state.provider ?? await getCodexProvider()).request({ method: "tasks.start", params: { workspaceId: workspace.id, prompt: suggestion.proposedPrompt, title: suggestion.title } }); }, onSuccess: value => { state.task = value; setTask(value); } });
  useEffect(() => { if (!task || !state.provider) return; const update = (event: { taskId: string; text: string }) => { if (event.taskId === task.id) setTask(current => current ? { ...current, lastMessage: event.text, updatedAt: Date.now() / 1000 } : current); }; state.provider.on("task.event", update); return () => state.provider?.removeListener("task.event", update); }, [task?.id]);
  if (!suggestion) return <Flow><Empty title="Choose an improvement" text="Return to your findings and select a suggestion."/></Flow>;
  return <Flow><Steps active={2}/><div className={styles.improve}>{task ? <><div className={styles.liveBadge}><span/> Codex task {task.status}</div><h1>{task.title}</h1><div className={styles.taskStream}><small>LATEST UPDATE</small><p>{task.lastMessage ?? "Codex is starting the task…"}</p></div><div className={styles.actions}><Button className={styles.secondaryButton} onClick={() => void navigate({ to: "/findings" })}>Back to findings</Button><Button className={styles.dangerButton} onClick={() => state.provider?.request({ method: "tasks.cancel", params: { taskId: task.id } }).then(setTask)}>Cancel task</Button></div></> : <><div className={styles.eyebrow}>Make it durable</div><h1>{suggestion.title}</h1><p>{suggestion.rationale}</p><div className={styles.prompt}><small>EXACT PROMPT</small><p>{suggestion.proposedPrompt}</p></div><button className={styles.workspace} onClick={() => selectWorkspace.mutate()}><span>⌘</span><div><small>WORKSPACE</small><b>{workspace?.label ?? "Choose a workspace"}</b></div><i>›</i></button><div className={styles.notice}>Codemask will show this origin, workspace, and exact prompt before anything starts.</div><Button className={styles.primary} disabled={!workspace || start.isPending} onClick={() => start.mutate()}>{start.isPending ? "Waiting for confirmation…" : "Review and start task →"}</Button>{start.isError && <div className={styles.error}>{String(start.error)}</div>}</>}</div></Flow>;
}

function Flow({ children }: { children: React.ReactNode }) { return <main className={styles.flow}>{children}</main>; }
function Empty({ title, text }: { title: string; text: string }) { return <div className={styles.empty}><b>{title}</b><p>{text}</p></div>; }

const rootRoute = createRootRoute({ component: Shell });
const routes = [
  createRoute({ getParentRoute: () => rootRoute, path: "/", component: Landing }),
  createRoute({ getParentRoute: () => rootRoute, path: "/threads", component: Threads }),
  createRoute({ getParentRoute: () => rootRoute, path: "/reflect", component: Reflect }),
  createRoute({ getParentRoute: () => rootRoute, path: "/findings", component: Findings }),
  createRoute({ getParentRoute: () => rootRoute, path: "/improve", component: Improve }),
];
const router = createRouter({ routeTree: rootRoute.addChildren(routes) });
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } });
createRoot(document.getElementById("root")!).render(<React.StrictMode><QueryClientProvider client={queryClient}><RouterProvider router={router}/></QueryClientProvider></React.StrictMode>);

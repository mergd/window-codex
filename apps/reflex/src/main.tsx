import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Outlet, RouterProvider, createRootRoute, createRoute, createRouter, useNavigate } from "@tanstack/react-router";
import { getCodexProvider, type CodexProvider, type ReflectionResult, type TaskSnapshot, type ThreadMetadata } from "@window-codex/sdk";
import { Button, Checkbox, Progress } from "@window-codex/ui";
import "@window-codex/ui/tokens.css";
import styles from "./styles.module.css";

type AppState = { provider: CodexProvider | null; selected: string[]; reflection: ReflectionResult | null; workspace: { id: string; label: string } | null; task: TaskSnapshot | null };
const state: AppState = { provider: null, selected: [], reflection: null, workspace: null, task: null };

function Shell() { return <div className={styles.shell}><header><Link to="/" className={styles.brand}><span>R</span> Reflex</Link><div className={styles.powered}>Powered by <b>Codemask</b></div><a href="https://window-codex-docs.pages.dev">Docs ↗</a></header><Outlet/></div>; }

function Landing() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const connect = useMutation({ mutationFn: async () => { const provider = await getCodexProvider({ timeoutMs: 1200 }); await provider.request({ method: "connect", params: { protocolVersion: "0.1", scopes: ["threads:metadata", "events:subscribe"] } }); state.provider = provider; return provider; }, onSuccess: () => void navigate({ to: "/threads" }), onError: error => setError(error instanceof Error ? error.message : String(error)) });
  return <main className={styles.landing}><section><div className={styles.eyebrow}>A clearer view of how you work</div><h1>Your Codex history,<br/><em>turned into momentum.</em></h1><p>Reflex finds the themes, repeated friction, and highest-leverage improvements across work you choose—without giving the page your transcripts.</p><Button className={styles.primary} onClick={() => connect.mutate()} disabled={connect.isPending}>{connect.isPending ? "Opening Codemask…" : "Connect with Codemask"}</Button>{error && <div className={styles.error}>{error}<small>Load the Codemask extension, then refresh this page.</small></div>}<div className={styles.trust}><span>◇ Your data stays local</span><span>◇ Every action is confirmed</span></div></section><aside className={styles.preview}><div className={styles.previewHead}><span>Reflection · Last 30 days</span><span className={styles.pill}>8 threads</span></div><div className={styles.score}><small>PRIMARY OPPORTUNITY</small><strong>Turn repeated setup work into a reusable workflow.</strong><p>Configuration and deployment steps appeared in 5 of 8 selected threads.</p></div><div className={styles.miniGrid}><div><span>24</span><small>turns reviewed</small></div><div><span>3</span><small>clear themes</small></div><div><span>4h</span><small>potential saved</small></div></div><div className={styles.themeBars}><label>Automation <i style={{ width: "84%" }}/></label><label>Deployment <i style={{ width: "68%" }}/></label><label>Debugging <i style={{ width: "44%" }}/></label></div></aside></main>;
}

function Steps({ active }: { active: number }) { return <div className={styles.steps}>{["Choose work", "Reflect", "Improve"].map((label, index) => <React.Fragment key={label}><div className={index <= active ? styles.activeStep : ""}><span>{index < active ? "✓" : index + 1}</span>{label}</div>{index < 2 && <i/>}</React.Fragment>)}</div>; }

function Threads() {
  const navigate = useNavigate();
  const providerQuery = useQuery({ queryKey: ["provider"], queryFn: async () => state.provider ?? getCodexProvider(), staleTime: Infinity });
  const threadsQuery = useQuery({ queryKey: ["threads"], enabled: Boolean(providerQuery.data), queryFn: () => providerQuery.data!.request({ method: "threads.list", params: { limit: 20 } }) });
  const [selected, setSelected] = useState<string[]>(state.selected);
  const toggle = (id: string) => setSelected(current => current.includes(id) ? current.filter(value => value !== id) : current.length < 10 ? [...current, id] : current);
  const continueFlow = () => { state.selected = selected; void navigate({ to: "/reflect" }); };
  return <Flow><Steps active={0}/><div className={styles.flowHead}><div><div className={styles.eyebrow}>Choose the signal</div><h1>What should Reflex learn from?</h1><p>Select up to ten threads. Titles and activity are metadata; content is only used after a separate one-time approval.</p></div><div className={styles.counter}><b>{selected.length}</b><span>of 10 selected</span></div></div>{threadsQuery.isLoading ? <ThreadSkeleton/> : threadsQuery.isError ? <Empty title="Couldn’t load threads" text={String(threadsQuery.error)}/> : <div className={styles.threadList}>{threadsQuery.data?.data.map(thread => <ThreadRow key={thread.id} thread={thread} checked={selected.includes(thread.id)} onChange={() => toggle(thread.id)}/>)}</div>}<div className={styles.stickyAction}><span>{selected.length ? `${selected.length} threads ready for reflection` : "Choose at least one thread"}</span><Button className={styles.primary} disabled={!selected.length} onClick={continueFlow}>Continue to reflection →</Button></div></Flow>;
}

function ThreadRow({ thread, checked, onChange }: { thread: ThreadMetadata; checked: boolean; onChange: () => void }) { return <label className={checked ? `${styles.thread} ${styles.checked}` : styles.thread}><Checkbox.Root checked={checked} onCheckedChange={onChange} className={styles.checkbox}><Checkbox.Indicator>✓</Checkbox.Indicator></Checkbox.Root><div><b>{thread.title}</b><span>{thread.workspaceLabel ?? "Codex workspace"} · {thread.turnCount} turns</span></div><time>{new Date(thread.updatedAt * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</time></label>; }
function ThreadSkeleton() { return <div className={styles.threadList}>{Array.from({ length: 5 }, (_, index) => <div className={styles.skeleton} key={index}/>)}</div>; }

function Reflect() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState(0);
  const analysis = useMutation({ mutationFn: async () => { const provider = state.provider ?? await getCodexProvider(); const timer = window.setInterval(() => setPhase(value => Math.min(value + 1, 3)), 700); try { return await provider.request({ method: "threads.analyze", params: { recipe: "reflection.v1", threadIds: state.selected } }); } finally { clearInterval(timer); } }, onSuccess: result => { state.reflection = result; void navigate({ to: "/findings" }); } });
  useEffect(() => { analysis.mutate(); }, []);
  const labels = ["Requesting one-time access", "Reading selected work", "Finding repeated patterns", "Preparing improvements"];
  return <Flow><Steps active={1}/><div className={styles.analysis}><div className={styles.orbit}><span>R</span><i/><i/><i/></div><div className={styles.eyebrow}>Private analysis in progress</div><h1>{labels[phase]}</h1><p>Only structured findings will return to this page. Raw transcript content stays behind the provider boundary.</p><Progress.Root value={(phase + 1) * 25} className={styles.progress}><Progress.Track><Progress.Indicator/></Progress.Track></Progress.Root>{analysis.isError && <div className={styles.error}>{String(analysis.error)}</div>}</div></Flow>;
}

function Findings() {
  const navigate = useNavigate();
  const result = state.reflection;
  if (!result) return <Flow><Empty title="No reflection yet" text="Choose work and run a reflection first."/><Button className={styles.primary} onClick={() => void navigate({ to: "/threads" })}>Choose threads</Button></Flow>;
  return <Flow><Steps active={2}/><div className={styles.findingHead}><div><div className={styles.eyebrow}>Your reflection</div><h1>A few patterns are doing most of the work.</h1></div><div className={styles.coverage}><b>{result.activity.threadCount}</b><span>threads</span><b>{result.activity.turnCount}</b><span>turns</span><b>{result.activity.activeDays}</b><span>active days</span></div></div><section className={styles.findingGrid}><div className={styles.card}><small>THEMES</small>{result.themes.map((theme, index) => <div className={styles.theme} key={theme.label}><span>{index + 1}</span><div><b>{theme.label}</b><small>{theme.count} supporting threads</small></div></div>)}</div><div className={styles.card}><small>REPEATED FRICTION</small>{result.frictions.map(item => <div className={styles.friction} key={item.label}><b>{item.label}</b><p>{item.description}</p></div>)}</div></section><h2 className={styles.sectionTitle}>Turn insight into improvement</h2><div className={styles.suggestions}>{result.suggestions.map((suggestion, index) => <article key={suggestion.id}><span>0{index + 1}</span><div><h3>{suggestion.title}</h3><p>{suggestion.rationale}</p><code>{suggestion.proposedPrompt}</code></div><Button className={styles.secondaryButton} onClick={() => { sessionStorage.setItem("suggestion", suggestion.id); void navigate({ to: "/improve" }); }}>Build this with Codex →</Button></article>)}</div></Flow>;
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

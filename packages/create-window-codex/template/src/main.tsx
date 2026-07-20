import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@base-ui/react/button";
import { createMockCodexProvider, getCodexProvider, type CodexProvider } from "@window-codex/sdk";
import "./tokens.css";
import styles from "./styles.module.css";

function App() {
  const provider = useQuery({ queryKey: ["provider"], queryFn: async () => { try { return await getCodexProvider({ timeoutMs: 500 }); } catch { return createMockCodexProvider(); } }, staleTime: Infinity });
  const [workspace, setWorkspace] = useState<{id:string;label:string}|null>(null);
  const [prompt, setPrompt] = useState("Review this project and propose the highest-leverage improvement.");
  const [events, setEvents] = useState<string[]>([]);
  const connect = useMutation({ mutationFn: () => provider.data!.request({ method: "connect", params: { protocolVersion: "0.1", scopes: ["tasks:create", "tasks:control", "events:subscribe"] } }) });
  const start = useMutation({ mutationFn: async () => { const selected = workspace ?? await provider.data!.request({ method: "workspace.select", params: {} }); setWorkspace(selected); const task = await provider.data!.request({ method: "tasks.start", params: { workspaceId: selected.id, prompt, title: "Integration task" } }); provider.data!.on("task.event", event => setEvents(current => [...current, event.text])); return task; } });
  return <main className={styles.shell}><div className={styles.eyebrow}>Codemask integration · window.codex</div><h1>Ship something useful.</h1><p>This generated starter works with Codemask and falls back to a safe local mock during UI development.</p><div className={styles.card}><div className={styles.status}><span/><b>{provider.isLoading ? "Discovering provider…" : "Provider ready"}</b></div><Button className={styles.button} disabled={!provider.data} onClick={() => connect.mutate()}>{connect.isSuccess ? "Connected" : "Connect"}</Button><label>Task prompt<textarea value={prompt} onChange={event => setPrompt(event.target.value)}/></label><Button className={styles.button} disabled={!connect.isSuccess || start.isPending} onClick={() => start.mutate()}>{start.isPending ? "Waiting for confirmation…" : "Choose workspace and start"}</Button>{start.data && <div className={styles.task}><b>{start.data.title}</b><span>{start.data.status} · {start.data.workspaceLabel}</span>{events.map((event, index) => <p key={index}>{event}</p>)}</div>}</div></main>;
}
const client = new QueryClient();
createRoot(document.getElementById("root")!).render(<React.StrictMode><QueryClientProvider client={client}><App/></QueryClientProvider></React.StrictMode>);

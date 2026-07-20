import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query";
import { Link, Outlet, RouterProvider, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { getCodexProvider, type CodexMethod, type CodexProvider } from "@window-codex/sdk";
import { ArrowRight, Button, CheckCircle, Tabs, WarningCircle } from "@window-codex/ui";
import "@window-codex/ui/tokens.css";
import "./font.css";
import styles from "./styles.module.css";

const quickstart = `npx --yes \\
  https://github.com/mergd/window-codex/releases/download/v0.1.0/create-window-codex-0.1.0.tgz \\
  my-integration
cd my-integration
npm install
npm run dev`;

const requestExample = `const codex = await getCodexProvider()

await codex.request({
  method: 'connect',
  params: {
    protocolVersion: '0.1',
    scopes: ['threads:metadata']
  }
})`;

function Shell() {
  return <div className={styles.shell}>
    <header className={styles.header}>
      <Link to="/" className={styles.brand}><span className={styles.mark}>wc</span> window.codex</Link>
      <nav><Link to="/quickstart">Quickstart</Link><Link to="/guides">Guides</Link><Link to="/reference">API</Link><Link to="/explorer">Explorer</Link><a href="https://window-codex-reflex.pages.dev">Reflex ↗</a></nav>
    </header>
    <Outlet />
    <footer><span>window.codex · protocol 0.1</span><span>Local-first by design</span></footer>
  </div>;
}

function Home() {
  return <main>
    <section className={styles.hero}>
      <div><div className={styles.eyebrow}>A browser provider for Codex</div><h1>Let the web ask Codex.<br/><em>Keep the user in control.</em></h1><p>Build integrations that analyze selected work, start confirmed tasks, and stream safe progress—with a familiar wallet-style permission model.</p><div className={styles.actions}><Link className={styles.primary} to="/quickstart">Build an integration</Link><Link className={styles.secondary} to="/explorer">Open provider explorer</Link></div></div>
      <div className={styles.providerCard}><div className={styles.cardTop}><span className={styles.statusDot}/><span>reflex.window.codex</span><span className={styles.muted}>Connected</span></div><div className={styles.request}><small>PERMISSION REQUEST</small><h3>Analyze 8 Codex threads?</h3><p>Reflex will receive derived findings, never raw transcripts.</p><div className={styles.scope}><span>◫</span><div><b>One-time access</b><small>reflection.v1 · 8 selected threads</small></div></div><div className={styles.inlineButtons}><button>Reject</button><button className={styles.approve}>Approve once</button></div></div></div>
    </section>
    <section className={styles.grid}><article><span>01</span><h2>Discover</h2><p>Feature-detect a stable, typed provider at <code>window.codex</code>.</p></article><article><span>02</span><h2>Ask</h2><p>Request the smallest scope. The extension shows the exact origin and action.</p></article><article><span>03</span><h2>Build</h2><p>Turn insights into confirmed Codex tasks and stream sanitized progress.</p></article></section>
  </main>;
}

function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  return <div className={styles.code}><button onClick={() => { void navigator.clipboard.writeText(children); setCopied(true); setTimeout(() => setCopied(false), 1200); }}>{copied ? "Copied" : "Copy"}</button><pre>{children}</pre></div>;
}

function Quickstart() { return <Article eyebrow="Five-minute quickstart" title="From zero to a Codex-powered page."><p>Generate the opinionated React starter directly from the public GitHub release. It includes typed provider discovery, a mock provider, task controls, Base UI, TanStack Query, CSS Modules, and Cloudflare configuration.</p><CodeBlock>{quickstart}</CodeBlock><h2>Make the first request</h2><CodeBlock>{requestExample}</CodeBlock><Callout>Without the extension, the starter automatically uses a local mock so you can finish the interface first. No npm registry account is required.</Callout></Article>; }

function Guides() { return <Article eyebrow="Guides" title="Small permissions. Clear outcomes."><div className={styles.guideList}>{[
  ["Connection", "Negotiate protocol 0.1 and ask only for capabilities your integration uses."],
  ["Thread metadata", "List opaque thread handles, activity dates, and safe workspace labels."],
  ["Analysis recipes", "Run reflection.v1 with a one-use grant and receive structured findings."],
  ["Task lifecycle", "Select a workspace, confirm the exact prompt, then stream sanitized events."],
  ["Errors and recovery", "Handle user cancellation, runtime restarts, revocation, and unsupported methods."],
].map(([name, text], i) => <section key={name}><span>0{i + 1}</span><div><h2>{name}</h2><p>{text}</p></div></section>)}</div><h2>Trust boundary</h2><p>Websites never receive app-server credentials, filesystem paths, raw approval requests, commands, diffs, or reasoning. Those stay in extension-owned UI.</p></Article>; }

const methods: Array<[string, string, string]> = [
  ["provider.info", "none", "Provider identity and connection state"], ["capabilities.list", "none", "Supported methods and recipes"], ["connect", "confirmation", "Connect an exact origin"], ["permissions.request", "confirmation", "Request scoped access"], ["workspace.select", "action", "Choose an opaque workspace"], ["threads.list", "threads:metadata", "List safe metadata"], ["threads.analyze", "threads:analyze", "Run a named recipe"], ["tasks.start", "tasks:create", "Confirm and start a task"], ["tasks.send", "tasks:control", "Confirm a follow-up"], ["tasks.cancel", "tasks:control", "Cancel an owned task"]
];
function Reference() { return <Article eyebrow="Protocol 0.1" title="A narrow, stable contract."><div className={styles.table}><div className={styles.tableHead}><span>Method</span><span>Permission</span><span>Outcome</span></div>{methods.map(row => <div key={row[0]}>{row.map(cell => <span key={cell}>{cell}</span>)}</div>)}</div><h2>Stable errors</h2><p><code>PROVIDER_UNAVAILABLE</code> · <code>PERMISSION_REQUIRED</code> · <code>USER_CANCELLED</code> · <code>RUNTIME_UNAVAILABLE</code> · <code>RUNTIME_ERROR</code></p></Article>; }

function Explorer() {
  const [provider, setProvider] = useState<CodexProvider | null>(null);
  const [method, setMethod] = useState<CodexMethod>("provider.info");
  const [output, setOutput] = useState("No request sent yet.");
  const discovery = useQuery({ queryKey: ["provider"], queryFn: () => getCodexProvider({ timeoutMs: 800 }), retry: false });
  const connect = useMutation({ mutationFn: async () => { const value = discovery.data ?? await getCodexProvider(); setProvider(value); return value.request({ method: "connect", params: { protocolVersion: "0.1", scopes: ["threads:metadata"] } }); }, onSuccess: value => setOutput(JSON.stringify(value, null, 2)), onError: error => setOutput(String(error)) });
  const send = async () => { try { const active = provider ?? discovery.data ?? await getCodexProvider(); setProvider(active); const params = method === "threads.list" ? { limit: 5 } : {}; const value = await active.request({ method, params } as never); setOutput(JSON.stringify(value, null, 2)); } catch (error) { setOutput(String(error)); } };
  return <Article eyebrow="Live provider explorer" title="See the boundary in action.">
    {discovery.isError ? <section className={styles.setupCard}>
      <div className={styles.setupIcon}><WarningCircle size={24}/></div>
      <div className={styles.setupCopy}><span>SETUP REQUIRED</span><h2>Connect this browser to Codex</h2><p>The provider is not installed in this browser yet. Add the extension, install the local macOS bridge, then return here to make your first request.</p></div>
      <ol className={styles.setupSteps}><li><span>1</span><div><b>Add the Chrome extension</b><small>Load the unpacked extension for the hackathon build.</small></div></li><li><span>2</span><div><b>Install the local bridge</b><small>The bridge connects Chrome directly to your authenticated Codex runtime.</small></div></li><li><span>3</span><div><b>Retry detection</b><small>No Codex data is sent through this documentation site.</small></div></li></ol>
      <div className={styles.setupActions}><Link className={styles.setupPrimary} to="/quickstart">Open setup guide <ArrowRight size={17}/></Link><Button className={styles.setupSecondary} onClick={() => void discovery.refetch()}>Check again</Button></div>
    </section> : <div className={styles.explorer}><div className={styles.explorerHeader}><CheckCircle size={22} className={styles.connectedIcon}/><div><b>Provider detected</b><small>Extension available · ready for requests</small></div><Button className={styles.button} onClick={() => connect.mutate()}>{connect.isPending ? "Waiting for approval…" : "Connect"}</Button></div><Tabs.Root defaultValue="request"><Tabs.List className={styles.tabs}><Tabs.Tab value="request">Request</Tabs.Tab><Tabs.Tab value="response">Response</Tabs.Tab></Tabs.List><Tabs.Panel value="request" className={styles.panel}><label>Method<select value={method} onChange={e => setMethod(e.target.value as CodexMethod)}>{methods.slice(0, 8).map(([name]) => <option key={name}>{name}</option>)}</select></label><Button className={styles.button} onClick={() => void send()}>Send request</Button></Tabs.Panel><Tabs.Panel value="response" className={styles.panel}><pre>{output}</pre></Tabs.Panel></Tabs.Root></div>}
  </Article>;
}

function Callout({ children }: { children: React.ReactNode }) { return <div className={styles.callout}><b>Good to know</b><span>{children}</span></div>; }
function Article({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) { return <main className={styles.article}><aside><span>Documentation</span><Link to="/quickstart">Quickstart</Link><Link to="/guides">Guides</Link><Link to="/reference">API reference</Link><Link to="/explorer">Provider explorer</Link></aside><article><div className={styles.eyebrow}>{eyebrow}</div><h1>{title}</h1>{children}</article></main>; }

const rootRoute = createRootRoute({ component: Shell });
const routes = [
  createRoute({ getParentRoute: () => rootRoute, path: "/", component: Home }),
  createRoute({ getParentRoute: () => rootRoute, path: "/quickstart", component: Quickstart }),
  createRoute({ getParentRoute: () => rootRoute, path: "/guides", component: Guides }),
  createRoute({ getParentRoute: () => rootRoute, path: "/reference", component: Reference }),
  createRoute({ getParentRoute: () => rootRoute, path: "/explorer", component: Explorer }),
];
const router = createRouter({ routeTree: rootRoute.addChildren(routes) });
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 5000 } } });
createRoot(document.getElementById("root")!).render(<React.StrictMode><QueryClientProvider client={queryClient}><RouterProvider router={router}/></QueryClientProvider></React.StrictMode>);

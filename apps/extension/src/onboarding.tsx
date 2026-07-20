import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { ArrowRight, Button, Check, Copy, Terminal } from "@window-codex/ui";
import "@window-codex/ui/tokens.css";
import "./font.css";
import styles from "./onboarding.module.css";

const INSTALL_COMMAND = "npx --yes \"https://cm.fldr.zip/downloads/codemask-bridge.tgz?bridge=0.1.1\"";
const hasExtensionRuntime = () => typeof globalThis.chrome !== "undefined" && Boolean(globalThis.chrome.runtime?.id);
const assetUrl = (path: string) => hasExtensionRuntime() ? chrome.runtime.getURL(path) : `/${path}`;
const checkRuntime = () => hasExtensionRuntime() ? chrome.runtime.sendMessage({ type: "ui.runtime.check" }) : Promise.resolve({ ok: false, message: "Preview mode" });

function Onboarding() {
  const [copied, setCopied] = React.useState(false);
  const runtime = useQuery({ queryKey: ["runtime"], queryFn: checkRuntime, retry: false, refetchInterval: 4000 });
  const ready = Boolean(runtime.data?.ok);
  const copyInstall = async () => { await navigator.clipboard.writeText(INSTALL_COMMAND); setCopied(true); window.setTimeout(() => setCopied(false), 1400); };
  return <main className={styles.page}><header><div><img src={assetUrl("icons/icon-48.png")}/><b>Codemask</b></div><span>PROVIDER 0.1</span></header><section className={styles.shell}><div className={styles.intro}><div className={styles.stepCount}>DEVELOPER SETUP · 3 STEPS</div><h1>Connect Codex<br/>to your browser.</h1><p>Codemask gives approved websites a local, permissioned route to Codex. Nothing is proxied through a hosted backend.</p></div><div className={ready ? styles.ready : styles.status}><i/><div><b>{ready ? "Codemask is ready" : "Local bridge not installed"}</b><span>{ready ? "Websites can now request access through window.codex." : "Run the installer below, then reload the extension."}</span></div><em>{ready ? "ONLINE" : "SETUP"}</em></div><div className={styles.card}><Step number="1" title="Install the Codemask bridge"><span>Run one command from any terminal. It finds your Codex CLI and registers Chrome Native Messaging for this extension.</span><div className={styles.command}><Terminal size={17}/><code>{INSTALL_COMMAND}</code><button aria-label="Copy install command" onClick={() => void copyInstall()}>{copied ? <Check size={16}/> : <Copy size={16}/>}</button></div></Step><Step number="2" title="Reload Codemask"><span>Open <code>chrome://extensions</code> and reload the unpacked Codemask extension. Node.js and an authenticated Codex CLI are required.</span><div className={styles.scope}><span>Installs locally to</span><code>~/.codemask</code></div></Step><Step number="3" title="Verify the connection"><span>Chrome connects directly to the registered native host on this Mac.</span><Button className={styles.verify} onClick={() => void runtime.refetch()}>{runtime.isFetching ? "Checking…" : ready ? <>Connected <Check size={14} weight="bold"/></> : "Check connection"}</Button></Step></div><div className={styles.trust}><span>LOCAL ROUTE</span><div><b>Website</b><ArrowRight/><b>Codemask</b><ArrowRight/><b>Bridge</b><ArrowRight/><b>Codex</b></div><p>Cloudflare serves the installer file. Codex content and control traffic stay on this Mac.</p></div></section></main>;
}

function Step({ number, title, children }: React.PropsWithChildren<{ number: string; title: string }>) { return <div className={styles.step}><em>{number}</em><div><b>{title}</b>{children}</div></div>; }
const queryClient = new QueryClient();
createRoot(document.getElementById("root")!).render(<React.StrictMode><QueryClientProvider client={queryClient}><Onboarding/></QueryClientProvider></React.StrictMode>);

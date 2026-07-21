import { EventEmitter } from "node:events";
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";

export class AppServer extends EventEmitter {
  private child: ChildProcessWithoutNullStreams | null = null;
  private nextId = 1;
  private pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>();

  constructor(private readonly codexBin: string) { super(); }

  async start() {
    if (this.child) return;
    const mcpProbe = spawnSync(this.codexBin, ["mcp", "list", "--json"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    let mcpNames: string[] = [];
    try { mcpNames = (JSON.parse(mcpProbe.stdout || "[]") as Array<{ name?: string }>).map(item => item.name).filter((name): name is string => Boolean(name && /^[A-Za-z0-9_-]+$/.test(name))); } catch { /* start with plugins disabled even if MCP discovery is unavailable */ }
    const disabledMcps = mcpNames.flatMap(name => ["-c", `mcp_servers.${name}={command="/usr/bin/false",enabled=false}`]);
    this.child = spawn(this.codexBin, ["app-server", "--disable", "plugins", "--disable", "apps", ...disabledMcps, "--listen", "stdio://"], { stdio: ["pipe", "pipe", "pipe"] });
    this.child.stderr.on("data", chunk => process.stderr.write(`[codex] ${chunk}`));
    this.child.on("exit", (code, signal) => { this.child = null; const failure = new Error(`codex app-server exited (${code ?? signal})`); this.pending.forEach(item => item.reject(failure)); this.pending.clear(); this.emit("exit", failure); });
    createInterface({ input: this.child.stdout }).on("line", line => { try { this.handle(JSON.parse(line)); } catch (error) { process.stderr.write(`[window.codex] invalid app-server frame: ${String(error)}\n`); } });
    await this.request("initialize", { clientInfo: { name: "codemask", title: "Codemask browser provider", version: "0.1.0" }, capabilities: { experimentalApi: false } });
    this.notify("initialized", {});
  }

  request(method: string, params: unknown): Promise<any> {
    if (!this.child) return Promise.reject(new Error("app-server is not running"));
    const id = this.nextId++;
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.write({ id, method, params }); });
  }
  notify(method: string, params: unknown) { this.write({ method, params }); }
  respond(id: number, result: unknown) { this.write({ id, result }); }
  private write(message: unknown) { if (!this.child) throw new Error("app-server is not running"); this.child.stdin.write(`${JSON.stringify(message)}\n`); }
  private handle(message: any) {
    if (typeof message.id === "number" && ("result" in message || "error" in message)) { const pending = this.pending.get(message.id); if (!pending) return; this.pending.delete(message.id); if (message.error) pending.reject(Object.assign(new Error(message.error.message), message.error)); else pending.resolve(message.result); return; }
    if (typeof message.id === "number" && message.method) { this.emit("request", message); return; }
    if (message.method) this.emit("notification", message);
  }
}

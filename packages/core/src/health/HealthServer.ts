import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import type { Disposable } from "@/di/types.js";
import type { LivenessCheck, ReadinessSource } from "./types.js";

export interface HealthServerOptions {
  port: number;
  host?: string;
}

export class HealthServer implements Disposable {
  private readonly server: Server;

  constructor(
    private readonly readiness: ReadinessSource,
    private readonly isAlive: LivenessCheck,
    private readonly options: HealthServerOptions,
  ) {
    this.server = createServer((request, response) => this.handle(request, response));
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(this.options.port, this.options.host ?? "0.0.0.0", () => {
        this.server.off("error", reject);
        resolve();
      });
    });
  }

  get port(): number {
    return (this.server.address() as AddressInfo).port;
  }

  dispose(): Promise<void> {
    if (!this.server.listening) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  // A throw here would reach uncaughtException and stop the worker, so the listener answers 500 instead.
  private handle(request: IncomingMessage, response: ServerResponse): void {
    try {
      this.route(request, response);
    } catch {
      if (!response.headersSent) {
        response.writeHead(500);
      }

      response.end();
    }
  }

  // Split, not parsed: new URL() throws on a target such as "//[".
  private route(request: IncomingMessage, response: ServerResponse): void {
    const path = (request.url ?? "/").split("?")[0];

    if (path !== "/health" && path !== "/ready") {
      response.writeHead(404).end();

      return;
    }

    if (request.method !== "GET") {
      response.writeHead(405, { Allow: "GET" }).end();

      return;
    }

    const passed = path === "/health" ? this.passes(this.isAlive) : this.passes(this.isReady);

    response.writeHead(passed ? 200 : 503, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ status: passed ? "ok" : "unavailable" }));
  }

  private readonly isReady = (): boolean => this.readiness.evaluate().ready;

  // An exception in a request handler would crash the process, so a throwing check counts as a fail.
  private passes(check: () => boolean): boolean {
    try {
      return check();
    } catch {
      return false;
    }
  }
}

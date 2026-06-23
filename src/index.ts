import { DurableObject } from "cloudflare:workers";
import { Hono } from "hono";

export class App extends DurableObject {
  private app = new Hono()
    .get("/api/hello", (c) => c.json({ message: "Minesweeper API ready" }));

  async fetch(request: Request) {
    return this.app.fetch(request);
  }
}
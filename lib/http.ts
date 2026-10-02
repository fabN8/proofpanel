/** Shared wrapper for API routes: turns errors into clear JSON answers. */
import { UserError } from "@/lib/types";

export async function handle(fn: () => Promise<Response | object>): Promise<Response> {
  try {
    const out = await fn();
    return out instanceof Response ? out : Response.json(out);
  } catch (err) {
    if (err instanceof UserError) {
      return Response.json({ error: err.message, code: err.code, ...err.details }, { status: err.status });
    }
    console.error(err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return Response.json({ error: message, code: "server_error" }, { status: 500 });
  }
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

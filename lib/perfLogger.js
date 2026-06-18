/**
 * Lightweight API performance logger for Next.js App Router.
 * Usage:
 *   import { withPerf } from "@/lib/perfLogger";
 *   export const GET = withPerf("dashboard/director", async (req) => { ... });
 *
 * Logs: method, path, duration, response size, slow-query flag (>500ms).
 */

const SLOW_THRESHOLD_MS = 500;

export function withPerf(label, handler) {
  return async function (...args) {
    const t0 = Date.now();
    let response;

    try {
      response = await handler(...args);
    } catch (err) {
      const ms = Date.now() - t0;
      console.error(`[PERF] ${label} THREW in ${ms}ms:`, err.message);
      throw err;
    }

    const ms = Date.now() - t0;
    const slow = ms > SLOW_THRESHOLD_MS;

    // Try to read content-length from response headers (works when body is JSON)
    let size = "-";
    try {
      const clone = response.clone();
      const text  = await clone.text();
      size = `${(text.length / 1024).toFixed(1)}KB`;
    } catch {
      // ignore — body may already be consumed
    }

    const tag = slow ? "[SLOW]" : "[PERF]";
    console.log(`${tag} ${label} → ${ms}ms | size=${size}${slow ? " ⚠️" : ""}`);

    return response;
  };
}

/**
 * Simple timer for inside a route handler (manual usage).
 *   const timer = startTimer();
 *   // ... do work ...
 *   timer.lap("phase-1");
 *   timer.end("total");
 */
export function startTimer() {
  const t0 = Date.now();
  const marks = [];

  return {
    lap(label) {
      marks.push({ label, ms: Date.now() - t0 });
    },
    end(label) {
      const ms = Date.now() - t0;
      marks.push({ label, ms });
      console.log(`[PERF] ${marks.map(m => `${m.label}=${m.ms}ms`).join(" | ")}`);
      return ms;
    },
  };
}

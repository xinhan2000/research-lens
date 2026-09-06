/**
 * GET /api/health — liveness probe for the Fly health check.
 *
 * Deliberately trivial. It imports nothing, reads no file, touches no
 * environment variable, and cannot reach Anthropic: a health check that does
 * real work eventually becomes a health check that costs money or fails for the
 * wrong reason.
 */

export const runtime = "nodejs";

export function GET() {
  return Response.json({ status: "ok" }, { status: 200 });
}

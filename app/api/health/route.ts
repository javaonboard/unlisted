// Also reports which commit is running, to check deploys.
export function GET() {
  return Response.json({ ok: true, commit: process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? "local" });
}

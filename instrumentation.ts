// Runs once when the server starts. The work lives in instrumentation-node.ts,
// which only loads on the Node.js server (not the edge runtime).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./instrumentation-node");
}

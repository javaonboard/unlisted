import { Suspense } from "react";
import { headers } from "next/headers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { currentUserId } from "@/lib/session";
import { getUser } from "@/lib/users/queries";

async function ConnectorLink() {
  const [user, h] = await Promise.all([currentUserId().then(getUser), headers()]);
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const link = `${proto}://${host}/mcp/${user?.connectorKey}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your connector link</CardTitle>
        <CardDescription>Keep it private. Anyone with this link can act as your Unlisted agent.</CardDescription>
      </CardHeader>
      <CardContent>
        <code className="block break-all rounded-lg bg-muted p-3 text-sm select-all">{link}</code>
      </CardContent>
    </Card>
  );
}

export default function ConnectPage() {
  return (
    <main className="mx-auto w-full max-w-2xl p-8">
      <h1 className="text-2xl font-semibold">Connect your AI</h1>
      <p className="mt-1 mb-6 text-muted-foreground">
        Use Unlisted from the AI app you already use. Add this link as a connector (MCP) and just ask:
        “Sell my old bike on Unlisted” or “Find me a mover for Saturday”.
      </p>

      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <ConnectorLink />
      </Suspense>

      <div className="mt-6 grid gap-3 text-sm">
        <Card>
          <CardHeader>
            <CardTitle>Claude</CardTitle>
            <CardDescription>Settings → Connectors → Add custom connector → paste the link.</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>ChatGPT</CardTitle>
            <CardDescription>Settings → Apps &amp; Connectors → turn on developer mode → create a connector → paste the link.</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Other apps</CardTitle>
            <CardDescription>Any app that supports remote MCP servers over HTTP works the same way.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </main>
  );
}

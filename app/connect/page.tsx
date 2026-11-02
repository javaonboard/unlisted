import { Suspense } from "react";
import { headers } from "next/headers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { currentUserId } from "@/lib/session";
import { getUser } from "@/lib/users/queries";
import { CopyButton } from "@/components/shared/CopyButton";
import { ConfirmAction } from "@/components/ConfirmAction";
import { newConnectorKeyAction } from "@/app/actions/profile";

const ago = (d: Date) => {
  const min = Math.round((Date.now() - d.getTime()) / 60_000);
  return min < 1 ? "just now" : min < 60 ? `${min} min ago` : min < 1440 ? `${Math.round(min / 60)} h ago` : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

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
      <CardContent className="flex flex-col gap-3">
        <code className="block break-all rounded-lg bg-muted p-3 text-sm select-all">{link}</code>
        <div className="flex flex-wrap items-center gap-2">
          <CopyButton text={link} />
          <ConfirmAction
            variant="outline"
            label="Make a new link"
            title="Make a new connector link?"
            points={["The old link stops working right away.", "Paste the new one into your AI app again."]}
            confirm="Make a new link"
            action={newConnectorKeyAction}
          />
          <span className="text-sm text-muted-foreground">{user?.connectorUsedAt ? `Last used by your AI ${ago(user.connectorUsedAt)}` : "Not used yet"}</span>
        </div>
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
        “Sell my old bike on Unlisted”, “Find me a mover for Saturday”, “Anything I should do?” or “Did my payment to Sam go through?”
        Approving deals and paying with PayPal stay in this app.
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

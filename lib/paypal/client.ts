import {
  Client,
  Environment,
  OAuthAuthorizationController,
} from "@paypal/paypal-server-sdk";

let client: Client | undefined;

// One shared sandbox client, created on first use.
export function paypalClient(): Client {
  if (client) return client;

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET");
  }

  client = new Client({
    clientCredentialsAuthCredentials: {
      oAuthClientId: clientId,
      oAuthClientSecret: clientSecret,
    },
    environment: Environment.Sandbox,
  });
  return client;
}

// Access token for REST calls the SDK doesn't cover (payouts, webhooks).
export async function paypalAccessToken(): Promise<string> {
  const basic = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`,
  ).toString("base64");
  const { result } = await new OAuthAuthorizationController(
    paypalClient(),
  ).requestToken({ authorization: `Basic ${basic}` });
  return result.accessToken;
}

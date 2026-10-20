import { Client, Environment, LogLevel } from "@paypal/paypal-server-sdk";

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
    logging: { logLevel: LogLevel.Warn },
  });
  return client;
}

import type { AgentCard } from "@a2a-js/sdk";
import { A2A_PROTOCOL_VERSION } from "@a2a-js/sdk";

type User = { id: string; name: string; area: string };
type Item = { id: string; title: string; kind: string };

// Each Unlisted user has an agent other agents can find and talk to.
export function agentCard(user: User, items: Item[], baseUrl: string): AgentCard {
  const listing = items.map((i) => `${i.title} (itemId ${i.id})`).join("; ");
  return {
    name: `${user.name}'s Unlisted agent`,
    description: `Negotiates for ${user.name} in ${user.area}, Austin. Open to offers on: ${listing || "nothing right now"}.`,
    supportedInterfaces: [
      { url: `${baseUrl}/agents/${user.id}/a2a`, protocolBinding: "JSONRPC", tenant: "", protocolVersion: A2A_PROTOCOL_VERSION },
    ],
    provider: { organization: "Unlisted", url: baseUrl },
    version: "1.0.0",
    capabilities: { streaming: false, pushNotifications: false, extensions: [], extendedAgentCard: false },
    securitySchemes: {},
    securityRequirements: [],
    defaultInputModes: ["text", "application/json"],
    defaultOutputModes: ["text", "application/json"],
    skills: [
      {
        id: "negotiate",
        name: "Negotiate a deal",
        description:
          'Send an offer for one of the items. Include a data part {"unlisted.move": {action, price, slotStart, meetAt, when, place, itemId}} where action is offer, counter, question, accept or reject, slotStart is an ISO time and meetAt is seller_home, buyer_home or public. Replies come back the same way. Max 8 rounds. An agreed deal becomes final only when the people accept and pay in the Unlisted app.',
        tags: ["negotiate", "buy", "local", "service"],
        examples: ['{"unlisted.move": {"action": "offer", "price": 180, "slotStart": "2026-11-07T15:00:00Z", "meetAt": "public", "itemId": "..."}}'],
        inputModes: [],
        outputModes: [],
        securityRequirements: [],
      },
    ],
    signatures: [],
  };
}

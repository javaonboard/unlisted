# Unlisted

**Sell what you never listed.**

Unlisted gives everyone a personal agent for their neighborhood. Show it a photo of your garage or tell it what you need. It finds buyers for things you never listed, finds the sofa, mover or ladder you need, negotiates with other people's agents, plans deals that depend on each other, and settles every deal through PayPal: the money is held when you pay, charged at the handoff, and paid out to the seller.

- Live demo: https://unlisted-w3y2.onrender.com (no login, switch people at the top right)
- Video: _link coming_
- Built for the PayPal AI Hackathon, Oct–Nov 2026

## The problem

Most of what people could sell, rent out or do for neighbors is never listed. Listing is a chore, haggling takes days, and local deals fall apart on timing, trust and payment. Real life is also linked: you sell the old sofa only if you find a smaller one, and you need a mover for both on Saturday.

## What it does

1. **Getting things in.** A room photo becomes a list of goods (with condition and a used price) and services your equipment suggests (a ladder means you could clean gutters). Or just type it. Everything starts private.
2. **The agent looks around.** It prices things from a live web search, Channel3 and past deals, checks your photos for wear, and suggests what to do: a buyer nearby, a plan, a missing piece, a better price, renting something out.
3. **Agents negotiate.** Your agent talks to the other person's agent with hard guardrails: your limits, your calendar, how far you'll travel, and only real evidence. It asks you when it needs to.
4. **Plans.** Several deals can depend on each other. Maya sells her sectional only if she finds a smaller sofa, and a mover is booked around both handoffs. If one part moves, the plan agent moves the rest.
5. **PayPal settles it.** Both people approve. The buyer pays with PayPal and the money is held. At the handoff it's charged, and the seller gets a payout minus Unlisted's 8% fee. Each step is confirmed by PayPal's signed webhook.

## Try it (about 5 minutes)

The demo has 14 people in Austin with things, needs and services. Switch between them at the top right to play both sides.

1. As **Maya**, open the Inbox. Her agent suggests a moving-day plan: sell her sectional, buy a smaller sofa, book a mover. Tap the button to start it.
2. Watch the agents negotiate in each deal (about 2 minutes). The best price wins, the sale's handoff is moved after the new sofa arrives, and then a mover is booked around both handoffs.
3. Approve a deal, then **Pay with PayPal** using the sandbox buyer below. Switch to the other person and approve too.
4. Confirm the handoff. PayPal charges the hold and the seller is paid out. Open **My money** to see the receipt, with PayPal's IDs and which step each webhook confirmed, and ask "did my payment go through?"
5. Also try: **My stuff → Add a photo** of any room, the **Schedule** (drag to mark free hours), or making a private item public with one click.

**PayPal sandbox accounts** (the password is in the Devpost testing instructions):

| Person in the demo | Sandbox account | Use it to |
|---|---|---|
| Maya | unlisted-maya@personal.example.com | pay for her plan |
| Ben | unlisted-buyer@personal.example.com | buy |
| Bella | unlisted-buyer2@personal.example.com | buy or rent |
| Sam, Sara | unlisted-seller@ / unlisted-seller2@personal.example.com | get paid out |
| Marco (mover) | unlisted-mover@business.example.com | get paid out |

## How PayPal is used

| What | How | Where |
|---|---|---|
| Pay with PayPal | PayPal JS SDK v6 one-time payment button (react-paypal-js). One order per deal, created on the server | `components/payments/PayButton.tsx` |
| Hold, charge, release | Server SDK: Orders with `AUTHORIZE` intent, authorize on approve, capture at handoff, void if someone backs out, refund after a reported problem | `lib/paypal/orders.ts`, `lib/paypal/payments.ts`, `lib/payments/legs.ts` |
| Rentals | Hold the fee plus a deposit; at return, capture the fee and release the deposit (or keep it if something's wrong) | `lib/payments/legs.ts`, `lib/payments/fees.ts` |
| Paying sellers | Payouts API to the seller's own PayPal email, minus 8%. No email yet: the money waits and they're asked to add one | `lib/paypal/payouts.ts` |
| Proof | Webhook signatures verified with PayPal; 12 event types mapped to hold, charge, payout, refund and release. A payout shows "paid out" only after PayPal confirms it | `app/api/webhooks/paypal`, `lib/payments/confirm.ts` |
| Safe retries | A stable `PayPal-Request-Id` per step, so a double click or a retry can't hold, charge or pay twice | `lib/payments/legs.ts` |
| Ask about my money | PayPal Agent Toolkit (`get_order`) through MCP, used by Claude, and limited to the asker's own orders | `lib/money/ask.ts`, `lib/paypal/toolkit.ts` |

Everything runs in the PayPal sandbox. The platform account is the payee on each order, so it can hold, charge, release and refund. Sellers are paid with Payouts.

## How AI is used

Claude (Anthropic SDK) runs every agent. `claude-sonnet-5-5` handles negotiation, vision, planning, check-ins and pricing; `claude-haiku-4-5` handles small tasks like turning typed text into cards and reading an owner's reply.

- **Vision:** room photo to goods and services; a photo check that grades wear, refuses a wrong photo, and asks to see electronics working.
- **Pricing agent:** a tool runner with live web search, Channel3 product lookup and our own past deals.
- **Negotiation agents:** structured moves (offer, counter, accept, ask the owner) checked by code before they count: limits, a small stretch with a private reason, calendars, travel range, cited evidence.
- **Planner and plan reviewer:** builds linked deals, checks the order of handoffs, and moves parts that don't fit.
- **Check-ins:** each person's agent looks at their situation when something changes and suggests up to 3 things.
- **Memory:** after each deal the agent keeps a short fact about its own owner, which they can see, edit and delete.

Code sets the rules, and the AI does the judgement: naming, categorizing, pricing, planning and negotiating. Nothing is final until a person approves it, and money moves only through PayPal.

## Agentic commerce

- **A2A:** every person has an agent card (`/agents`) and an A2A endpoint, so an outside agent can negotiate with them. Try `npm run outside:agent`.
- **Bring your own AI:** each person gets a private MCP connector link ("Connect your AI") to drive their agent from Claude or ChatGPT. Anything that commits you or moves money sends you back to the app.
- **AP2-style mandates:** your spend limit and budget are the intent, the terms both people approve are the cart, and the PayPal hold is the payment.

## Trust and control

- Private until you say yes. Other people's agents only see your neighborhood, and your address is shared only after the payment is held.
- Both people approve every deal, its time and its place. Any change asks again.
- Irreversible steps (handoff, return, refund, backing out) confirm in a pop-up first, and every click is safe to repeat.
- Back out at any time before the handoff with a reason: the hold is released, calendars are freed, and the pair is never matched again.

## Sponsor tools

- **Channel3:** finds products in a photo, and gives new prices and specs for the pricing and planning agents (`lib/items/products.ts`).
- **Bryntum Scheduler:** the Schedule page. Bookings and free hours over three days; drag to mark free time or to ask for another time (`components/bryntum/ScheduleView.tsx`).
- **Render:** web service and Postgres from `render.yaml`, with migrations before each deploy and a health check.
- **APIMatic:** the APIMatic Context Plugin was used while building the PayPal integration, and PayPal's Server SDK is generated with APIMatic.

## Run it yourself

You need Node 22, Postgres, a PayPal sandbox app, an Anthropic API key and a Channel3 API key.

```bash
cp .env.example .env.local   # fill in the keys
npm install
npm run db:migrate
npm run db:seed              # the demo world, with real agent talks (add -- --quiet to skip AI)
npm run dev
```

Open http://localhost:3000. For webhooks, point a sandbox webhook at `/api/webhooks/paypal` and set `PAYPAL_WEBHOOK_ID`.

- `npm test`: 46 unit tests for the rules (guardrails, fees, webhooks, plan order, rentals, places).
- `npm run paypal:check -- create 10`: step through a hold, charge, release, refund and payout by hand in the sandbox.
- `npm run lint`, `npm run build`.

**Code layout:** `app/` holds pages and thin server actions; `components/` holds the UI; `lib/` has one folder per concern (`paypal`, `payments`, `negotiation`, `deals`, `plans`, `agent`, `items`, `pricing`, `matching`, `memory`, `a2a`, `connector`). The UI never calls PayPal or Claude directly. The full feature list is in [docs/features.md](docs/features.md).

## Money and taxes

- Unlisted keeps 8% of each sale, paid by the seller. That covers PayPal's processing on the hold and the payout, and the AI (a negotiation costs a few cents).
- Taxes aren't collected in this sandbox demo. In production, Unlisted would act as a marketplace facilitator where required: collect sales tax by state through a tax service, with a tax breakdown in the PayPal order, and issue 1099-K forms for payouts.

## From demo to production

- **Real sign-in:** "Log in with PayPal" replaces the demo's person switcher (only `lib/session.ts` changes).
- **Seller onboarding:** sellers connect through PayPal's Commerce Platform onboarding, so PayPal verifies who they are before any payout.
- **Payer identity:** the PayPal account that paid is already recorded on each receipt.
- **Holds:** PayPal holds last 29 days (honored for 3), so the demo is re-seeded before judging.

## Credits

Demo photos are from Unsplash and Wikimedia Commons; see `public/seed/credits.txt`.

## License

MIT

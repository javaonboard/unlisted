# Unlisted: what the app does today

Inventory as of Nov 2, 2026 (88 commits). Written from the code, for planning the demo video and the README.

## Summary

Unlisted gives each person a personal agent for a local marketplace in Austin. You show it a room photo or tell it in plain words what you own, what you can do and what you need. Things start private. The agent prices them from live web search, Channel3 and past Unlisted sales, checks photos for wear, and suggests what to do next: go public, talk to a buyer, rent something out, or run a plan. Agents negotiate with each other in rooms with hard guardrails (limits, calendars, travel range, evidence). A plan links several deals (sell a sofa, buy a smaller one, book a mover) so the sale waits for the purchase and the helper is booked around the handoffs. Each agreed deal is approved by both people and paid through PayPal sandbox: a hold when paid, capture at handoff, payout to the seller minus 8%, every step confirmed by a verified PayPal webhook. Outside agents can join over A2A, and people can drive their agent from their own AI app over MCP.

Tags: [PayPal sandbox verified] run end to end against sandbox · [Live-tested with agents] run with real Claude calls (seed or check scripts) · [Unit tested] with the test file · [Seeded for demo] set up by `npm run db:seed` · [Partial] works with clear limits. No tag: built, no sign it was run end to end.

## Features

### Getting things in
- **Room photo to goods and services**: Channel3 finds products in the photo (new price as a ceiling); Claude lists goods with visible condition, used value, specs and sell/rent, plus services the equipment suggests (ladder: gutter cleaning) with local demand per job. Owner edits before saving; new things are private. `lib/vault/photo.ts`, `components/vault/PhotoToVault.tsx` [Live-tested with agents] (`scripts/photo-check.ts`)
- **Tell your agent in plain words**: typed text becomes up to 3 cards (goods, service, need). One short question asks for every missing must-have: need = budget and when (and days, for a rental); sale = condition and lowest price; rent = price per day; service = price per job and free hours; plus travel range and job size. Save is blocked until complete and safe to double-click. `lib/vault/understand.ts`, `lib/vault/card.ts` [Unit tested: tests/card.test.ts]
- **Photo check**: up to 4 photos, or 3 frames from a short video (the video is never uploaded). The agent checks it's the right item, grades it, lists visible wear, and flags things that should be shown working. Wrong photos are refused. Findings become verified evidence agents can cite. Runs automatically on room-photo items. `lib/vault/inspect.ts` [Unit tested: tests/photo-check.test.ts] [Seeded for demo] (seed photos in `public/seed`)
- **Price check**: Claude tool runner with live web search (prefers pages that show prices), Channel3 for the new price, and agreed Unlisted deals in the same category. Returns a used range, a fair price, a note and sources. Runs on every new item and after new photos; replaces a photo guess (and tells the owner if it moved over 15%); "Use it" applies it. Needs get a budget check too. `lib/pricing/` [Live-tested with agents] [Seeded for demo] (sectional, RTX 2080)
- **Edit anything**: title, condition, price, lowest price, public or private, sell / rent / both (defaults: 4% of value per day, 50% deposit), travel range per item and per need, need text, budget, deadline. `app/actions/edit.ts`, `app/actions/range.ts`
- **What my agent knows**: after each deal the agent saves up to 2 short facts about its own owner (never the other side). Owner can add, edit, confirm, delete and export them as JSON. The private street address is set here. `lib/memory/`, `app/memory/` [Seeded for demo]

### Agents and suggestions
- **Agent check-in**: one look per person (at most every 2 minutes) when they add something, post a need, the market around them changes, a deal falls through, at seed time, and daily (5 people per 10-minute tick). It picks up to 3 of: go public, talk to a buyer, plan, add a need, set a price, rent it out. Code checks every id, skips repeats (14 days), one per kind, max 10 suggestions a day. Other people's private things only show as counts. `lib/agent/checkin.ts` [Live-tested with agents] [Seeded for demo]
- **Go public in one click**: the Scout ranks buyers by distance, urgency and track record; the agent opens talks with the best 3 at once and both sides are told. Going private stops new talks; running ones carry on. `lib/vault/visibility.ts`, `lib/scout/rank.ts`
- **Plan suggestion**: the agent proposes a plan in its own words ("Here's what I'll do"). The owner can tick parts on or off, choose whether the sale waits for the purchase, or type what to change; the planning agent then re-plans, looks products up on Channel3 when specs matter, and points out up to 2 missing pieces. `lib/suggestions/plan.ts`, `lib/plans/compose.ts`, `components/inbox/PlanChoices.tsx`
- **Add a need / set price / rent it out**: one-tap suggestions. Rent it out sets a day price and a half-value deposit and makes the item public. Bought goods join the buyer's things, so their agent can suggest renting them out. `lib/suggestions/accept.ts`
- **Waves for needs**: a need goes out to the nearest 3, then the next 7, then people whose goods could do the job ("Your ladder could earn money"), then suggests a 15% higher budget. Open listings start talking right away; private owners are asked first. 2 hours between waves; skips ahead if nobody is left or everyone said "not now". `lib/suggestions/engine.ts`
- **Matching rules**: same category, prices within 10%, number requirements against specs (minSeats, maxWidthIn, minWatts...), both people within travel range, sold items out, pairs that backed out never matched again. `lib/matching/` [Unit tested: tests/places.test.ts]

### Negotiation
- **Agent rooms (A2A-style)**: buyer opens, sides alternate, 8 rounds by default. Every move is structured (offer, counter, question, accept, reject, walk away, ask owner) with price, exact time, meeting place, costs, extras, cited evidence and a short message, and is also stored as an A2A v1.0 message (text part plus data part). Owners see their agent's private "why". `lib/negotiation/room.ts`, `moves.ts` [Live-tested with agents] [Seeded for demo] (4 real talks)
- **Guardrails**: code rejects a move past the stretch (buyer +10%, seller -10%), past the limit without a stated reason, without an exact time, clashing with a booking, outside marked free hours, at a place out of someone's range, or citing unknown evidence. One retry with the reason, then the agent walks away. `lib/negotiation/guardrails.ts` [Unit tested: tests/guardrails.test.ts]
- **Limits and stretch with private reasons**: the agent may go a little past the owner's limit on its own with a one-line reason; only the owner sees it, and still approves the deal.
- **What the agent knows**: market price and rounds left, behavior signals from this room only (how much they moved, their deadline, a verified count of other buyers), the owner's facts (personal ones shared only when needed, never the address), other parts of the plan, rental terms and rented-out dates, a helper's stop list. `lib/negotiation/context.ts`, `signals.ts`
- **Ask the owner**: the room pauses; the owner answers in their own words; a small model pulls out a new limit; the agent gets 3 more rounds. Only the newest question can be answered, and only by its owner. `lib/negotiation/owner.ts` [Unit tested: tests/next-step.test.ts]
- **Best price wins**: when an agent says yes, it waits up to 45 s for parallel talks on the same item or need, then settles in one locked transaction: the seller gets the highest yes, the buyer the cheapest. Losers close with a plain reason. A service can take many jobs. `lib/negotiation/claim.ts`
- **Schedule, busy and free hours**: an agreed deal goes on both calendars as tentative (goods 30 min, services 2 h, rentals whole days) and is final once both approve. Agents only see free/busy, never what the booking is. Either side can ask for another time in words or by dragging the bar; the price stays fixed. `lib/bookings.ts`, `lib/availability.ts`
- **Places in reach and distance**: seller's place, buyer's place, or the easiest public spot for both, limited by each person's range (defaults 5 mi offering, 10 mi needing). Distance is rough, neighborhood to neighborhood. Either person can change the place; the other approves again. `lib/places.ts`, `lib/deals/meet.ts` [Unit tested: tests/places.test.ts]
- **Learn from each deal**: memory facts are saved after agreement (see Memory).

### Plans
- **Planner agent**: starts a plan from the chosen parts: any mix of sales, purchases and helpers. Talks to the best 3 buyers per sale and 2 sellers per purchase at once, with a short Scout note on why them. `lib/deals/planner.ts`, `lib/scout/note.ts` [Live-tested with agents] (seed check-ins)
- **Sale waits for purchase**: if chosen, the owner's sale can't be approved until the purchase is agreed. `lib/deals/dependency.ts` [Unit tested: tests/dependency.test.ts]
- **Helpers booked around handoffs**: once every sale and purchase is agreed, the top 2 helpers (mover, installer) are asked with a stop list built from the handoffs ("Pick up the loveseat at Sam's and bring it to Maya's"). `lib/deals/coordinator.ts`, `stops.ts`
- **Plan review**: before booking help, the plan agent checks the handoff order (the new sofa should arrive before the old one leaves) and reopens parts that don't fit. `lib/plans/cascade.ts`
- **Cascade on changes**: when one part's time or place changes, the plan agent adjusts the others. Paid parts keep their price; unpaid parts may renegotiate. The other side gets a plain message. Each part is moved by the plan agent at most once.
- **Hop and stuck parts**: when all talks for a part die, the Scout tries the next candidate (up to 5). With nobody left, the owner hears once; for a purchase they get "Raise to $X" (+10%) which retries the top 2 sellers.
- **Go ahead without a stuck part**: the owner drops a part that isn't agreed; the rest carries on and the dropped need keeps looking on its own. `lib/deals/drop.ts`
- **Order and overview**: parts show as "step 2 of 3" (buy, then sell, then helpers) and stay together in the inbox; the plan page groups selling, buying and helpers with progress. `lib/deals/order.ts`, `app/deals/[id]` [Unit tested: tests/plan-order.test.ts]

### Rent and sell
- **Rentals block only their days**: two rentals of one item can both happen on different days; a rental is priced as day price times days. `lib/deals/clash.ts`, `usage.ts` [Unit tested: tests/rent-and-sell.test.ts] [Live-tested with agents]
- **Sale after rentals are back**: a sale can be agreed while the item is out, but hands off only after every rental returns. [Unit tested: tests/rent-and-sell.test.ts]
- **Deposit held and released**: PayPal holds fee plus deposit; pickup starts the rental; on return the owner confirms "good shape" (capture the fee only, deposit released) or "something's wrong" (deposit kept). `lib/payments/legs.ts` [PayPal sandbox verified] [Unit tested: tests/fees.test.ts] [Seeded for demo] (Kai's ladder, Bella's talk)

### Money with PayPal
- **Pay with PayPal (hold)**: PayPal's v6 one-time button; the server creates an AUTHORIZE order and places the hold on approve. One order per deal; paying counts as the buyer's approval; the paying account is recorded for the receipt. `components/payments/PayButton.tsx`, `lib/paypal/orders.ts` [PayPal sandbox verified]
- **Capture at handoff**: the buyer confirms in a short pop-up; the claim is atomic, a failed capture lets them retry. Goods move to the buyer's things and to the seller's "Things I had". [PayPal sandbox verified]
- **Payout minus 8%**: Payouts API to the payee's own PayPal email after capture; "paid out" only once PayPal confirms. No email yet: the money waits, they're asked to add one ("Get paid to" on What my agent knows), and saving it sends what was waiting. The payee's receipt shows which PayPal account was paid. Fee defined in one place. `lib/paypal/payouts.ts`, `lib/payments/fees.ts` [PayPal sandbox verified] [Unit tested: tests/fees.test.ts]
- **Void / release**: cancel before handoff or back out releases the hold, nothing charged. `lib/paypal/payments.ts` [PayPal sandbox verified]
- **Safe retries**: stable PayPal-Request-Id per step (authorize-, capture-<leg>, void-, refund-, payout-<leg>), so a retry can't hold, charge or pay twice. Errors are logged without credentials.
- **Webhooks**: signature verified with PayPal on the raw body; 12 event types mapped to hold, capture, refund, payout and release (failures flagged and both people told); each event stored once. A 30-minute fallback asks PayPal about payouts whose webhook never came. `app/api/webhooks/paypal`, `lib/payments/confirm.ts`, `webhook.ts` [PayPal sandbox verified] [Unit tested: tests/webhook.test.ts]
- **Receipts**: price, deposit, fee, what the seller receives, a timeline with which step PayPal's webhook confirmed, PayPal ids (order, authorization, capture, payout batch) and live order status. Only the two people in the deal can open it. `lib/money/receipt.ts`, `app/money/[id]`
- **Ask about my money**: Claude with the PayPal Agent Toolkit over in-process MCP, read-only (`get_order`), wrapped so it can only open the asker's own order ids. `lib/money/ask.ts`, `lib/paypal/toolkit.ts` [Live-tested with agents] (`scripts/agent-check.ts`)
- **Report a problem, then refund**: after handoff the buyer reports what's wrong and asks for part or all back; the seller agrees (PayPal refund, once) or declines (buyer is told they can open a PayPal case). `lib/payments/problems.ts`

### Trust and control
- **Approvals by both sides**: nothing is final until both people approve the deal with its time and place; a change resets the other side's approval. Nudge reminds the other side (once per 30 min). `lib/deals/approval.ts`, `nudge.ts` [Unit tested: tests/next-step.test.ts]
- **Confirm pop-ups**: handoff, return, refund and back-out confirm in a short dialog that says what happens. `components/ConfirmAction.tsx`
- **Idempotent clicks**: every state change claims its row in one update (accept, pay, handoff, return, back out, suggestion yes, save, nudge); buttons show a spinner until done.
- **Back out with a reason**: any time before handoff, 7 reasons plus a note. Hold released, calendars freed, other side told why, their agent remembers it, the pair is never rematched, and the item or need goes back on the market. After handoff it's "Report a problem" instead. `lib/deals/backout.ts` [PayPal sandbox verified]
- **Privacy rules**: agents see neighborhoods only; the street address shows to both only after the hold; room queries return public user fields only; owner notes and agent reasoning stay with their side; the market check-in counts other people's private items instead of showing them.
- **Spend limit**: each person has a max spend (Maya $350, others $500); the buyer's limit is the lower of that and the need's budget.

### Outside agents
- **A2A agent per user**: public directory at `/agents`, an agent card per user listing their public items, JSON-RPC endpoint at `/agents/<user>/a2a` (A2A JS SDK). An outside agent becomes a guest buyer, sends moves as a data part, and our agent answers turn by turn. Accepting, paying and handoff stay in the app. `lib/a2a/` [Live-tested with agents] (`scripts/outside-agent.ts`: a rule-based bot haggles for Sam's loveseat) [Partial]
- **Connect your AI (MCP)**: a private connector link per user (`/mcp/<key>`) with 14 tools: my stuff, add, post need, matches, start negotiation, room status, inbox, what needs me, schedule, mark free hours, change time, change place, tell agent, finish in app. Anything that commits the user or moves money returns an app link instead. `lib/connector/server.ts`, `app/connect` (`scripts/connector-check.ts`)

### UI
- **Inbox**: "Hi Maya", tell-your-agent box, Needs you (suggestions plus deals waiting on you), In progress, Updates, and Done (ended talks with last prices, kept chats). One thread per deal with role badge, status pill, distance and folded history; plan parts shown together in step order. Live refresh every 5 s. Header shows a needs-you count. `app/page.tsx`
- **Deal room**: the agents' chat with the raw A2A JSON per move (cited evidence ids are stored but not shown), the owner's private notes and "why", and a 5-step tracker: approve, pay, handoff or pickup (address and Maps link once paid), return, paid out, each with "confirmed by PayPal" marks. `app/rooms/[id]`, `components/rooms/NextSteps.tsx`
- **My stuff**: goods, services and needs apart, one-click Private/Public switch, sell/rent switch, only running plans with progress; item page with photos, photo check, price advice with sources, range and edit form. "Things I had" lists what was sold, bought, hired or rented. `app/my-stuff/`
- **Schedule (Bryntum Scheduler)**: next three days hour by hour; green = final, orange = waiting for someone; drag across empty time to mark free hours, drag a bar to ask for another time. `app/schedule`, `components/bryntum/ScheduleView.tsx`
- **Money**: every payment with what you pay or receive after fees and its status, the ask-about-my-money box, and receipts. `app/money/`
- **Persona switcher**: no login; switch people to play both sides. Look: one-color lucide line icons, pill buttons, plain text formatting. [Unit tested: tests/text.test.ts]

### Ops
- **Timer jobs** (every 10 min, in the server process): next need waves, resume quiet rooms, day-of handoff reminders, payout status check, daily agent check-ins. `instrumentation-node.ts`
- **Timeouts** (off unless `TIMEOUTS_ENABLED=true`): owner question reminder at 1 h and default to the original limit at 3 h, payment reminder at 2 h and cancel at 12 h, unapproved plans cancelled after 24 h, holds released before PayPal's 3-day honor period. `lib/jobs/timeouts.ts` [Partial]
- **Resume after restart**: open rooms quiet for 5 minutes carry on from the last saved move; a yes that wasn't settled gets settled. `lib/negotiation/resume.ts` [Live-tested with agents]
- **AI limits**: 20 calls per IP per hour and 1000 per day on the public site, none locally; tokens counted per day. Structured calls on the main model fall back to another model if refused. `lib/ai/` 
- **Deploy**: Render web service plus Postgres (`render.yaml`), migrations before deploy, health check with the running commit, webpack build to fit 512 MB.
- **Demo reset**: `npm run db:seed` loads 14 people, 14 things, 17 needs, facts, bookings, then runs real photo checks, 4 negotiations, 2 price checks and a first check-in for everyone (`--quiet` skips the AI part).

## Use cases

1. **Maya's moving day (hero).** Maya (East Austin, 2nd floor, no elevator, $350 max spend) wants a smaller sofa under $250 by Saturday, to sell her never-listed sectional only if she finds one, and a Saturday mover. Her agent suggests a "Moving day" plan; agents talk to Sam (loveseat) and Sara (beige sofa) for the purchase and Ben, Bella and Omar for the sectional. The sale waits for the purchase, then Marco or Dev (both busy Saturday morning) are booked around the handoffs with a stop list. Shows plans, dependency, plan review, helpers, best price wins, and one PayPal hold per deal.
2. **PC upgrade.** Priya wants Leo's RTX 4070 (under $450) and to sell her RTX 2080 Super once she has it; Kai wants a used 2080 under $230. Her agent knows her PC has a 550W power supply, looks the card up on Channel3 and suggests adding a 650W+ PSU, which Leo also sells (750W). Ivan offers PC setup. Shows add-a-need, product lookup, a plan with two purchases and a sale. Note: Priya, Leo and Kai have no sandbox email, so their payouts wait until they add one.
3. **Kai's ladder, rented then sold.** Kai rents his 8 ft ladder at $10/day with a $30 deposit; Bella rents it for Saturday (seeded talk). PayPal holds $10 + $30, pickup starts the rental, the return captures $10 and releases the deposit. If Kai switches it to "both", a buyer can agree now but the handoff waits until the rental is back. Shows rentals, deposits, rent-and-sell.
4. **Bella's weekend.** Bella's lawn mowing with Lily and her ladder rental with Kai are already negotiated by the seed; she's also one of three buyers for Maya's sectional. Shows the inbox with several deals in different steps.
5. **Gutter cleaning.** Sara, Ben and Omar all need gutters cleaned; Gus (with a tall ladder) negotiates with Sara and Omar in parallel, since a service can take many jobs. Ben's request is left for the live demo; if nobody answers, wave 3 asks ladder owners like Kai whether they'd offer the service. Shows waves, services, parallel jobs.
6. **Quest 3 for Kai.** Kai wants a Quest 3 under $300; Maya has one, private and never listed. Maya's check-in shows a buyer nearby; one tap makes it public and her agent starts talking. Shows private-until-yes and go public.
7. **Ben and Sam, the sandbox pair.** Ben (sandbox buyer) wants a sectional and gutter help; Sam (sandbox seller) sells a navy loveseat. They hold real sandbox accounts, so they show the full money path: hold, handoff, capture, payout minus 8%, webhook confirmations, receipt, and "Did my payment go through?" via the Agent Toolkit. Back out before handoff releases the hold; report a problem after handoff asks for a refund.
8. **Marco and Dev, movers.** Marco (truck, $70 min, busy 8-10 Sat) and Dev (van, $85 min, busy 8-13 Sat). The Scout prefers whoever is free Saturday morning; both are asked, the first fit wins. Their agents price by stops and only pick free times. Marco has a sandbox business account for the payout.
9. **An outside agent buys Sam's loveseat.** `npm run outside:agent` finds Sam's agent card, haggles over A2A with simple rules, and agrees; Sam then approves and the buyer pays in the app.
10. **Your own AI.** Paste the connector link into Claude or ChatGPT and say "Find me a mover for Saturday"; the tools ask for budget and timing, post the need, and send you to the app to approve and pay.
11. **Oil change with no supply.** Priya and Kai need an oil change but nobody offers one; waves widen and end with a suggestion to raise the budget. Shows what happens when the market is empty.

## Sponsor and PayPal tools used

- **PayPal Server SDK** (`@paypal/paypal-server-sdk` 2.5.0, sandbox only): orders (authorize intent), authorize, capture, void, refund, OAuth token. `lib/paypal/client.ts`, `orders.ts`, `payments.ts`
- **PayPal JS SDK v6 via react-paypal-js** (10.6.1, `/sdk-v6`): `PayPalProvider` and `PayPalOneTimePaymentButton`. `components/payments/PayButton.tsx`
- **PayPal Agent Toolkit** (`@paypal/agent-toolkit` 1.11.0, MCP server in-process, `context.sandbox = true`, read-only actions). `lib/paypal/toolkit.ts`, `lib/money/ask.ts`, `scripts/agent-check.ts`
- **Payouts API** (REST, with PayPal-Request-Id and sender batch id per deal). `lib/paypal/payouts.ts`
- **Webhooks** (verify-webhook-signature REST call, event mapping). `lib/paypal/webhooks.ts`, `app/api/webhooks/paypal/route.ts`, `lib/payments/confirm.ts`
- **Anthropic SDK** (0.135.0): `claude-sonnet-5-5` for negotiation, vision, planning, check-ins, pricing; `claude-haiku-4-5` for text-to-cards, owner replies, memory, tool-owner matching, Scout notes. Structured output with zod, tool runner (`look_up_product`, `submit_plan`, `submit_price`, PayPal MCP tools), server-side web search, server-side model fallback. `lib/ai/`, `lib/pricing/check.ts`, `lib/plans/compose.ts`
- **Channel3 SDK** (4.6.0): find products in a photo, product search for specs and new prices. `lib/vault/products.ts`
- **Bryntum Scheduler** (trial 7.3.8, React wrapper): the Schedule page. `components/bryntum/ScheduleView.tsx`
- **A2A JS SDK** (1.3.0) and **MCP SDK** (1.32.2): outside agents and the "Connect your AI" connector. `lib/a2a/`, `lib/connector/`
- **Render**: web service, Postgres, pre-deploy migrations, health check. `render.yaml`
- **Postgres + Drizzle**: schema and migrations (`lib/db/schema.ts`, `drizzle/`), LISTEN/NOTIFY event bus (`lib/events/bus.ts`), advisory locks for "best price wins".
- **APIMatic**: not used directly. The PayPal Server SDK is APIMatic-generated (its `@apimatic/*` packages appear in `package-lock.json`).

## Known gaps

- No login: anyone can switch persona (by design for the demo). The MCP connector is guarded only by the secret key in its URL; the A2A endpoint has no auth.
- Only Maya, Sam, Sara, Ben, Bella and Marco have sandbox PayPal accounts; others get "add your PayPal email" and their payout waits until they do.
- Refund after "Report a problem" is built but not confirmed against sandbox in the history. No PayPal dispute handling beyond pointing to PayPal.
- Timeouts (owner defaults, payment and approval deadlines, stale holds) are off by default.
- Places are 6 hard-coded Austin neighborhoods and 4 demo public spots; distance is straight-line between neighborhood centers.
- A2A: outside agents can only buy open items (not sell or offer services), no streaming, task store in memory.
- Single server assumed: per-IP AI limits, A2A handlers and plan "busy" flags live in memory.
- Notifications are in-app only (no email or push). The README is still a stub.
- Unit tests cover rules and pure logic (46 tests); there are no automated tests for rooms, plans or payment flows, which were checked by hand and with scripts.

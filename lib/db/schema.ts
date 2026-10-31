import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at").defaultNow().notNull();
const money = (name: string) => numeric(name, { precision: 10, scale: 2 });

// People in the marketplace. In the demo these are personas.
export const users = pgTable("users", {
  id: text("id").primaryKey(), // "maya", "sam", ...
  name: text("name").notNull(),
  area: text("area").notNull(), // neighborhood; this is all other people and agents see
  address: text("address"), // private: shown only to the other side of a paid-into-hold deal
  paypalEmail: text("paypal_email"),
  bio: text("bio"),
  connectorKey: text("connector_key").unique(), // secret part of the user's MCP connector link
  createdAt: createdAt(),
});

// What the agent may do for its owner. Checked in code on every offer.
export const mandates = pgTable("mandates", {
  userId: text("user_id").primaryKey().references(() => users.id),
  maxSpend: money("max_spend").notNull(),
  askBeforePaying: boolean("ask_before_paying").default(true).notNull(),
  canNegotiate: boolean("can_negotiate").default(true).notNull(),
});

// Things a user owns (goods) or can do (skills). Private until they opt in.
export const vaultItems = pgTable("vault_items", {
  id: id(),
  ownerId: text("owner_id").notNull().references(() => users.id),
  kind: text("kind", { enum: ["goods", "skill"] }).notNull(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  details: jsonb("details").$type<Record<string, unknown>>().default({}).notNull(),
  condition: text("condition"),
  photos: jsonb("photos").$type<string[]>().default([]).notNull(),
  estimatedValue: money("estimated_value"),
  minPrice: money("min_price"), // never shown to other users
  openToOffers: boolean("open_to_offers").default(false).notNull(),
  maxMiles: integer("max_miles"), // how far the owner will travel; 0 = pickup only. Empty = the default
  createdAt: createdAt(),
});

// Facts that back up a claim: a photo, a receipt, a price lookup.
export const evidence = pgTable("evidence", {
  id: id(),
  itemId: uuid("item_id").notNull().references(() => vaultItems.id),
  type: text("type", { enum: ["photo", "receipt", "price", "note"] }).notNull(),
  summary: text("summary").notNull(),
  url: text("url"),
  verified: boolean("verified").default(false).notNull(),
  createdAt: createdAt(),
});

// What a user wants right now.
export const intents = pgTable("intents", {
  id: id(),
  ownerId: text("owner_id").notNull().references(() => users.id),
  type: text("type", {
    enum: ["buy", "sell", "request_service", "offer_service"],
  }).notNull(),
  text: text("text").notNull(), // the user's own words
  category: text("category").notNull(),
  maxPrice: money("max_price"),
  maxMiles: integer("max_miles"), // how far away is fine. Empty = the default
  minPrice: money("min_price"),
  constraints: jsonb("constraints").$type<Record<string, unknown>>().default({}).notNull(),
  dependsOn: jsonb("depends_on").$type<string[]>().default([]).notNull(), // other intent ids
  dueAt: timestamp("due_at"),
  status: text("status", { enum: ["open", "matched", "done", "expired"] })
    .default("open")
    .notNull(),
  wave: integer("wave").default(0).notNull(), // how far we've widened the search for this need
  nextWaveAt: timestamp("next_wave_at"),
  createdAt: createdAt(),
});

export const negotiations = pgTable("negotiations", {
  id: id(),
  buyerId: text("buyer_id").notNull().references(() => users.id),
  sellerId: text("seller_id").notNull().references(() => users.id),
  itemId: uuid("item_id").references(() => vaultItems.id),
  intentId: uuid("intent_id").references(() => intents.id),
  dealId: uuid("deal_id").references(() => deals.id), // the plan this is part of, if any
  dependsOn: jsonb("depends_on").$type<string[]>().default([]).notNull(), // negotiations this one serves, e.g. a mover for a sale
  label: text("label"), // thread name in the deal channel, e.g. "Sectional → Ben"
  meetAt: text("meet_at", { enum: ["seller_home", "buyer_home", "public"] }), // set by hand; otherwise what the agents agreed
  status: text("status", { enum: ["open", "waiting_owner", "agreed", "closed"] })
    .default("open")
    .notNull(),
  round: integer("round").default(0).notNull(),
  maxRounds: integer("max_rounds").default(8).notNull(),
  buyerLimit: money("buyer_limit"), // set when the buyer's owner changes the limit mid-room
  sellerLimit: money("seller_limit"),
  agreedPrice: money("agreed_price"),
  closedReason: text("closed_reason"),
  createdAt: createdAt(),
});

export const offers = pgTable("offers", {
  id: id(),
  negotiationId: uuid("negotiation_id").notNull().references(() => negotiations.id),
  fromUserId: text("from_user_id").notNull().references(() => users.id),
  round: integer("round").notNull(),
  kind: text("kind", {
    enum: ["offer", "counter", "question", "accept", "reject", "walk_away", "ask_owner", "owner_note"],
  }).notNull(),
  price: money("price"),
  terms: jsonb("terms").$type<Record<string, unknown>>().default({}).notNull(),
  evidenceIds: jsonb("evidence_ids").$type<string[]>().default([]).notNull(),
  note: text("note"), // what the other side sees
  reasoning: text("reasoning"), // private, only the sender's owner sees it
  signalsUsed: jsonb("signals_used").$type<string[]>().default([]).notNull(),
  a2a: jsonb("a2a").$type<Record<string, unknown>>(), // the A2A message as sent
  createdAt: createdAt(),
});

// A deal can have several legs: sell the couch, buy the sofa, pay the mover.
export const deals = pgTable("deals", {
  id: id(),
  ownerId: text("owner_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  scoutNote: text("scout_note"), // the Scout's short "why I picked these"
  status: text("status", {
    enum: ["proposed", "approved", "held", "settled", "cancelled"],
  })
    .default("proposed")
    .notNull(),
  createdAt: createdAt(),
});

export const dealLegs = pgTable("deal_legs", {
  id: id(),
  dealId: uuid("deal_id").notNull().references(() => deals.id),
  roomId: uuid("room_id").references(() => negotiations.id), // the negotiation this leg pays for
  kind: text("kind", { enum: ["goods", "service"] }).notNull(),
  description: text("description").notNull(),
  payerId: text("payer_id").notNull().references(() => users.id),
  payeeId: text("payee_id").notNull().references(() => users.id),
  amount: money("amount").notNull(),
  feePercent: integer("fee_percent").default(5).notNull(),
  orderId: text("order_id"),
  authorizationId: text("authorization_id"),
  captureId: text("capture_id"),
  payoutBatchId: text("payout_batch_id"),
  status: text("status", {
    enum: ["pending", "held", "captured", "voided", "paid_out", "refunded"],
  })
    .default("pending")
    .notNull(),
  handoffCode: text("handoff_code"), // the payee shows it, the payer enters it to confirm
  heldAt: timestamp("held_at"), // when the PayPal hold was placed
  handoffAt: timestamp("handoff_at"),
  createdAt: createdAt(),
});

// Everything that happens, per user. PayPal events are stored once by event id.
export const activity = pgTable("activity", {
  id: id(),
  userId: text("user_id").references(() => users.id),
  type: text("type").notNull(), // "offer", "paypal", "agent", ...
  message: text("message").notNull(),
  data: jsonb("data").$type<Record<string, unknown>>().default({}).notNull(),
  paypalEventId: text("paypal_event_id").unique(),
  createdAt: createdAt(),
});

export const notifications = pgTable("notifications", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  body: text("body").notNull(),
  link: text("link"),
  roomId: uuid("room_id").references(() => negotiations.id), // the deal this is about; the inbox shows its next step
  fromMe: boolean("from_me").default(false).notNull(), // what the owner told their agent
  read: boolean("read").default(false).notNull(),
  createdAt: createdAt(),
});

// What the agent has learned about its owner, with where it came from.
export const memoryFacts = pgTable("memory_facts", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id),
  fact: text("fact").notNull(),
  source: text("source").notNull(), // "deal:<id>", "chat", "user"
  confidence: real("confidence").default(0.5).notNull(),
  verified: boolean("verified").default(false).notNull(),
  replacedBy: uuid("replaced_by"),
  createdAt: createdAt(),
});

// AI calls and tokens per day, so we can cap spend and see real cost.
export const aiUsage = pgTable("ai_usage", {
  day: text("day").primaryKey(), // "2026-10-29"
  calls: integer("calls").default(0).notNull(),
  inputTokens: integer("input_tokens").default(0).notNull(),
  outputTokens: integer("output_tokens").default(0).notNull(),
});

// What is on someone's calendar: a handoff or a job. Each deal books both people.
export const bookings = pgTable("bookings", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id),
  roomId: uuid("room_id").references(() => negotiations.id),
  title: text("title").notNull(),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at").notNull(),
  dealId: uuid("deal_id").references(() => deals.id),
  confirmedAt: timestamp("confirmed_at"), // this person said yes to the time; final once both have
  createdAt: createdAt(),
});

// Hours someone marked as free. If they marked any, agents only pick times inside them.
export const freeTimes = pgTable("free_times", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at").notNull(),
});

// Things that happened. Saved, then announced with Postgres NOTIFY so listeners react at once.
export const events = pgTable("events", {
  id: id(),
  type: text("type").notNull(), // "need.posted", "vault.added", ...
  payload: jsonb("payload").$type<Record<string, string>>().notNull(),
  processedAt: timestamp("processed_at"),
  createdAt: createdAt(),
});

// What a user's agent suggests to them. One tap to say yes.
export const suggestions = pgTable("suggestions", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id),
  kind: text("kind", {
    enum: ["open_item", "offer_skill", "add_skill", "raise_offer", "post_need", "plan"],
  }).notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  action: jsonb("action").$type<Record<string, string | number>>().notNull(), // what "Yes" does
  needId: uuid("need_id").references(() => intents.id), // the demand this answers, if any
  wave: integer("wave").default(1).notNull(),
  status: text("status", { enum: ["new", "accepted", "dismissed"] }).default("new").notNull(),
  createdAt: createdAt(),
});

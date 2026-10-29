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
  area: text("area").notNull(), // neighborhood, never a street address
  paypalEmail: text("paypal_email"),
  bio: text("bio"),
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
  minPrice: money("min_price"),
  constraints: jsonb("constraints").$type<Record<string, unknown>>().default({}).notNull(),
  dependsOn: jsonb("depends_on").$type<string[]>().default([]).notNull(), // other intent ids
  dueAt: timestamp("due_at"),
  status: text("status", { enum: ["open", "matched", "done", "expired"] })
    .default("open")
    .notNull(),
  createdAt: createdAt(),
});

export const negotiations = pgTable("negotiations", {
  id: id(),
  buyerId: text("buyer_id").notNull().references(() => users.id),
  sellerId: text("seller_id").notNull().references(() => users.id),
  itemId: uuid("item_id").references(() => vaultItems.id),
  intentId: uuid("intent_id").references(() => intents.id),
  status: text("status", { enum: ["open", "agreed", "closed"] })
    .default("open")
    .notNull(),
  round: integer("round").default(0).notNull(),
  maxRounds: integer("max_rounds").default(6).notNull(),
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
    enum: ["offer", "counter", "question", "accept", "reject", "walk_away"],
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

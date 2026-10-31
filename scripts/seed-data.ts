// The demo world. Personas with a PayPal email can pay or get paid in sandbox.
// Everyone else only lives in the database (other bidders, other providers).

export const users = [
  { id: "maya", name: "Maya Lee", area: "East Austin", address: "1418 Larkspur Example Ln, Apt 2B, Austin, TX", paypalEmail: "unlisted-maya@personal.example.com", bio: "Moving across town on Saturday." },
  { id: "sam", name: "Sam Ortiz", area: "Mueller", address: "2207 Bluebonnet Example Ct, Austin, TX", paypalEmail: "unlisted-seller@personal.example.com", bio: "Selling a navy loveseat." },
  { id: "sara", name: "Sara Kim", area: "Hyde Park", address: "4312 Oakmont Example Ave, Austin, TX", paypalEmail: "unlisted-seller2@personal.example.com", bio: "Selling a beige sofa. Needs gutters cleaned." },
  { id: "ben", name: "Ben Carter", area: "Cherrywood", address: "3105 Pecan Example St, Unit 4, Austin, TX", paypalEmail: "unlisted-buyer@personal.example.com", bio: "First apartment: wants a sectional and gutter help." },
  { id: "bella", name: "Bella Diaz", area: "Windsor Park", address: "6021 Cedar Example Dr, Austin, TX", paypalEmail: "unlisted-buyer2@personal.example.com", bio: "Wants a big sofa, lawn mowing, and a ladder for one day." },
  { id: "omar", name: "Omar Haddad", area: "Holly", address: "1904 Riverbend Example Rd, Austin, TX", paypalEmail: null, bio: "Wants a sectional. Gutters overflowing." },
  { id: "marco", name: "Marco Ruiz", area: "East Austin", address: "1120 Mesquite Example St, Austin, TX", paypalEmail: "unlisted-mover@business.example.com", bio: "Mover with a pickup truck. Weekends." },
  { id: "dev", name: "Dev Kapoor", area: "Windsor Park", address: "5815 Juniper Example Way, Austin, TX", paypalEmail: null, bio: "Mover with a cargo van. Afternoons." },
  { id: "gus", name: "Gus Patel", area: "Mueller", address: "2410 Sage Example Ln, Austin, TX", paypalEmail: null, bio: "Cleans gutters. Has a tall ladder." },
  { id: "lily", name: "Lily Nguyen", area: "Cherrywood", address: "3300 Willow Example St, Austin, TX", paypalEmail: null, bio: "Mows lawns around the neighborhood." },
  { id: "ivan", name: "Ivan Petrov", area: "Hyde Park", address: "4708 Elm Example Ave, Austin, TX", paypalEmail: null, bio: "IT help: Wi-Fi, TV mounting, PC builds." },
  { id: "kai", name: "Kai Johnson", area: "Holly", address: "2001 Magnolia Example Ct, Austin, TX", paypalEmail: null, bio: "Wants a Quest 3. Rents out his long ladder." },
  { id: "priya", name: "Priya Shah", area: "Mueller", address: "2650 Aspen Example Dr, Austin, TX", paypalEmail: null, bio: "Upgrading her graphics card. Needs an oil change." },
  { id: "leo", name: "Leo Park", area: "Windsor Park", address: "6110 Birch Example Ln, Austin, TX", paypalEmail: null, bio: "Upgraded his PC. Selling an RTX 4070 and a 750W power supply." },
];

export const mandates = users.map((u) => ({
  userId: u.id,
  maxSpend: u.id === "maya" ? "350.00" : "500.00",
  askBeforePaying: true,
  canNegotiate: true,
}));

type Item = {
  key: string;
  ownerId: string;
  kind: "goods" | "skill";
  title: string;
  category: string;
  condition?: string;
  estimatedValue?: string;
  minPrice?: string;
  openToOffers?: boolean;
  details?: Record<string, unknown>;
  forSale?: boolean;
  rentPerDay?: string;
  deposit?: string;
};

export const vaultItems: Item[] = [
  // Maya: never listed anything.
  { key: "sectional", ownerId: "maya", kind: "goods", title: "Grey 3-seat sectional", category: "sofa", condition: "Good. Small stain on left cushion.", estimatedValue: "240.00", minPrice: "150.00", details: { seats: 3, widthIn: 104, bought: "2022" } },
  { key: "lamp", ownerId: "maya", kind: "goods", title: "Brass floor lamp", category: "lighting", condition: "Like new", estimatedValue: "45.00" },
  { key: "quest3", ownerId: "maya", kind: "goods", title: "Meta Quest 3 (128GB)", category: "vr-headset", condition: "Good. Barely used.", estimatedValue: "320.00", details: { storageGb: 128 } },
  // Sofa sellers.
  { key: "loveseat", ownerId: "sam", kind: "goods", title: "Navy loveseat, 2 seats", category: "sofa", condition: "Very good", estimatedValue: "300.00", minPrice: "255.00", openToOffers: true, details: { seats: 2, widthIn: 68 } },
  { key: "small-sofa", ownerId: "sara", kind: "goods", title: "Beige apartment sofa", category: "sofa", condition: "Good. Light wear on arm.", estimatedValue: "320.00", minPrice: "260.00", openToOffers: true, details: { seats: 2, widthIn: 74 } },
  // Local skills.
  { key: "moving", ownerId: "marco", kind: "skill", title: "Moving help with pickup truck", category: "moving", estimatedValue: "85.00", minPrice: "70.00", openToOffers: true, details: { days: ["Sat", "Sun"], equipment: ["truck", "dolly", "straps"] } },
  { key: "moving-dev", ownerId: "dev", kind: "skill", title: "Moving help with a cargo van", category: "moving", estimatedValue: "95.00", minPrice: "85.00", openToOffers: true, details: { days: ["Sat afternoon"], equipment: ["van", "blankets"] } },
  // Kai keeps his ladder but rents it out: $15 a day, $60 deposit held by PayPal while it's out.
  { key: "ladder", ownerId: "kai", kind: "goods", title: "Extension ladder, 24 ft", category: "tools", condition: "Good", estimatedValue: "120.00", forSale: false, rentPerDay: "15.00", deposit: "60.00", openToOffers: true },
  { key: "gutters", ownerId: "gus", kind: "skill", title: "Gutter cleaning", category: "gutters", estimatedValue: "80.00", openToOffers: true, details: { equipment: ["ladder"] } },
  { key: "lawn", ownerId: "lily", kind: "skill", title: "Lawn mowing", category: "lawn", estimatedValue: "40.00", openToOffers: true, details: { equipment: ["mower", "trimmer"] } },
  { key: "it-setup", ownerId: "ivan", kind: "skill", title: "Wi-Fi, TV mounting and PC setup", category: "it-setup", estimatedValue: "60.00", openToOffers: true },
  // PC upgrade: Priya sells her old card and buys Leo's. Her agent should notice she also needs a bigger power supply.
  { key: "rtx3070", ownerId: "priya", kind: "goods", title: "RTX 3070 graphics card", category: "gpu", condition: "Good. Used for gaming, never mined.", estimatedValue: "260.00", minPrice: "220.00" },
  { key: "rtx4070", ownerId: "leo", kind: "goods", title: "RTX 4070 graphics card", category: "gpu", condition: "Like new, in the box.", estimatedValue: "470.00", minPrice: "420.00", openToOffers: true },
  { key: "psu750", ownerId: "leo", kind: "goods", title: "750W power supply, fully modular", category: "psu", condition: "Good, two years old.", estimatedValue: "80.00", minPrice: "60.00", openToOffers: true, details: { watts: 750 } },
];

export const evidence = [
  { itemKey: "sectional", type: "note" as const, summary: "Small stain on left cushion, about 2 inches.", verified: true },
  { itemKey: "sectional", type: "receipt" as const, summary: "Bought new in 2022 for $1,100.", verified: true },
  { itemKey: "loveseat", type: "note" as const, summary: "No stains, pet-free home (seller's claim).", verified: false },
  { itemKey: "small-sofa", type: "note" as const, summary: "Light wear on right arm.", verified: true },
];

type Intent = {
  key: string;
  ownerId: string;
  type: "buy" | "sell" | "request_service" | "offer_service" | "rent";
  days?: number;
  text: string;
  category: string;
  maxPrice?: string;
  minPrice?: string;
  constraints?: Record<string, unknown>;
  dependsOn?: string[];
  dueInDays?: number;
};

export const intents: Intent[] = [
  // Maya's linked deal: all three or nothing.
  { key: "maya-sofa", ownerId: "maya", type: "buy", text: "A smaller sofa under $250, delivered by Saturday.", category: "sofa", maxPrice: "250.00", constraints: { maxWidthIn: 80 }, dependsOn: ["maya-sell", "maya-mover"], dueInDays: 3 },
  { key: "maya-sell", ownerId: "maya", type: "sell", text: "Sell the sectional, only if I find the smaller sofa.", category: "sofa", minPrice: "150.00", dependsOn: ["maya-sofa"], dueInDays: 3 },
  { key: "maya-mover", ownerId: "maya", type: "request_service", text: "Mover for Saturday morning, both pickups.", category: "moving", maxPrice: "90.00", dueInDays: 3 },
  // Demand for her sectional she never listed.
  { key: "ben-sectional", ownerId: "ben", type: "buy", text: "Sectional for my first apartment.", category: "sofa", maxPrice: "250.00", constraints: { minSeats: 3 }, dueInDays: 14 },
  { key: "bella-sectional", ownerId: "bella", type: "buy", text: "Big sofa or sectional for movie nights.", category: "sofa", maxPrice: "230.00", constraints: { minSeats: 3 }, dueInDays: 10 },
  { key: "omar-sectional", ownerId: "omar", type: "buy", text: "Sectional for the den, can pick up.", category: "sofa", maxPrice: "260.00", constraints: { minSeats: 3 }, dueInDays: 7 },
  // Other local demand: shows the engine is not just sofas.
  { key: "kai-quest", ownerId: "kai", type: "buy", text: "A Quest 3 under $300 nearby.", category: "vr-headset", maxPrice: "300.00", dueInDays: 20 },
  { key: "priya-gpu", ownerId: "priya", type: "buy", text: "Used RTX 4070 or better under $450.", category: "gpu", maxPrice: "450.00", dueInDays: 20 },
  { key: "sara-gutters", ownerId: "sara", type: "request_service", text: "Gutters cleaned before the rain.", category: "gutters", maxPrice: "100.00", dueInDays: 5 },
  { key: "ben-gutters", ownerId: "ben", type: "request_service", text: "Clean the gutters on a one-story house.", category: "gutters", maxPrice: "80.00", dueInDays: 10 },
  { key: "omar-gutters", ownerId: "omar", type: "request_service", text: "Gutters are overflowing, need help this week.", category: "gutters", maxPrice: "90.00", dueInDays: 6 },
  { key: "bella-lawn", ownerId: "bella", type: "request_service", text: "Mow and edge a small front yard every two weeks.", category: "lawn", maxPrice: "45.00", dueInDays: 7 },
  { key: "priya-sell", ownerId: "priya", type: "sell", text: "Sell my RTX 3070 once I have the new card.", category: "gpu", minPrice: "220.00", dueInDays: 10 },
  { key: "kai-gpu", ownerId: "kai", type: "buy", text: "A used RTX 3070 or similar for my first gaming PC.", category: "gpu", maxPrice: "280.00", dueInDays: 14 },
  { key: "bella-ladder", ownerId: "bella", type: "rent", days: 1, text: "A tall ladder for Saturday to hang string lights.", category: "tools", maxPrice: "25.00", dueInDays: 4 },
  { key: "priya-oil", ownerId: "priya", type: "request_service", text: "Oil change at home, I have the oil.", category: "car-care", maxPrice: "60.00", dueInDays: 8 },
  { key: "kai-oil", ownerId: "kai", type: "request_service", text: "Someone to change my oil on a weekend.", category: "car-care", maxPrice: "55.00", dueInDays: 12 },
];

export const memoryFacts = [
  { userId: "maya", fact: "Prefers weekend pickups.", source: "deal:2026-08 bookshelf", confidence: 0.8, verified: true },
  { userId: "maya", fact: "Accepted about $20 less for a same-day pickup.", source: "deal:2026-09 desk", confidence: 0.6, verified: false },
  { userId: "maya", fact: "Lives on a second floor with no elevator.", source: "user", confidence: 1, verified: true },
  { userId: "priya", fact: "Her PC has a 550W power supply.", source: "user", confidence: 1, verified: true },
];

export const notifications = [
  { userId: "maya", title: "3 people want a sectional like yours", body: "Ben, Bella and Omar are looking nearby. Your sectional stays private until you say yes." },
];

// Marco already has a job Saturday morning; his agent must schedule around it.
export const bookings = [
  { providerId: "marco", title: "Other customer: apartment move", startHour: 8, endHour: 10 },
  { providerId: "dev", title: "Other customer: office move", startHour: 8, endHour: 13 },
];

// A few real negotiations so the market isn't empty. Maya and Ben are left for the live demo.
export const talks = [
  { itemKey: "gutters", intentKey: "sara-gutters", label: "Gutter cleaning" },
  { itemKey: "gutters", intentKey: "omar-gutters", label: "Gutter cleaning" },
  { itemKey: "lawn", intentKey: "bella-lawn", label: "Lawn mowing" },
  { itemKey: "ladder", intentKey: "bella-ladder", label: "Extension ladder, 24 ft" },
];

# 0001 — Generalizing to other businesses

_Status: exploration, nothing in development · Last reviewed: 2026-11-05_

## Context

The app was built to run a personal football-jersey resale business, replacing a spreadsheet with several sheets and formulas. The question is whether it can be opened to other small business owners, reusing what already exists, as a **side income**. If it works it could grow (even into a mobile app), but that is not the goal today.

### What is generic and what is jersey-specific

Coupling to the domain is concentrated in a few places:

| Already generic | Jersey-specific |
|---|---|
| Batches with landed cost (shipping, card tax, supplier payments split between partners) | `Team`, `season`, `version`, `sleeve`, `player`, `number` |
| Inventory units with available / reserved / sold status | `SIZES`, `KID_SIZES`, `ITEM_TYPES`, `JERSEY_COLORS` |
| Sales with cancellation, collector and payment method | The unique constraint on `CatalogProduct` |
| Expenses, UYU↔USD conversions, month close | Rules such as `TYPES_WITHOUT_SLEEVE` |
| Partner balances | |
| Public catalog + WhatsApp, MELI sales import | |

Several things are also hardcoded or set through environment variables: `PEOPLE`, `USD_RATE`, `METHODS`, `WHATSAPP_NUMBER`, `MELI_API_KEY`, the Cloudinary folder and the month-close cron. With multiple businesses, all of that becomes per-business configuration.

## Decisions

1. **Target audience: small business owners.** High-volume businesses are out of scope for now. That lets inventory stay **serialized** (one row per physical unit). Moving to quantity-based stock would be a fundamental fork of the model, and it doesn't happen until a real case calls for it.

2. **The competitor is the spreadsheet, not other software.** Its strengths are flexibility and the fact that the customer's data is already in it. The app beats it on:
   - **"How much did I actually make?"**: per-unit landed cost, including shipping, card tax and the dollar rate.
   - **"Who owes whom?"**: partner balances.
   - **Organization that scales**: spreadsheets become unmanageable as they grow.
   - **Ease of use**: integrations load the data on their own.

3. **Work order: multi-tenant first, domain abstraction later.**
   1. Multi-tenant with the current domain (jerseys). The natural first customer is another jersey reseller, which needs no abstraction at all.
   2. Move what is hardcoded today into per-business configuration (partners, currencies, payment methods, integrations).
   3. Only once there are 2 or 3 customers from another vertical, abstract product attributes (rule of three: abstracting without real cases means guessing the shape).

4. **We offer integrations ready-made; the customer never touches n8n.** What the customer sees is the outcome ("connect your MercadoLibre", "log sales from the bot"), not the tool.

5. **Imported sales always go through approval** ("the app proposes, you approve"). This is the current MELI + Telegram flow, and it is central to the pitch: the spreadsheet's problem isn't recording a sale, it's *remembering* to. Nothing gets in without the user's OK.

6. **Telegram first for the bot.** It's free and quick to set up. WhatsApp Business charges per conversation and requires verifying the number, so it's only considered if customers ask for it.

## Hypotheses (unvalidated)

- **Freemium pricing.** The app is free up to a product limit, and you pay to go past that limit and to get integrations (anything involving n8n or WhatsApp). The idea is to charge where there is real cost and where the business is already growing.
  - _Risk:_ the core value (real profit, balances) stays free, and many small businesses don't sell on MELI. We could end up with many free users and almost nobody paying.
  - _Variant:_ integrations with per-use cost (such as WhatsApp) are charged at cost plus a margin, never free.
- **The limit should be the number of products, not photos.** The public catalog can work as a distribution channel, with a "Made with [app]" footer, and degrading photos impoverishes exactly that shop window. Proposal:
  - _Free:_ up to X products, reasonable photos and the app's branding on the catalog.
  - _Paid:_ unlimited products, no branding or a custom domain, and integrations.
- **Validate with "founders" before setting prices.** The first 3 to 5 customers get everything free, integrations included, in exchange for feedback. The model gets defined after seeing what they actually use. Reaching those 2 or 3 people doesn't look hard.
- **A PWA is enough before a native app.** Native is only justified if something comes up that the web can't do (for example, reliable push notifications or scanning).

## Technical implications identified

- **Free infrastructure (current terms still need checking):**
  - Vercel Hobby is reportedly for non-commercial use only; once we charge, we'd need Pro.
  - Supabase's free plan limits the number of projects and pauses inactive ones.
  - Consequence: one deploy per customer on free plans isn't viable, so it has to be **one shared database**, which is why multi-tenancy comes first.
  - Photos live in Cloudinary, which has its own free limit. That is the resource to ration.
- **MELI for multiple customers:**
  - Each customer authorizes *our* MELI app via OAuth, and we store and refresh their tokens.
  - MELI notifications arrive at a single callback URL, so **one n8n workflow for everyone** that routes by `seller_id` is enough. Today `User.meliUserId` resolves `seller_id → user`; it would become `seller_id → business → user`.
  - Onboarding friction point: linking listings to catalog products (`MeliListing`). A customer with many listings needs automatic suggestions, or linking that happens when each listing's first sale comes in.
- **Pending-sales inbox as a general concept.** If this becomes a product, MELI is just one source. The bot, another online store or manual entry feed the same approval inbox.
- **Onboarding from the spreadsheet.** An importer from CSV or Google Sheets is probably worth more than any new feature: nobody migrates if they have to enter everything by hand.
- **Self-service support.** Since this is a side income, customers should be able to fix the most common things themselves (undo, edit, see history), so support doesn't eat up the time.

## Open questions

- Who exactly are the first 2 or 3 customers? Do they sell on MELI, import in batches with USD cost, and have a partner? The more of those three they match, the more directly the existing app applies.
- How many hours of support per month are we willing to give?
- Does the core (without integrations) stand on its own? A simple test: would we use it ourselves without the MELI integration? If yes, maybe what we charge for is the core, not the extra.
- Where is the core value: landed cost and balances, or the catalog? We'll only know with the first customers.

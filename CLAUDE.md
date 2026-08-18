# Nasser Alwadani — coaching site

Arabic (RTL) landing site for an online fitness coaching business in Saudi Arabia.
Static HTML, no build step, deployed as a **Cloudflare Worker with static assets**
(`wrangler.jsonc`, built via Workers Builds git integration — not Pages, despite
some older references to "Pages Functions" below).

## Files

```
index.html             hero, credentials, who it's for, results, reviews, about, packages, calorie calculator
program.html            what the subscription includes
faq.html                19 FAQs
checkout.html            name + mobile form, reads ?tier=&months=&price= from the URL
checkout-success.html   post-payment landing page (links to the intake form)
checkout-error.html     payment-failed landing page
src/index.js            Worker: /api/checkout and /api/webhook only — everything
                         else falls through to static-asset serving automatically
wrangler.jsonc          Worker name, assets dir, KV binding, send_email binding
.assetsignore           keeps src/, wrangler.jsonc, .wrangler/ etc. from being
                         served as public static files (they'd otherwise be
                         fetchable at e.g. /src/index.js — checked and closed 2026-08-18)
```

Each HTML file is standalone and contains its **own full copy** of the CSS and JS.
Any shared change (nav, colours, footer, script) must be applied to all three.
This duplication is the main technical debt — see Tasks.

## Brand

From the official guideline PDF (v0.1, April 2025). Do not substitute.

| | |
|---|---|
| Font | **Vazirmatn** (Google Fonts) — all weights, Latin + Arabic |
| Ink (base bg) | `#131313` |
| Charcoal (surfaces) | `#2d2b28` |
| Sand (accent/text) | `#cec8ae` |
| Warm grey (muted) | `#9b978d` |

Non-brand colours added deliberately for commerce UI only:
- `--cta: #0F7A55` — subscribe buttons + price numerals
- `--sale: #D0342C` — student discount flag

Logo is embedded as a **CSS mask** (white PNG + `background: var(--sand)`), so it
recolours with the accent automatically. Two variants: full lockup (nav), N mark
(testimonial cards).

## Layout conventions

- `<html dir="rtl" lang="ar">` — use CSS logical properties (`inset-inline-start`, not `left`)
- Numerals are **Latin** (`1609`), not Arabic-Indic. Consistent across the whole site.
- Sticky nav; `section[id]{scroll-margin-top:76px}` keeps headings clear of it
- Mobile-first: most traffic arrives from Instagram/Snapchat/TikTok. Test at 375px before anything else.
- Carousels use scroll-snap. **RTL `scrollLeft` counts negative** — the JS detects
  direction and applies a sign. Don't "fix" this by assuming positive values.
- CSS is order-dependent for `.tag` / `.tag--save` (same specificity). `.tag--save` must come after.

## Pricing

Two tiers, four durations. Student is exactly 30% off at every duration.

| Duration | الباقة الرئيسية | باقة الطلاب |
|---|---|---|
| 1 month | 599 | 419 |
| 3 months | 1609 | 1129 |
| 6 months | 3109 | 2179 |
| 12 months | 5859 | 4099 |

- Default selected duration is **3 months**; the الأكثر اشتراكًا flag shows only on that duration.
- Sub-line shows per-month equivalent + saving vs the 1-month plan, in green.
- Goals are chosen at signup, not priced separately: **تنشيف · محافظة · تضخيم**
- Payment: mada, Apple Pay, cards. Tabby installments available.

## Content rules

- **Testimonials are verbatim client messages.** Spelling and grammar are not corrected —
  the raw voice is the point. Never invent, edit, or embellish a testimonial.
- **No client names, durations, or personal details** anywhere. Owner's explicit instruction.
- Before/after images carry no captions.
- FAQ answers are the coach's own words, taken from the previous site. Don't rewrite them.
- The "about" section contains biographical claims sourced from public web pages
  (football, Al Nassr spell, karate, 2024 placings). **Unverified by the owner.**

## Calorie calculator

Mifflin-St Jeor BMR × activity multiplier, on `index.html`.

- Multipliers are deliberately **lower than the textbook 1.2/1.375/1.55/1.725** —
  those overestimate badly. Current: 1.2 / 1.3 / 1.42 / 1.55, framed by daily step count.
- Cut −18%, bulk +10%.
- Protein **1.8 g/kg**, capped at 100 kg of bodyweight. Fat 25% of calories. Carbs fill the rest.
- **Hard floor:** never outputs below BMR, or below 1500 kcal (m) / 1200 kcal (f).
  If clamped, the note changes to explain why. Do not remove this guard.

## Tasks

1. **Split embedded assets out.** Photos and logo are base64 data URIs — each page is
   ~400–530 KB. Move to `/images/`, reference by path. Cuts size ~3× and makes photos swappable.
2. **Migrate to Astro.** Removes the three-copies-of-everything problem. This is now a
   Worker (see above), not Pages — an Astro migration would need its own Worker/assets setup.
3. ~~MyFatoorah checkout~~ — **built 2026-08-18, on branch `feat/myfatoorah-checkout`, not
   yet merged.** See "Checkout / payments" below before touching this again.
4. Consider a short summary of what's included on `index.html` above the packages —
   splitting it to `program.html` removed the strongest argument from the purchase path.

## Checkout / payments

- Two package buttons on `index.html#packages` (`.js-checkout`, `data-tier="main"|"student"`)
  navigate to `checkout.html?tier=..&months=..&price=..` (price read from the currently
  displayed `data-p{m}` value, for display only). That page collects name + mobile, then
  `POST /api/checkout`. The server (`src/index.js`) looks up the price itself from a
  hardcoded table — **never trusts the price in the URL or request body.**
  (An earlier version of this used an in-page modal instead of a dedicated page — replaced
  2026-08-18, so if you see modal-related CSS/JS referenced anywhere it's stale.)
- **That price table is duplicated three ways**: `src/index.js` (`PRICES`, authoritative),
  `index.html`'s `data-p1/p3/p6/p12` attributes (display), and this file's Pricing section.
  If pricing changes, update all three.
- Payment method: hosted MyFatoorah page (`SendPayment` → redirect to `InvoiceURL`).
  No Tabby yet (deferred by owner's choice, 2026-08-18) — mada/cards/Apple Pay only.
- **Test tokens only work against `apitest.myfatoorah.com`, not a country-specific live
  host like `api-sa.myfatoorah.com`.** Hitting the live host with a test token doesn't
  fail cleanly (no 401) — MyFatoorah returns a generic 500 with no useful detail. Found
  by bisecting the request payload down to nothing and still failing; confirmed by
  switching only the base URL. `MYFATOORAH_BASE` in `src/index.js` must change together
  with the token when a live credential eventually replaces the test one.
- **Webhook design deliberately does not do HMAC signature verification.** `/api/webhook`
  treats MyFatoorah's callback as nothing more than a hint to re-check — it always calls
  `GetPaymentStatus` back with our own token before trusting anything, and only acts on
  what that authoritative call returns. This was a conscious choice over replicating
  MyFatoorah's signature scheme from memory, since getting that subtly wrong is worse
  than not needing it at all. Idempotent via a KV existence check (`order:<invoiceId>`).
- Order notification: on confirmed payment, order is stored in the `ORDERS` KV namespace
  and a plain-text email is sent via the `SEND_EMAIL` binding (Cloudflare Email Routing,
  enabled on `nassercoaching.com` 2026-08-18) to `coaching@nasserpt.com`. No third-party
  email service — deliberately avoided touching `nasserpt.com`'s DNS.
- Post-payment redirect goes to `checkout-success.html`, which links out to the existing
  intake form (`https://form.jotform.com/Alwadani/nasserpt`) — goal/history is still
  collected there, not at checkout.
- **`MYFATOORAH_TEST_TOKEN` is a TEST credential.** `src/index.js` only ever reads this
  one secret — there is no live/production token wired in yet, on purpose. **Do not merge
  this branch to `main` until a live MyFatoorah token replaces it** (new secret + a
  one-line change in `src/index.js`), or real visitors will hit a non-functional sandbox
  checkout and think they've paid when the business has received nothing.

## Rules

- **API keys never go in HTML or in this repo.** Cloudflare dashboard → Settings →
  Environment variables, or `wrangler secret put <NAME>` run by the owner locally —
  never pasted into chat. The site is public; anything in a file is readable via view-source.
- Payment changes go to a **branch**, get tested at the preview URL with MyFatoorah
  test credentials, then merge. Never commit checkout code straight to `main`.
- Never trust a payment callback's own claims about its status — re-verify server-to-server
  with your own credentials before acting on it (see "Checkout / payments" above for how
  this is currently done). Redirect-only integration will silently lose paid orders when
  someone closes the browser — fulfillment must happen from the webhook path, not the
  browser redirect.

## Resolved decisions

- **Response time is 24 hours max, except Thursday and Friday** (his days off). Reflected
  in `program.html`'s "رد على استفساراتك" spec.
- **Domain consolidation: `nassercoaching.com` (current deploy) is the one that stays.**
  The other three (`nasser-alwadani.com`, `nasser-pt.com`, `nasserpt.com`) should eventually
  301 to it — except `nasserpt.com`, which hosts the coaching Google Workspace email and must
  **never** be repointed.
- **Discount ladder stays as-is.** 10% at 3 months, 13% at 6, 18% at 12 — no change wanted.
- **No تغذية فقط (nutrition-only) package exists currently.** The pricing-parity concern
  doesn't apply until one is introduced.

## Open questions for the owner

- **Follow-up interval: 10 days or 15?** `program.html` says 10. The older site says both,
  in two places on the same page. Needs a decision, not a guess.

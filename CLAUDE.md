# Nasser Alwadani — coaching site

Arabic (RTL) landing site for an online fitness coaching business in Saudi Arabia.
Static HTML, no build step, deployed as a **Cloudflare Worker with static assets**
(`wrangler.jsonc`, built via Workers Builds git integration — not Pages, despite
some older references to "Pages Functions" elsewhere in this file).

## Files

```
index.html     hero, credentials, results, reviews, packages, calorie calculator
program.html   what the subscription includes, who it's for
about.html     about the coach (bio, record) — split out from index.html 2026-08-18
faq.html       19 FAQs
```

Each HTML file is standalone and contains its **own full copy** of the CSS and JS.
Any shared change (nav, colours, footer, script) must be applied to every page.
This duplication is the main technical debt — see Tasks.

## Nav

Kept deliberately short (owner's instruction, 2026-08-18): only links that go to a
**different page**, plus two explicit exceptions that stay in the nav even though
they're anchors on `index.html` — اشترك الآن (`#packages`) and حاسبة السعرات (`#calc`),
because the owner wants those reachable from everywhere. Anchors into other
in-page sections (`#results`, `#reviews`) were dropped from the nav for this reason —
the sections themselves still exist on `index.html`, they're just not nav-linked.
Current nav, in order: عن ناصر (`about.html`) · البرنامج (`program.html`) ·
اشترك الآن · حاسبة السعرات · الأسئلة (`faq.html`).

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
| 6 months | 2179 → **1129 is student**; main is 3109 | 2179 |
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
- `about.html` contains biographical claims sourced from public web pages
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
2. **Migrate to Astro.** Removes the copy-pasted-everything problem — now five HTML
   pages each carrying their own CSS/JS. This is now a Worker (see above), not Pages —
   an Astro migration would need its own Worker/assets setup.
3. **MyFatoorah checkout.** All four `اشترك الآن` buttons currently `href="#"` and do nothing.
   Needs Worker routes (not Pages Functions) for `/api/checkout` and `/api/webhook`.
4. Consider a short summary of what's included on `index.html` above the packages —
   splitting it to `program.html` removed the strongest argument from the purchase path.

## Rules

- **API keys never go in HTML or in this repo.** Cloudflare dashboard → Settings →
  Environment variables. The site is public; anything in a file is readable via view-source.
- Payment changes go to a **branch**, get tested at the preview URL with MyFatoorah
  test credentials, then merge. Never commit checkout code straight to `main`.
- Verify the webhook signature before trusting any payment callback. Redirect-only
  integration will silently lose paid orders when someone closes the browser.

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

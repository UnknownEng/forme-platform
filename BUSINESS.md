# Forme business plan (Pakistan)

## The idea in one line
A "fit intelligence" layer for Pakistani fashion e-commerce: shoppers answer three questions once, and any brand that plugs in Forme can tell them their size for every product, so fewer parcels come back or get refused at the door.

The full simulated 100-judge evaluation, with sources, is in [docs/EVALUATION.md](docs/EVALUATION.md). Summary: **3 invest, 33 pilot, 64 pass; average 4.1/10.** Operators (brand e-commerce heads, D2C founders) liked it enough to pilot; investors want proof first.

## Why it can work
- **Every brand sizes differently.** A "Medium" at one Lahore pret brand is not a Medium at the next, and shoppers know it.
- **Cash on delivery magnifies doubt.** Most Pakistani online orders are COD. When a shopper isn't sure about size, a common outcome is a refused parcel and a wasted two-way courier trip.
- **The pain is in the brand's P&L.** Courier both ways, handling and re-stocking are easy to price, so savings are easy to show.
- **Light integration.** One script tag on Shopify/WooCommerce/custom stores, or a REST API.

## The hard truths (from the judges)
1. **Measure the problem first.** Nobody publishes how many Pakistani COD refusals and returns are actually caused by size. Some refusals are buyer's remorse before anyone tries anything on. Size advice only fixes the share caused by size doubt. Get this number from pilot brands before selling hard.
2. **Expect modest savings.** Published results from big European retailers show roughly 4–10% fewer size-related returns, not 25–35%. The website now uses 5/10/15% scenarios.
3. **Price below the savings.** At 15,000 orders/month, realistic savings are a few lakh rupees a year. Pricing has to sit comfortably under that: Rs 9,999/month for Growth, free pilots, and outcome-based deals for big platforms.
4. **No moat yet.** The cross-store profile is the long-term moat, but browsers isolate storage per site. It needs a Forme login (e.g. phone OTP) before it is real, so the website now calls it "coming soon".
5. **Unstitched fabric has no size.** A large share of fashion sales on marketplaces like Daraz is unstitched lawn, which Forme cannot help with. Focus on pret (ready-to-wear), menswear, denim and western wear.
6. **Size charts are messy.** Many brands publish body charts, not garment measurements. Offer a paid "size chart audit" service; it's also a way in.

## Where to win
- **Start with mid-size pret, menswear and denim brands** that run their own Shopify/WooCommerce stores, not Daraz. They own the checkout and the returns data, and decide fast.
- **Women's pret first.** Kurtas and 2-piece/3-piece pret dominate online fashion. The engine now has Kurtas and Shalwar Kameez categories with their own length rules, and a women's/men's sizing choice.
- **Diaspora storefronts** (UK, US, Gulf) shipping from Pakistan: international returns are very expensive, so sizing accuracy is worth more.
- **Sell outcomes:** a free 4–8 week pilot on one category, measuring size returns and refusals with vs without the widget. The console already tracks "followed vs ignored" return rates.

## Pricing to test
| Plan | Price | For |
|---|---|---|
| Starter | Free up to 5,000 recommendations/month | Pilots, small brands |
| Growth | Rs 9,999/month incl. 50,000 recommendations, then Rs 0.25 each | Growing pret/menswear brands |
| Enterprise | Share of measured savings, or annual licence | Large brands, marketplaces |

These are starting points. Validate with the first three pilots.

## Regulation
Pakistan's personal data protection bill has been in draft for several years, and PECA applies to electronic data. Forme stores body measurements only (no name, phone, CNIC or photos), has a public privacy page, a consent line in the widget, and a one-tap "Forget me". Get a local legal review before signing large brands.

## Next 90 days
1. Get size charts and anonymised return/refusal data from 3 pilot brands. Measure what share is truly size-related.
2. Calibrate the engine on real outcomes; publish an accuracy number you can defend.
3. Move from demo storage to Postgres; add password reset and team accounts.
4. Ship the phone-OTP Forme login so profiles follow shoppers between brands.
5. Turn the best pilot into a one-page case study (with the brand's permission) before approaching large brands or marketplaces.

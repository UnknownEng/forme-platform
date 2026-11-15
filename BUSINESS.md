# Forme business analysis

## The idea in one line
A B2B "fit intelligence" layer: shoppers create one fit profile, and any fashion platform that plugs in Forme can tell them their size for every product, reducing size-related returns.

## Why it can work
- **The pain is real and measurable.** Apparel has the highest return rates in e-commerce, and size/fit is the most common reason given. Every return costs reverse logistics, handling, and often the sale itself. In India, cash-on-delivery and free returns make this worse.
- **The buyer has a budget line for it.** Returns cost shows up directly in a platform's P&L, so savings are easy to calculate (the ROI calculator on the landing page does this with the client's own numbers).
- **Integration is light.** One script tag or one API call. Platforms can pilot on a single category without engineering projects.
- **Data compounds.** Every keep/return outcome improves product calibration. The longer a platform uses Forme, the better it gets, which raises switching costs.

## The hard truths
1. **It's a crowded category.** Established players include True Fit, Fit Analytics (owned by Snap), Bold Metrics, Virtusize, Kiwi Sizing, Sizebay and 3DLook. Several large platforms (Amazon, Myntra and others) also have in-house size recommendation. "Better UI" is not enough to win.
2. **Big platforms rarely buy from unproven startups.** They will ask for case studies, security review, uptime SLAs, data-processing agreements and references. Selling straight to the biggest platforms first is the slowest path.
3. **The cross-store profile is the moat, and the hardest part.** Browsers isolate storage per site, so a shopper's profile does not follow them between stores automatically. A Forme login (phone OTP) or platform partnerships are needed for true "one profile everywhere".
4. **Accuracy depends on real size charts.** Many brands' charts are body-measurement charts, not garment charts, and are often wrong. You need a process to collect or verify garment measurements.

## Where to win (recommended positioning)
- **Start with mid-size Indian D2C brands and regional marketplaces**, not Myntra or Amazon. They feel the returns pain, lack in-house data science teams, and decide fast.
- **Specialise first:** e.g. ethnic wear (kurtas, sherwanis, blouses) or men's shirts and denim, where sizing is inconsistent and existing tools are weak. Ethnic wear sizing in particular is underserved by global competitors.
- **Sell on outcomes:** offer a free 30–60 day pilot on one category, measure return rate with vs without Forme (the console already tracks "followed vs ignored" return rates), then charge.
- **Use the data later:** aggregated, anonymised fit data ("which sizes run small, which body types are under-served") is valuable to brands' design and merchandising teams. That's a second product.

## Pricing models to test
| Model | Good for | Note |
|---|---|---|
| Free tier (≤5k recs/month) | Small brands, word of mouth | Builds the shopper profile network |
| Per recommendation (e.g. ₹0.30–0.50) | Growth brands | Predictable, easy to understand |
| Share of measured savings | Large platforms | Aligns with their goal; requires trusted measurement |
| Annual enterprise licence | Marketplaces | Add SLA, SSO, data residency |

The prices on the landing page are placeholders to validate with real customers.

## Pitch for a big platform (when you get there)
1. Their numbers in the ROI calculator: orders, AOV, return rate, size share, cost per return.
2. Live demo: the demo store + the console's live activity feed.
3. Pilot proposal: one category, 4–8 weeks, A/B test (widget shown vs hidden), success metric = size-return rate.
4. Security pack: key model, data stored (body measurements only), erasure endpoint, hosting/data-residency plan.
5. Integration effort: widget (hours) or API (days), catalog sync via bulk endpoint.

## Next 90 days
1. Get 3–5 real brand size charts and test the engine against real shoppers' known sizes.
2. Deploy to a real domain with HTTPS; add password reset and team accounts.
3. Sign 2–3 pilot brands for free in exchange for return data and a case study.
4. Build the Forme shopper login (phone OTP) so profiles really travel between stores.
5. Turn pilot results into a one-page case study before approaching large platforms.

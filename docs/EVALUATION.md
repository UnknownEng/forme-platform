# Forme: simulated judging panel (Pakistan-first)

> **AI-generated simulation. These are not real people.** The 100 judges below are fictional personas written by an AI model to stress-test the idea. Their scores and quotes are synthetic. Where a persona type mentions a real firm (Indus Valley Capital, Daraz and so on), it describes the *kind* of person who might sit in such a role. It does not represent that firm or anyone who works there. The market research in sections 3 and 4 is real and cited, but much of it comes from secondary or vendor sources, which are flagged. Use this document as a structured critique, not as evidence of investor or customer demand.

- **Date:** 16 November 2026
- **Inputs reviewed:** `BUSINESS.md`, `README.md`, `public/index.html`, `public/js/landing.js`, `public/widget.js`, `src/engine.js`, `src/routes/public.js`, `tests/engine.test.js`, and the live site https://forme-platform.vercel.app (pages read only, no load testing).
- **Correction applied:** The founder is based in Pakistan and the target market is **Pakistan**. India appears below only as a comparison or a later market. This replaces an earlier India-focused draft.

---

## 1. Verdict

| | |
|---|---|
| **Verdict totals (100 judges)** | **Invest 3 · Pilot 33 · Pass 64** |
| **Mean scores (1 to 10)** | Problem severity **6.4** · Willingness to pay **3.7** · Differentiation/moat **2.7** · Technical credibility **4.5** · Go-to-market feasibility **4.0** · Team/execution risk **3.2** (higher means less risk) |
| **Overall mean** | **4.1 / 10** |

**What the panel concluded.** The product is a well-built demo of a real pain, but the business case has not been proven. The software looks more professional than most pre-seed decks (clean API, OpenAPI spec, shadow-DOM widget, hashed keys, an erasure endpoint). The panel's problems are elsewhere:

1. **The Pakistani returns problem is mostly not a sizing problem.** Most "returns" in Pakistan are COD refusals at the door (return-to-origin, RTO). They are driven by fake or impulse orders, cash not being ready, delivery delays and courier issues, before anyone tries the garment on. A size recommender only touches the smaller slice of post-delivery exchanges.
2. **The best published evidence for size advice shows single-digit reductions, not 25%.** Zalando reports its Size & Fit tools prevented 8% of size-related returns in 2025. Zalando's peer-reviewed A/B test showed a 3.8% to 6.6% relative reduction. The site's ROI calculator treats 25% as "Expected" and 35% as "Strong".
3. **The engine is a hand-tuned heuristic with no sex/body-shape input.** It would be used mainly on women's pret, and it has never been validated against a single real shopper's known size.
4. **A large part of the Pakistani fashion market has no size at all.** About 70% of Daraz fashion sales are reportedly unstitched fabric.
5. **The "one profile, every store" network moat does not exist yet.** The README admits that browsers isolate storage per site, and there are zero retailers.

About a third of judges would run a **free pilot**, almost all of them operators: brand e-commerce heads, D2C founders and agencies. They have no better tool, and the integration cost is low. Only 3 of 100 would invest today.

**Biggest existential risk:** Even with a working product, the money saved for a typical Pakistani brand is too small to pay for a company. A realistic 5 to 10% cut in post-delivery size exchanges at a 15,000-order brand is worth roughly **Rs 4 to 6 lakh a year** (section 8). That has to fund Forme's revenue and still leave a visible ROI for the brand. Meanwhile, the platforms big enough to matter (Daraz, the top brands) can build a "size chart plus height/weight" tool themselves or license a global vendor. Unless Forme proves a **conversion lift**, or wins the high-cost **cross-border (diaspora) orders**, there may be no business here regardless of execution.

---

## 2. What Forme is today (technical review)

### Strengths the panel acknowledged
- **Complete surface area for a solo build:** landing page, merchant console, demo store, embeddable widget, REST API (`/v1/recommend`, `/v1/recommend/batch`, profiles, events, feedback, catalog sync), OpenAPI 3.1 docs, and 18 automated tests.
- **Sensible security basics:** scrypt passwords, hashed session tokens and secret keys, publishable vs secret keys, origin allow-lists, rate limits, CSRF header, strict CSP, and a `DELETE /v1/profiles/me` erasure endpoint.
- **A feedback loop exists:** `calibration()` shifts a product's target measurements based on too-small / too-large / kept feedback, damped by `(n + 6)` and clamped to ±4 cm.
- **Honest internal documents:** `BUSINESS.md` and `README.md` already list the hard truths (a crowded category, no cross-store identity yet, unverified size charts, data not persisted on Vercel). The panel said the landing page should be as honest as these files.

### Weaknesses the panel's ML and garment-technology judges found in `src/engine.js`
| # | Finding | Why it matters |
|---|---|---|
| E1 | **No sex or body-shape input.** `resolveBody()` estimates chest, waist, hips and shoulders from height and BMI with one unisex linear formula (e.g. `hips = 0.56*height + b*2.1`). | Women's pret is the core Pakistani online category. A probe of the engine for a 165 cm / 60 kg shopper returns chest 90.5, waist 76.1, hips 91.4 cm: a waist-to-hip gap of about 15 cm, which is a typically male proportion. For bottoms, waist carries a 0.5 weight, so women would be systematically mis-sized. |
| E2 | **Confidence is a heuristic, not a probability.** `confidence = 100 - penalty*3.4`, minus at most 12 points for estimated dimensions, clamped to 30–98. | With *every* dimension estimated (only height and weight given), the probe still returns "Good match" at 79–84% for jeans. The hero shows "M · 94%", which shoppers and buyers will read as "94% chance this fits". Nothing in the repo measures whether 80% confidence is right 80% of the time. |
| E3 | **No validation data.** The tests check monotonicity (bigger body, bigger size), not accuracy against real shoppers. | No "top-1 size accuracy vs known sizes" number exists. Any buyer's data scientist will ask for this first. |
| E4 | **Wrong garment taxonomy for Pakistan.** Categories are T-shirts, Shirts, Knitwear, Jackets, Hoodies, Jeans, Trousers, Shorts and Dresses. There is no kameez/kurta, shalwar, trouser (straight/cigarette/culotte), lehenga, abaya, or kids. `length` is fixed at `0.41*height` for every top. | A kameez's length, shoulder and sleeve fit, and its armhole and side-slit behaviour, are the main fit questions in pret. Kameez lengths vary on purpose (short kurti vs long kameez), so a single "ideal length" is wrong. Pakistani trousers are often elasticated or free-size. |
| E5 | **Calibration is one scalar per product.** It shifts all sizes equally, has no per-size or per-body-segment correction, and doesn't separate a "runs small in the chest" signal from "too short". | Real fit issues are usually local (e.g. "XS shoulders are 19 in, chart says 14.5 in", a real Trustpilot complaint about a Pakistani brand). |
| E6 | **Garment charts are taken as given.** The engine assumes garment measurements. Many Pakistani brands publish body charts, inconsistent charts, or none. | `BUSINESS.md` identifies this correctly. The product has no chart QA or verification workflow. |
| E7 | **No use of purchase history.** It cannot learn that "you bought M in Brand A and kept it". | This is the signal the strongest incumbents rely on (Myntra's personalised size vectors, True Fit's Fashion Genome). |

### Production-readiness issues raised by infosec and procurement judges
- The README says that on Vercel **"new sign-ups and live events are not kept"**, but the landing page invites visitors to "create your own account in under a minute." A prospect who signs up and later finds the account gone will lose trust.
- There is no privacy policy, terms, DPA, consent text in the widget, uptime history, or status page. The "Status" link goes to a raw `/v1/health` JSON endpoint.
- The shopper profile token is a bearer token stored in the retailer's `localStorage`. That is fine for a pilot, but enterprise reviewers will ask about token theft and replay, and about the fact that the "portable" token cannot leave the retailer's origin.
- Vercel serverless runs on SQLite with no persistent disk. Postgres, backups and monitoring are prerequisites for even a paid pilot.

---

## 3. Market research (Pakistan)

### 3.1 Market size and online adoption
- Pakistan's e-commerce sector was reported at about **$7.7bn in 2024** ([Profit / Pakistan Today, Mar 2025](https://profit.pakistantoday.com.pk/2025/03/29/pakistans-e-commerce-sector-hits-7-7bn-in-2024-smes-face-challenges-in-tapping-global-market-report/)). Definitions vary widely, and other sources say the country "has no proper means to collect authentic data".
- ECDB estimates **fashion e-commerce at about US$1.05bn in 2025**, growing 10–15%, with online at only 5–10% of fashion sales. Apparel is about 55% of the market. Its ranking puts **sapphireonline.pk first (about US$109m online revenue in 2025)**, ahead of Daraz and Nishat ([ECDB Pakistan fashion](https://ecdb.com/resources/sample-data/market/pk/fashion)). These are commercial-database estimates.
- Adoption is still narrow. A Gallup & Gilani survey found **only about 8% of Pakistanis shopped online in H1 2025** ([ProPakistani, Dec 2025](https://propakistani.pk/2025/12/12/91-pakistanis-didnt-shop-online-in-first-half-of-2025-survey/); [Dawn](https://www.dawn.com/news/1962597)).

### 3.2 Cash on delivery and the returns that matter
- **COD dominates.** The Gallup & Gilani 2025 survey puts COD at **60% of online buyers**, Easypaisa at 15% and cards at 7% ([Dawn](https://www.dawn.com/news/1962597)). Industry estimates run from 75% of shoppers to 90%+ of transactions (Karandaaz/PostEx, cited in [CW Pakistan](https://cwpakistan.com/pakistan-e-commerce-gets-digital-cod-makeover-karandaaz-and-postex-pilot/)). The older ADB/UNESCAP figure was 95% ([ProPakistani, 2018](https://propakistani.pk/2018/06/28/95-of-e-commerce-transactions-in-pakistan-are-cash-on-delivery-report/)).
- **No reliable fashion return or RTO figure exists for Pakistan.** ECDB, via DHL, puts the overall e-commerce return rate at **7.9% (2023)** ([DHL Pakistan](https://www.dhl.com/discover/en-pk/e-commerce-advice/e-commerce-best-practice/subscription-marketing/how-pakistani-e-commerce-sellers-can-reduce-cod-returns)). Vendor and store anecdotes cite **30–42% RTO on COD fashion orders** ([Markaz](https://www.markaz.app/blog-post/cod-return-rates-in-pakistan-how-to-reduce-them) notes that "nobody can tell you" the true rate). The panel treats RTO in the 15–35% range as plausible for apparel but unverified.
- **The key point is that most RTO happens before the garment is tried on.** Refusals at the door are caused by unverified or fake orders, impulse buying, the customer not being home, cash not ready, and delivery delays. Size can only cause a refusal when the courier allows the parcel to be opened, or when the customer cancels because they are unsure of the size. The addressable slice for Forme is **post-delivery exchanges and returns**, plus any size-uncertainty share of pre-delivery cancellations. Nobody has measured that share. Measuring it is the single most valuable thing Forme could do in a pilot.
- **Costs are rising.** Finance Act 2025 added **2% withholding tax plus sales tax on COD e-commerce, collected by couriers** ([KPMG brief](https://assets.kpmg.com/content/dam/kpmg/pk/pdf/2025/07/A-Brief-on-Finance-Act-2025.pdf); [Profit](https://profit.pakistantoday.com.pk/?p=203554)), and couriers raised fees ([ARY](https://arynews.tv/excise-department-revises-courier-service-charges-amid-inflation)). The FBR also capped cash payment on COD orders at Rs 200,000 ([CW Pakistan](https://cwpakistan.com/fbr-caps-cash-on-delivery-payments-for-e-commerce-orders-at-rs-200000/)). Each failed parcel is now more expensive, which helps the "reduce failed deliveries" argument but not the sizing argument specifically.
- **Reverse-logistics cost per parcel:** no current public rate cards were found for TCS, Trax, M&P or Call Courier. Leopards advertises "no return fees" on COD ([Leopards](https://leopardscourier.com/services/cod)), while most arrangements bill forward and return legs separately ([Markaz](https://www.markaz.app/blog-post/cod-return-rates-in-pakistan-how-to-reduce-them)). PostEx bundles COD financing with logistics, raised a $7.3m pre-Series A in 2024, and is expanding to the GCC ([Khaleej Times](https://khaleejtimes.com/business/leading-pakistan-fintech-raises-7-3-million-to-drive-gcc-expansion)). **Panel assumption:** a size exchange (reverse pickup, inspection, repack and re-ship) costs a brand roughly **Rs 400–700** all-in. A failed COD parcel costs roughly **Rs 250–500**. Verify with real courier quotes.

### 3.3 Sizing culture
- **Unstitched still dominates.** About **70% of Daraz fashion sales are unstitched fabric and about 30% pret** ([CW Pakistan](https://cwpakistan.com/daraz-pakistan-transforms-fashion-retail-with-e-commerce-and-small-scale-manufacturer-partnerships/)). In 2017, Aurora put pret at about 0.5% of retail ([Aurora](https://aurora.dawn.com/news/1141213)). Pret is growing fastest among urban working women, and brands report that customers buy both formats ([Alkaram Studio](https://www.alkaramstudio.com/blogs/pages/unstitched-suits-vs-ready-to-wear)). Unstitched has no size, so Forme's addressable catalog is **pret, menswear (Outfitters, Breakout, Engine, Cougar, J. kurtas) and kidswear**.
- **Brand charts are inconsistent and sometimes wrong.** Consumer reviews of Pakistani brands report garments that don't match their charts, e.g. an XS with about 19 in shoulders against a chart saying 14.5 in ([Trustpilot, Ethnic by Outfitters](https://ca.trustpilot.com/review/ethnic.pk)). Self-selected reviews are anecdotal, but they confirm `BUSINESS.md`'s worry. The first value may come from **auditing the brand's own charts with return data**, not from shopper profiles.
- **Plus-size gaps:** smaller brands have emerged specifically to fill the "size gap" for plus-size women ([Aurora](https://aurora.dawn.com/news/1144814)).
- **Diaspora:** LAAM, a Pakistani multi-brand fashion marketplace (1,200+ sellers), raised $5.5m in Dec 2024, led by Disrupt and Zayn VC, to sell South Asian fashion to migrants in 100+ countries ([TechCrunch](https://techcrunch.com/2024/12/11/laam-lands-5-5m-to-provide-south-asian-fashions-to-migrants-around-the-world); [ProPakistani](https://propakistani.pk/2024/12/12/fashion-marketplace-laam-raises-5-5-million-led-by-shark-tank-judge-faisal-aftabs-zayn-vc/)). A cross-border return can cost more than the item's margin, so **fit errors are far more expensive on international orders.**

### 3.4 Regulation
- **Personal Data Protection Bill:** as of late 2026, Pakistan still has **no enacted comprehensive data-protection law** and no independent authority. The bill has cycled through drafts (2021, 2023, a "2025/2026" draft), cabinet approval and parliamentary delays. Some trackers record the 2023 Senate bill as withdrawn ([Arab News](https://www.arabnews.pk/node/2344396/pakistan); [Express Tribune, Oct 2026](https://tribune.com.pk/story/2625470/pakistan-can-no-longer-wait-for-personal-data-protection-law); [RecordingLaw summary](https://www.recordinglaw.com/world-laws/world-data-privacy-laws/pakistan-data-privacy-laws/)). Global tech coalitions have warned that draft localisation clauses could deter business ([Arab News](https://www.arabnews.pk/node/2344396/pakistan)).
- **PECA 2016 (amended January 2025):** Section 3 (unauthorised access) and Section 4 (unauthorised copying or transmission of data) apply to any breach. The 2025 amendment moved enforcement to the new NCCIA and added content offences ([DLA Piper](https://www.dlapiperdataprotection.com/?c=PK); [ARY summary](https://arynews.tv/peca-amendment-act-2025-the-key-points/)).
- **What this means for Forme:** compliance burden today is low, which is a short-term advantage. But enterprise brands with UK, UAE or EU storefronts will apply **GDPR / UK GDPR / UAE PDPL** to diaspora shoppers, and draft PDPB localisation clauses could affect hosting outside Pakistan. Body measurements are personal data under every regime. Consent text, a privacy notice and a DPA template are needed before any paid pilot.

### 3.5 Funding climate
- Pakistani startup funding collapsed from **$355m (2022) to about $43m (2024)**, an 88% fall ([Nukta / i2i, Telenor, STZA brief](https://nukta.com/pakistan-startup-sector-funding)). 2025 partially recovered, with estimates ranging from $36.6m ([startup.pk / Data Darbar](https://startup.pk/pakistan-startup-funding-in-2025-reading-between-the-numbers/)) to about $74m ([Business Recorder](https://www.brecorder.com/news/40407474)). Q1 2025 raised just $196k ([TechJuice](https://www.techjuice.pk/?p=171158)). Local seed cheques are scarce and favour fintech and B2B with revenue.
- Daraz, Pakistan's largest marketplace (founded in Pakistan as a fashion retailer and owned by Alibaba since 2018), cut 11% of staff in 2023 and announced more layoffs in 2024 ([Dawn](https://dawn.com/news/1817510/alibabas-south-asian-e-commerce-giant-daraz-announces-layoffs-in-memo); [Arab News](https://arab.news/y35kk)). It is in cost-cutting mode, not buying point solutions.

### 3.6 Global evidence on what size advice actually achieves
| Source | Finding |
|---|---|
| Zalando corporate returns page | About **50%** of items ordered are returned. Size & Fit solutions **prevented 8% of size-related returns in 2025** (9% in 2026) ([Zalando](https://corporate.zalando.com/en/node/10413)). Zalando earlier reported 10% fewer size-related returns on items with size advice ([Zalando](https://corporate.zalando.com/en/node/10416)). |
| Zalando, SizeFlags (KDD 2021) | A/B tests with about 720k customers per arm: **3.8% relative** cut in size-related returns (shoes) and **4.3–6.6%** (textiles). Size advice also **increased multi-size ordering by 11–19%** ([arXiv 2106.03532](https://arxiv.org/pdf/2106.03532)). |
| Coresight Research (2023) | US online apparel return rate **24.4%**. Size/fit was the top reason, cited by **53% of respondents** (a survey of 100 retailers, not measured returns) ([Coresight](https://coresight.com/research/the-true-cost-of-apparel-returns/)). |
| Amazon Fashion (Jan 2024) | In-house deep-learning size recommendations "generating billions of recommendations per month", plus LLM fit-review highlights and Fit Insights for brands ([About Amazon](https://aboutamazon.com/news/retail/how-amazon-is-using-ai-to-help-customers-shop); [Retail TouchPoints](https://www.retailtouchpoints.com/?p=139977)). |
| Myntra (India, for comparison) | The CEO said half of Myntra's revenue flows through system-driven size and fit recommendations ([YourStory, Nov 2025](https://yourstory.com/2025/11/ai-becomes-myntras-growth-engine-ceo-nandita-sinha), a company claim). Myntra researchers built personalised user-by-brand "sizing vectors" ([arXiv 1906.12128](https://arxiv.org/pdf/1906.12128v1.pdf)). |
| India (comparison) | Fashion and footwear return rates of **30–35%**, with about **40%** of returns due to size (Return Prime data via [Apparel Resources, Jul 2024](https://apparelresources.com/business-news/retail/third-online-bought-fashion-footwear-products-get-returned-says-report/)). Redseer's older 2017 data put apparel returns at 37–42%. |

**What this means:** a credible claim for a heuristic recommender is **"5–10% fewer size-related returns, to be measured in your A/B test"**, not 25–35%.

### 3.7 Competitors
| Player | Status (cited) | Relevance to Forme in Pakistan |
|---|---|---|
| **True Fit** (US) | Raised about $55m Series C (2018) and $30m (2021) ([TechCrunch](https://techcrunch.com/?p=1586620); [multiples.vc](https://multiples.vc/private-comps/true-fit)). Launched the GenAI "Fit Hub" in June 2024 on its "Fashion Genome" (82m shoppers, 29k brands) and expanded to Shopify merchants ([BusinessWire](https://www.businesswire.com/news/home/20240605922431/en/True-Fits-New-Generative-AI-Fit-Hub-Conveniently-Synthesizes-All-Size-Fit-Information-To-Solve-Online-Fit-Challenges-for-Fashion-Retailers)). | Already has the cross-retailer data network Forme describes. Unlikely to target small Pakistani brands, but available on Shopify. |
| **Fit Analytics** (Berlin) | Acquired by Snap (2021). After Snap wound down AR Enterprise, the founder **re-acquired the pre-acquisition IP** and it now operates independently as Fit Analytics Innovation GmbH ([Yahoo / Sourcing Journal](https://www.yahoo.com/lifestyle/fit-analytics-reacquires-ip-snap-145138494.html); [StartupIM](https://startupim.com/company/fit-analytics-innovation-gmbh)). | Shows that even a scaled leader was not core enough for a big platform to keep. Exit by acquisition is not guaranteed. |
| **Bold Metrics** (US) | Series A of about $8m (2022). No newer round found ([Venture Capital Journal](https://www.venturecapitaljournal.com/bold-metrics-lands-8m-series-a/)). | Body-data-from-few-questions approach, similar to Forme's. |
| **Virtusize** (Tokyo) | Sold to Japanese investors for €11m in 2018. Total funding about $4m (CB Insights). Reports 50%+ partner growth in 2025 ([tech.eu](https://tech.eu/2018/06/20/swedish-fashion-tech-startup-virtusize-sells-japanese-investors-e11-million-raises-additional-e700000/); [CB Insights](https://www.cbinsights.com/company/virtusize)). | Garment-to-garment comparison, a good model for "compare to a kurta you already own". |
| **Sizebay** (Brazil) | **Acquired by Audaces** (Jul 2024). Serves Renner, Riachuelo and Netshoes ([Sizebay](https://sizebay.com/en/blog/sizebay-is-acquired-by-audaces-as-part-of-global-expansion-strategy/)). | **The best analogue for Forme:** a regional, emerging-market fit tool whose realistic exit was a fashion-software acquirer, not a VC-scale IPO. |
| **3DLOOK** (US/Ukraine) | $6.5m Series A (2021). Launched FitXpress pose validation in Sept 2025 ([FITT Insider](https://insider.fitt.co/press-release/3dlook-launches-ai-powered-real-time-pose-validation-for-fitxpress/)). | Photo-based body scanning. More accurate inputs, higher friction. |
| **Kiwi Sizing** (Shopify app) | Free tier, then roughly $7.50–$15/month plus order-volume charges. 4.7★ from about 1,200 reviews ([Shopify App Store](https://apps.shopify.com/kiwi-sizing?locale=en)). | **The real price anchor for Pakistani Shopify brands.** A brand can add a size chart and simple recommender for under Rs 5,000/month today. |
| **Amazon / Myntra / Zalando in-house** | See 3.6. | Large platforms build this themselves. Daraz has Alibaba's tech. |
| **Pakistan local** | **No dedicated Pakistani size/fit startup was found** in searches. Adjacent players include COD/returns tools (PostEx, Markaz guides, COD verifiers) and marketplaces (Daraz, LAAM). | No local competitor means open space, or a sign that demand has not been strong enough to support one. The panel was split on which. |
| **India (regional)** | MirrorSize, Size n Fit (Bengaluru, ~6 staff), Bigthinx, The Body Match ([Retail4Growth](https://www.retail4growth.com/products/mirrorsize-india-launches-3d-body-scanning-tech-4381); [PitchBook](https://pitchbook.com/profiles/company/399524-41); [YourStory](https://yourstory.com/2025/04/chennai-startup-recuding-apparel-return-rate-with-ai-the-body-match)). Mint (Oct 2025): Indian fashion-tech firms "struggle for funding fit". Of the top 50, only one reached Series B ([Magzter reprint](https://www.magzter.com/en/stories/newspaper/Mint-Kolkata/FASHION-TECH-FIRMS-STRUGGLE-FOR-FUNDING-FIT)). | Even in a market about 8× larger, independent fit startups stay small. |

---

## 4. Landing-page claim audit

| Claim on the site | Panel finding |
|---|---|
| "**30–40%** of online apparel orders are commonly reported as returned" | Plausible globally and for Indian fashion. **No source is given, and the figure is not Pakistan-specific.** The number is also injected by JavaScript: without JS (crawlers, link previews, the fetch the panel ran), the page reads "**0–40%**" and "**~0%+**". |
| "**~50%+** of those returns are usually put down to size or fit" | Survey sources say 40–70%, and Zalando says about a third. The claim is defensible as a range only if sourced. It is not shown for Pakistan, where most failed orders are COD refusals before try-on. |
| "**2× logistics cost** on every return" | **No source was found.** Remove it or replace it with a sourced or customer-specific figure. |
| "**<50 ms** engine response" | Likely true for server-side compute. Not true end-to-end from Karachi or Lahore to a Vercel region. Say "engine compute" or publish a measured p95. |
| Hero mock-up "**M · 94%**" | Reads as a probability of fit. The confidence score is uncalibrated (E2). |
| "**One profile, every store** … works across every retailer on the network" | **There is no network yet.** The README admits browsers isolate storage per site, so this is currently false as a shopper experience. |
| "**Learns from returns** … recalibrates each product automatically" | True in code (scalar shift). Fine if worded modestly. |
| "**Built for enterprise review**" | No privacy policy, DPA, uptime history, SSO, or persistent database on Vercel. Overstated. |
| "Create your own account **in under a minute**" | The README says sign-ups are not persisted on Vercel. Fix this or caveat it. |
| "**Pay for outcomes, not seats**" with Growth at "**₹0.40 / recommendation**" | Self-contradictory: per-recommendation is a usage charge, not an outcome charge. Also in **Indian rupees (₹)**, which is wrong for a Pakistan-first product. |
| ROI scenarios "**Cautious 15% / Expected 25% / Strong 35%**" | 2–4× higher than Zalando's measured 8–10% and the 3.8–6.6% A/B results. The default of 250,000 orders/month is larger than nearly every Pakistani brand. |
| Marquee: "Marketplaces ✦ D2C brands ✦ Department stores ✦ **Quick commerce** ✦ **Resale platforms** ✦ **Uniform suppliers** …" | Visually reads like a customer-logo strip. Quick commerce is not a meaningful Pakistani fashion channel. Label it "Built for" or cut it. |
| "Start 30-day trial" | No billing exists. Say "Request a pilot". |

---

## 5. Panel composition

| # | Persona group | n |
|---|---|---|
| 1 | Pakistani seed VCs (the type at Indus Valley Capital, Sarmayacar, Zayn VC, Fatima Gobi, i2i-style programmes) | 12 |
| 2 | Pakistani angels and ex-founders (incl. ex-D2C operators) | 8 |
| 3 | Global SaaS / commerce-tech VCs | 8 |
| 4 | Gulf/MENA VCs active in Pakistan | 5 |
| 5 | Marketplace category and product leads (Daraz, LAAM-type) | 7 |
| 6 | E-commerce heads at large Pakistani apparel brands (Khaadi, Sapphire, Gul Ahmed/Ideas, J., Outfitters, Breakout, Bonanza Satrangi, Limelight, Alkaram, Nishat Linen, Engine, Cougar tier) | 12 |
| 7 | Mid-size and Instagram-first D2C founders (Shopify stores) | 10 |
| 8 | Logistics/COD experts (Leopards, TCS, PostEx, Trax, M&P, Call Courier backgrounds) | 8 |
| 9 | ML / data scientists (recsys, sizing) | 6 |
| 10 | Pattern makers / garment technologists (Pakistani pret and export garment sector) | 7 |
| 11 | Enterprise IT, procurement and infosec reviewers | 5 |
| 12 | Privacy / legal (PDPB, PECA, consumer protection, GDPR for diaspora) | 4 |
| 13 | Shopify / e-commerce agencies and platform partners | 4 |
| 14 | Skeptics and ex-fit-tech operators | 4 |
| | **Total** | **100** |

**How to read the scores.** All scores are 1–10. "Team" is execution-risk adjusted, so higher means lower risk, assuming a solo first-time founder. **Invest** means an investor would write a cheque now, or a buyer would sign a paid contract. **Pilot** means a free or low-cost trial, or a follow-up meeting tied to specific milestones. **Pass** means neither.

---

## 6. Results by persona group

### 1. Pakistani seed VCs (n = 12)
| Problem | WTP | Moat | Tech | GTM | Team | Verdict (I/P/X) |
|---|---|---|---|---|---|---|
| 6.4 | 3.6 | 2.8 | 4.6 | 3.8 | 3.3 | 1 / 3 / 8 |

- *"The pain in Pakistan is RTO. Show me what share of RTO is size, with your own pilot data, and I'll take the meeting again. Right now you're pitching Zalando's problem to a COD market."*
- *"A beautiful demo with zero customers and a ₹ sign on the pricing page. Ship the PKR version, get three Lahore brands live, and come back with a before/after."*

### 2. Pakistani angels and ex-founders (n = 8)
| 6.8 | 4.0 | 3.0 | 4.9 | 4.4 | 3.6 | 1 / 3 / 4 |
|---|---|---|---|---|---|---|

- *"When I ran my brand, exchanges for size were maybe a third of our reverse parcels, and they killed margin on sale days. I'd put a small cheque in if you pick one niche, like women's pret kurtas, and become the best at that."*
- *"Solo founder, B2B enterprise sales, Pakistani brands that pay late. That's three risks stacked. Get a co-founder who has sold to Khaadi-tier marketing teams."*

### 3. Global SaaS / commerce-tech VCs (n = 8)
| 5.6 | 3.2 | 2.3 | 4.5 | 3.0 | 2.9 | 0 / 0 / 8 |
|---|---|---|---|---|---|---|

- *"The category has a decade of history: True Fit, Fit Analytics, Sizebay. The exits were modest or went back to the founders. A Pakistan-only fit tool is a small market with a small ACV."*
- *"No proprietary data, no network, heuristic model. The moat slide is aspirational."*

### 4. Gulf/MENA VCs active in Pakistan (n = 5)
| 6.0 | 3.6 | 2.6 | 4.6 | 3.6 | 3.0 | 0 / 1 / 4 |
|---|---|---|---|---|---|---|

- *"The interesting angle is diaspora. Pakistani brands shipping to Dubai, London and Toronto pay a fortune on international returns. Make that your wedge and the ACV story changes."*

### 5. Marketplace category and product leads (n = 7)
| 6.2 | 2.8 | 2.2 | 4.0 | 2.8 | 2.6 | 0 / 2 / 5 |
|---|---|---|---|---|---|---|

- *"Most of our fashion GMV is unstitched. There's no size to recommend. For pret, we'd build a height/weight-to-chart lookup in a sprint, and the parent company has far bigger recommender teams."*
- *"A multi-brand marketplace has exactly the cross-brand sizing mess you solve. I'd pilot on one category if you handle the size-chart cleanup for our sellers. Their charts are the problem."* (a LAAM-type persona)

### 6. E-commerce heads at large Pakistani apparel brands (n = 12)
| 7.0 | 4.2 | 3.0 | 4.6 | 4.6 | 3.4 | 0 / 6 / 6 |
|---|---|---|---|---|---|---|

- *"Our customers absolutely ask 'what size should I take?' on WhatsApp. If your widget reduces those chats and exchanges, I'll test it on pret for 6 weeks, free, with a holdout."*
- *"Your engine doesn't know a kameez from a T-shirt. Our sizing questions are shoulder, chest, length and sleeve, and they vary by cut (A-line, straight, angrakha). Until that's in, it's a Western demo."*
- *"Security review? We'll want a privacy policy, data hosted where we're comfortable, and no shopper data used for other brands without consent. The 'network' idea makes our legal team nervous."*

### 7. Mid-size and Instagram-first D2C founders (n = 10)
| 7.2 | 3.8 | 3.2 | 5.2 | 5.4 | 4.0 | 1 / 6 / 3 |
|---|---|---|---|---|---|---|

- *"One script tag on Shopify is exactly what I can handle. But I pay Kiwi under ten dollars a month. Rs 1.3 per recommendation on 200k product views is more than my courier bill. Give me a flat Rs 5–10k plan."*
- *"I'd try it tomorrow if it also told me which of my products run small. That's my real headache: one bad batch from the factory and I get 40 exchanges."*

### 8. Logistics / COD experts (n = 8)
| 5.4 | 3.4 | 2.6 | 4.4 | 3.8 | 3.2 | 0 / 2 / 6 |
|---|---|---|---|---|---|---|

- *"Most refusals we see are 'customer not available', 'didn't order', or 'changed mind'. Size is a minority, and most couriers don't allow opening the parcel, so the customer never tries it before refusing."*
- *"If you want to be useful, plug into the exchange flow. A size-swap at the doorstep or a pre-dispatch WhatsApp size confirmation is where size and logistics actually meet."*

### 9. ML / data scientists (n = 6)
| 6.5 | 3.8 | 2.3 | 3.4 | 3.8 | 3.3 | 0 / 2 / 4 |
|---|---|---|---|---|---|---|

- *"There's no sex variable, and the hip estimate for a 165 cm woman is male-shaped. The confidence is a penalty rescaled to look like a percentage. No offline accuracy, no calibration plot. Today it's a rules engine dressed as AI."*
- *"The good news is that the problem is tractable. Collect 2,000 'kept size' labels per brand and fit an ordinal model per category. Zalando's SizeFlags shows that product-level flags alone move returns."*

### 10. Pattern makers / garment technologists (n = 7)
| 7.6 | 4.0 | 3.0 | 3.0 | 4.0 | 3.3 | 0 / 2 / 5 |
|---|---|---|---|---|---|---|

- *"Brand size charts here are often copied from a previous season. Grading is inconsistent, and the factory's tolerance is ±1 inch. Your engine trusts the chart to the millimetre. Start by measuring finished garments."*
- *"Ease isn't one number. A lawn kurta and a khaddar kameez of the same size wear completely differently. Fabric and cut need to be inputs."*

### 11. Enterprise IT, procurement and infosec (n = 5)
| 5.6 | 3.6 | 2.8 | 5.0 | 3.0 | 2.4 | 0 / 1 / 4 |
|---|---|---|---|---|---|---|

- *"Credit where due: hashed keys, origin locks and CSP are better than most vendors we see. But SQLite on serverless with no persistence, no backups, no SLA, a one-person bus factor, and a 'Status' link to a JSON endpoint is a hard no for production."*

### 12. Privacy / legal (n = 4)
| 6.0 | 3.8 | 3.0 | 4.8 | 4.2 | 3.0 | 0 / 2 / 2 |
|---|---|---|---|---|---|---|

- *"Pakistan has no data-protection law in force, which lowers your burden today. But your clients' UK and UAE storefronts bring GDPR and PDPL. A widget storing body measurements with no consent text and no privacy notice is fixable in a week. Fix it."*
- *"Don't promise 'one profile, every store' until you have explicit shopper consent for cross-merchant sharing. That is the part regulators and brand lawyers will object to."*

### 13. Shopify / e-commerce agencies and platform partners (n = 4)
| 6.8 | 4.4 | 2.8 | 5.6 | 5.8 | 4.0 | 0 / 3 / 1 |
|---|---|---|---|---|---|---|

- *"Package it as a Shopify app with a theme block and PKR billing, and we can put it in front of 30 brands in a quarter. The API is clean, and integration really is an afternoon."*

### 14. Skeptics and ex-fit-tech operators (n = 4)
| 4.8 | 2.4 | 1.6 | 4.0 | 2.4 | 2.4 | 0 / 0 / 4 |
|---|---|---|---|---|---|---|

- *"I've seen this movie. The widget gets about 5% engagement, the shoppers who use it were already careful, and the 'followed vs ignored' return comparison is pure selection bias. You need a randomised holdout or you're fooling yourself and your customer."*
- *"Shoppers bracket and wardrobe on purpose. Zalando's own paper found size advice *increased* multi-size orders. Your ROI calculator assumes the opposite."*

---

## 7. Aggregate results

### 7.1 Mean score per criterion (weighted by group size)
| Criterion | Mean | Range across groups |
|---|---|---|
| Problem severity | **6.4** | 4.8 (skeptics) to 7.6 (pattern makers) |
| Willingness to pay | **3.7** | 2.4 to 4.4 |
| Differentiation / moat | **2.7** | 1.6 to 3.2 |
| Technical credibility | **4.5** | 3.0 (pattern makers) to 5.6 (agencies) |
| Go-to-market feasibility | **4.0** | 2.4 to 5.8 |
| Team / execution risk | **3.2** | 2.4 to 4.0 |
| **Overall** | **4.1** | 2.9 (skeptics) to 4.9 (agencies) |

### 7.2 Verdict totals
**Invest 3 · Pilot 33 · Pass 64.** The 3 Invest votes came from one Pakistani seed VC, one angel/ex-founder and one D2C founder. All three made their cheque conditional on niche focus. 27 of the 33 Pilot votes came from operators (brand heads, D2C founders, agencies, marketplace leads, logistics), not investors.

### 7.3 Top 5 reasons for Pass
1. **Wrong problem for the market.** In COD-heavy Pakistan, most failed orders are refusals before try-on. Size-driven post-delivery exchanges are a smaller, unmeasured slice. (Cited by 41 Pass votes.)
2. **No moat.** A heuristic engine, no proprietary data, no network yet, global incumbents with years of data, and big platforms that build in-house. (38)
3. **Unproven and inflated impact claims.** No pilot, no accuracy number, and ROI scenarios 2–4× above the best published evidence. (33)
4. **Small, price-sensitive buyer pool with weak unit economics.** About 70% of marketplace fashion is unstitched. Brands anchor on Kiwi-style $10/month tools. Per-recommendation pricing can cost more than the savings. (29)
5. **Solo first-time founder selling enterprise B2B.** No domain co-founder, no garment-tech expertise, no production infrastructure. (24)

### 7.4 Top 5 things that would flip a Pass to Pilot
1. **A measured result from a real randomised holdout** (widget shown vs hidden) at 2–3 Pakistani brands, reporting size-exchange rate, conversion and RTO.
2. **A Pakistan-native fit model:** sex/body-shape input, kameez/kurta/shalwar/trouser categories with cut and fabric, and a published top-1 accuracy against shoppers' known kept sizes.
3. **A wedge with expensive returns:** cross-border/diaspora orders for Pakistani brands, or multi-brand marketplaces with chaotic charts.
4. **A product-level "runs small / runs large" and size-chart QA tool** that works with zero shopper input. This is the SizeFlags lesson, and it sells to merchandising teams.
5. **PKR pricing that is clearly cheaper than the savings** (a flat monthly plan or per influenced order), plus a privacy notice, consent text, DPA template and persistent hosting.

### 7.5 Biggest existential risk
**There may not be enough profit in the gap.** For a typical Pakistani pret brand, the realistic avoided-cost pool from size advice is a few lakh rupees a year (section 8). That has to fund Forme's revenue and still leave a visible ROI. Large players who could pay more can build it themselves or license True Fit. If fit advice does not also produce a **measurable conversion lift** or win **high-cost international orders**, Forme risks becoming a feature that brands won't pay enough for.

---

## 8. Pricing and ROI in PKR

### 8.1 Why ₹0.40 per recommendation fails here
- ₹0.40 is roughly **Rs 1.2–1.4** at 2026 exchange rates (approximate).
- Take a mid-size brand with 15,000 orders/month at about a 1.5% conversion rate. That is about **1,000,000 product-page views a month**. If even 20% of those render a recommendation for a profiled shopper, the bill is about **Rs 2.6 lakh/month**.
- The realistic savings (below) are about **Rs 45,000/month**. **Per-recommendation pricing costs about 5× the savings.** Even at 5% render share, it roughly equals the savings. The batch endpoint (up to 60 SKUs per listing page) makes this worse if each item is billed.

### 8.2 Panel's realistic ROI example (to replace the site default)
| Input | Value | Basis |
|---|---|---|
| Monthly online orders | 15,000 | mid-size Pakistani pret brand (assumption) |
| Average order value | Rs 5,500 | typical pret kurta/2-piece price band (assumption) |
| Post-delivery return/exchange rate | 12% | excludes pre-delivery COD refusals (assumption, verify) |
| Share caused by size | 45% | global surveys 33–70% (section 3.6) |
| Size returns/month | **810** | |
| Reduction from Forme | **10%** | upper end of Zalando's measured 8–10% |
| Returns avoided/month | **81** | |
| Cost per exchange | Rs 550 | two-way courier, inspection, repack (assumption) |
| **Savings/month** | **≈ Rs 44,600** | **≈ Rs 5.3 lakh/year** |

The same inputs with the site's "Expected 25%" give about Rs 13.4 lakh/year, which is still small. The site's default (250,000 orders, ₹450 per return, 25%) shows a figure in crores that no Pakistani prospect will recognise.

### 8.3 Recommended pricing to test (placeholders)
| Plan | Price | Notes |
|---|---|---|
| **Free** | Rs 0, up to 300 influenced orders/month | Size chart, widget, product "runs small/large" flags |
| **Growth** | **Rs 9,999/month flat** (up to 3,000 influenced orders), then **Rs 4 per influenced order** | "Influenced order" means an order containing an item the shopper sized with Forme. Billing tied to orders, not views. Undercuts the savings with visible margin. |
| **Brand / Marketplace** | Custom: annual licence, or a share of savings **measured against a randomised holdout** | Includes chart QA, a garment-measurement audit, SLA and a DPA |
| **International storefront add-on** | Priced per influenced cross-border order (e.g. Rs 25–50) | Where a single avoided return can be worth Rs 5,000 or more |

Returns savings alone justify only about **Rs 3–8 per influenced order**. Anything above that has to be justified by a measured conversion lift, so measure conversion in every pilot.

---

## 9. 90-day plan the panel wants to see

**Days 1–30: make it true and make it Pakistani**
1. Switch every price and the ROI calculator to **PKR (Rs)**, with realistic Pakistani defaults and 5/10/15% scenarios (section 10).
2. Add **sex/body-shape** input and **kameez/kurta, shalwar/trouser (straight, cigarette, culotte, elastic), and kids** categories, with cut and fabric-ease parameters. Make kameez length a preference (short/medium/long), not a formula.
3. Move to **Postgres** with backups and monitoring. Fix sign-up persistence. Publish a **privacy notice**, add **consent text** in the widget, and write a **one-page DPA template** that covers GDPR/UK/UAE for diaspora storefronts.
4. Recruit an advisor or co-founder with **garment technology / pret production** experience. Ask a seed VC to introduce a brand-side operator.

**Days 31–60: get ground truth**
5. Sign **3 pilots** (two mid-size Shopify pret brands plus one larger brand or a LAAM-type marketplace), free, with a **randomised 50/50 holdout** at the shopper level.
6. **Measure finished garments** for the pilot SKUs (20–40 SKUs per brand, 3 pieces per size). Publish a "chart vs garment" audit to each brand. This is valuable on its own.
7. Collect **"what size do you usually keep in Brand X?"** labels from shoppers to build a top-1 accuracy benchmark. Target 1,500+ labels. Report accuracy and a calibration plot for the confidence score.
8. Tag every reverse parcel by reason (RTO before try-on vs size exchange vs other) with the brand's courier data. This produces the first real figure for **"share of Pakistani fashion RTO/returns caused by size."**

**Days 61–90: prove it and package it**
9. Report results for each pilot: size-exchange rate, conversion rate, RTO and WhatsApp size queries, test vs control, with confidence intervals. Turn results into **one-page case studies**, even if the effect is small.
10. Ship a **Shopify app** (theme app block, PKR billing) and a product-level **"Fit flags" dashboard** (runs small/large per SKU).
11. Run a **diaspora experiment** on one brand's international storefront.
12. Only then, approach **Sapphire/Khaadi-tier brands and Daraz/LAAM**, with case studies, a security pack and an SLA.

**Pilot success bar the panel would accept:** a **statistically significant reduction in size exchanges of 8% or more** against holdout, **no conversion drop**, and at least one brand willing to pay after the pilot.

---

## 10. Recommended website changes (exact text)

| Where | Current | Replace with |
|---|---|---|
| Positioning (meta description and hero sub-copy) | "Forme gives every shopper one portable fit profile and tells them the right size for every product…" | "**Size advice built for Pakistani fashion.** Forme turns your size charts and your customers' keep/exchange history into a clear size for every kurta, kameez and pair of trousers, so fewer parcels come back." |
| Hero stat row | "3 questions to a size · <50 ms engine response · 1 script tag" | "3 questions to a size · **Shopify-ready in an afternoon** · **Prices in PKR**" (drop "<50 ms" or say "<50 ms engine compute") |
| Hero widget mock-up | "M · 94%" / "Strong" | "**M · Strong match** (estimated from height & weight)". Avoid percentages until confidence is calibrated. |
| Problem stats | "30–40% … returned" / "~50%+ … size or fit" / "2× logistics cost" | "**Up to 1 in 3** online fashion orders in South Asia come back, as refusals, returns or exchanges.¹" · "**Size and fit** is the most-cited reason for post-delivery returns worldwide.²" · "**Every exchange costs you two courier trips**, and often the sale." Add footnotes with sources (e.g. ¹ Apparel Resources/Return Prime 2024; ² Coresight 2023). **Render numbers in the HTML**, not only via JS. |
| Disclaimer under stats | "Ranges are widely cited industry estimates…" | "Figures vary by brand and category. In Pakistan, many failed orders are COD refusals before try-on, which size advice does not fix. Use the calculator with your own exchange numbers." |
| Marquee | "Marketplaces ✦ D2C brands ✦ … Quick commerce ✦ Resale platforms ✦ Uniform suppliers …" | Label it "**Built for:** Women's pret ✦ Menswear & kurtas ✦ Kidswear ✦ Multi-brand marketplaces ✦ International storefronts". Remove quick commerce and resale. |
| "How it works" step 1 | "Tops, bottoms and dresses, any size labels." | "**Kameez, kurtas, shirts, trousers, shalwar and dresses**, with any size labels." (Ship the categories first.) |
| "One profile, every store" card | "A shopper's Forme profile token works across every retailer on the network…" | "**Saved fit profile.** Shoppers answer once and get a size on every product in your store. *Cross-store profiles with Forme sign-in are coming soon.*" |
| Security card title | "Built for enterprise review" | "**Privacy by design**", plus a link to a real privacy policy and DPA |
| ROI calculator defaults | 250,000 orders · ₹1,600 AOV · 28% · 50% · ₹450 · scenarios 15/25/35% | **15,000 orders · Rs 5,500 AOV · 12% post-delivery returns/exchanges · 45% size share · Rs 550 per exchange · scenarios 5% / 10% / 15%** labelled "Conservative / Typical (published benchmarks) / Best case". Add a note: "*Published results for size advice: 4–10% fewer size-related returns (Zalando, 2021–2025).*" |
| ROI footnote | "'Revenue kept' assumes half of avoided returns would otherwise have been refunded…" | "Most Pakistani brands offer exchanges rather than refunds, so savings here are mainly courier and handling costs. We'll measure the real number in a free pilot with a control group." |
| Pricing heading | "Pay for outcomes, not seats." | "**Simple pricing in rupees. Pay when it's used on real orders.**" |
| Starter | "₹0 /month · Up to 5,000 recommendations / mo" | "**Rs 0/month** · Up to 300 sized orders/month · Widget, size charts, 'runs small/large' flags" |
| Growth | "₹0.40 /recommendation … Start 30-day trial" | "**Rs 9,999/month** · Up to 3,000 sized orders, then Rs 4 per sized order · Keep/exchange calibration · Listing-page sizes · WhatsApp & email support · **[Request a free pilot]**" |
| Enterprise | "Share of measured return savings · Dedicated deployment and data residency · SLA, SSO and security review…" | "**Brands & marketplaces: custom.** Share of savings measured against a control group · Garment-measurement audit · SLA and DPA · International storefront support" |
| Final CTA | "…or create your own account in under a minute." | "Explore the demo workspace, or **book a free 6-week pilot** on one category." (Restore self-serve sign-up once persistence is fixed.) |
| Footer | "Status" → `/v1/health` | Link to a proper status page, or label it "API health". Add "Privacy" and "Terms" links. Add "Made in Pakistan" if desired. |
| Currency sitewide | ₹ in `index.html` (lines 189, 194, 195, 279, 286) and the `money()` formatter in `landing.js` | **Rs** with Pakistani lakh/crore grouping (e.g. "Rs 5.3 lakh"). |

Related internal edits (not website): `BUSINESS.md` still says "India-first", names Myntra/Amazon as the main in-house threats, and prices in ₹. Update it to Pakistan (Daraz/LAAM/top brands, PKR, PDPB/PECA), with India as a later expansion market.

---

## 11. Sources

**Pakistan market, COD, logistics, tax**
- Profit / Pakistan Today, e-commerce at $7.7bn in 2024: https://profit.pakistantoday.com.pk/2025/03/29/pakistans-e-commerce-sector-hits-7-7bn-in-2024-smes-face-challenges-in-tapping-global-market-report/
- ECDB, Pakistan fashion e-commerce: https://ecdb.com/resources/sample-data/market/pk/fashion
- Gallup & Gilani survey via ProPakistani: https://propakistani.pk/2025/12/12/91-pakistanis-didnt-shop-online-in-first-half-of-2025-survey/ and Dawn: https://www.dawn.com/news/1962597
- CW Pakistan, Karandaaz/PostEx digital COD pilot: https://cwpakistan.com/pakistan-e-commerce-gets-digital-cod-makeover-karandaaz-and-postex-pilot/
- ProPakistani, 95% COD (2018): https://propakistani.pk/2018/06/28/95-of-e-commerce-transactions-in-pakistan-are-cash-on-delivery-report/
- DHL Pakistan, reducing COD returns: https://www.dhl.com/discover/en-pk/e-commerce-advice/e-commerce-best-practice/subscription-marketing/how-pakistani-e-commerce-sellers-can-reduce-cod-returns
- Markaz, COD return rates in Pakistan: https://www.markaz.app/blog-post/cod-return-rates-in-pakistan-how-to-reduce-them
- Leopards COD page: https://leopardscourier.com/services/cod
- KPMG, Finance Act 2025 brief: https://assets.kpmg.com/content/dam/kpmg/pk/pdf/2025/07/A-Brief-on-Finance-Act-2025.pdf
- Profit, courier taxes and e-commerce costs: https://profit.pakistantoday.com.pk/?p=203554
- ARY, courier charges revised: https://arynews.tv/excise-department-revises-courier-service-charges-amid-inflation
- CW Pakistan, FBR COD cash cap: https://cwpakistan.com/fbr-caps-cash-on-delivery-payments-for-e-commerce-orders-at-rs-200000/
- Khaleej Times, PostEx $7.3m: https://khaleejtimes.com/business/leading-pakistan-fintech-raises-7-3-million-to-drive-gcc-expansion
- CW Pakistan, Daraz 70% unstitched / 30% pret: https://cwpakistan.com/daraz-pakistan-transforms-fashion-retail-with-e-commerce-and-small-scale-manufacturer-partnerships/
- Aurora, unstitched vs pret (2017): https://aurora.dawn.com/news/1141213 · plus-size gap: https://aurora.dawn.com/news/1144814
- Alkaram Studio, unstitched vs RTW: https://www.alkaramstudio.com/blogs/pages/unstitched-suits-vs-ready-to-wear
- Trustpilot, Ethnic by Outfitters reviews (sizing complaint): https://ca.trustpilot.com/review/ethnic.pk
- TechCrunch, LAAM $5.5m: https://techcrunch.com/2024/12/11/laam-lands-5-5m-to-provide-south-asian-fashions-to-migrants-around-the-world · ProPakistani: https://propakistani.pk/2024/12/12/fashion-marketplace-laam-raises-5-5-million-led-by-shark-tank-judge-faisal-aftabs-zayn-vc/
- Dawn, Daraz layoffs: https://dawn.com/news/1817510/alibabas-south-asian-e-commerce-giant-daraz-announces-layoffs-in-memo · Arab News: https://arab.news/y35kk

**Pakistan regulation and funding**
- Arab News, tech coalition on data bill: https://www.arabnews.pk/node/2344396/pakistan
- Express Tribune, Oct 2026: https://tribune.com.pk/story/2625470/pakistan-can-no-longer-wait-for-personal-data-protection-law
- RecordingLaw, Pakistan data privacy summary: https://www.recordinglaw.com/world-laws/world-data-privacy-laws/pakistan-data-privacy-laws/
- DLA Piper, Data protection in Pakistan: https://www.dlapiperdataprotection.com/?c=PK
- ARY, PECA Amendment 2025 key points: https://arynews.tv/peca-amendment-act-2025-the-key-points/
- Nukta, funding down 88%: https://nukta.com/pakistan-startup-sector-funding
- startup.pk, 2025 funding: https://startup.pk/pakistan-startup-funding-in-2025-reading-between-the-numbers/
- Business Recorder, 2025 funding: https://www.brecorder.com/news/40407474
- TechJuice, Q1 2025: https://www.techjuice.pk/?p=171158

**Global evidence and competitors**
- Zalando returns: https://corporate.zalando.com/en/node/10413 · size tech: https://corporate.zalando.com/en/node/10416
- SizeFlags (KDD 2021): https://arxiv.org/pdf/2106.03532
- Coresight, true cost of apparel returns: https://coresight.com/research/the-true-cost-of-apparel-returns/
- About Amazon, AI for shopping: https://aboutamazon.com/news/retail/how-amazon-is-using-ai-to-help-customers-shop · Retail TouchPoints: https://www.retailtouchpoints.com/?p=139977
- YourStory, Myntra CEO on AI (Nov 2025): https://yourstory.com/2025/11/ai-becomes-myntras-growth-engine-ceo-nandita-sinha
- Myntra sizing research: https://arxiv.org/pdf/1906.12128v1.pdf
- Apparel Resources, India returns (Return Prime): https://apparelresources.com/business-news/retail/third-online-bought-fashion-footwear-products-get-returned-says-report/
- TechCrunch, True Fit Series C: https://techcrunch.com/?p=1586620 · multiples.vc: https://multiples.vc/private-comps/true-fit · True Fit Fit Hub: https://www.businesswire.com/news/home/20240605922431/en/True-Fits-New-Generative-AI-Fit-Hub-Conveniently-Synthesizes-All-Size-Fit-Information-To-Solve-Online-Fit-Challenges-for-Fashion-Retailers
- Fit Analytics reacquires IP from Snap: https://www.yahoo.com/lifestyle/fit-analytics-reacquires-ip-snap-145138494.html · StartupIM: https://startupim.com/company/fit-analytics-innovation-gmbh
- Bold Metrics Series A: https://www.venturecapitaljournal.com/bold-metrics-lands-8m-series-a/
- Virtusize sale (2018): https://tech.eu/2018/06/20/swedish-fashion-tech-startup-virtusize-sells-japanese-investors-e11-million-raises-additional-e700000/ · CB Insights: https://www.cbinsights.com/company/virtusize
- Sizebay acquired by Audaces: https://sizebay.com/en/blog/sizebay-is-acquired-by-audaces-as-part-of-global-expansion-strategy/
- 3DLOOK FitXpress (2025): https://insider.fitt.co/press-release/3dlook-launches-ai-powered-real-time-pose-validation-for-fitxpress/
- Kiwi Sizing on Shopify: https://apps.shopify.com/kiwi-sizing?locale=en
- India fit startups: MirrorSize https://www.retail4growth.com/products/mirrorsize-india-launches-3d-body-scanning-tech-4381 · Size n Fit https://pitchbook.com/profiles/company/399524-41 · The Body Match https://yourstory.com/2025/04/chennai-startup-recuding-apparel-return-rate-with-ai-the-body-match · Mint via Magzter https://www.magzter.com/en/stories/newspaper/Mint-Kolkata/FASHION-TECH-FIRMS-STRUGGLE-FOR-FUNDING-FIT

**Source caveats.** Several figures come from search-result summaries of pages that could not be fully loaded (e.g. YourStory and Mint returned 403 or paywalls). Pakistani return and RTO rates come from vendor blogs, not audited data. Courier costs, AOV and exchange costs in section 8 are panel assumptions and should be replaced with real quotes from pilot brands.

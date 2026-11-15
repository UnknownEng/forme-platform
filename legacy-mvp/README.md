# Forme fit platform

Forme is a runnable local MVP based on the video concept: one personal fit profile, size estimates for different clothing brands, and a retailer workspace for product size charts.

## Run it

Install Node.js 18 or later, then open this folder in a terminal and run:

```sh
npm start
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173).

There are no third-party runtime packages to install. The app is served only on this computer.

Run the isolated backend checks with:

```sh
npm run test:backend
```

## What works

- Update height, chest, waist, shoulders, and preferred fit.
- Search and filter a sample apparel catalog.
- See a size estimate for each item, based on its product chart, height, other measurements, garment cut, and fit preference.
- See size suggestions update live while editing measurements or a retailer's full size chart.
- Save pieces, select a size, and add items to the local sample bag.
- Add, edit, and remove products and their full XS–XL garment charts (chest, waist, shoulders, and length) in the retailer workspace.
- Export the current catalog as JSON.
- Shopper measurements, saved pieces, and bag contents stay in this browser. Retailer catalog edits are stored in `data/catalog.json` on this computer.

## Scope

This is an MVP, not a public production service. The included products and charts are illustrative. There is no account system, remote retailer integration, live inventory, checkout, or payment processing. The sample match is a simple estimate using garment chest, waist, and shoulder measurements; real brand charts should be verified before using recommendations with customers. The built-in server listens on `127.0.0.1` and is intended for local use.

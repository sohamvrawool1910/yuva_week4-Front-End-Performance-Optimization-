# Week 4 – Frontend Performance Optimisation (Wanderlust)

```
before/     Unoptimised baseline (10 MB of images, blocking JS, 1,200 DOM reviews)
src/        Readable sources for the optimised page
after/      Built, optimised output (fingerprinted, minified, responsive images)
tools/      build.js, serve.js, measure.js, extra.js, results.json
REPORT.md   Before/after analysis
docs/       Word version of the report
```

## Run
```bash
node tools/serve.js after 8080 optimised     # http://localhost:8080
node tools/serve.js before 8081 naive        # http://localhost:8081
```

## Rebuild and measure
```bash
npm i sharp playwright && npx playwright install chromium
node tools/build.js
node tools/measure.js 3
node tools/extra.js
```

## Deploy `after/`
Netlify/Cloudflare Pages read `_headers`; Apache reads `.htaccess`.

## Publish
```bash
git init && git add . && git commit -m "Week 4: performance optimisation"
git branch -M main
git remote add origin https://github.com/sohamvrawool1910/week4-performance.git
git push -u origin main
```

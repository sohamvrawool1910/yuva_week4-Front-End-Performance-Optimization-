# Week 4 – Frontend Performance Report

## 1. Project and goal
The project is **Wanderlust**, a travel landing page with a hero banner, eight destination cards and a long list of traveller reviews (1,200 entries). `before/` is a realistic but unoptimised baseline. `after/` is the optimised build generated from `src/` by `tools/build.js`. The goal was to find the bottlenecks, fix them, and measure the difference.

## 2. How performance was measured
Lighthouse and PageSpeed Insights could not be run in the build environment (no network access to PSI, and Lighthouse was not installed). Instead, `tools/measure.js` drives Chrome through Playwright and the DevTools Protocol with the same kind of throttling Lighthouse uses:

- Network: 4 Mbps down, 100 ms latency. CPU: 4x slowdown. Viewport: 412 x 823 (mobile).
- Median of 3 cold loads (cache disabled), plus one warm reload with the cache enabled.
- Metrics: First Contentful Paint (FCP), Largest Contentful Paint (LCP), load event, transferred bytes, request count, DOM node count, Cumulative Layout Shift (CLS) and long-task blocking time.
- The "before" page is served by a naive server (no compression, `no-cache`). The "after" page is served by a tuned server (Brotli, immutable caching), which mirrors the `_headers` and `.htaccess` files shipped in `after/`.

Reproduce: `node tools/build.js && node tools/measure.js 3 && node tools/extra.js`

## 3. Issues found in the baseline
| # | Issue | Impact |
|---|---|---|
| 1 | Nine JPEGs of 1.1 to 1.2 MB each (2000 to 2400 px wide) served to every device, about 10 MB in total | Very slow load and LCP; wasted mobile data |
| 2 | All images load eagerly, including those far below the fold | Competes with the hero for bandwidth |
| 3 | Hero image set as a CSS `background-image` | Discovered late, cannot be prioritised or given a srcset |
| 4 | No `width` and `height` on images | Layout shift risk |
| 5 | Blocking `<script>` in `<head>` that renders 1,200 reviews (about 6,000 DOM nodes) at once | 4.4 s of main-thread blocking at 4x CPU |
| 6 | `offsetHeight` read inside the render loop | Forced synchronous layout on every iteration |
| 7 | Un-throttled scroll handler reading layout for every review | Scroll jank |
| 8 | CSS uses `@import` and is unminified | Extra serial request, larger file |
| 9 | No compression and no cache headers | Repeat visits download everything again |

## 4. Optimisations applied
| Technique | What was done | Why it helps |
|---|---|---|
| Responsive images | `sharp` generates WebP at 480, 800 and 1200 px (hero: 640, 1200 and 1920 px) with a JPEG fallback, served through `<picture>` and `srcset`/`sizes` | The browser downloads only the size it needs, in a modern format |
| Lazy loading | `loading="lazy"` and `decoding="async"` on card images | Below-the-fold images are not fetched until needed |
| LCP priority | Hero is a real `<img>` with `fetchpriority="high"` and a matching `<link rel="preload">` | The browser starts the hero download immediately |
| Layout stability | Explicit `width` and `height` on every image | CLS stays at 0 |
| Async JS | Script loaded with `defer` | Nothing blocks HTML parsing |
| Code splitting | Reviews are a separate ES module, loaded with `import()` when `IntersectionObserver` sees the section within 400 px of the viewport | The initial page ships about 1 KB of JavaScript instead of running everything |
| Smaller DOM | Reviews render 12 at a time with a "Show more" button and a `DocumentFragment` | DOM drops from 6,066 to 98 nodes at load |
| No layout thrashing | Removed `offsetHeight` reads; one DOM write per batch | No forced synchronous layout |
| Scroll performance | Passive listener, `requestAnimationFrame` throttling, `transform` instead of `background-position` | Runs on the compositor; respects `prefers-reduced-motion` |
| Rendering hints | `content-visibility: auto` on cards and reviews | Off-screen content is skipped by the renderer |
| Minification | Custom build step strips comments and whitespace from CSS, JS and HTML; `@import` removed | Fewer bytes, one fewer request |
| Caching | Content-hashed file names (`style.0a663418.css`) with `Cache-Control: immutable`, 30 days for images, `no-cache` for HTML | Repeat visits transfer almost nothing |
| Compression | Brotli or gzip for text (configured in `_headers` and `.htaccess`) | Smaller text transfers |

## 5. Results (measured)
| Metric | Before | After | Change |
|---|---|---|---|
| Transferred (cold load) | 10,215 KB | 17.7 KB | -99.8% |
| Requests | 13 | 8 | -38% |
| First Contentful Paint | 576 ms | 336 ms | -42% |
| Largest Contentful Paint | 20,740 ms | 336 ms | -98% |
| Load event | 20,696 ms | 303 ms | -98% |
| DOM nodes | 6,066 | 98 | -98% |
| Main-thread blocking (long tasks) | 4,366 ms | 0 ms | -100% |
| CLS | 0 | 0 | none (before had no shift in this run) |
| Repeat visit transfer (warm) | 10,215 KB | 1.5 KB | -99.9% |
| After scrolling the whole page | 10,215 KB | 30 KB (13 requests, 158 nodes) | -99.7% |

## 6. Challenges and honest caveats
- **Synthetic images.** The test images are generated gradients with mild noise, so they compress far better than real photographs. Expect real photos to see roughly 70 to 90 percent savings, not 99.8 percent. The technique and the direction of the result are the same; the exact percentage is optimistic.
- **Lab conditions.** These are single-machine lab numbers with emulated throttling, not field data. LCP after the fix is 336 ms because the tiny hero image and the headline paint together; on real photos it would be higher.
- **Custom minifier.** Terser and esbuild were not available offline, so the build uses a small, conservative minifier that removes comments and whitespace but does not rename variables. A production project should use esbuild or Terser for further savings.
- **HTML is larger.** `after/index.html` (6 KB) is bigger than the baseline (3.3 KB) because it contains `srcset` markup. This is a good trade-off, and Brotli shrinks it.
- **Fake "before" headers.** The baseline is served without compression or caching to represent a misconfigured host. A well-configured host would narrow the gap for text files but not for images or the DOM and JavaScript costs.
- **Accessibility kept intact.** The lazy-loaded reviews use an `aria-live` status message and a real `<button>`; decorative hero image has `alt=""`.

## 7. Public tool scores (to fill in)
| Tool | Before | After |
|---|---|---|
| Lighthouse Performance (mobile) | ___ / 100 | ___ / 100 |
| PageSpeed Insights LCP / TBT / CLS | ___ | ___ |

Run `npx serve before` and `npx serve after`, then use Chrome DevTools > Lighthouse. Note that `npx serve` does not add Brotli or cache headers; use `node tools/serve.js after 8080 optimised` for a fair comparison.

## 8. Next steps
- Use a CDN with HTTP/2 or HTTP/3 and automatic Brotli.
- Add a service worker for offline support.
- Replace the custom minifier with esbuild.
- Consider AVIF images for another 20 to 30 percent saving on photos.

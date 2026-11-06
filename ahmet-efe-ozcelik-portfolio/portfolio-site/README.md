# Ahmet Efe Özçelik — Portfolio

A production-oriented, responsive personal portfolio centered on engineering, quality, technology and credible sustainability.

## Preview locally

No installation or build step is required.

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Files

- `index.html` — semantic content, SEO metadata and Person JSON-LD
- `styles.css` — complete responsive design system and reduced-motion support
- `script.js` — progressive interactions and a dependency-free procedural energy globe
- `CONTENT_PLAN.md` — architecture, source rules and growth model
- `DESIGN_SYSTEM.md` — visual tokens, components, accessibility and motion guidance
- `social-card.svg` / `favicon.svg` — lightweight brand assets
- `robots.txt` / `sitemap.xml` — launch templates

## Before publishing

1. Choose a production domain.
2. Add the canonical URL and update the Open Graph URL/image to absolute production URLs.
3. Replace `https://example.com/` in `sitemap.xml` and add its URL in `robots.txt`.
4. Convert `social-card.svg` to a 1200×630 PNG if the hosting/social platform does not accept SVG previews.
5. Recheck LinkedIn facts and dates, then update any role that has changed.
6. Deploy the folder to any static host (GitHub Pages, Cloudflare Pages, Netlify, Vercel static output or equivalent).

## Content safety

The site intentionally distinguishes public, profile-supported facts from development goals. Unknown project methods, metrics and results are labeled rather than inferred. No private contact detail is included.

## Performance approach

- Zero runtime/framework dependency
- No remote fonts, images, models or textures
- Small procedural canvas capped at 1.5× device pixel ratio
- Animation paused when the hero is offscreen
- Lower-complexity, static mobile canvas
- Semantic HTML and CSS-first visuals
- Progressive enhancement with IntersectionObserver

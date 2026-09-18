# Thando Thomo portfolio

An editorial portfolio for Thando Thomo's software engineering work. The site presents five projects through concise case summaries and project-specific conceptual illustrations.

Motion includes glossy water drops labelled with technologies used in this site or the featured work. They fall at varied positions and intervals over a calm, shaded water surface. Each impact sends perspective ripples across the surface; clicking the hero creates a drop at that position. The canvas pauses when the hero is offscreen and respects reduced-motion settings. Other sections use scroll reveals and animated system paths.

## Run locally

```powershell
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Add project screenshots

The projects live in `components/Work.tsx`. Vertigo uses the supplied screenshot at `public/work/vertigo.png`. The Trading Bot case has a linked, static dashboard interface preview at `/work/trading`, based on the supplied reference. It uses sample data and does not connect to a broker or place orders. The other projects use conceptual illustrations. To add another screenshot:

1. Put the image in `public/work/`, for example `public/work/force-life.png`.
2. Set that project's `screenshot` value to `/work/force-life.png`.
3. Keep the image's project name and description accurate, and remove or blur any private data before publishing.

Each project-specific conceptual illustration displays until a screenshot is provided. The illustrations are labelled as conceptual views, not product screenshots.

Replace the placeholder contact email in `components/Contact.tsx` before publishing.

# Thando Thomo portfolio

An editorial portfolio for Thando Thomo's software engineering work. The site presents five projects through concise case summaries and project-specific conceptual illustrations.

Motion includes glossy water drops labelled with technologies used in this site or the featured work. They fall at varied positions and intervals over a calm, shaded water surface. Each impact sends perspective ripples across the surface; clicking the hero creates a drop at that position. The canvas pauses when the hero is offscreen and respects reduced-motion settings. Other sections use scroll reveals and animated system paths.

## Run locally

```powershell
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Publish with GitHub Pages

This project is configured as a static Next.js export. `npm run build` writes the site to `out/`, and `.github/workflows/deploy-pages.yml` publishes it whenever `main` is pushed.

1. On GitHub, create an **empty public repository** named `impactengineer87.github.io` under the `impactengineer87` account. This exact name makes the portfolio available at `https://impactengineer87.github.io/` without a repository path prefix.
2. In the repository, go to **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**.
3. From this project folder, run:

   ```powershell
   git init
   git add .
   git commit -m "Publish portfolio"
   git branch -M main
   git remote add origin https://github.com/impactengineer87/impactengineer87.github.io.git
   git push -u origin main
   ```

4. Check the repository's **Actions** tab for the deployment result, then open `https://impactengineer87.github.io/`.

Before publishing, replace `hello@example.com` in `components/Contact.tsx` with your real contact address. If you choose a different repository name, the site will have a `/repository-name/` URL and the Next.js path configuration will need to change.

## Add project screenshots

The projects live in `components/Work.tsx`. Vertigo uses the supplied screenshot at `public/work/vertigo.png`. The Trading Bot case has a linked, static dashboard interface preview at `/work/trading`, based on the supplied reference. It uses sample data and does not connect to a broker or place orders. The other projects use conceptual illustrations. To add another screenshot:

1. Put the image in `public/work/`, for example `public/work/force-life.png`.
2. Set that project's `screenshot` value to `/work/force-life.png`.
3. Keep the image's project name and description accurate, and remove or blur any private data before publishing.

Each project-specific conceptual illustration displays until a screenshot is provided. The illustrations are labelled as conceptual views, not product screenshots.

Replace the placeholder contact email in `components/Contact.tsx` before publishing.

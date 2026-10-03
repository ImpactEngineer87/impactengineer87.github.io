# Thando Thomo portfolio

A grassland-inspired portfolio for Thando Thomo's software engineering work. The landing page opens onto a sunlit acacia clearing and a winding earthen road, with leaf-shaped links to Home, About me, Experience, My work, and Contact me growing from tree branches. Lions, tigers, and giraffes inhabit the clearing, with a zebra on desktop. The site presents five projects through concise case summaries and project-specific conceptual illustrations.

The grassland is a Three.js scene with a perspective camera, rolling terrain, a dirt path, natural bark, sage and golden grass, sunlight, and shadows. Tree crowns consist of thousands of individually curved, veined leaves on branching twig sprays. Photographic bark textures cover the trees and their navigation branches. Navigation leaves have detailed cellular surfaces and branching veins; they pivot at their stems, sharing exact world positions with branch tips through camera movement, hover, focus, and resizing. Hover or focus a leaf to hold its sway. Photographic-style lion, tiger, giraffe, and zebra cutouts are depth-tested in the clearing, with natural proportions, ground contact shadows, and subtle breathing. Procedural wildlife remains available if the atlas cannot load. Random wind carries loose leaves through the clearing; feathered songbirds flap, glide, bank, and occasionally catch leaves. Click the scenery to stir up a gust, or use Pause scene for stillness. Animation pauses offscreen and in hidden tabs, respects reduced-motion settings, and adapts to mobile screens. The static WebGL fallback also uses the animal atlas and photographic bark. All assets are served with the site, with no third-party runtime asset requests. The AI-generated nature textures and their exact generation prompts are in `public/nature/asset-metadata.json`. Other sections use scroll reveals and animated system paths.

## Run locally

```powershell
npm.cmd install
npm.cmd run dev
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

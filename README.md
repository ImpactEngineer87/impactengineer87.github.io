# Thando Thomo portfolio

A woodland-inspired portfolio for Thando Thomo's software engineering work. The landing page opens onto a sunlit forest and a winding earthen road, with leaf-shaped links to Home, About me, Experience, My work, and Contact me. The site presents five projects through concise case summaries and project-specific conceptual illustrations.

The forest is a Three.js scene with a perspective camera, branching three-dimensional trees, uneven terrain, a dirt path, textured bark, curved leaves, ferns, grass, mist, sunlight, and shadows. Move your pointer to look around; scrolling gently moves the camera along the path. Random wind carries loose leaves through three-dimensional space with lift and tumbling, and the navigation leaves travel at different depths. Hover or focus a navigation leaf to hold it still. Feathered songbirds flap their articulated wings, glide, bank, and occasionally catch and consume leaves, which replenish over time. Click the scenery to stir up a gust, or use Pause scene for stillness. Animation pauses offscreen and in hidden tabs, respects reduced-motion settings, and adapts to mobile screens. A static woodland fallback keeps navigation available when WebGL 2 is unavailable. All textures are generated locally; there are no remote asset requests. Other sections use scroll reveals and animated system paths.

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

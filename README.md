# The Way

An immersive full-screen scroll sequence. Each entry in `src/main.js` is one image, video, or text block.

```sh
npm install
npm run dev
```

## Media hosting

Large source videos are hosted outside Git. Keep the full-size source files in `local-media`, then run:

```sh
npm run assets:publish
```

The script uses Cloudflare Wrangler to create/use an R2 bucket, upload video files, enable an R2 public development URL when `R2_PUBLIC_BASE_URL` is not set, and update:

- `.env.local` with local R2 settings.
- `.env.production` with `VITE_MEDIA_BASE_URL` so hosted builds use the R2 media URL.

Git hooks are installed by `npm install`. When local videos exist, commits publish media and stage `.env.production`; pushes verify the published media URL is committed.

For a custom R2 domain, set `R2_PUBLIC_BASE_URL` in `.env.local` before publishing:

```sh
R2_PUBLIC_BASE_URL=https://assets.example.com
```

For local development and deployed fallback, the optimized `public/media/moon-fallback.mp4` is checked into Git. Full-size video files in `local-media` and `public/media` are ignored by Git.

The production build currently points at:

```sh
VITE_MEDIA_BASE_URL=https://pub-dce3284b917342619402f554d82dad82.r2.dev/media
```

If that R2 object is unavailable, the site falls back to the optimized `public/media/moon-fallback.mp4` checked into Git.

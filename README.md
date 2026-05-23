# The Way

An immersive full-screen scroll sequence. Each entry in `src/main.js` is one image, video, or text block.

```sh
npm install
npm run dev
```

## Media hosting

Large videos are hosted outside Git. Put video files in `public/media`, then run:

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

For local development, `public/media/moon.mp4` still works when no media base URL is configured, but video files in `public/media` are ignored by Git.

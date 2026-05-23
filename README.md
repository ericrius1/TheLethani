# The Way

An immersive full-screen scroll sequence. Each entry in `src/main.js` is one image, video, or text block.

```sh
npm install
npm run dev
```

## Media hosting

Large videos should be hosted outside Git. Upload `moon.mp4` to Cloudflare R2, S3, or another public asset host, then set:

```sh
VITE_MOON_VIDEO_URL=https://assets.example.com/moon.mp4
```

For local development, `public/media/moon.mp4` still works when that environment variable is not set, but `.mp4` files in `public/media` are ignored by Git.

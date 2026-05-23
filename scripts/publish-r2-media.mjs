#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const envLocalPath = path.join(projectRoot, ".env.local");
const envProductionPath = path.join(projectRoot, ".env.production");
const mediaDir = path.join(projectRoot, "public", "media");
const wranglerScript = path.join(
  projectRoot,
  "node_modules",
  "wrangler",
  "bin",
  "wrangler.js"
);

const videoMimeTypes = new Map([
  [".m4v", "video/mp4"],
  [".mov", "video/quicktime"],
  [".mp4", "video/mp4"],
  [".webm", "video/webm"]
]);

const config = {
  ...readEnvFile(path.join(projectRoot, ".env")),
  ...readEnvFile(envLocalPath),
  ...process.env
};

const bucket = normalizeBucketName(config.R2_BUCKET || `${readPackageName()}-media`);
const prefix = normalizePrefix(config.R2_PREFIX || "media");
let publicBaseUrl = trimTrailingSlash(config.R2_PUBLIC_BASE_URL || "");

const videos = listVideoFiles();

if (videos.length === 0) {
  console.log("No local video files found in public/media. Media publish skipped.");
  process.exit(0);
}

if (!existsSync(wranglerScript)) {
  fail("Wrangler is not installed. Run `npm install`, then retry.");
}

if (config.R2_AUTO_CREATE_BUCKET !== "0") {
  ensureBucket(bucket);
}

if (!publicBaseUrl && config.R2_AUTO_ENABLE_DEV_URL !== "0") {
  publicBaseUrl = enableDevUrl(bucket);
}

if (!publicBaseUrl) {
  fail(
    [
      "R2_PUBLIC_BASE_URL is required when the script cannot discover an r2.dev URL.",
      "Set it in .env.local to your R2 public bucket URL or custom domain, then rerun `npm run assets:publish`."
    ].join("\n")
  );
}

for (const video of videos) {
  uploadVideo(bucket, prefix, video);
}

const mediaBaseUrl = joinUrl(publicBaseUrl, prefix);

writeEnvFile(envLocalPath, {
  R2_BUCKET: bucket,
  R2_PREFIX: prefix,
  R2_PUBLIC_BASE_URL: publicBaseUrl,
  VITE_MEDIA_BASE_URL: mediaBaseUrl
});

writeEnvFile(envProductionPath, {
  VITE_MEDIA_BASE_URL: mediaBaseUrl
});

console.log(`Media published to ${mediaBaseUrl}`);
console.log(".env.local and .env.production are up to date.");

function readEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  return readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .reduce((values, line) => {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        return values;
      }

      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);

      if (!match) {
        return values;
      }

      values[match[1]] = unquoteEnvValue(match[2].trim());
      return values;
    }, {});
}

function writeEnvFile(filePath, updates) {
  const existing = existsSync(filePath) ? readFileSync(filePath, "utf8").split(/\r?\n/) : [];
  const remainingKeys = new Set(Object.keys(updates));
  const nextLines = existing.map((line) => {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=/);

    if (!match || !remainingKeys.has(match[1])) {
      return line;
    }

    remainingKeys.delete(match[1]);
    return `${match[1]}=${quoteEnvValue(updates[match[1]])}`;
  });

  if (nextLines.length > 0 && nextLines[nextLines.length - 1] !== "") {
    nextLines.push("");
  }

  for (const key of remainingKeys) {
    nextLines.push(`${key}=${quoteEnvValue(updates[key])}`);
  }

  writeFileSync(filePath, `${nextLines.join("\n").replace(/\n+$/, "")}\n`);
}

function unquoteEnvValue(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function quoteEnvValue(value) {
  if (/^[A-Za-z0-9_./:@+-]+$/.test(value)) {
    return value;
  }

  return JSON.stringify(value);
}

function listVideoFiles() {
  if (!existsSync(mediaDir)) {
    return [];
  }

  return readdirSync(mediaDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .filter((entry) => videoMimeTypes.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => ({
      name: entry.name,
      path: path.join(mediaDir, entry.name),
      mimeType: videoMimeTypes.get(path.extname(entry.name).toLowerCase())
    }));
}

function ensureBucket(bucketName) {
  const result = runWrangler(["r2", "bucket", "create", bucketName], { allowFailure: true, capture: true });
  const output = `${result.stdout || ""}${result.stderr || ""}`;

  if (result.status === 0) {
    console.log(`R2 bucket ready: ${bucketName}`);
    return;
  }

  if (/already exists|bucket.*exists/i.test(output)) {
    console.log(`R2 bucket already exists: ${bucketName}`);
    return;
  }

  fail(output.trim() || `Unable to create R2 bucket: ${bucketName}`);
}

function enableDevUrl(bucketName) {
  const result = runWrangler(
    ["r2", "bucket", "dev-url", "enable", bucketName, "--force"],
    { allowFailure: true, capture: true }
  );
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  const url = extractPublicUrl(output) || getDevUrl(bucketName);

  if (result.status === 0 && url) {
    console.log(`R2 public dev URL ready: ${url}`);
    return trimTrailingSlash(url);
  }

  if (result.status === 0) {
    return "";
  }

  fail(output.trim() || `Unable to enable public dev URL for R2 bucket: ${bucketName}`);
}

function getDevUrl(bucketName) {
  const result = runWrangler(["r2", "bucket", "dev-url", "get", bucketName], {
    allowFailure: true,
    capture: true
  });
  const output = `${result.stdout || ""}${result.stderr || ""}`;

  if (result.status !== 0) {
    return "";
  }

  return extractPublicUrl(output);
}

function uploadVideo(bucketName, keyPrefix, video) {
  const key = `${keyPrefix}/${video.name}`;

  runWrangler([
    "r2",
    "object",
    "put",
    `${bucketName}/${key}`,
    "--file",
    video.path,
    "--remote",
    "--content-type",
    video.mimeType,
    "--cache-control",
    "public, max-age=31536000, immutable"
  ]);

  console.log(`Uploaded ${video.name} -> ${key}`);
}

function runWrangler(args, options = {}) {
  const nodePath = path.dirname(process.execPath);
  const childPath = [nodePath, process.env.PATH].filter(Boolean).join(path.delimiter);
  const result = spawnSync(process.execPath, [wranglerScript, ...args], {
    cwd: projectRoot,
    env: { ...process.env, ...config, PATH: childPath },
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit"
  });

  if (result.error) {
    fail(result.error.message);
  }

  if (result.status !== 0 && !options.allowFailure) {
    fail(`Wrangler failed: wrangler ${args.join(" ")}`);
  }

  return result;
}

function extractPublicUrl(output) {
  const matches = output.match(/https:\/\/[^\s'"`<>]+/g) || [];

  return matches.find((url) => url.includes(".r2.dev")) || matches[0] || "";
}

function readPackageName() {
  const packageJson = JSON.parse(readFileSync(path.join(projectRoot, "package.json"), "utf8"));

  return packageJson.name || path.basename(projectRoot);
}

function normalizeBucketName(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizePrefix(value) {
  return value.replace(/^\/+|\/+$/g, "") || "media";
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/g, "");
}

function joinUrl(baseUrl, suffix) {
  return `${trimTrailingSlash(baseUrl)}/${normalizePrefix(suffix)}`;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

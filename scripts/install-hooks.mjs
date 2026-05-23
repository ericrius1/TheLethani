#!/usr/bin/env node

import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const hooksDir = path.join(projectRoot, ".git", "hooks");
const marker = "# TheWay managed media hook";

const hooks = new Map([
  [
    "pre-commit",
    `#!/bin/sh
${marker}
set -e

[ "$SKIP_R2_MEDIA" = "1" ] && exit 0

if find public/media -maxdepth 1 \\( -name '*.mp4' -o -name '*.webm' -o -name '*.mov' -o -name '*.m4v' \\) 2>/dev/null | grep -q .; then
  if command -v node >/dev/null 2>&1; then
    NODE=node
  elif [ -x /opt/homebrew/bin/node ]; then
    NODE=/opt/homebrew/bin/node
  else
    echo "Node.js is required to publish R2 media before committing."
    exit 1
  fi

  "$NODE" scripts/publish-r2-media.mjs
  git add .env.production
fi
`
  ],
  [
    "pre-push",
    `#!/bin/sh
${marker}
set -e

[ "$SKIP_R2_MEDIA" = "1" ] && exit 0

if find public/media -maxdepth 1 \\( -name '*.mp4' -o -name '*.webm' -o -name '*.mov' -o -name '*.m4v' \\) 2>/dev/null | grep -q .; then
  if command -v node >/dev/null 2>&1; then
    NODE=node
  elif [ -x /opt/homebrew/bin/node ]; then
    NODE=/opt/homebrew/bin/node
  else
    echo "Node.js is required to publish R2 media before pushing."
    exit 1
  fi

  "$NODE" scripts/publish-r2-media.mjs

  if ! git diff --quiet -- .env.production; then
    echo ".env.production changed after publishing media. Commit that file, then push again."
    exit 1
  fi
fi
`
  ]
]);

if (!existsSync(path.join(projectRoot, ".git"))) {
  process.exit(0);
}

mkdirSync(hooksDir, { recursive: true });

for (const [hookName, hookBody] of hooks) {
  const hookPath = path.join(hooksDir, hookName);

  if (existsSync(hookPath)) {
    const existing = readFileSync(hookPath, "utf8");

    if (!existing.includes(marker)) {
      console.warn(`Skipping existing .git/hooks/${hookName}; it was not created by this project.`);
      continue;
    }
  }

  writeFileSync(hookPath, hookBody);
  chmodSync(hookPath, 0o755);
}

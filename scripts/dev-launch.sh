#!/bin/sh
# Build in `pnpm -r build` order; a failed build exits 0 so nodemon waits, a successful one hands over to node.
if ! tsc -b ../../packages/core/tsconfig.build.json \
  || ! tsc-alias -p ../../packages/core/tsconfig.build.json \
  || ! tsc -b tsconfig.build.json \
  || ! tsc-alias -p tsconfig.build.json; then
  echo "build failed; waiting for source changes" >&2
  exit 0
fi
exec node dist/src/index.js

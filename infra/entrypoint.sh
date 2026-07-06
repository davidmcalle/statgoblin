#!/bin/sh
# Apply pending migrations, then start the standalone Next server.
set -e
echo "rollwatch: applying migrations"
# Invoke the CLI's real entry point — the .bin shim breaks when copied
# between stages (it resolves bundled wasm relative to its own realpath).
node node_modules/prisma/build/index.js migrate deploy
echo "rollwatch: starting server"
exec node server.js

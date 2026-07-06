#!/bin/sh
# Apply pending migrations, then start the standalone Next server.
set -e
echo "rollwatch: applying migrations"
./node_modules/.bin/prisma migrate deploy
echo "rollwatch: starting server"
exec node server.js

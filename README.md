# StatGoblin

Self-hosted roll analytics for Foundry VTT (dnd5e). The [StatGoblin Foundry
module](https://github.com/davidmcalle/statgoblin-foundry-module) mirrors every
roll to this app's ingest API; campaigns, characters, and dashboards live here.

- **Stack**: Next.js 16, Prisma 7, Postgres 16, Clerk, shadcn/ui + Recharts.
- **Dev**: `npm install`, Postgres via `docker run` (see `.env`), `npx prisma
  migrate dev`, `npm run dev`. Demo data: `npm run seed:demo` (`-- --clean`
  removes it). Rebuild derived tables: `npm run reprocess`.
- **Deploy**: push to main → CI builds `ghcr.io/davidmcalle/statgoblin:latest`
  → the homelab pod auto-updates. Runbook in [docs/deployment.md](docs/deployment.md).

# StatGoblin deployment — homelab VM (Podman + Quadlet)

One pod: postgres + app + Caddy in a shared network namespace. CI builds
`ghcr.io/davidmcalle/statgoblin:latest` on every push to main; the VM's
`podman-auto-update` timer pulls it and restarts the pod. Deploy = merge.

## 0. Credentials to generate & save (password manager)

| Credential | Where it goes |
|---|---|
| Postgres password (generate one) | pod.yaml ×2 (`POSTGRES_PASSWORD` + inside `DATABASE_URL`), DataGrip |
| Clerk secret key (`sk_…`) | pod.yaml `CLERK_SECRET_KEY` |
| Clerk publishable key (`pk_…`) | pod.yaml + GitHub repo variable `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (already set for dev) |
| Campaign Admin API key | shown once when the campaign is created in the app → Foundry module settings |

## 1. DNS + router

- A record: `statgoblin.com` (and `www`) → your public IP. Dynamic IP → use
  your DNS provider's update API on a cron.
- Router: forward **80 and 443** → VM (80 = ACME HTTP-01 + https redirect).
- Do **not** forward 5432 — it's LAN-only for DataGrip.

## 2. Clerk

- Dashboard → your app → **Configure → Email, phone, username → Personal
  information → Name → Required.** Sign-up then collects first + last name
  (the app shows players by first name).
- Dev keys work anywhere (with a dev banner). For production keys later:
  create a Production instance on statgoblin.com, swap the secret in
  pod.yaml and update the GitHub repo variable, then re-run the workflow.

## 3. VM setup

```sh
# prereqs: podman 4.4+
sudo mkdir -p /opt/statgoblin && sudo chown $USER /opt/statgoblin
git clone https://github.com/davidmcalle/statgoblin /opt/statgoblin-src
cp -r /opt/statgoblin-src/infra /opt/statgoblin/infra

# edit secrets — replace every change-me:
$EDITOR /opt/statgoblin/infra/pod.yaml

# rootless low ports for caddy (80/443):
echo 'net.ipv4.ip_unprivileged_port_start=80' | sudo tee /etc/sysctl.d/50-unpriv-ports.conf
sudo sysctl --system

# quadlet + autostart + auto-update:
mkdir -p ~/.config/containers/systemd
cp /opt/statgoblin/infra/statgoblin.kube ~/.config/containers/systemd/
systemctl --user daemon-reload
systemctl --user start statgoblin
systemctl --user enable --now podman-auto-update.timer
loginctl enable-linger $USER
```

Faster deploys than the daily default:

```sh
systemctl --user edit podman-auto-update.timer
# [Timer]
# OnCalendar=
# OnCalendar=*:0/15
```

## 4. DataGrip

New Data Source → PostgreSQL:

- Host: `<VM LAN IP>` · Port: `5432`
- Database / User: `statgoblin` · Password: the one you generated
- URL form: `jdbc:postgresql://<VM-IP>:5432/statgoblin`

Tables of interest: `raw_events` (immutable source of truth), `rolls` /
`actors` (derived — rebuildable via `npm run reprocess`), `campaigns`,
`campaign_members`, `api_keys` (sha256 only).

## 5. Verify

1. `https://statgoblin.com` loads; sign-up asks for first/last name.
2. `podman logs statgoblin-app` shows "applying migrations" then "starting server".
3. Create a campaign in the app → copy Campaign ID + Admin API key.
4. Foundry (module **statgoblin**, manifest
   `https://github.com/davidmcalle/statgoblin-foundry-module/releases/latest/download/module.json`
   — uninstall old rollwatch first):
   - Ingest URL: `https://statgoblin.com/api/ingest`
   - Campaign ID + Admin API Key from step 3
5. Roll in Foundry → appears on the campaign page within ~4s.

## 6. Operations

- Deploy: merge to main (timer pulls), or `podman auto-update` for right-now.
- Logs: `podman logs -f statgoblin-app` / `-caddy` / `-postgres`.
- Backup: `podman exec statgoblin-postgres pg_dump -U statgoblin statgoblin > statgoblin-$(date +%F).sql`
- Derived-table rebuild after parser changes ships automatically (ingest
  derives incrementally); full rebuild needs a shell:
  `podman exec statgoblin-app node node_modules/prisma/build/index.js migrate status`
  then reprocess from a dev machine pointed at the prod DATABASE_URL.

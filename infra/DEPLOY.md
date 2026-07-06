# Deploying StatGoblin

Self-hosted deployment guide. One Podman pod (Postgres + app) managed by Quadlet, fronted by any reverse proxy that terminates TLS. Deploy is pull-based: CI publishes the image, the host's `podman-auto-update` timer pulls it. Merge to main is the deploy.

## Architecture

```
Internet → your reverse proxy (TLS) → app :3000 (Podman pod)
                                       └─ Postgres :5432 (loopback only)
```

- The app binds `:3000`. TLS, WAF and rate limiting are the proxy's job.
- Postgres is published on `127.0.0.1:5432` only, for admin access via SSH tunnel.
- Run the pod on an isolated host or network segment. It is internet-facing; treat it that way.

## Prerequisites

- Linux host with Podman 4.4+
- A domain pointed at your proxy
- Clerk account
- GitHub repository fork (for CI) or use the published image

## Credentials

Generate and store these before starting:

| Credential | Where it goes |
|---|---|
| Postgres password | `pod.yaml` twice: `POSTGRES_PASSWORD` and inside `DATABASE_URL` |
| Clerk secret key (`sk_...`) | `pod.yaml` `CLERK_SECRET_KEY` only. Never in CI |
| Clerk publishable key (`pk_...`) | `pod.yaml` and the `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` GitHub repo variable |
| Campaign admin API key | Shown once at campaign creation. Goes in the Foundry module settings |

## Clerk

1. Create an application. For production, create a production instance on your domain and add the DNS records Clerk asks for. If your DNS provider proxies traffic, set the Clerk records to DNS only.
2. Configure → Email, phone, username → Personal information → Name → Required. The app displays players by first name.
3. Copy the publishable and secret keys.

## Host setup

```bash
sudo apt install -y podman git

sudo mkdir -p /opt/statgoblin && sudo chown $USER /opt/statgoblin
git clone https://github.com/davidmcalle/statgoblin /tmp/statgoblin-src
cp -r /tmp/statgoblin-src/infra /opt/statgoblin/infra

# Replace every change-me
$EDITOR /opt/statgoblin/infra/pod.yaml
chmod 600 /opt/statgoblin/infra/pod.yaml
```

Before saving `pod.yaml`, verify:

- Postgres password set in both places and they match
- Clerk keys set
- The app container carries the `io.containers.autoupdate: registry` annotation. Without it the update timer silently does nothing
- Postgres publishes with `hostIP: 127.0.0.1`, never `0.0.0.0`

Start the pod:

```bash
mkdir -p ~/.config/containers/systemd
cp /opt/statgoblin/infra/statgoblin.kube ~/.config/containers/systemd/
systemctl --user daemon-reload
systemctl --user start statgoblin
podman logs -f statgoblin-app
```

Expect image pulls, then `applying migrations`, then `starting server`. Migrations run on every container start; there is no manual migrate step.

Enable autostart and auto-update:

```bash
systemctl --user enable --now podman-auto-update.timer
loginctl enable-linger $USER
```

Optional 15 minute deploy cadence (default is daily):

```bash
mkdir -p ~/.config/systemd/user/podman-auto-update.timer.d
cat > ~/.config/systemd/user/podman-auto-update.timer.d/override.conf <<'EOF'
[Timer]
OnCalendar=
OnCalendar=*:0/15
EOF
systemctl --user daemon-reload
```

## Reverse proxy

Point your proxy at the pod host on port 3000. Caddy example:

```
statgoblin.example.com {
    encode gzip
    reverse_proxy <pod-host>:3000
}
```

## CI/CD

The workflow in `.github/workflows/` builds the `Containerfile` on every push to main and pushes `ghcr.io/<owner>/statgoblin:latest` plus a `:sha` tag for rollbacks.

1. Set the repo variable `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`. It is baked into the client bundle at build time, so re-run the workflow after changing it.
2. Make the package public, or configure a pull secret on the host.
3. Deploy = merge to main. The host pulls within one timer interval. For an immediate deploy, run `podman auto-update` on the host.

Rollback: retag or pull a previous `:sha` image and restart the pod.

## Database access

Postgres is loopback-only. Connect through an SSH tunnel:

```
Host: localhost  Port: 5432  DB/User: statgoblin
```

Tables of interest:

- `raw_events` — immutable source of truth
- `rolls`, `actors` — derived, rebuildable via `npm run reprocess`
- `campaigns`, `campaign_members`, `api_keys` (sha256 only)

## Backups

`raw_events` is the only data that matters; everything else derives from it.

Dump (run from a trusted host, not on the pod host, so a compromised app cannot reach your backups):

```bash
ssh <pod-host> 'podman exec statgoblin-postgres pg_dump -U statgoblin statgoblin' | gzip > statgoblin-$(date +%F).sql.gz
```

Restore test (do this once; an untested backup is a hope):

```bash
podman exec statgoblin-postgres createdb -U statgoblin restore_test
gunzip -c dump.sql.gz | podman exec -i statgoblin-postgres psql -q -U statgoblin restore_test
podman exec statgoblin-postgres psql -U statgoblin restore_test -c 'select count(*) from raw_events;'
podman exec statgoblin-postgres dropdb -U statgoblin restore_test
```

Real recovery: stop the app container, restore into `statgoblin` instead of `restore_test`, start the pod.

## Foundry module

1. Install via manifest: `https://github.com/davidmcalle/statgoblin-foundry-module/releases/latest/download/module.json`
2. Create a campaign in the app. Copy the campaign ID and admin API key.
3. Module settings: ingest URL `https://<your-domain>/api/ingest`, plus both credentials.
4. Roll. The campaign page updates within a few seconds.

## Verify

- Site loads over HTTPS; sign-up asks for first and last name
- `podman logs statgoblin-app` shows migrations then `starting server`
- A Foundry roll appears on the campaign page
- From the pod host, confirm it cannot reach anything internal it should not

## Operations

- Deploy: merge to main, or `podman auto-update` for right now
- Logs: `podman logs -f statgoblin-app` / `statgoblin-postgres`
- Status: `systemctl --user status statgoblin`
- Derived table rebuild after parser changes: `npm run reprocess` from a dev machine pointed at the production `DATABASE_URL` via tunnel

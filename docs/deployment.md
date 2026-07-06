# Deployment — homelab VM (Podman + Quadlet)

The pod runs postgres + the app + Caddy in one network namespace. CI builds
`ghcr.io/davidmcalle/statgoblin:latest` on every push to main; the VM's
`podman-auto-update` timer pulls it and restarts the pod — that's the deploy.

## One-time VM setup

1. Prereqs: `podman` (4.4+ for quadlet). DNS: an A record for
   `statgoblin.com` (and `www`) pointing at your public IP — if the home IP is
   dynamic, use your registrar/DNS provider's update API or a cron'd updater.
   Router forwards **80 and 443** to the VM (80 is needed for the ACME
   HTTP-01 challenge and the https redirect).

2. Files:

   ```sh
   sudo mkdir -p /opt/statgoblin && sudo chown $USER /opt/statgoblin
   git clone https://github.com/davidmcalle/statgoblin /opt/statgoblin-src
   cp -r /opt/statgoblin-src/infra /opt/statgoblin/infra
   ```

3. Secrets — edit `/opt/statgoblin/infra/pod.yaml`, replacing every
   `change-me`:
   - Postgres password (twice: `POSTGRES_PASSWORD` and inside `DATABASE_URL`)
   - `CLERK_SECRET_KEY` / `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (Clerk dashboard)

4. Quadlet + auto-update:

   ```sh
   mkdir -p ~/.config/containers/systemd
   cp /opt/statgoblin/infra/statgoblin.kube ~/.config/containers/systemd/
   systemctl --user daemon-reload
   systemctl --user start statgoblin
   systemctl --user enable --now podman-auto-update.timer
   loginctl enable-linger $USER   # rootless pods survive logout/reboot
   ```

   Default auto-update cadence is daily; for faster deploys:

   ```sh
   systemctl --user edit podman-auto-update.timer
   # [Timer]
   # OnCalendar=
   # OnCalendar=*:0/15
   ```

5. Rootless low ports (80/443): `sudo sysctl net.ipv4.ip_unprivileged_port_start=80`
   (persist in /etc/sysctl.d), or map to 8080/8443 in pod.yaml and translate at
   the router.

## Verify

- `https://statgoblin.com` loads, sign-in works.
- Migrations applied automatically (`podman logs statgoblin-app` shows
  "applying migrations").
- Foundry: module settings → Ingest URL `https://statgoblin.com/api/ingest`,
  plus the campaign's Campaign ID + API key. Roll; the dashboard updates
  within ~4s.

## Operations

- Deploy = merge to main. CI pushes the image; the timer picks it up.
- Manual deploy now: `podman auto-update` (as the pod user).
- Logs: `podman logs -f statgoblin-app` (or `-caddy`, `-postgres`).
- DB backup: `podman exec statgoblin-postgres pg_dump -U statgoblin statgoblin > backup.sql`
- Clerk: dev-instance keys work anywhere (with a dev banner). For production
  keys, create a Production instance in Clerk on statgoblin.com and swap both
  keys (publishable also needs the GitHub repo variable
  `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` updated, then rebuild).

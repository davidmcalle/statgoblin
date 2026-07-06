# Deployment — homelab VM (Podman + Quadlet)

The pod runs postgres + the app + Caddy in one network namespace. CI builds
`ghcr.io/davidmcalle/rollwatch:latest` on every push to main; the VM's
`podman-auto-update` timer pulls it and restarts the pod — that's the deploy.

## One-time VM setup

1. Prereqs: `podman` (4.4+ for quadlet), a DuckDNS subdomain pointing at your
   public IP (e.g. `rollwatch.darchbox.duckdns.org`), router forwarding 443 to
   the VM.

2. Files:

   ```sh
   sudo mkdir -p /opt/rollwatch && sudo chown $USER /opt/rollwatch
   git clone https://github.com/davidmcalle/rollwatch /opt/rollwatch-src
   cp -r /opt/rollwatch-src/infra /opt/rollwatch/infra
   ```

3. Secrets — edit `/opt/rollwatch/infra/pod.yaml`, replacing every
   `change-me`:
   - Postgres password (twice: `POSTGRES_PASSWORD` and inside `DATABASE_URL`)
   - `CLERK_SECRET_KEY` / `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (Clerk dashboard)
   - `DUCKDNS_TOKEN`, and `SITE_ADDRESS` if using a different hostname

4. Caddy image (once):

   ```sh
   cd /opt/rollwatch/infra && podman build -t localhost/rollwatch-caddy -f Containerfile.caddy .
   ```

5. Quadlet + auto-update:

   ```sh
   mkdir -p ~/.config/containers/systemd
   cp /opt/rollwatch/infra/rollwatch.kube ~/.config/containers/systemd/
   systemctl --user daemon-reload
   systemctl --user start rollwatch
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

6. Rootless port 443: either
   `sudo sysctl net.ipv4.ip_unprivileged_port_start=443` (persist in
   /etc/sysctl.d), or change the hostPort in pod.yaml to 8443 and forward
   443→8443 at the router.

## Verify

- `https://rollwatch.darchbox.duckdns.org` loads, sign-in works.
- Migrations applied automatically (`podman logs rollwatch-app` shows
  "applying migrations").
- Foundry: module settings → Ingest URL
  `https://rollwatch.darchbox.duckdns.org/api/ingest`, plus the campaign's
  Campaign ID + API key. Roll; the dashboard updates within ~4s.

## Operations

- Deploy = merge to main. CI pushes the image; the timer picks it up.
- Manual deploy now: `podman auto-update` (as the pod user).
- Logs: `podman logs -f rollwatch-app` (or `-caddy`, `-postgres`).
- DB backup: `podman exec rollwatch-postgres pg_dump -U rollwatch rollwatch > backup.sql`
- Clerk: dev-instance keys work anywhere (with a dev banner). For production
  keys, create a Production instance in Clerk on your domain and swap both
  keys (publishable also needs the GitHub repo variable
  `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` updated, then rebuild).

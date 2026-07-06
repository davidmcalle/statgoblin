# StatGoblin deployment — isolated VM (vmbr2) behind archbox + Cloudflare

Architecture (owned by the infra runbook, summarized here):

    Cloudflare (proxied, WAF) → UDR7 :80/:443 → archbox Caddy (TLS, CF DNS-01)
      → routed via pve → statgoblin VM 10.99.98.10:3000 (vmbr2, default-drop
        to all LANs; internet egress NAT'd for ghcr/Clerk only)

This doc covers only what runs ON the statgoblin VM plus the app-specific
bits (Clerk, DataGrip, Foundry). Bridge/firewall/route/Cloudflare stages live
in the infra plan.

## Credentials to generate & save

| Credential | Where it goes |
|---|---|
| Postgres password (generate) | pod.yaml ×2 (`POSTGRES_PASSWORD` + `DATABASE_URL`), DataGrip |
| Clerk secret key (`sk_…`) | pod.yaml `CLERK_SECRET_KEY` |
| Clerk publishable key (`pk_…`) | pod.yaml + GitHub repo variable `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (already set for dev keys) |
| Campaign Admin API key | shown once at campaign creation → Foundry module settings |

## Clerk (dashboard)

- Configure → Email, phone, username → Personal information → **Name →
  Required** (app displays players by first name).
- Dev keys work behind the proxy (dev banner). Production instance on
  statgoblin.com later: swap secret in pod.yaml, update the GitHub variable,
  re-run the workflow.

## VM setup (Ubuntu 24.04, 10.99.98.10)

```sh
# prereqs
sudo apt update && sudo apt install -y podman git

# files
sudo mkdir -p /opt/statgoblin && sudo chown $USER /opt/statgoblin
git clone https://github.com/davidmcalle/statgoblin /tmp/statgoblin-src
cp -r /tmp/statgoblin-src/infra /opt/statgoblin/infra

# secrets — replace every change-me:
$EDITOR /opt/statgoblin/infra/pod.yaml

# quadlet + autostart + auto-update (app binds :3000; archbox proxies to it,
# no low ports and no in-pod TLS, so no sysctl needed)
mkdir -p ~/.config/containers/systemd
cp /opt/statgoblin/infra/statgoblin.kube ~/.config/containers/systemd/
systemctl --user daemon-reload
systemctl --user start statgoblin
systemctl --user enable --now podman-auto-update.timer
loginctl enable-linger $USER

# 15-minute deploy cadence
systemctl --user edit podman-auto-update.timer
# [Timer]
# OnCalendar=
# OnCalendar=*:0/15
```

## archbox Caddy block (reference — lives in archbox's Caddyfile)

```
statgoblin.com {
	encode gzip
	reverse_proxy 10.99.98.10:3000
	tls {
		dns cloudflare {$CF_API_TOKEN}
	}
}
www.statgoblin.com {
	redir https://statgoblin.com{uri} permanent
}
```

## DataGrip (no LAN 5432 — SSH tunnel through pve)

Data Source → PostgreSQL → SSH/SSL tab:

- Use SSH tunnel: host `192.168.0.226` (pve) as jump → `david@10.99.98.10`
  (DataGrip supports one hop; if you need the jump, add a ~/.ssh/config entry
  `Host statgoblin-vm  HostName 10.99.98.10  ProxyJump root@192.168.0.226`
  and point DataGrip at `statgoblin-vm`)
- Then General tab: host `localhost`, port `5432`, db/user `statgoblin`,
  the generated password.

Postgres itself is never published beyond the pod's namespace… except
localhost inside the VM, which the tunnel lands on.

## Verify

1. `https://statgoblin.com` loads (via Cloudflare + archbox), sign-up asks
   for first/last name.
2. `podman logs statgoblin-app` → "applying migrations" then "starting server".
3. Create campaign → copy Campaign ID + Admin API key.
4. Foundry (module **statgoblin**, manifest
   `https://github.com/davidmcalle/statgoblin-foundry-module/releases/latest/download/module.json`
   — uninstall old rollwatch first): Ingest URL `https://statgoblin.com/api/ingest`
   + both credentials. The module posts via Cloudflare's front door — VM
   isolation needs no exception for Foundry.
5. Roll → dashboard within ~4s.

## Operations

- Deploy: merge to main → CI pushes image → timer pulls within 15 min.
  Right-now: `podman auto-update` on the VM.
- Logs: `podman logs -f statgoblin-app` / `-postgres`.
- Backup (from pve or via tunnel):
  `podman exec statgoblin-postgres pg_dump -U statgoblin statgoblin > statgoblin-$(date +%F).sql`

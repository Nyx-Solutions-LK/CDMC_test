# Deploy on Windows Hyper-V with Cloudflare Tunnel

This app is a Node/Express service that serves both the API and the static
site from one process. The production process should listen only on the VM's
loopback interface (`127.0.0.1:4000`); Cloudflare Tunnel publishes that local
HTTP origin to your public hostname.

## Recommended Shape

- Windows host: Hyper-V only.
- Guest VM: Ubuntu Server 24.04 LTS or newer.
- App: systemd service named `cdmc`.
- Public access: `cloudflared` service with an ingress rule to
  `http://127.0.0.1:4000`.

You can run everything directly on a Windows guest instead, but the Linux VM is
lower-friction for Node services, file permissions, and unattended restarts.

## 1. Create the Hyper-V VM

1. In Hyper-V Manager, create an External Virtual Switch.
2. Create a Generation 2 Ubuntu Server VM.
3. Allocate at least 2 vCPU, 2 GB RAM, and 20 GB disk.
4. Enable OpenSSH during Ubuntu install so you can deploy over SSH.
5. Give the VM outbound Internet access. You do not need inbound router port
   forwarding when using Cloudflare Tunnel.

## 2. Install Runtime Dependencies

On the Ubuntu VM:

```bash
sudo apt update
sudo apt install -y git curl ca-certificates build-essential
node --version
```

Install Node.js 22 or newer if the VM does not already have it. This project
uses `node:sqlite`, so older Node versions will not run it.

## 3. Put the App on the VM

Example target paths:

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin cdmc
sudo mkdir -p /opt/cdmc /etc/cdmc /var/lib/cdmc
sudo chown -R cdmc:cdmc /opt/cdmc /var/lib/cdmc
```

Copy or clone this repo to `/opt/cdmc`, then install backend dependencies:

```bash
sudo chown -R cdmc:cdmc /opt/cdmc
cd /opt/cdmc/backend
sudo -u cdmc npm ci --omit=dev
```

Create `/etc/cdmc/cdmc.env` from `deploy/env/cdmc.env.example` and replace
`SESSION_SECRET` with a long random value:

```bash
cd /opt/cdmc
sudo install -m 640 -o root -g cdmc deploy/env/cdmc.env.example /etc/cdmc/cdmc.env
sudoedit /etc/cdmc/cdmc.env
```

Run migrations and seed the initial admin:

```bash
cd /opt/cdmc/backend
sudo -u cdmc bash -lc 'set -a; source /etc/cdmc/cdmc.env; set +a; npm run migrate'
sudo -u cdmc bash -lc 'set -a; source /etc/cdmc/cdmc.env; set +a; npm run seed:admin'
```

## 4. Install the App Service

```bash
sudo cp /opt/cdmc/deploy/systemd/cdmc.service.example /etc/systemd/system/cdmc.service
sudo systemctl daemon-reload
sudo systemctl enable --now cdmc
sudo systemctl status cdmc
curl http://127.0.0.1:4000/healthz
```

Expected health response:

```json
{"ok":true}
```

## 5. Create the Cloudflare Tunnel

Install `cloudflared` from Cloudflare's package/download instructions, then:

```bash
cloudflared tunnel login
cloudflared tunnel create cdmc
cloudflared tunnel route dns cdmc cdmc.example.com
```

Copy `deploy/cloudflared/config.example.yml` to `/etc/cloudflared/config.yml`,
replace `cdmc.example.com` and `<TUNNEL-UUID>`, and copy the generated tunnel
credentials JSON to `/etc/cloudflared/<TUNNEL-UUID>.json`.

Validate and install the tunnel service:

```bash
sudo cloudflared --config /etc/cloudflared/config.yml tunnel ingress validate
sudo cloudflared --config /etc/cloudflared/config.yml service install
sudo systemctl enable --now cloudflared
sudo systemctl status cloudflared
```

## 6. Production Checks

```bash
curl http://127.0.0.1:4000/healthz
systemctl status cdmc cloudflared
journalctl -u cdmc -n 100 --no-pager
journalctl -u cloudflared -n 100 --no-pager
```

Then open `https://cdmc.example.com`, log in, and confirm that `/notices.html`,
`/messages.html`, and `/admin.html` work.

## Notes

- Keep `HOST=127.0.0.1`; the app should not be directly reachable on the VM
  network.
- Keep `COOKIE_SECURE=true` and `TRUST_PROXY=loopback` for Cloudflare Tunnel.
- Back up `/var/lib/cdmc/cdmc.sqlite`; it contains the application data.
- If you change `/etc/cdmc/cdmc.env`, restart with
  `sudo systemctl restart cdmc`.
- If you change `/etc/cloudflared/config.yml`, restart with
  `sudo systemctl restart cloudflared`.

## Cloudflare References

- Create a locally managed tunnel:
  https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/create-local-tunnel/
- Configure tunnel ingress rules:
  https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/configuration-file/
- Run `cloudflared` as a Linux service:
  https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/as-a-service/linux/

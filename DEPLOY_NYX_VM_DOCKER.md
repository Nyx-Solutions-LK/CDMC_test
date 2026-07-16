# CDMC on `nyx-vm`

The current deployment runs beside the existing `nyx-bms` Docker Compose stack.

## Server Layout

- App path: `/home/ameshf/cdmc`
- Compose project: `cdmc`
- Container: `cdmc-cdmc-1`
- Image: `cdmc:latest`
- Runtime env: `/home/ameshf/cdmc/backend/.env.production`
- SQLite data volume: `cdmc_cdmc_data`
- Shared Docker network: `nyx-bms_default`
- Public hostname: `https://cdmc.nyxsolutions.lk`

The existing Cloudflare Tunnel forwards all hostnames to local Caddy on port
80. Caddy then routes `cdmc.nyxsolutions.lk` to `http://cdmc:4000`.

## Deploy or Update

From this repo on your workstation:

```bash
rsync -az --delete \
  --exclude='.git/' \
  --exclude='backend/node_modules/' \
  --exclude='backend/data/' \
  --exclude='backend/.env' \
  --exclude='backend/.env.production' \
  ./ nyx-vm:/home/ameshf/cdmc/
```

Then on the server:

```bash
cd /home/ameshf/cdmc
docker compose build cdmc
docker compose run --rm cdmc npm run migrate
docker compose up -d cdmc
curl -fsS https://cdmc.nyxsolutions.lk/healthz
```

## Operations

```bash
ssh nyx-vm 'cd /home/ameshf/cdmc && docker compose ps'
ssh nyx-vm 'cd /home/ameshf/cdmc && docker compose logs --tail 100 cdmc'
ssh nyx-vm 'cd /home/ameshf/cdmc && docker compose restart cdmc'
```

Back up the `cdmc_cdmc_data` Docker volume; it contains the SQLite database.

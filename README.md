# better-agent

## CI/CD (Deploy branch -> HK jump -> US VPS)

Push code to `deploy` branch, GitHub Actions will SSH to Hong Kong jump host first, then proxy to US VPS and run your deploy command.

### 1) Add GitHub Secrets

In repo `Settings -> Secrets and variables -> Actions`, create:

- `VPS_HOST`: VPS IP or domain
- `VPS_PORT`: SSH port (usually `22`)
- `VPS_USER`: SSH username
- `VPS_SSH_KEY`: Private key content for SSH login (PEM format)
- `JUMP_HOST`: Hong Kong jump host IP/domain
- `JUMP_PORT`: Jump host SSH port (usually `22`)
- `JUMP_USER`: Jump host SSH username
- `JUMP_SSH_KEY`: Private key used to login jump host
- `VPS_APP_DIR`: Project directory on VPS (example: `/srv/better-agent`)
- `DEPLOY_REPO_URL`: Repo clone URL used on VPS (example: `https://github.com/Proview-China/better-agent.git`)
- `DEPLOY_COMMAND`: Actual deploy script/command on VPS

Example `DEPLOY_COMMAND`:

```bash
docker compose pull && docker compose up -d --build
```

or:

```bash
npm ci && npm run build && pm2 restart better-agent
```

### 2) Trigger deploy

- Push to `deploy` branch, or
- Run workflow manually from Actions tab (`workflow_dispatch`).

Workflow file: `.github/workflows/deploy.yml`

Notes:
- This workflow deploys only on US VPS side. It uses HK as SSH jump/proxy only.
- Do not run app deploy commands on the HK server if HK also hosts other workloads.

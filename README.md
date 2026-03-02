# better-agent

## CI/CD (Deploy branch -> VPS)

Push code to `deploy` branch, GitHub Actions will SSH into VPS and run your deploy command.

### 1) Add GitHub Secrets

In repo `Settings -> Secrets and variables -> Actions`, create:

- `VPS_HOST`: VPS IP or domain
- `VPS_PORT`: SSH port (usually `22`)
- `VPS_USER`: SSH username
- `VPS_SSH_KEY`: Private key content for SSH login (PEM format)
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

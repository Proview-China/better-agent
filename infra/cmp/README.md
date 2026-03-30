# CMP Live Infra

最小开发拓扑：

- `cmp-postgres`
- `cmp-redis`
- `cmp-git-infra`
- `cmp-status-panel`

常用命令：

- `docker compose --env-file infra/cmp/.env.example -f infra/cmp/compose.yaml up -d`
- `docker compose --env-file infra/cmp/.env.example -f infra/cmp/compose.yaml ps`
- `curl http://127.0.0.1:57480/status`
- `curl http://127.0.0.1:57480/status/json`

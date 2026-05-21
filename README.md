# Personal Trainer

A workout tracker for walks / runs / cycling and a gym session log with sets / reps / weight. TypeScript Express service backed by PostgreSQL, served as a static SPA.

Previously lived in the `tmpclaw` monorepo under `pt/`. History preserved via `git filter-repo`.

## Layout

```
.
├── src/          # TypeScript Express service (entry: src/index.ts)
├── public/       # Static SPA (HTML/CSS/JS)
├── chart/        # Helm chart (Deployment, Service, IngressRoute, NetworkPolicy)
├── scripts/      # gen-version, deploy
├── test/         # Smoke tests
├── Dockerfile    # Multi-stage build (node:22-slim base)
└── .github/workflows/ci.yml
```

## Local development

```sh
npm install
npm run dev        # tsx watch src/index.ts
npm test           # node:test, no external runner
npm run build      # tsc → dist/
```

Without `TRUST_FORWARD_AUTH=true` the service auto-authenticates as `dev`, so you can hit it directly at `http://localhost:8080`.

## Deploying

Default target is the local k3s cluster with a NodePort registry at `localhost:31500` and a Keycloak forward-auth middleware in the `tmpclaw` namespace (Traefik). To deploy:

```sh
./scripts/deploy.sh
```

This will:
1. Generate `version.json` from `package.json` + git
2. Build the Docker image with a timestamp tag (never `:latest` — containerd caches it aggressively)
3. Push to `${REGISTRY}` (default `localhost:31500/personal-trainer/pt`)
4. `helm upgrade --install pt chart/` against the `project-pt` namespace
5. Rewrite `chart/values.yaml` with the deployed tag so a committed `values.yaml` matches what's running

### Overrides

| env | default | what it does |
|---|---|---|
| `REGISTRY` | `localhost:31500` | image registry host:port |
| `IMAGE_REPO` | `personal-trainer/pt` | image name inside the registry |
| `RELEASE_NAME` | `pt` | helm release name |
| `HELM_NAMESPACE` | `project-pt` | helm release namespace |
| `TAG` | `$(date +%s)` | image tag |
| `VALUES_FILE` | — | extra helm values file to merge |

### Cluster prerequisites

The chart routes through a Keycloak forward-auth middleware that lives outside this chart. To deploy in isolation (no auth gateway):

```sh
helm upgrade --install pt chart/ --namespace project-pt --create-namespace \
  --set ingress.enabled=false
```

You'll then need to expose the Service yourself (kubectl port-forward, NodePort, etc).

### What the chart deploys

- `Namespace` (toggle with `createNamespace`)
- `Deployment` + `Service` for pt
- `IngressRoute` (Traefik) for `pt.tmpclaw.io` behind forward-auth (toggle with `ingress.enabled`)
- `NetworkPolicy` allowing pt's namespace to reach postgres in `tmpclaw` namespace (toggle with `postgresNetpol.enabled`)

## API surface

| method | path | purpose |
|---|---|---|
| GET    | `/api/me`              | identity |
| GET    | `/api/me/dashboard`    | batched dashboard payload |
| GET    | `/api/me/profile`      | profile read |
| PUT    | `/api/me/profile`      | profile update |
| GET    | `/api/me/activities`   | list cardio/rest/mobility/other |
| POST   | `/api/me/activities`   | log walk/run/cycle (planned or completed) |
| PATCH  | `/api/me/activities/:id` | edit / mark completed |
| GET    | `/api/me/gym`          | list gym sessions |
| POST   | `/api/me/gym`          | create gym session w/ sets |
| PATCH  | `/api/me/gym/:id`      | edit gym session |
| DELETE | `/api/me/gym/:id`      | delete gym session |
| GET    | `/api/me/workouts.csv` | full CSV export |

Health: `/healthz` (process) and `/readyz` (process + DB ping).

#!/usr/bin/env sh
set -eu

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required for the live HydraDB verification." >&2
  exit 1
fi
if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required for the live HydraDB verification." >&2
  exit 1
fi

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
CONTAINER="gentether-hydradb-$$"

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

"$ROOT/scripts/init-hydra-data.sh"

docker run -d --name "$CONTAINER" \
  --user "$(id -u):$(id -g)" \
  -p 7687:7687 -p 8443:8443 -p 9090:9090 \
  -v "$ROOT/.hydradb:/data" \
  -e CLOUD_PROVIDER=local \
  -e LOCAL_PATH=/data/store \
  -e GRAPH_NAMESPACE=default \
  -e GRAPH_ID=default \
  -e GRAPH_CELL_ID=cell-0 \
  -e GRAPH_CELLS=cell-0 \
  -e GRAPH_NODE_ID=node-0 \
  -e GRAPH_BOLT_NODE_ADDRESSES=node-0=127.0.0.1:7687 \
  -e GRAPH_ADVERTISED_BOLT_ADDR=127.0.0.1:7687 \
  -e GRAPH_DATA_CACHE_DIR=/data/cache \
  -e GRAPH_AUTH_TOKEN_FILE=/data/auth-token \
  -e GRAPH_ALLOW_PLAINTEXT=true \
  -e RUST_MIN_STACK=33554432 \
  ghcr.io/hydra-db/hydradb:latest >/dev/null

attempt=0
until curl -fsS http://127.0.0.1:9090/readyz >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 90 ]; then
    echo "HydraDB did not become ready." >&2
    docker logs "$CONTAINER" >&2 || true
    exit 1
  fi
  if ! docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null | grep -q true; then
    echo "HydraDB stopped before becoming ready." >&2
    docker logs "$CONTAINER" >&2 || true
    exit 1
  fi
  sleep 1
done

cd "$ROOT"
npm run build
HYDRA_URL=http://127.0.0.1:8443 \
HYDRA_TOKEN=local-development-token-32-bytes \
HYDRA_NAMESPACE=default \
HYDRA_GRAPH=default \
HYDRA_CELL_ID=cell-0 \
node dist/scripts/hydra-live-smoke.js

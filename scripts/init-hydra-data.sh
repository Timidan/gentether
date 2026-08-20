#!/usr/bin/env sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
mkdir -p "$ROOT/.hydradb/store" "$ROOT/.hydradb/cache"
token=${HYDRA_TOKEN:-local-development-token-32-bytes}
printf '%s\n' "$token" > "$ROOT/.hydradb/auth-token"
chmod 600 "$ROOT/.hydradb/auth-token"
printf 'HydraDB development data initialized at %s/.hydradb\n' "$ROOT"

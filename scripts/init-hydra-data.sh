#!/usr/bin/env sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
mkdir -p "$ROOT/.hydradb/store" "$ROOT/.hydradb/cache"
printf '%s\n' 'local-development-token-32-bytes' > "$ROOT/.hydradb/auth-token"
chmod 600 "$ROOT/.hydradb/auth-token"
printf 'HydraDB development data initialized at %s/.hydradb\n' "$ROOT"

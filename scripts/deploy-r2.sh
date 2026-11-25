#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
exec bun run deploy:r2 "$@"

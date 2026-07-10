#!/usr/bin/env bash
#
# Generic "deploy this project to my VPS" script.
#
#   - Infra facts (VPS host, base domain, paths) live ONCE in a global config
#     file, never in the project repo.
#   - Each project carries a tiny deploy.toml (name, port, optional overrides).
#
# Mechanism: rsync the repo to the VPS, build it there, run it as a systemd
# service, and expose it over HTTPS with Caddy.
#
# Usage:  deploy.sh [--yes] [--config PATH] [PROJECT_DIR]
#
set -euo pipefail

# ---------------------------------------------------------------------------
# Args
# ---------------------------------------------------------------------------
ASSUME_YES=0
CONFIG="${AGENT_DEPLOY_CONFIG:-$HOME/.config/agent-deploy/config.env}"
PROJECT_DIR="$PWD"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes|-y) ASSUME_YES=1; shift ;;
    --config) CONFIG="$2"; shift 2 ;;
    *) PROJECT_DIR="$1"; shift ;;
  esac
done

die() { echo "ERROR: $*" >&2; exit 1; }
say() { echo "==> $*"; }

# ---------------------------------------------------------------------------
# Load global infra config
# ---------------------------------------------------------------------------
[[ -f "$CONFIG" ]] || die "No deploy config at $CONFIG.
Create it from config.env.example (see the skill's SETUP.md). This holds your
VPS host, base domain and paths so you never repeat them per project."
# shellcheck disable=SC1090
source "$CONFIG"

: "${VPS_SSH:?Set VPS_SSH in $CONFIG (ssh alias or user@host)}"
: "${BASE_DOMAIN:?Set BASE_DOMAIN in $CONFIG}"
REMOTE_ROOT="${REMOTE_ROOT:-/opt/apps}"
CADDY_SITES_DIR="${CADDY_SITES_DIR:-/etc/caddy/sites}"

# ---------------------------------------------------------------------------
# Read the per-project manifest (deploy.toml)
# ---------------------------------------------------------------------------
MANIFEST="$PROJECT_DIR/deploy.toml"
[[ -f "$MANIFEST" ]] || die "No deploy.toml in $PROJECT_DIR.
Add one declaring at least: name, port. See the skill's README for the format."

# Minimal TOML reader for simple 'key = value' lines (strings or numbers).
toml_get() {
  local key="$1" def="${2:-}"
  local val
  val="$(sed -n -E "s/^[[:space:]]*${key}[[:space:]]*=[[:space:]]*(.*)$/\1/p" "$MANIFEST" | head -n1)"
  val="${val%%#*}"                                  # strip trailing comment
  val="$(echo "$val" | sed -E 's/^[[:space:]]+|[[:space:]]+$//g')" # trim
  val="${val%\"}"; val="${val#\"}"                  # strip quotes
  [[ -z "$val" ]] && val="$def"
  echo "$val"
}

NAME="$(toml_get name)"
PORT="$(toml_get port)"
[[ -n "$NAME" ]] || die "deploy.toml must set 'name'"
[[ -n "$PORT" ]] || die "deploy.toml must set 'port'"

DOMAIN="$(toml_get domain "${NAME}.${BASE_DOMAIN}")"
WORKDIR="$(toml_get workdir ".")"                   # subdir the service runs from
START="$(toml_get start "node dist/index.js")"      # ExecStart command
ENV_FILE="$(toml_get env_file ".env.production")"   # local secrets file to ship
# Default remote build: install + build web and server, fold SPA into server/public.
DEFAULT_BUILD='if [ -d web ] && [ -d server ]; then (cd web && npm ci && npm run build) && (cd server && npm ci && npm run build) && rm -rf server/public && cp -r web/dist server/public; else npm ci && npm run build; fi'
REMOTE_BUILD="$(toml_get remote_build "$DEFAULT_BUILD")"

REMOTE_DIR="$REMOTE_ROOT/$NAME"
SERVICE="app-$NAME"

# ---------------------------------------------------------------------------
# Confirmation
# ---------------------------------------------------------------------------
cat <<SUMMARY

  Project:   $NAME  ($PROJECT_DIR)
  VPS:       $VPS_SSH
  Deploy to: $REMOTE_DIR
  Service:   systemd  $SERVICE
  URL:       https://$DOMAIN   ->  localhost:$PORT
SUMMARY

if [[ "$ASSUME_YES" -ne 1 ]]; then
  read -r -p "Deploy to production? [y/N] " ans
  [[ "$ans" =~ ^[Yy]$ ]] || die "Aborted."
fi

# ---------------------------------------------------------------------------
# 1. Sanity: can we reach the VPS?
# ---------------------------------------------------------------------------
say "Checking SSH connectivity to $VPS_SSH"
ssh -o BatchMode=yes -o ConnectTimeout=10 "$VPS_SSH" 'echo ok >/dev/null' \
  || die "Cannot SSH to $VPS_SSH. Add a Host alias in ~/.ssh/config or fix VPS_SSH."

# ---------------------------------------------------------------------------
# 2. rsync the repo to the VPS (source only; deps/build happen there)
# ---------------------------------------------------------------------------
say "Syncing project to $VPS_SSH:$REMOTE_DIR"
ssh "$VPS_SSH" "mkdir -p '$REMOTE_DIR'"
RSYNC_EXCLUDES=(--exclude '.git' --exclude 'node_modules' --exclude 'dist'
  --exclude 'server/public' --exclude 'web/dist' --exclude 'data' --exclude '*.db*')
# Honor an optional .deployignore for extra excludes.
[[ -f "$PROJECT_DIR/.deployignore" ]] && RSYNC_EXCLUDES+=(--exclude-from "$PROJECT_DIR/.deployignore")
rsync -az --delete "${RSYNC_EXCLUDES[@]}" "$PROJECT_DIR"/ "$VPS_SSH:$REMOTE_DIR"/

# Ship the local secrets file (if present) as the service's EnvironmentFile.
if [[ -f "$PROJECT_DIR/$ENV_FILE" ]]; then
  say "Shipping $ENV_FILE as the service environment"
  scp -q "$PROJECT_DIR/$ENV_FILE" "$VPS_SSH:$REMOTE_DIR/.service.env"
else
  say "No $ENV_FILE found locally — deploying without extra env (using app defaults)"
  ssh "$VPS_SSH" "rm -f '$REMOTE_DIR/.service.env'; touch '$REMOTE_DIR/.service.env'"
fi

# ---------------------------------------------------------------------------
# 3. Build on the VPS (native modules compile for the server platform)
# ---------------------------------------------------------------------------
say "Building on the VPS"
ssh "$VPS_SSH" "cd '$REMOTE_DIR' && $REMOTE_BUILD"

# ---------------------------------------------------------------------------
# 4. Install / refresh the systemd service
# ---------------------------------------------------------------------------
say "Installing systemd service $SERVICE"
RUN_DIR="$REMOTE_DIR"
[[ "$WORKDIR" != "." ]] && RUN_DIR="$REMOTE_DIR/$WORKDIR"
EXEC_BIN="$(echo "$START" | awk '{print $1}')"

# Build the unit file remotely. PORT/HOST are injected so the app binds locally;
# Caddy is the only public-facing listener.
ssh "$VPS_SSH" "sudo tee /etc/systemd/system/${SERVICE}.service >/dev/null" <<UNIT
[Unit]
Description=$NAME (deployed by /deploy-production)
After=network.target

[Service]
Type=simple
WorkingDirectory=$RUN_DIR
EnvironmentFile=-$REMOTE_DIR/.service.env
Environment=PORT=$PORT
Environment=HOST=127.0.0.1
ExecStart=$(command -v env || echo /usr/bin/env) $START
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT

ssh "$VPS_SSH" "sudo systemctl daemon-reload && sudo systemctl enable --now ${SERVICE} && sudo systemctl restart ${SERVICE}"

# ---------------------------------------------------------------------------
# 5. Wire up Caddy (per-app site file imported by the main Caddyfile)
# ---------------------------------------------------------------------------
say "Configuring Caddy for https://$DOMAIN"
ssh "$VPS_SSH" "sudo mkdir -p '$CADDY_SITES_DIR' && sudo tee '$CADDY_SITES_DIR/${NAME}.caddy' >/dev/null" <<CADDY
$DOMAIN {
	reverse_proxy 127.0.0.1:$PORT
}
CADDY
# Reload Caddy (systemd service name is 'caddy' on standard installs).
ssh "$VPS_SSH" "sudo systemctl reload caddy || sudo systemctl restart caddy"

# ---------------------------------------------------------------------------
# 6. Verify
# ---------------------------------------------------------------------------
say "Verifying the service is up"
sleep 2
ssh "$VPS_SSH" "systemctl is-active --quiet ${SERVICE}" \
  || die "Service ${SERVICE} is not active. Check: ssh $VPS_SSH 'journalctl -u ${SERVICE} -n 50'"

say "Checking https://$DOMAIN (TLS may take a few seconds on first deploy)"
for i in 1 2 3 4 5 6; do
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "https://$DOMAIN/" || true)"
  if [[ "$code" =~ ^(2|3) ]]; then
    echo
    echo "  ✅ Deployed:  https://$DOMAIN   (HTTP $code)"
    exit 0
  fi
  echo "   ...not ready yet (HTTP ${code:-000}); retrying"
  sleep 5
done

echo
echo "  ⚠️  Deployed, but https://$DOMAIN did not return success yet."
echo "     DNS for $DOMAIN must point at the VPS, and Caddy needs it to issue a cert."
echo "     Check:  ssh $VPS_SSH 'journalctl -u caddy -n 50'"
exit 0

#!/usr/bin/env bash
# =============================================================================
#  Auto OLT — Deploy / Build Script
#  Run after `git pull` to apply changes:  sudo bash build.sh
#
#  What it does:
#    1. Backend deps + migrations
#    2. Frontend deps + production build
#    3. Restart auto-olt-backend + auto-olt-frontend systemd services
# =============================================================================
set -e

# ── Colour helpers ────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()     { echo -e "${RED}[ERR ]${NC}  $*"; }
section() { echo -e "\n${GREEN}══════════════════════════════════════════${NC}"; echo -e "${GREEN} $*${NC}"; echo -e "${GREEN}══════════════════════════════════════════${NC}"; }

# ── Paths ─────────────────────────────────────────────────────────────────────
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
VENV_DIR="$BACKEND_DIR/venv"

# ── Root check ────────────────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  err "Please run as root: sudo bash build.sh"
  exit 1
fi

# ── Backend ───────────────────────────────────────────────────────────────────
section "1 — Backend: install deps + migrate"
cd "$BACKEND_DIR"

if [[ ! -d "$VENV_DIR" ]]; then
  err "venv not found at $VENV_DIR — run setup.sh first."
  exit 1
fi

"$VENV_DIR/bin/pip" install -q -r requirements.txt
info "Backend dependencies up to date"

"$VENV_DIR/bin/python" manage.py migrate --noinput
info "Database migrations applied"

# Collect static files only if STATIC_ROOT is configured (best-effort)
"$VENV_DIR/bin/python" manage.py collectstatic --noinput 2>/dev/null || \
  warn "collectstatic skipped (likely no STATIC_ROOT configured — fine)"

# ── Frontend ──────────────────────────────────────────────────────────────────
section "2 — Frontend: install deps + production build"
cd "$FRONTEND_DIR"

if command -v npm >/dev/null 2>&1; then
  npm ci --silent || npm install --silent
  info "Frontend dependencies up to date"
  npm run build
  info "Frontend production build complete"
else
  err "npm not found on PATH — install Node.js first."
  exit 1
fi

# ── Restart services ──────────────────────────────────────────────────────────
section "3 — Restart systemd services"
systemctl daemon-reload
systemctl restart auto-olt-backend.service auto-olt-frontend.service
info "Services restarted"

# Brief status report so you can spot a startup failure immediately
sleep 1
echo
systemctl --no-pager --lines=0 status auto-olt-backend.service  || true
echo
systemctl --no-pager --lines=0 status auto-olt-frontend.service || true

section "Done"
info "Deploy complete. Tail logs with:"
echo "    journalctl -u auto-olt-backend.service  -f"
echo "    journalctl -u auto-olt-frontend.service -f"

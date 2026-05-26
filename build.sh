#!/usr/bin/env bash
# =============================================================================
#  Auto OLT — Deploy / Build Script
#  Run after `git pull` to apply changes:  sudo bash build.sh
#
#  What it does:
#    1. Backend deps + migrations
#    2. Frontend deps + production build
#    3. Restart auto-olt-backend + auto-olt-celery + auto-olt-frontend systemd services
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

# ── Git pull ─────────────────────────────────────────────────────────────────
section "0 — Git pull"
cd "$PROJECT_DIR"
git pull
info "Repository up to date"

# ── What to deploy? ───────────────────────────────────────────────────────────
echo -e "${YELLOW}What do you want to deploy?${NC}"
echo "  1) All                  (backend + celery worker + beat + frontend)"
echo "  2) Backend only         (deps, migrate, restart backend)"
echo "  3) Celery only          (deps, restart worker + beat)"
echo "  4) Frontend only        (npm build, restart frontend)"
echo "  5) Backend + Celery     (deps, migrate, restart backend + worker + beat)"
echo "  6) Backend + Frontend"
read -rp "Choice [1-6] (default 1): " DEPLOY_CHOICE
DEPLOY_CHOICE="${DEPLOY_CHOICE:-1}"

DO_BACKEND=false; DO_CELERY=false; DO_FRONTEND=false
case "$DEPLOY_CHOICE" in
  1) DO_BACKEND=true;  DO_CELERY=true;  DO_FRONTEND=true  ;;
  2) DO_BACKEND=true ;;
  3) DO_CELERY=true ;;
  4) DO_FRONTEND=true ;;
  5) DO_BACKEND=true;  DO_CELERY=true ;;
  6) DO_BACKEND=true;  DO_FRONTEND=true ;;
  *) warn "Invalid choice, deploying all."; DO_BACKEND=true; DO_CELERY=true; DO_FRONTEND=true ;;
esac

# ── Backend ───────────────────────────────────────────────────────────────────
if $DO_BACKEND || $DO_CELERY; then
section "— Backend: install deps + migrate"
cd "$BACKEND_DIR"

if [[ ! -d "$VENV_DIR" ]]; then
  err "venv not found at $VENV_DIR — run setup.sh first."
  exit 1
fi

"$VENV_DIR/bin/pip" install -q -r requirements.txt
info "Backend dependencies up to date"

"$VENV_DIR/bin/python" manage.py migrate --noinput
info "Database migrations applied"

"$VENV_DIR/bin/python" manage.py collectstatic --noinput 2>/dev/null || \
  warn "collectstatic skipped (likely no STATIC_ROOT configured — fine)"
fi  # end backend/celery steps

# ── Frontend ──────────────────────────────────────────────────────────────────
if $DO_FRONTEND; then
section "— Frontend: install deps + production build"
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
fi  # end frontend steps

# ── Restart services ──────────────────────────────────────────────────────────
section "— Restart systemd services"
systemctl daemon-reload

SVCS=()
$DO_BACKEND  && SVCS+=(auto-olt-backend.service)
$DO_CELERY   && SVCS+=(auto-olt-celery.service auto-olt-celery-beat.service)
$DO_FRONTEND && SVCS+=(auto-olt-frontend.service)

systemctl restart "${SVCS[@]}"
info "Restarted: ${SVCS[*]}"

sleep 1
for svc in "${SVCS[@]}"; do
  echo
  systemctl --no-pager --lines=0 status "$svc" || true
done

section "Done"
info "Deploy complete. Tail logs with:"
for svc in "${SVCS[@]}"; do
  echo "    journalctl -u $svc -f"
done

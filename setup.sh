#!/usr/bin/env bash
# =============================================================================
#  Auto OLT — Full Project Setup Script
#  Run once on a fresh server:  sudo bash setup.sh
#  Server IP : 5.154.181.180
#  Backend   : http://5.154.181.180:9005
#  Frontend  : http://5.154.181.180:3001
# =============================================================================
set -e

# ── Colour helpers ────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
section() { echo -e "\n${GREEN}══════════════════════════════════════════${NC}"; echo -e "${GREEN} $*${NC}"; echo -e "${GREEN}══════════════════════════════════════════${NC}"; }

# ── Config ────────────────────────────────────────────────────────────────────
SERVER_IP="5.154.181.180"
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
WEBSITE_DIR="$PROJECT_DIR/website"
VENV_DIR="$BACKEND_DIR/venv"
BE_PORT=9005
FE_PORT=3001
WS_PORT=3002
SERVICE_USER="${SUDO_USER:-$(whoami)}"
NODE_VERSION="20"

# ── Root check ────────────────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  echo -e "${RED}Please run as root: sudo bash setup.sh${NC}"; exit 1
fi

# ── What to install? ──────────────────────────────────────────────────────────
# Each flag gates a specific section so the user can re-run setup.sh and only
# touch the parts they care about. Defaults to a full install.
DO_SYSPKG=false
DO_REDIS=false
DO_NODE=false
DO_PYTHON=false
DO_WG=false
DO_BACKEND=false   # backend .env + migrate + systemd unit
DO_CELERY=false    # celery worker + beat systemd units
DO_FRONTEND=false  # frontend env + npm build + systemd unit
DO_WEBSITE=false   # website env + npm build + systemd unit

echo -e "${YELLOW}What do you want to install?${NC}"
echo "  1) All                              (recommended for first run)"
echo "  2) Backend stack only               (sys pkgs + Redis + Python + WireGuard + backend + Celery)"
echo "  3) Frontend only                    (Node.js + frontend build + service)"
echo "  4) Website only                     (Node.js + website build + service)"
echo "  5) WireGuard only                   (sys pkgs + WireGuard server config)"
echo "  6) Update services + restart only   (re-write systemd units, skip installs)"
echo "  7) Custom                           (comma-separated: syspkg,redis,node,python,wg,backend,celery,frontend,website)"
read -rp "Choice [1-7] (default 1): " INSTALL_CHOICE
INSTALL_CHOICE="${INSTALL_CHOICE:-1}"

case "$INSTALL_CHOICE" in
  1)
    DO_SYSPKG=true; DO_REDIS=true; DO_NODE=true; DO_PYTHON=true; DO_WG=true
    DO_BACKEND=true; DO_CELERY=true; DO_FRONTEND=true; DO_WEBSITE=true
    ;;
  2)
    DO_SYSPKG=true; DO_REDIS=true; DO_PYTHON=true; DO_WG=true
    DO_BACKEND=true; DO_CELERY=true
    ;;
  3)
    DO_NODE=true; DO_FRONTEND=true
    ;;
  4)
    DO_NODE=true; DO_WEBSITE=true
    ;;
  5)
    DO_SYSPKG=true; DO_WG=true
    ;;
  6)
    DO_BACKEND=true; DO_CELERY=true; DO_FRONTEND=true; DO_WEBSITE=true
    ;;
  7)
    read -rp "  Pick components (comma-separated): " CUSTOM
    IFS=',' read -ra PARTS <<< "$CUSTOM"
    for p in "${PARTS[@]}"; do
      case "$(echo "$p" | tr '[:upper:]' '[:lower:]' | xargs)" in
        syspkg|sys|packages)         DO_SYSPKG=true ;;
        redis)                       DO_REDIS=true ;;
        node|nodejs)                 DO_NODE=true ;;
        python|venv|py)              DO_PYTHON=true ;;
        wg|wireguard)                DO_WG=true ;;
        backend|be)                  DO_BACKEND=true ;;
        celery|worker|beat)          DO_CELERY=true ;;
        frontend|fe)                 DO_FRONTEND=true ;;
        website|ws)                  DO_WEBSITE=true ;;
        *) warn "Unknown component '$p' — skipped" ;;
      esac
    done
    ;;
  *)
    warn "Invalid choice — defaulting to full install"
    DO_SYSPKG=true; DO_REDIS=true; DO_NODE=true; DO_PYTHON=true; DO_WG=true
    DO_BACKEND=true; DO_CELERY=true; DO_FRONTEND=true; DO_WEBSITE=true
    ;;
esac

# Auto-pull dependencies — e.g. WireGuard needs the system packages section to
# install wireguard-tools, and backend/celery need the Python venv to exist.
if $DO_WG || $DO_PYTHON; then
  DO_SYSPKG=true
fi
if $DO_FRONTEND || $DO_WEBSITE; then
  : # Node will be installed if user explicitly picked it — but if it's missing the build steps would fail anyway, so warn rather than auto-enable to avoid surprise installs.
fi

info "Plan: syspkg=$DO_SYSPKG redis=$DO_REDIS node=$DO_NODE python=$DO_PYTHON wireguard=$DO_WG backend=$DO_BACKEND celery=$DO_CELERY frontend=$DO_FRONTEND website=$DO_WEBSITE"

# Always detect Python version once — used by venv setup and apt package selection.
PY_VER=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>/dev/null || echo "3")

if $DO_SYSPKG; then
section "1 — System packages"
apt-get update -qq
apt-get install -y -qq python3 python3-pip python3-venv curl git build-essential wireguard wireguard-tools iptables
apt-get install -y -qq "python${PY_VER}-venv" 2>/dev/null || true
info "System packages installed (Python $PY_VER)"
fi

# ── Redis (native — no Docker) ────────────────────────────────────────────────
if $DO_REDIS; then
section "1b — Redis"
if ! command -v redis-server &>/dev/null; then
  apt-get install -y -qq redis-server
  info "Redis installed"
else
  info "Redis already installed — skipping"
fi
# Bind to loopback only (default is already 127.0.0.1, but enforce it)
sed -i 's/^# *bind .*/bind 127.0.0.1 ::1/' /etc/redis/redis.conf 2>/dev/null || true
systemctl enable redis-server
systemctl restart redis-server
# Smoke-test: make sure Redis responds before we continue
if redis-cli ping | grep -q PONG; then
  info "Redis is up and responding"
else
  echo -e "${RED}[ERROR] Redis did not start correctly — check: journalctl -u redis-server${NC}"
  exit 1
fi
fi

# ── Node.js ───────────────────────────────────────────────────────────────────
if $DO_NODE; then
section "2 — Node.js $NODE_VERSION"
if ! command -v node &>/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d 'v')" -lt "$NODE_VERSION" ]]; then
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
  apt-get install -y -qq nodejs
fi
info "Node $(node -v) / npm $(npm -v)"
fi

# ── Python venv + deps ────────────────────────────────────────────────────────
if $DO_PYTHON; then
section "3 — Python virtualenv & dependencies"
if [[ ! -d "$VENV_DIR" ]]; then
  python3 -m venv "$VENV_DIR" || {
    warn "python3 -m venv failed, trying python${PY_VER} directly..."
    "python${PY_VER}" -m venv "$VENV_DIR"
  }
  info "Virtualenv created at $VENV_DIR"
else
  info "Virtualenv already exists at $VENV_DIR — skipping creation"
fi
"$VENV_DIR/bin/pip" install --upgrade pip -q
"$VENV_DIR/bin/pip" install -r "$BACKEND_DIR/requirements.txt"
info "Python deps installed"
fi

# ── WireGuard server (auto setup, idempotent) ────────────────────────────────
if $DO_WG; then
section "3b — WireGuard server"
WG_IFACE="wg0"
WG_PORT="51820"
WG_NETWORK="10.100.0.0/16"
WG_CONF="/etc/wireguard/${WG_IFACE}.conf"

mkdir -p /etc/wireguard
chmod 700 /etc/wireguard

if [[ -f "$WG_CONF" ]]; then
  # Reuse existing keypair — regenerating would break every connected MikroTik peer.
  WG_SERVER_PUBKEY=$(wg show "$WG_IFACE" public-key 2>/dev/null || \
                     grep -E '^PrivateKey' "$WG_CONF" | awk '{print $3}' | wg pubkey)
  info "Existing $WG_CONF detected — reusing keypair (peers preserved)"
else
  WG_PRIV=$(wg genkey)
  WG_SERVER_PUBKEY=$(echo "$WG_PRIV" | wg pubkey)
  cat > "$WG_CONF" <<EOF
[Interface]
PrivateKey = $WG_PRIV
Address = 10.100.0.1/16
ListenPort = $WG_PORT
SaveConfig = true
EOF
  chmod 600 "$WG_CONF"
  info "Wrote $WG_CONF with fresh keypair"
fi

# Open UDP firewall port (best-effort — works on Ubuntu's ufw)
if command -v ufw &>/dev/null; then
  ufw allow "${WG_PORT}/udp" >/dev/null 2>&1 || true
  info "ufw: opened ${WG_PORT}/udp"
fi
# Also via iptables in case ufw is inactive (idempotent — only inserts if missing)
iptables -C INPUT -p udp --dport "$WG_PORT" -j ACCEPT 2>/dev/null || \
  iptables -I INPUT -p udp --dport "$WG_PORT" -j ACCEPT

# Enable IP forwarding (needed for tunnel routing)
if ! grep -qE '^\s*net\.ipv4\.ip_forward\s*=\s*1' /etc/sysctl.conf; then
  echo 'net.ipv4.ip_forward = 1' >> /etc/sysctl.conf
fi
sysctl -p >/dev/null 2>&1 || true

# Enable + start the systemd unit (idempotent — won't restart if already active)
systemctl enable "wg-quick@${WG_IFACE}" >/dev/null 2>&1 || true
systemctl start "wg-quick@${WG_IFACE}" 2>/dev/null || \
  systemctl restart "wg-quick@${WG_IFACE}"

if systemctl is-active --quiet "wg-quick@${WG_IFACE}"; then
  info "wg-quick@${WG_IFACE} is up"
  info "Server public key: $WG_SERVER_PUBKEY"
else
  warn "wg-quick@${WG_IFACE} not active — check: journalctl -u wg-quick@${WG_IFACE}"
fi

# Allow the service user to run wg/wg-quick without a password — the
# Django backend uses `sudo wg set ...` to register/remove peers at runtime.
SUDOERS_FILE="/etc/sudoers.d/auto-olt-wireguard"
cat > "$SUDOERS_FILE" <<EOF
# Allows Auto OLT backend to manage WireGuard peers without a TTY/password.
$SERVICE_USER ALL=(ALL) NOPASSWD: /usr/bin/wg, /usr/bin/wg-quick
EOF
chmod 440 "$SUDOERS_FILE"
# Validate — visudo -c -f exits non-zero on syntax error
if visudo -cf "$SUDOERS_FILE" >/dev/null; then
  info "sudoers: $SERVICE_USER may run wg/wg-quick without password"
else
  rm -f "$SUDOERS_FILE"
  warn "sudoers entry failed validation — removed. WG peer add/remove will need manual sudo config."
fi
fi  # end DO_WG

# WG defaults — needed by the backend .env even when DO_WG was skipped on this run
WG_IFACE="${WG_IFACE:-wg0}"
WG_PORT="${WG_PORT:-51820}"
if [[ -z "${WG_SERVER_PUBKEY:-}" ]]; then
  if command -v wg &>/dev/null && wg show "$WG_IFACE" public-key &>/dev/null; then
    WG_SERVER_PUBKEY=$(wg show "$WG_IFACE" public-key)
  else
    WG_SERVER_PUBKEY="REPLACE_WITH_WG_SERVER_PUBLIC_KEY"
  fi
fi

# ── Backend .env ──────────────────────────────────────────────────────────────
if $DO_BACKEND; then
section "4 — Backend .env"
ENV_FILE="$BACKEND_DIR/.env"
# Preserve SECRET_KEY if one already exists (changing it invalidates all JWT tokens)
if [[ -f "$ENV_FILE" ]]; then
  EXISTING_SECRET=$(grep -E '^SECRET_KEY=' "$ENV_FILE" | cut -d= -f2- | tr -d '[:space:]')
fi
if [[ -z "$EXISTING_SECRET" ]]; then
  EXISTING_SECRET=$(python3 -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())" 2>/dev/null \
                    || python3 -c "import secrets,base64; print(base64.urlsafe_b64encode(secrets.token_bytes(50)).decode())")
fi
cat > "$ENV_FILE" <<EOF
# ── Django Core ──────────────────────────────────────────────
SECRET_KEY=$EXISTING_SECRET
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1,$SERVER_IP

# ── Database ─────────────────────────────────────────────────
DATABASE_URL=sqlite:///db.sqlite3

# ── CORS ─────────────────────────────────────────────────────
CORS_ALLOW_ALL_ORIGINS=False
CORS_ALLOWED_ORIGINS=http://$SERVER_IP:$FE_PORT,http://localhost:$FE_PORT

# ── JWT ──────────────────────────────────────────────────────
JWT_ACCESS_TOKEN_LIFETIME_MINUTES=15
JWT_REFRESH_TOKEN_LIFETIME_DAYS=7

# ── Encryption (OLT passwords at rest) ───────────────────────
# WARNING: Never change this after data is written.
FIELD_ENCRYPTION_KEY=REPLACE_WITH_FERNET_KEY

# ── HMAC Response Signing ────────────────────────────────────
HMAC_SECRET=REPLACE_WITH_HMAC_SECRET

# ── Admin ────────────────────────────────────────────────────
ADMIN_URL=REPLACE_WITH_SECRET_ADMIN_PATH/

# ── Registration ─────────────────────────────────────────────
REGISTRATION_OPEN=True

# ── OTP ──────────────────────────────────────────────────────
OTP_EXPIRY_MINUTES=10

# ── Site URL ─────────────────────────────────────────────────
SITE_URL=http://$SERVER_IP:$FE_PORT

# ── HTTPS Security ───────────────────────────────────────────
SECURE_SSL_REDIRECT=False
SESSION_COOKIE_SECURE=False
CSRF_COOKIE_SECURE=False

# ── Logging ──────────────────────────────────────────────────
LOG_LEVEL=WARNING

# ── Email / SMTP ─────────────────────────────────────────────
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-gmail-app-password
DEFAULT_FROM_EMAIL=Auto OLT <your-email@gmail.com>

# ── ONU Provisioning ─────────────────────────────────────────
ONU_REGISTER_METHOD=hybrid
DEFAULT_TELNET_USERNAME=admin
DEFAULT_TELNET_PASSWORD=admin
DEFAULT_TELNET_PORT=23
OLT_MGMT_USER=autoolt
OLT_MGMT_PASSWORD=REPLACE_WITH_MGMT_PASSWORD
OLT_MGMT_PRIVILEGE=15

# ── WireGuard ────────────────────────────────────────────────
WG_INTERFACE=$WG_IFACE
WG_ENDPOINT=$SERVER_IP:$WG_PORT
WG_SERVER_PUBLIC_KEY=$WG_SERVER_PUBKEY

# ── Celery / Redis ────────────────────────────────────────────
# Allow sync ORM calls inside gevent-pooled Celery workers
DJANGO_ALLOW_ASYNC_UNSAFE=1
CELERY_BROKER_URL=redis://127.0.0.1:6379/0
CELERY_RESULT_BACKEND=redis://127.0.0.1:6379/0
REDIS_CACHE_URL=redis://127.0.0.1:6379/1
REDIS_CHANNEL_URL=redis://127.0.0.1:6379/2
EOF
info ".env written at $ENV_FILE"

# ── Django migrations ─────────────────────────────────────────────────────────
section "5 — Django migrate"
cd "$BACKEND_DIR"
"$VENV_DIR/bin/python" manage.py migrate --run-syncdb
info "Database ready"
fi  # end DO_BACKEND (.env + migrate)

# ── Frontend .env ─────────────────────────────────────────────────────────────
if $DO_FRONTEND; then
section "6 — Frontend .env"
FE_ENV="$FRONTEND_DIR/.env.local"
cat > "$FE_ENV" <<EOF
NEXT_PUBLIC_API_URL=http://$SERVER_IP:$BE_PORT/api
NEXT_PUBLIC_HMAC_SECRET=REPLACE_WITH_HMAC_SECRET
EOF
info ".env.local written at $FE_ENV"

# ── Frontend build ────────────────────────────────────────────────────────────
section "7 — Frontend npm install & build"
cd "$FRONTEND_DIR"
npm install --silent
npm run build
info "Frontend built"
fi  # end DO_FRONTEND

# ── Website .env ──────────────────────────────────────────────────────────────
if $DO_WEBSITE; then
section "7b — Website .env"
WS_ENV="$WEBSITE_DIR/.env.local"
cat > "$WS_ENV" <<EOF
NEXT_PUBLIC_APP_URL=http://$SERVER_IP:$FE_PORT
EOF
info ".env.local written at $WS_ENV"

# ── Website build ─────────────────────────────────────────────────────────────
section "7c — Website npm install & build"
cd "$WEBSITE_DIR"
npm install --silent
npm run build
info "Website built"
fi  # end DO_WEBSITE

# ── systemctl — Backend ───────────────────────────────────────────────────────
if $DO_BACKEND; then
section "8 — systemctl service: auto-olt-backend (port $BE_PORT)"
cat > /etc/systemd/system/auto-olt-backend.service <<EOF
[Unit]
Description=Auto OLT Backend (Django / Daphne ASGI)
After=network.target redis-server.service

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$BACKEND_DIR
EnvironmentFile=$ENV_FILE
ExecStart=$VENV_DIR/bin/daphne -b 0.0.0.0 -p $BE_PORT auto_olt.asgi:application
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
info "Backend service file written"
fi  # end DO_BACKEND (systemd unit)

# ── systemctl — Frontend ──────────────────────────────────────────────────────
if $DO_FRONTEND; then
section "9 — systemctl service: auto-olt-frontend (port $FE_PORT)"
cat > /etc/systemd/system/auto-olt-frontend.service <<EOF
[Unit]
Description=Auto OLT Frontend (Next.js)
After=network.target auto-olt-backend.service

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$FRONTEND_DIR
Environment=PORT=$FE_PORT
Environment=HOSTNAME=0.0.0.0
ExecStart=$(which npx) next start -p $FE_PORT -H 0.0.0.0
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
info "Frontend service file written"
fi  # end DO_FRONTEND (systemd unit)

# ── systemctl — Website ───────────────────────────────────────────────────────
if $DO_WEBSITE; then
section "9b — systemctl service: auto-olt-website (port $WS_PORT)"
cat > /etc/systemd/system/auto-olt-website.service <<EOF
[Unit]
Description=Auto OLT Marketing Website (Next.js)
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$WEBSITE_DIR
Environment=PORT=$WS_PORT
Environment=HOSTNAME=0.0.0.0
ExecStart=$(which npx) next start -p $WS_PORT -H 0.0.0.0
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
info "Website service file written"
fi  # end DO_WEBSITE (systemd unit)

# ── systemctl — Celery worker ─────────────────────────────────────────────────
if $DO_CELERY; then
section "10 — systemctl service: auto-olt-celery (worker)"
cat > /etc/systemd/system/auto-olt-celery.service <<EOF
[Unit]
Description=Auto OLT Celery Worker
After=network.target redis-server.service

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$BACKEND_DIR
EnvironmentFile=$ENV_FILE
ExecStart=$VENV_DIR/bin/celery -A auto_olt worker --loglevel=info --pool=gevent --concurrency=200
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
info "Celery worker service file written"

# ── systemctl — Celery Beat ───────────────────────────────────────────────────
section "10b — systemctl service: auto-olt-celery-beat (scheduler)"
# Beat writes a schedule file — keep it inside the backend dir
BEAT_SCHEDULE_FILE="$BACKEND_DIR/celerybeat-schedule"
cat > /etc/systemd/system/auto-olt-celery-beat.service <<EOF
[Unit]
Description=Auto OLT Celery Beat Scheduler
After=network.target redis-server.service auto-olt-celery.service

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$BACKEND_DIR
EnvironmentFile=$ENV_FILE
ExecStart=$VENV_DIR/bin/celery -A auto_olt beat --loglevel=info --scheduler celery.beat.PersistentScheduler --schedule=$BEAT_SCHEDULE_FILE
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
info "Celery Beat service file written"
fi  # end DO_CELERY

# ── Enable & start ────────────────────────────────────────────────────────────
section "11 — Enable & start services"
systemctl daemon-reload

# Only enable + restart the units this run actually touched. Leaves other
# units untouched so "Frontend only" reruns don't bounce the backend.
SVCS_TO_ENABLE=()
$DO_BACKEND  && SVCS_TO_ENABLE+=(auto-olt-backend)
$DO_FRONTEND && SVCS_TO_ENABLE+=(auto-olt-frontend)
$DO_WEBSITE  && SVCS_TO_ENABLE+=(auto-olt-website)
$DO_CELERY   && SVCS_TO_ENABLE+=(auto-olt-celery auto-olt-celery-beat)

if [[ ${#SVCS_TO_ENABLE[@]} -gt 0 ]]; then
  systemctl enable "${SVCS_TO_ENABLE[@]}"
  for svc in "${SVCS_TO_ENABLE[@]}"; do
    systemctl restart "$svc"
  done
  info "Enabled + restarted: ${SVCS_TO_ENABLE[*]}"
else
  info "No service changes — skipping enable/restart"
fi

sleep 3
BE_STATUS=$(systemctl is-active auto-olt-backend 2>/dev/null || echo "n/a")
FE_STATUS=$(systemctl is-active auto-olt-frontend 2>/dev/null || echo "n/a")
WS_STATUS=$(systemctl is-active auto-olt-website 2>/dev/null || echo "n/a")
CELERY_STATUS=$(systemctl is-active auto-olt-celery 2>/dev/null || echo "n/a")
BEAT_STATUS=$(systemctl is-active auto-olt-celery-beat 2>/dev/null || echo "n/a")
WG_STATUS=$(systemctl is-active "wg-quick@${WG_IFACE}" 2>/dev/null || echo "n/a")

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         Auto OLT Setup Complete          ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}  Backend  : http://$SERVER_IP:$BE_PORT   ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Frontend : http://$SERVER_IP:$FE_PORT   ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Website  : http://$SERVER_IP:$WS_PORT   ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Login    : admin / admin123             ${GREEN}║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}  Backend    service : $BE_STATUS                  ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Frontend   service : $FE_STATUS                  ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Website    service : $WS_STATUS                  ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Worker     service : $CELERY_STATUS              ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Beat       service : $BEAT_STATUS                ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  WireGuard  service : $WG_STATUS                  ${GREEN}║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}  WG endpoint  : $SERVER_IP:$WG_PORT       ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  WG pubkey    : (in backend/.env)         ${GREEN}║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo "  Useful commands:"
echo "  sudo systemctl status  auto-olt-backend"
echo "  sudo systemctl status  auto-olt-frontend"
echo "  sudo systemctl status  auto-olt-website"
echo "  sudo systemctl status  auto-olt-celery"
echo "  sudo systemctl status  auto-olt-celery-beat"
echo "  sudo journalctl -u auto-olt-backend      -f"
echo "  sudo journalctl -u auto-olt-frontend     -f"
echo "  sudo journalctl -u auto-olt-website      -f"
echo "  sudo journalctl -u auto-olt-celery       -f"
echo "  sudo journalctl -u auto-olt-celery-beat  -f"
echo "  sudo systemctl restart auto-olt-backend"
echo "  sudo systemctl restart auto-olt-frontend"
echo "  sudo systemctl restart auto-olt-website"
echo "  sudo systemctl restart auto-olt-celery"
echo "  sudo systemctl restart auto-olt-celery-beat"

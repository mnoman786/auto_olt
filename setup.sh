#!/usr/bin/env bash
# =============================================================================
#  Auto OLT — Full Project Setup Script
#  Run once on a fresh server:  sudo bash setup.sh
#  Server IP : 162.217.248.75
#  Backend   : http://162.217.248.75:9005
#  Frontend  : http://162.217.248.75:3001
# =============================================================================
set -e

# ── Colour helpers ────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
section() { echo -e "\n${GREEN}══════════════════════════════════════════${NC}"; echo -e "${GREEN} $*${NC}"; echo -e "${GREEN}══════════════════════════════════════════${NC}"; }

# ── Config ────────────────────────────────────────────────────────────────────
SERVER_IP="162.217.248.75"
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
VENV_DIR="$BACKEND_DIR/venv"
BE_PORT=9005
FE_PORT=3001
SERVICE_USER="${SUDO_USER:-$(whoami)}"
NODE_VERSION="20"

# ── Root check ────────────────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  echo -e "${RED}Please run as root: sudo bash setup.sh${NC}"; exit 1
fi

section "1 — System packages"
apt-get update -qq
apt-get install -y -qq python3 python3-pip python3-venv curl git build-essential
# Also install versioned venv package for Python 3.12 / 3.11 if present
PY_VER=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
apt-get install -y -qq "python${PY_VER}-venv" 2>/dev/null || true
info "System packages installed (Python $PY_VER)"

# ── Node.js ───────────────────────────────────────────────────────────────────
section "2 — Node.js $NODE_VERSION"
if ! command -v node &>/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d 'v')" -lt "$NODE_VERSION" ]]; then
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
  apt-get install -y -qq nodejs
fi
info "Node $(node -v) / npm $(npm -v)"

# ── Python venv + deps ────────────────────────────────────────────────────────
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

# ── Backend .env ──────────────────────────────────────────────────────────────
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
JWT_ACCESS_TOKEN_LIFETIME_MINUTES=60
JWT_REFRESH_TOKEN_LIFETIME_DAYS=7

# ── Encryption (OLT passwords at rest) ───────────────────────
# WARNING: Never change this after data is written.
FIELD_ENCRYPTION_KEY=jLA2s6sE6cOz6U2AI9yB3kUiJCtts2WZL0pl-0YcOMc=

# ── HMAC Response Signing ────────────────────────────────────
HMAC_SECRET=105eff89fe94e55e87aee967eb9b9339ff7a3061afc279dab3e4ae3e87199f1c

# ── Admin ────────────────────────────────────────────────────
ADMIN_URL=olt-control-9f3a/

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
EMAIL_HOST_USER=mnomanch786@gmail.com
EMAIL_HOST_PASSWORD=jpsk pypc ixul ashp
DEFAULT_FROM_EMAIL=Auto OLT <mnomanch786@gmail.com>

# ── ONU Provisioning ─────────────────────────────────────────
ONU_REGISTER_METHOD=hybrid
DEFAULT_TELNET_USERNAME=admin
DEFAULT_TELNET_PASSWORD=admin
DEFAULT_TELNET_PORT=23
OLT_MGMT_USER=autoolt
OLT_MGMT_PASSWORD=autoolt123
OLT_MGMT_PRIVILEGE=15

# ── WireGuard ────────────────────────────────────────────────
WG_INTERFACE=wg0
WG_ENDPOINT=$SERVER_IP:51820
WG_SERVER_PUBLIC_KEY=egHNg6PWBMadeIIgiaLpCHV9q6pzMUJBV0/1ouwNdCI=
EOF
info ".env written at $ENV_FILE"

# ── Django migrations ─────────────────────────────────────────────────────────
section "5 — Django migrate"
cd "$BACKEND_DIR"
"$VENV_DIR/bin/python" manage.py migrate --run-syncdb
info "Database ready"

# ── Frontend .env ─────────────────────────────────────────────────────────────
section "6 — Frontend .env"
FE_ENV="$FRONTEND_DIR/.env.local"
cat > "$FE_ENV" <<EOF
NEXT_PUBLIC_API_URL=http://$SERVER_IP:$BE_PORT/api
NEXT_PUBLIC_HMAC_SECRET=105eff89fe94e55e87aee967eb9b9339ff7a3061afc279dab3e4ae3e87199f1c
EOF
info ".env.local written at $FE_ENV"

# ── Frontend build ────────────────────────────────────────────────────────────
section "7 — Frontend npm install & build"
cd "$FRONTEND_DIR"
npm install --silent
npm run build
info "Frontend built"

# ── systemctl — Backend ───────────────────────────────────────────────────────
section "8 — systemctl service: auto-olt-backend (port $BE_PORT)"
cat > /etc/systemd/system/auto-olt-backend.service <<EOF
[Unit]
Description=Auto OLT Backend (Django / Gunicorn)
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$BACKEND_DIR
EnvironmentFile=$ENV_FILE
ExecStart=$VENV_DIR/bin/python $BACKEND_DIR/manage.py runserver 0.0.0.0:$BE_PORT
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
info "Backend service file written"

# ── systemctl — Frontend ──────────────────────────────────────────────────────
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

# ── Enable & start ────────────────────────────────────────────────────────────
section "10 — Enable & start services"
systemctl daemon-reload
systemctl enable auto-olt-backend auto-olt-frontend
systemctl restart auto-olt-backend
systemctl restart auto-olt-frontend

sleep 3
BE_STATUS=$(systemctl is-active auto-olt-backend)
FE_STATUS=$(systemctl is-active auto-olt-frontend)

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         Auto OLT Setup Complete          ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}  Backend  : http://$SERVER_IP:$BE_PORT   ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Frontend : http://$SERVER_IP:$FE_PORT   ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Login    : admin / admin123             ${GREEN}║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}  BE service : $BE_STATUS                       ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  FE service : $FE_STATUS                       ${GREEN}║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo "  Useful commands:"
echo "  sudo systemctl status  auto-olt-backend"
echo "  sudo systemctl status  auto-olt-frontend"
echo "  sudo journalctl -u auto-olt-backend  -f"
echo "  sudo journalctl -u auto-olt-frontend -f"
echo "  sudo systemctl restart auto-olt-backend"
echo "  sudo systemctl restart auto-olt-frontend"

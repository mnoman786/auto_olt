# Auto OLT - Smart ISP OLT Management System

A full-stack automated ISP OLT management platform built with **Next.js** (frontend) and **Django REST Framework** (backend), designed for ISPs to manage OLT devices, provision ONUs, and configure VLANs — all fully automated without manual CLI interaction.

---

## Features

- **User Authentication** — JWT-based login with per-user OLT isolation
- **OLT Management** — Add, configure, and monitor OLT devices
- **Automated Setup Wizard** — Real-time setup logs showing SNMP validation, system info fetch, Telnet CLI config
- **ONU Discovery** — Automatic SNMP polling to discover registered and unregistered ONUs
- **ONU Provisioning** — One-click provisioning via SNMP, Telnet, or Hybrid mode
- **VLAN Management** — Create and bind VLANs to ONUs during provisioning
- **Hybrid Provisioning** — SNMP-first with automatic Telnet fallback

---

## Architecture

```
auto_olt/
├── backend/                  # Django REST Framework
│   ├── auto_olt/             # Django project config
│   ├── apps/
│   │   ├── accounts/         # User auth (JWT)
│   │   ├── olts/             # OLT models + setup API
│   │   ├── onus/             # ONU models + provisioning API
│   │   └── vlans/            # VLAN models + API
│   ├── services/
│   │   ├── snmp_service.py   # SNMP GET/SET/WALK operations
│   │   ├── telnet_service.py # Telnet CLI automation
│   │   └── provisioning_service.py  # Orchestration layer
│   ├── .env                  # Environment config
│   └── requirements.txt
└── frontend/                 # Next.js 14 App Router
    ├── app/
    │   ├── dashboard/        # OLT overview
    │   ├── login/            # Auth pages
    │   ├── register/
    │   └── olts/
    │       ├── add/          # Add OLT form
    │       └── [id]/
    │           ├── page.tsx  # OLT detail
    │           ├── setup/    # Real-time setup wizard
    │           ├── onus/     # ONU management
    │           └── vlans/    # VLAN management
    ├── components/           # Reusable UI components
    └── lib/                  # API client, auth, types
```

---

## Quick Start

### Prerequisites
- Python 3.9+
- Node.js 18+

### Backend

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

**Access at:** http://localhost:3000

---

## Environment Variables

### Backend (`backend/.env`)

```env
SECRET_KEY=your-secret-key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1,*
CORS_ALLOWED_ORIGINS=http://localhost:3000

# Default Telnet credentials for initial OLT setup
DEFAULT_TELNET_USERNAME=admin
DEFAULT_TELNET_PASSWORD=admin
DEFAULT_TELNET_PORT=23

# Auto-created management user on OLT
OLT_MGMT_USER=autoolt
OLT_MGMT_PASSWORD=autoolt123
OLT_MGMT_PRIVILEGE=15
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register/` | Create account |
| POST | `/api/auth/login/` | Login (returns JWT) |
| POST | `/api/auth/logout/` | Logout |
| GET | `/api/auth/me/` | Current user |

### OLTs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/olts/` | List / Create OLTs |
| GET/PUT/DELETE | `/api/olts/{id}/` | OLT detail |
| POST | `/api/olts/{id}/setup/` | Trigger setup |
| GET | `/api/olts/{id}/setup/logs/` | Setup logs |
| POST | `/api/olts/{id}/poll/` | SNMP poll |
| GET | `/api/olts/{id}/stats/` | OLT statistics |

### ONUs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/olts/{id}/onus/` | List ONUs (with `?status=unregistered\|registered`) |
| POST | `/api/olts/{id}/onus/{id}/register/` | Provision ONU |
| POST | `/api/olts/{id}/onus/{id}/deregister/` | Deregister ONU |
| GET | `/api/olts/{id}/onus/{id}/logs/` | Provisioning logs |

### VLANs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/olts/{id}/vlans/` | List / Create VLANs |
| GET/PUT/DELETE | `/api/olts/{id}/vlans/{id}/` | VLAN detail |

---

## Windows Quick Start

Double-click to start:
- `start_backend.bat` — Starts Django backend
- `start_frontend.bat` — Starts Next.js frontend

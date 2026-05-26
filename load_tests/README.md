# Load Tests — Auto OLT

## Install

```bash
pip install locust
```

## Run with web UI (recommended first time)

```bash
cd load_tests
locust -f locustfile.py --host http://5.154.181.180:9005
```

Open **http://localhost:8089**, set:
- Number of users: `100`
- Spawn rate: `10` (adds 10 users/sec until 100 reached)
- Click **Start swarming**

## Run headless (CI / scripted)

```bash
locust -f locustfile.py \
  --host http://5.154.181.180:9005 \
  --headless \
  -u 100 \
  -r 10 \
  --run-time 2m \
  --html report.html
```

Opens `report.html` with full results after the run.

## Custom credentials

```bash
LOAD_TEST_USER=myuser LOAD_TEST_PASS=mypass locust -f locustfile.py ...
```

## What it tests

| Endpoint | Weight | Why |
|---|---|---|
| `GET /api/olts/` | 5 | Dashboard — most common action |
| `GET /api/olts/[id]/stats/` | 4 | OLT detail page |
| `GET /api/olts/[id]/bandwidth/?hours=24` | 4 | Traffic graphs |
| `GET /api/olts/[id]/onus/` | 4 | ONU list |
| `GET /api/olts/[id]/ports/` | 3 | Port list |
| `GET /api/olts/[id]/vlans/` | 2 | VLAN list |
| `GET /api/olts/[id]/setup/logs/` | 2 | Setup logs |
| `GET /api/olts/[id]/bandwidth/?hours=168` | 2 | 7-day graph |
| `GET /api/auth/me/` | 1 | Profile |

## Reading results

- **RPS** — requests per second your server handles
- **p50 / p95 / p99** — response times (p95 < 500ms = good)
- **Failure %** — should be 0%; spikes mean the server is overwhelmed
- **429 errors** — you're hitting rate limits (expected under heavy load)

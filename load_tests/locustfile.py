"""
Auto OLT — Load Test
====================
Simulates realistic user behaviour: login → browse OLTs → check stats →
view bandwidth → list ONUs → list ports → logout.

Install:
    pip install locust

Run (web UI — open http://localhost:8089):
    locust -f locustfile.py --host http://5.154.181.180:9005

Run headless (100 users, 10 spawn/sec, 2 min):
    locust -f locustfile.py --host http://5.154.181.180:9005 \
           --headless -u 100 -r 10 --run-time 2m \
           --html report.html

Environment variables (override defaults):
    LOAD_TEST_USER=admin
    LOAD_TEST_PASS=admin123
"""
import os
import random
import logging
from locust import HttpUser, task, between, events

logger = logging.getLogger(__name__)

TEST_USER = os.getenv('LOAD_TEST_USER', 'admin')
TEST_PASS = os.getenv('LOAD_TEST_PASS', 'admin123')


class OLTUser(HttpUser):
    """
    Simulates a logged-in ISP operator browsing the Auto OLT dashboard.
    Wait 1–5s between actions — realistic human pacing.
    """
    wait_time = between(1, 5)

    def on_start(self):
        """Login once per virtual user and store the JWT token."""
        self.token = None
        self.olt_ids = []
        self._login()

    def on_stop(self):
        if self.token:
            self.client.post(
                '/api/auth/logout/',
                json={'refresh': self.refresh_token},
                headers=self._auth(),
                name='/api/auth/logout/',
            )

    # ── Auth helpers ─────────────────────────────────────────────────────────

    def _login(self):
        with self.client.post(
            '/api/auth/login/',
            json={'username': TEST_USER, 'password': TEST_PASS},
            name='/api/auth/login/',
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                data = resp.json()
                self.token         = data.get('access')
                self.refresh_token = data.get('refresh', '')
                resp.success()
            else:
                resp.failure(f'Login failed: {resp.status_code} {resp.text[:120]}')

    def _auth(self):
        return {'Authorization': f'Bearer {self.token}'} if self.token else {}

    def _olt_id(self):
        """Return a random OLT id from the cached list, or None."""
        return random.choice(self.olt_ids) if self.olt_ids else None

    # ── Tasks (weight = relative frequency) ──────────────────────────────────

    @task(5)
    def list_olts(self):
        """Most common action — operator opens the dashboard."""
        with self.client.get(
            '/api/olts/',
            headers=self._auth(),
            name='/api/olts/',
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                results = resp.json().get('results', [])
                self.olt_ids = [o['id'] for o in results]
                resp.success()
            elif resp.status_code == 401:
                self._login()
                resp.failure('401 — re-logged in')
            else:
                resp.failure(f'{resp.status_code}')

    @task(4)
    def olt_stats(self):
        """View ONU stats for a specific OLT."""
        olt_id = self._olt_id()
        if not olt_id:
            return
        with self.client.get(
            f'/api/olts/{olt_id}/stats/',
            headers=self._auth(),
            name='/api/olts/[id]/stats/',
            catch_response=True,
        ) as resp:
            if resp.status_code not in (200, 404):
                resp.failure(f'{resp.status_code}')

    @task(4)
    def bandwidth_24h(self):
        """Load 24h bandwidth graphs — most common graph view."""
        olt_id = self._olt_id()
        if not olt_id:
            return
        with self.client.get(
            f'/api/olts/{olt_id}/bandwidth/?hours=24',
            headers=self._auth(),
            name='/api/olts/[id]/bandwidth/?hours=24',
            catch_response=True,
        ) as resp:
            if resp.status_code not in (200, 404):
                resp.failure(f'{resp.status_code}')

    @task(2)
    def bandwidth_7d(self):
        """Less frequent — operator checking weekly trend."""
        olt_id = self._olt_id()
        if not olt_id:
            return
        with self.client.get(
            f'/api/olts/{olt_id}/bandwidth/?hours=168',
            headers=self._auth(),
            name='/api/olts/[id]/bandwidth/?hours=168',
            catch_response=True,
        ) as resp:
            if resp.status_code not in (200, 404):
                resp.failure(f'{resp.status_code}')

    @task(4)
    def list_onus(self):
        """View ONU list for an OLT."""
        olt_id = self._olt_id()
        if not olt_id:
            return
        with self.client.get(
            f'/api/olts/{olt_id}/onus/',
            headers=self._auth(),
            name='/api/olts/[id]/onus/',
            catch_response=True,
        ) as resp:
            if resp.status_code not in (200, 404):
                resp.failure(f'{resp.status_code}')

    @task(3)
    def list_ports(self):
        """View port list."""
        olt_id = self._olt_id()
        if not olt_id:
            return
        with self.client.get(
            f'/api/olts/{olt_id}/ports/',
            headers=self._auth(),
            name='/api/olts/[id]/ports/',
            catch_response=True,
        ) as resp:
            if resp.status_code not in (200, 404):
                resp.failure(f'{resp.status_code}')

    @task(2)
    def list_vlans(self):
        """View VLANs."""
        olt_id = self._olt_id()
        if not olt_id:
            return
        with self.client.get(
            f'/api/olts/{olt_id}/vlans/',
            headers=self._auth(),
            name='/api/olts/[id]/vlans/',
            catch_response=True,
        ) as resp:
            if resp.status_code not in (200, 404):
                resp.failure(f'{resp.status_code}')

    @task(2)
    def setup_logs(self):
        """Check setup logs."""
        olt_id = self._olt_id()
        if not olt_id:
            return
        with self.client.get(
            f'/api/olts/{olt_id}/setup/logs/',
            headers=self._auth(),
            name='/api/olts/[id]/setup/logs/',
            catch_response=True,
        ) as resp:
            if resp.status_code not in (200, 404):
                resp.failure(f'{resp.status_code}')

    @task(1)
    def me(self):
        """Fetch own profile — background call made by the frontend."""
        with self.client.get(
            '/api/auth/me/',
            headers=self._auth(),
            name='/api/auth/me/',
            catch_response=True,
        ) as resp:
            if resp.status_code == 401:
                self._login()
                resp.failure('401 — re-logged in')
            elif resp.status_code != 200:
                resp.failure(f'{resp.status_code}')

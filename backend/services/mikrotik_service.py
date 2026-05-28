"""
MikroTik RouterOS API integration.

Used for creating PPPoE users on a linked MikroTik router when a customer
is registered. Requires the `routeros-api` package.
"""
import logging

logger = logging.getLogger(__name__)


def _connect(host, port, username, password):
    import routeros_api
    pool = routeros_api.RouterOsApiPool(
        host,
        username=username,
        password=password,
        port=int(port),
        plaintext_login=True,
    )
    api = pool.get_api()
    return pool, api


def test_connection(host, port, username, password):
    """Try connecting to MikroTik and return {success, message}."""
    pool = None
    try:
        pool, api = _connect(host, port, username, password)
        resource = api.get_resource('/system/identity')
        identity = resource.get()
        name = identity[0].get('name', '') if identity else ''
        return {'success': True, 'message': f'Connected to {name or host}'}
    except Exception as exc:
        return {'success': False, 'message': str(exc)}
    finally:
        if pool:
            try:
                pool.disconnect()
            except Exception:
                pass


def create_pppoe_user(host, port, username, password, pppoe_username, pppoe_password):
    """Create a PPPoE secret on MikroTik. Skips silently if user already exists."""
    pool = None
    try:
        pool, api = _connect(host, port, username, password)
        resource = api.get_resource('/ppp/secret')
        existing = [s for s in resource.get() if s.get('name') == pppoe_username]
        if existing:
            return {'success': True, 'created': False, 'message': 'PPPoE user already exists'}
        resource.add(
            name=pppoe_username,
            password=pppoe_password,
            service='pppoe',
        )
        return {'success': True, 'created': True, 'message': f'PPPoE user {pppoe_username} created'}
    except Exception as exc:
        logger.error(f'MikroTik create_pppoe_user failed for {pppoe_username}: {exc}')
        return {'success': False, 'created': False, 'message': str(exc)}
    finally:
        if pool:
            try:
                pool.disconnect()
            except Exception:
                pass

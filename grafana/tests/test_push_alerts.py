import contextlib
import http.server
import json
import os
from pathlib import Path
import runpy
import tempfile
import threading
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / 'push-alerts.py'


class AlertApiTest(unittest.TestCase):
    def request(self, responses):
        received = []

        class Handler(http.server.BaseHTTPRequestHandler):
            def do_POST(self):
                received.append(self.rfile.read(int(self.headers['Content-Length'])))
                status, body = responses[min(len(received) - 1, len(responses) - 1)]
                self.send_response(status)
                self.end_headers()
                self.wfile.write(body.encode())

            def log_message(self, *args):
                pass

        with http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler) as server:
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                env = {'GRAFANA_URL': f'http://127.0.0.1:{server.server_port}', 'GRAFANA_TOKEN': 'test'}
                # Load the CLI in an empty workspace: no deployments run on import.
                with tempfile.TemporaryDirectory() as directory, contextlib.chdir(directory), patch.dict(os.environ, env), patch('sys.exit'), patch('time.sleep'):
                    api = runpy.run_path(str(SCRIPT))['api']
                    result = api('POST', '/api/ruler/grafana/api/v1/rules/homelab', {'name': 'node-disk'})
                return result, received
            finally:
                server.shutdown()
                thread.join()

    def test_deploy_finds_all_alerts_from_another_directory(self):
        calls = []

        def api(method, path, body=None, extra_headers=None):
            calls.append((method, path, body))
            return 200, '{}'

        env = {'GRAFANA_URL': 'http://grafana.test', 'GRAFANA_TOKEN': 'test',
               'TELEGRAM_BOT_TOKEN': 'test'}
        with tempfile.TemporaryDirectory() as directory, contextlib.chdir(directory), patch.dict(os.environ, env):
            main = runpy.run_path(str(SCRIPT))['main']
            with patch.dict(main.__globals__, {'api': api}):
                self.assertEqual(main(), 0)
        groups = [body for method, path, body in calls if '/api/ruler/' in path]
        expected = {rule['uid'] for path in (SCRIPT.parent / 'alerts').glob('*.json')
                    for rules in json.loads(path.read_text()).get('groups', {}).values()
                    for rule in rules}
        actual = {rule['grafana_alert']['uid'] for group in groups for rule in group['rules']}
        self.assertEqual(actual, expected)
        self.assertTrue(any('/provisioning/templates/' in path for _, path, _ in calls))
        self.assertTrue(any('/provisioning/contact-points/' in path for _, path, _ in calls))
        self.assertTrue(any(path.endswith('/provisioning/policies') for _, path, _ in calls))

    def test_retries_locked_rule_group_with_same_payload(self):
        result, bodies = self.request([(500, 'database is locked'), (202, 'accepted')])
        self.assertEqual(result, (202, 'accepted'))
        self.assertEqual(len(bodies), 2)
        self.assertEqual(bodies[0], bodies[1])
        self.assertEqual(json.loads(bodies[0]), {'name': 'node-disk'})

    def test_persistent_lock_is_reported_after_bounded_attempts(self):
        result, bodies = self.request([(500, 'database is locked')])
        self.assertEqual(result, (500, 'database is locked'))
        self.assertEqual(len(bodies), 3)

    def test_other_server_errors_are_not_retried(self):
        result, bodies = self.request([(500, 'invalid rule')])
        self.assertEqual(result, (500, 'invalid rule'))
        self.assertEqual(len(bodies), 1)


if __name__ == '__main__':
    unittest.main()

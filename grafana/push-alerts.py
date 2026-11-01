#!/usr/bin/env python3
"""Заливка правил алертов из alerts/*.json в Grafana (Ruler API).

  GRAFANA_URL=http://monitoring.home.arpa:3000 GRAFANA_TOKEN=glsa_xxx ./push-alerts.py

POST на namespace заменяет группу целиком, поэтому запуск идемпотентен:
удалённое из файла правило исчезает и в Grafana.
ponytail: группу, целиком удалённую из файла, скрипт не трогает — убирать руками.
"""
import glob, json, os, sys, time, urllib.error, urllib.request
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

URL = os.environ["GRAFANA_URL"].rstrip("/")
TOKEN = os.environ["GRAFANA_TOKEN"]
DS = os.environ.get("DS_UID", os.environ.get("DS_UID_PROMETHEUS", "ca323c89-304d-4630-90ab-16c715c6e304"))


def api(method, path, body=None, extra_headers=None):
    headers = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
    headers.update(extra_headers or {})
    req = urllib.request.Request(
        URL + path, method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers=headers)
    # Grafana's SQLite writer can briefly lock while rule evaluation is active.
    # Retry only this known transient response; keep other failures visible.
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.status, r.read().decode()
        except urllib.error.HTTPError as e:
            with e:
                code, response = e.code, e.read().decode()
            if code != 500 or "database is locked" not in response.lower() or attempt == 2:
                return code, response
            print(f"  Grafana database is locked; retry {attempt + 1}/2", flush=True)
            time.sleep(2 ** (attempt + 1))


def rule(r, service="spruthub"):
    """Компактное правило из файла -> формат Grafana.

    service попадает в метку правила: по ней Notification policies разводят
    уведомления разных сервисов. Значение берётся из поля "service" файла,
    По умолчанию используется service=spruthub.
    """
    return {
        "for": r.get("for", "5m"),
        "keep_firing_for": "0s",
        "labels": {"severity": r.get("severity", "warning"), "service": service},
        "annotations": {"summary": r["summary"], "description": r.get("description", "")},
        "grafana_alert": {
            "uid": r["uid"],
            "title": r["title"],
            "condition": "B",
            # выражения написаны так, что серия возвращается только при проблеме,
            # поэтому единое условие для всех правил: "что-то вернулось"
            "no_data_state": r.get("noData", "OK"),
            "exec_err_state": "Error",
            # Grafana 12: сколько прогонов без серии до закрытия алерта
            "missing_series_evals_to_resolve": 1,
            "data": [
                {"refId": "A", "relativeTimeRange": {"from": 43200, "to": 0},
                 "datasourceUid": DS,
                 "model": {"refId": "A", "expr": r["expr"], "instant": True,
                           "editorMode": "code", "range": False}},
                {"refId": "B", "relativeTimeRange": {"from": 0, "to": 0},
                 "datasourceUid": "__expr__",
                 "model": {"refId": "B", "type": "threshold", "expression": "A",
                           "conditions": [{"evaluator": {"type": "gt", "params": [0]}}]}},
            ],
        },
    }


def main():
    fail = False
    for f in sorted(glob.glob(str(BASE_DIR / "alerts/*.json"))):
        d = json.loads(Path(f).read_text())
        folder_uid = d.get("folderUid", "spruthub")
        code, body = api("POST", "/api/folders", {"uid": folder_uid, "title": d.get("folder", folder_uid)})
        print(f"папка {folder_uid}: {'создана' if code in (200, 201) else 'уже есть'}")
        for group, rules in d["groups"].items():
            code, body = api("POST", f"/api/ruler/grafana/api/v1/rules/{folder_uid}",
                             {"name": group, "interval": d.get("interval", "1m"),
                              "rules": [rule(r, d.get("service", "spruthub")) for r in rules]})
            print(f"  {group}: HTTP {code}, правил {len(rules)}" + (f" {body[:300]}" if code >= 300 else ""))
            fail |= code >= 300
    return 1 if fail else 0


if __name__ == "__main__":
    sys.exit(main())

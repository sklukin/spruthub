#!/usr/bin/env python3
"""Заливка правил алертов из alerts/*.json в Grafana (Ruler API).

  GRAFANA_URL=http://192.168.1.50:3000 GRAFANA_TOKEN=glsa_xxx ./grafana/push-alerts.py

POST на namespace заменяет группу целиком, поэтому запуск идемпотентен:
удалённое из файла правило исчезает и в Grafana.
ponytail: группу, целиком удалённую из файла, скрипт не трогает — убирать руками.
"""
import glob, json, os, sys, urllib.error, urllib.request

# Правила ищутся рядом со скриптом, а не в текущем каталоге: запуск из корня
# репозитория и из любого другого места должен давать один результат.
os.chdir(os.path.dirname(os.path.abspath(__file__)))

URL = os.environ["GRAFANA_URL"].rstrip("/")
TOKEN = os.environ["GRAFANA_TOKEN"]
# Алерты считаются только по VictoriaMetrics: InfluxDB здесь короткая история для графиков.
DS = os.environ.get("DS_UID_PROMETHEUS", "ca323c89-304d-4630-90ab-16c715c6e304")


def api(method, path, body=None, extra_headers=None):
    headers = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
    headers.update(extra_headers or {})
    req = urllib.request.Request(
        URL + path, method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def rule(r, service):
    """Компактное правило из файла -> формат Grafana.

    service попадает в метку правила: по ней Notification policies разводят
    уведомления разных сервисов.
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


def contact_points(d):
    """Секреты приезжают из окружения, в репозитории их нет."""
    ok = True
    for cp in d["contactPoints"]:
        env = cp.pop("secretEnv", {})
        missing = [e for e in env.values() if not os.environ.get(e)]
        if missing:
            print(f"  {cp['name']}: ПРОПУСК, нет переменных {missing}")
            continue
        cp["settings"].update({k: os.environ[e] for k, e in env.items()})
        # X-Disable-Provenance: иначе Grafana пометит точку как provisioned и запретит правки в UI
        hdr = {"X-Disable-Provenance": "true"}
        code, body = api("PUT", f"/api/v1/provisioning/contact-points/{cp['uid']}", cp, hdr)
        if code == 404:
            code, body = api("POST", "/api/v1/provisioning/contact-points", cp, hdr)
        print(f"  {cp['name']}: HTTP {code}" + (f" {body[:300]}" if code >= 300 else ""))
        ok &= code < 300
    return ok


fail = False
for f in sorted(glob.glob("alerts/*.json")):
    d = json.load(open(f))
    if "contactPoints" in d:
        print(f"точки контакта из {f}:")
        fail |= not contact_points(d)
        continue
    folder_uid = d.get("folderUid", "spruthub")
    code, body = api("POST", "/api/folders", {"uid": folder_uid, "title": d.get("folder", folder_uid)})
    print(f"папка {folder_uid}: {'создана' if code in (200, 201) else 'уже есть'}")
    for group, rules in d["groups"].items():
        code, body = api("POST", f"/api/ruler/grafana/api/v1/rules/{folder_uid}",
                         {"name": group, "interval": d.get("interval", "1m"),
                          "rules": [rule(r, d.get("service", "spruthub")) for r in rules]})
        print(f"  {group}: HTTP {code}, правил {len(rules)}" + (f" {body[:300]}" if code >= 300 else ""))
        fail |= code >= 300
sys.exit(1 if fail else 0)

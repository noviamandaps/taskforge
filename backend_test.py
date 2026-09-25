import os
import re
import subprocess
import urllib.request

BASE = os.environ.get("NEXT_PUBLIC_BASE_URL", "https://task-flow-hub-81.preview.emergentagent.com").rstrip("/")


def request(method):
    req = urllib.request.Request(f"{BASE}/api", method=method)
    with urllib.request.urlopen(req, timeout=20) as response:
        return response.status, dict(response.headers), response.read()


def main():
    status, headers, body = request("GET")
    assert status == 200, status
    assert body.decode() == '{"ok":true,"service":"taskforge-api","phase":"workspace-foundation"}', body
    print("PASS GET /api health")
    status, headers, body = request("OPTIONS")
    assert status == 204, status
    assert headers.get("Access-Control-Allow-Origin") == "*"
    assert "GET" in headers.get("Access-Control-Allow-Methods", "")
    print("PASS OPTIONS /api health")
    schema = open("supabase/schema.sql", encoding="utf-8").read()
    checks = {
        "uuid defaults": "id uuid primary key default gen_random_uuid()" in schema,
        "workspace role enum": "create type public.workspace_role as enum ('owner', 'admin', 'member', 'guest')" in schema,
        "workspace membership relationship": "workspace_id uuid not null references public.workspaces(id) on delete cascade" in schema,
        "project relationship": "workspace_id uuid not null references public.workspaces(id) on delete cascade" in schema,
        "RLS enabled": "alter table public.workspaces enable row level security" in schema,
        "owner create policy": "create policy workspace_create" in schema and "with check (owner_id = auth.uid())" in schema,
        "member create owner path": "exists (select 1 from public.workspaces where id = workspace_id and owner_id = auth.uid())" in schema,
    }
    for name, ok in checks.items():
        assert ok, name
    print("PASS schema static foundation checks")


if __name__ == "__main__":
    main()

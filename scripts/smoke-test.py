#!/usr/bin/env python3
"""Comprehensive PantryButler end-to-end smoke test.

Systematically exercises every major button/action in the app against a running
server, using only the Python standard library (optionally plus Playwright for
the UI layer when PB_PLAYWRIGHT=1). Each `check()` is one counted assertion;
the run ends with `Succeeded: X / Y` plus full detail for every failure.

Sections (mapped to UI flows):
  A. Auth & Account          login, register, /me, change password, profile,
                             instance switch, bad-login rejection
  B. Setup bootstrap         setup/status, seed/create-admin guards, setup files
  C. Recipes                 create/read/update/delete, public toggle + slug,
                             tags, folders, ingredient autocomplete, URL import
  D. Grocery list            add recipe/custom item, check bought, consolidate,
                             clear
  E. Pantry & ingredients    add/update/delete pantry w/ units + cost, usage,
                             equipment, conversions, custom locations
  F. Calendar                schedule meal, mark as cooked (pantry decrement),
                             delete meal
  G. Kitchen layout          models/elements/placements CRUD + location sync
  H. Nutrition admin         search, food detail, calculate, custom nutrition,
                             superadmin export/import gates
  I. Settings & profile      settings CRUD, member list, instance members,
                             user tutorials
  J. Admin & superadmin      setup validate, admin instances (feature gate),
                             announcements (active list, view, unread)
  K. API tokens              mint (JWT-only), scope enforcement, self-inspect,
                             sibling-revoke rejection, revocation
  L. Notifications           list, unread count, mark read, read all
  M. Files                   image upload (real PNG), public fetch, delete,
                             invalid-content rejection
  UI. Playwright              visit every page, click every button, capture
                             console errors + uncaught JS exceptions
  N. Account teardown        self-delete guard + admin deletes the test user

Usage:
    PB_BASE=http://localhost:3000 python3 scripts/smoke-test.py
    PB_PLAYWRIGHT=1 python3 scripts/smoke-test.py   # also run browser UI checks

Exit code is non-zero if any assertion failed.
"""

import hashlib
import json
import os
import re
import secrets
import subprocess
import sys
import time
import urllib.error
import urllib.request
from fractions import Fraction

BASE = os.environ.get("PB_BASE", "http://localhost:3000")
ADMIN_EMAIL = os.environ.get("PB_ADMIN_EMAIL", "admin@pantrybutler.local")
TEST_PASS = "testpass123"
RUN_UI = os.environ.get("PB_PLAYWRIGHT") == "1"


def load_env_2container():
    """Load credentials from the standalone stack's .env.2container so the smoke
    test can authenticate as the admin and reach the database without hardcoding
    secrets. Searched in order: $PB_ENV_2CONTAINER, docker/.env.2container,
    .env.2container, <repo>/.env.2container. Returns a plain KEY->VALUE dict."""
    candidates = [
        os.environ.get("PB_ENV_2CONTAINER"),
        os.path.join(os.path.dirname(__file__), "..", "docker", ".env.2container"),
        ".env.2container",
        os.path.join(os.path.dirname(__file__), "..", ".env.2container"),
    ]
    for path in candidates:
        if not path:
            continue
        p = os.path.abspath(path)
        if not os.path.isfile(p):
            continue
        values = {}
        with open(p, "r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if line.startswith("export "):
                    line = line[len("export "):]
                if "=" not in line:
                    continue
                key, _, val = line.partition("=")
                val = val.strip()
                if len(val) >= 2 and val[0] in "\"'" and val[-1] == val[0]:
                    val = val[1:-1]
                values[key.strip()] = val
        if values:
            return values
    return {}


# Admin + DB credentials default to the standalone stack's .env.2container so a
# freshly launched instance (whose admin/password are generated there) can be
# smoked without passing anything on the command line.
ENV2 = load_env_2container()
ADMIN_PASS = os.environ.get("PB_ADMIN_PASS") or ENV2.get("ADMIN_PASSWORD") or "admin123"

# A real 1x1 transparent PNG (valid magic bytes for the upload check).
PNG_1PX = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
    "0000000d49444154789c626001000000ffff03000006000557bfabd40000000049454e44ae426082"
)

BOUNDARY = "----pantrybutler-smoketest"

# --------------------------------------------------------------------------- #
# Reporter — every check() counts as one assertion
# --------------------------------------------------------------------------- #
_area = "bootstrap"
_passed = 0
_failed = 0
_skipped = 0
_failures = []  # [{area, name, method, path, ms, expected, detail}]
_skips = []     # [{area, name, detail}]
_last_request = {"method": "", "path": "", "ms": 0.0}


def section(area):
    global _area
    _area = area
    print(f"\n=== {area} ===")


def check(cond, name, detail="", expected=""):
    global _passed, _failed
    if cond:
        _passed += 1
        print(f"  PASS  {name}" + (f"  ({detail})" if detail else ""))
    else:
        _failed += 1
        _failures.append({
            "area": _area,
            "name": name,
            "method": _last_request["method"],
            "path": _last_request["path"],
            "ms": _last_request["ms"],
            "expected": expected,
            "detail": detail,
        })
        print(f"  FAIL  {name}" + (f"  ({detail})" if detail else ""))
    return cond


def skip(name, detail=""):
    global _skipped
    _skipped += 1
    _skips.append({"area": _area, "name": name, "detail": detail})
    print(f"  SKIP  {name}" + (f"  ({detail})" if detail else ""))


def find(items, predicate):
    if isinstance(items, list):
        for it in items:
            if isinstance(it, dict) and predicate(it):
                return it
    return None


# --------------------------------------------------------------------------- #
# HTTP helpers
# --------------------------------------------------------------------------- #
def _request(req, raw):
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            data = resp.read()
            ms = (time.perf_counter() - t0) * 1000.0
            if raw:
                return resp.status, data, ms
            try:
                return resp.status, (json.loads(data) if data else None), ms
            except json.JSONDecodeError:
                return resp.status, data.decode("utf-8", "replace"), ms
    except urllib.error.HTTPError as e:
        data = e.read()
        ms = (time.perf_counter() - t0) * 1000.0
        if raw:
            return e.code, data, ms
        try:
            return e.code, (json.loads(data) if data else None), ms
        except json.JSONDecodeError:
            return e.code, data.decode("utf-8", "replace"), ms
    except urllib.error.URLError as e:
        ms = (time.perf_counter() - t0) * 1000.0
        return 0, {"error": f"network error: {e.reason}"}, ms


def call(method, path, token=None, body=None, raw=False):
    url = BASE + path
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    status, resp, ms = _request(req, raw)
    _last_request.update(method=method, path=path, ms=ms)
    return status, resp


def call_multipart(path, token, fields=None, file_field=None, filename=None,
                   file_bytes=None, content_type=None):
    body = b""
    for k, v in (fields or {}).items():
        body += (f"--{BOUNDARY}\r\n"
                 f'Content-Disposition: form-data; name="{k}"\r\n\r\n'
                 f"{v}\r\n").encode("utf-8")
    if file_field:
        body += (f"--{BOUNDARY}\r\n"
                 f'Content-Disposition: form-data; name="{file_field}"; '
                 f'filename="{filename}"\r\n'
                 f"Content-Type: {content_type}\r\n\r\n").encode("utf-8")
        body += file_bytes + b"\r\n"
    body += f"--{BOUNDARY}--\r\n".encode("utf-8")

    req = urllib.request.Request(BASE + path, data=body, method="POST")
    req.add_header("Content-Type", f"multipart/form-data; boundary={BOUNDARY}")
    req.add_header("Authorization", f"Bearer {token}")
    status, resp, ms = _request(req, False)
    _last_request.update(method="POST", path=path, ms=ms)
    return status, resp


def status_ok(status, *codes):
    return status in codes


def body_text(body, limit=220):
    try:
        return json.dumps(body)[:limit]
    except Exception:
        return str(body)[:limit]


# --------------------------------------------------------------------------- #
# Small cooklang-ish parser for the .cook import simulation
# --------------------------------------------------------------------------- #
def qty_to_number(text):
    text = (text or "").strip()
    if not text:
        return 1
    m = re.match(r"^([\d\s/.+-]+)", text)
    if not m:
        return 1
    raw = m.group(1).strip().replace(" ", "+")
    try:
        return float(Fraction(raw))
    except Exception:
        m2 = re.match(r"\d+", raw)
        return float(m2.group()) if m2 else 1


def parse_cooklang(text):
    """Extract @ingredient{amount%unit} lines -> [{name, quantity, unit}]."""
    ingredients = []
    for name, meta in re.findall(r"@([^@%{}\s]+(?:\s+[^@#%{}\s]+)*)\{([^}]*)\}", text):
        quantity, _, unit = meta.partition("%")
        ingredients.append({
            "name": name.strip(),
            "quantity": qty_to_number(quantity),
            "unit": unit.strip(),
        })
    return ingredients


# --------------------------------------------------------------------------- #
# Email verification helper
# --------------------------------------------------------------------------- #
# When the running server requires email verification, /register returns
# `requiresEmailVerification: true` and no token, so the throwaway smoke-test
# user cannot sign in until the address is confirmed. The smoke test confirms
# the address itself: it writes a one-time verification token directly into the
# database, then finalizes through the real /verify-email endpoint (which runs
# handle_new_user and creates the instance). The stored token is a SHA-256 hash
# of the raw token, mirroring server/src/utils/tokens sha256Hex.
#
# Connection selection (in order):
#   PB_DATABASE_URL  set  -> psql "<PB_DATABASE_URL>" directly (no docker)
#   otherwise             -> `docker compose exec db psql` against the default
#                            local stack (credentials overridable via
#                            PB_DB_USER / PB_DB_PASSWORD / PB_DB_NAME).
COMPOSE_CMD = os.environ.get("PB_COMPOSE_CMD", "docker compose").split()
COMPOSE_FILE = os.environ.get("PB_COMPOSE_FILE", "docker-compose.yml")
PSQL_BIN = os.environ.get("PB_PSQL_BIN", "psql")
DB_USER = os.environ.get("PB_DB_USER") or ENV2.get("POSTGRES_USER") or "pantrybutler"
DB_PASSWORD = os.environ.get("PB_DB_PASSWORD") or ENV2.get("POSTGRES_PASSWORD") or "pb_local_9f2c4a7e_5b8d"
DB_NAME = os.environ.get("PB_DB_NAME") or ENV2.get("POSTGRES_DB") or "pantrybutler"
DATABASE_URL = os.environ.get("PB_DATABASE_URL")


def _psql(sql):
    if DATABASE_URL:
        cmd = [PSQL_BIN, DATABASE_URL, "-tAc", sql]
    else:
        cmd = COMPOSE_CMD + ["-f", COMPOSE_FILE, "exec", "-T",
               "-e", f"PGPASSWORD={DB_PASSWORD}", "db",
               "psql", "-U", DB_USER, "-d", DB_NAME, "-tAc", sql]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"psql failed ({proc.returncode}): {proc.stderr.strip()}")
    return proc.stdout.strip()


def verify_test_user_via_db(ctx):
    email = ctx["test_email"].replace("'", "''")
    raw = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    _psql(
        "INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) "
        f"SELECT u.id, '{token_hash}', NOW() + interval '1 hour' "
        f"FROM users u WHERE u.email = '{email}';"
    )
    status, body = call("GET", f"/api/auth/verify-email?token={raw}")
    ok = status == 200 and isinstance(body, dict) and body.get("token")
    check(ok, "Verify test user email (db token)", f"status={status}",
          expected="200 + token")
    if not ok:
        print("  Cannot continue: test user email could not be verified.")
        sys.exit(1)
    ctx["test_uid"] = body.get("user", {}).get("id")
    return body["token"]


# --------------------------------------------------------------------------- #
# A. Auth & Account
# --------------------------------------------------------------------------- #
def section_auth(ctx):
    section("A. Auth & Account")

    status, body = call("GET", "/api/health")
    check(status == 200 and isinstance(body, dict) and body.get("status") == "ok",
          "Health check", f"status={status}", expected="200 ok")

    status, body = call("POST", "/api/auth/login",
                        body={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    ok = status == 200 and isinstance(body, dict) and body.get("token")
    check(ok, "Admin login", f"status={status}", expected="200 + token")
    if not ok:
        print("  Cannot continue without admin login.")
        sys.exit(1)
    ctx["admin_token"] = body["token"]
    ctx["admin_uid"] = body.get("user", {}).get("id")

    status, body = call("GET", "/api/auth/me", token=ctx["admin_token"])
    ok = status == 200 and isinstance(body, dict) and body.get("profile") and body.get("instances")
    check(ok, "Fetch admin profile + instances", f"status={status}", expected="200")
    if not ok:
        sys.exit(1)
    ctx["admin_role"] = body["profile"].get("role")
    admin_instance = next((i for i in body["instances"] if i.get("role") in ("admin",)), None) \
        or (body["instances"][0] if body["instances"] else None)
    check(bool(admin_instance), "Determine admin instance", str(admin_instance and admin_instance.get("id")))
    ctx["admin_instance"] = admin_instance["id"]

    # Register a throwaway test user (creates its own kitchen instance).
    ctx["test_email"] = f"smoketest-{secrets.token_hex(4)}@pantrybutler.local"
    status, body = call("POST", "/api/auth/register",
                        body={"email": ctx["test_email"], "password": TEST_PASS,
                              "instance_name": "Smoke Test Kitchen"})
    requires_verify = isinstance(body, dict) and body.get("requiresEmailVerification") is True
    ok = status == 201 and isinstance(body, dict) and (body.get("token") or requires_verify)
    check(ok, "Register test user", f"status={status}", expected="201 + token")
    if not ok:
        sys.exit(1)
    ctx["test_uid"] = body.get("user", {}).get("id")
    if body.get("token"):
        ctx["test_token"] = body["token"]
    else:
        # Email verification required: confirm the address via the database, then
        # finalize through the real verify-email endpoint to create the instance.
        ctx["test_token"] = verify_test_user_via_db(ctx)

    status, body = call("GET", "/api/auth/me", token=ctx["test_token"])
    ok = status == 200 and body.get("instances")
    check(ok, "Test user kitchen instance auto-created", f"status={status}", expected="200")
    if not ok:
        sys.exit(1)
    ctx["test_instance"] = body["instances"][0]["id"]

    # Wrong-password login is rejected.
    status, body = call("POST", "/api/auth/login",
                        body={"email": ctx["test_email"], "password": "wrong-password"})
    check(status == 401, "Reject login with wrong password", f"status={status}", expected="401")

    # Change password, then log in with the new password (and not the old one).
    new_pass = f"newpass{secrets.token_hex(4)}!"
    status, body = call("POST", "/api/auth/change-password", token=ctx["test_token"],
                        body={"currentPassword": TEST_PASS, "password": new_pass})
    check(status == 200, "Change password", f"status={status}", expected="200")

    status, body = call("POST", "/api/auth/login",
                        body={"email": ctx["test_email"], "password": new_pass})
    ok = status == 200 and isinstance(body, dict) and body.get("token")
    check(ok, "Login with new password", f"status={status}", expected="200")
    if ok:
        ctx["test_token"] = body["token"]
    ctx["test_pass"] = new_pass

    status, body = call("POST", "/api/auth/login",
                        body={"email": ctx["test_email"], "password": TEST_PASS})
    check(status == 401, "Old password no longer works", f"status={status}", expected="401")

    # Profile self-edit and role lookup.
    status, body = call("PUT", f"/api/profiles/{ctx['test_uid']}", token=ctx["test_token"],
                        body={"display_name": "Smoke Test User"})
    check(status == 200 and body.get("display_name") == "Smoke Test User",
          "Update own profile display name", f"status={status}", expected="200")

    status, body = call("GET", f"/api/profiles/role?instance_id={ctx['test_instance']}",
                        token=ctx["test_token"])
    check(status == 200 and body.get("role") == "admin",
          "Test user is admin of own instance", f"status={status}", expected="200 admin")

    # Instance switch (own instance).
    status, body = call("PUT", "/api/auth/instance", token=ctx["test_token"],
                        body={"instance_id": ctx["test_instance"]})
    check(status == 200 and isinstance(body, dict) and body.get("profile"),
          "Switch active instance", f"status={status}", expected="200")


# --------------------------------------------------------------------------- #
# B. Setup bootstrap
# --------------------------------------------------------------------------- #
def section_setup(ctx):
    section("B. Setup bootstrap")

    status, body = call("GET", "/api/setup/status", token=ctx["admin_token"])
    ok = status == 200 and isinstance(body, dict) and body.get("success") and isinstance(body.get("validation"), dict)
    check(ok, "Setup status report", f"status={status}", expected="200 {success, validation}")
    if ok:
        check(body["validation"].get("nutritionData") is True,
              "Nutrition data present", f"count={body['validation'].get('nutritionCount')}")

    status, body = call("POST", "/api/setup/create-admin",
                        body={"email": "bootstrap@example.com", "password": "bootstrap123"})
    check(status == 400, "create-admin blocked once users exist", f"status={status}", expected="400")

    status, body = call("POST", "/api/setup/seed-nutrition", token=ctx["admin_token"])
    check(status == 200 and body.get("success") is False,
          "seed-nutrition blocked (data already seeded)", f"status={status} - {body_text(body)}",
          expected="200 success:false (server returns 200 with success:false)")

    status, body = call("GET", "/api/setup/files", token=ctx["admin_token"])
    check(status == 200 and isinstance(body, list), "List setup files", f"status={status}", expected="200 []")
    if status == 200:
        check(any(f.get("name", "").endswith(".json") for f in body),
              "Setup dir contains .json seed files", f"{[f.get('name') for f in body]}")

    status, body = call("GET", "/api/setup/files/nutrition_foods.json", token=ctx["admin_token"])
    check(status == 200 and isinstance(body, dict) and isinstance(body.get("data"), list),
          "Read nutrition_foods.json seed file", f"status={status}", expected="200 {data: []}")
    if status == 200:
        check(len(body["data"]) > 0, "Seed file has records", f"{len(body['data'])} records")


# --------------------------------------------------------------------------- #
# C. Recipes
# --------------------------------------------------------------------------- #
def section_recipes(ctx):
    section("C. Recipes")
    t = ctx["test_token"]
    inst = ctx["test_instance"]

    # Import a .cook file (client-side parse simulated via create-recipe).
    cook_text = (
        ">> title: Classic Chocolate Chip Cookies\n"
        "@butter{1%cup}\n@brown sugar{3/4%cup}\n@eggs{2}\n"
        "@all-purpose flour{2 1/4%cups}\n@baking soda{1%tsp}\n"
        "@salt{1%tsp}\n@chocolate chips{2%cups}\n"
        "Cream together, then bake for ~{12%minutes}."
    )
    ing = parse_cooklang(cook_text)
    check(len(ing) >= 5, "Parse .cook ingredients", f"{len(ing)} parsed")

    status, body = call("POST", "/api/recipes", token=t, body={
        "instance_id": inst, "title": "Cook Import Test",
        "description": "Imported from a .cook file", "ingredients": ing,
        "sections": [{"title": "Steps", "order_index": 0,
                      "steps": [{"order_index": 0, "instruction": "Cream together, then bake for 12 minutes."}]}],
        "tags": ["imported", "cook"],
    })
    ctx["cook_recipe_id"] = body.get("id") if status in (200, 201) else None
    check(status in (200, 201) and ctx["cook_recipe_id"], "Create recipe from .cook import",
          f"status={status}", expected="201")

    # Manual recipe (used by grocery, calendar-cook, and equipment tests).
    status, body = call("POST", "/api/recipes", token=t, body={
        "instance_id": inst, "title": "Manual Salt Test",
        "description": "Manually entered test recipe",
        "ingredients": [{"name": "Flour", "quantity": 1, "unit": "kg"},
                        {"name": "salt", "quantity": 1, "unit": "tsp"}],
        "equipment": ["Oven"],
        "sections": [{"title": "Steps", "order_index": 0,
                      "steps": [{"order_index": 0, "instruction": "Season to taste."}]}],
        "servings": 2,
    })
    ctx["manual_recipe_id"] = body.get("id") if status in (200, 201) else None
    check(status in (200, 201) and ctx["manual_recipe_id"], "Create manual recipe",
          f"status={status}", expected="201")

    status, body = call("GET", f"/api/recipes?instance_id={inst}", token=t)
    check(status == 200 and isinstance(body, list) and any(r.get("id") == ctx["manual_recipe_id"] for r in body),
          "Recipe appears in recipe list", f"status={status}", expected="200")

    status, body = call("GET", f"/api/recipes/{ctx['manual_recipe_id']}", token=t)
    check(status == 200 and body.get("title") == "Manual Salt Test",
          "Fetch single recipe", f"status={status}", expected="200")
    check(status == 200 and isinstance(body.get("ingredients"), list) and len(body["ingredients"]) >= 2,
          "Recipe detail includes ingredients", f"{len(body.get('ingredients', []))}")

    status, body = call("PUT", f"/api/recipes/{ctx['manual_recipe_id']}", token=t,
                        body={"title": "Manual Salt Test (renamed)", "instance_id": inst})
    check(status == 200 and body.get("title") == "Manual Salt Test (renamed)",
          "Rename recipe", f"status={status}", expected="200")

    # Public toggle -> public slug is served without auth.
    status, body = call("PUT", f"/api/recipes/{ctx['manual_recipe_id']}/public", token=t,
                        body={"is_public": True})
    slug = body.get("publicSlug") if status == 200 else None
    check(status == 200 and slug, "Make recipe public", f"status={status} slug={slug}", expected="200 {publicSlug}")
    status, body = call("GET", f"/api/recipes/public/{slug}")
    check(status == 200 and body.get("title") == "Manual Salt Test (renamed)",
          "Public recipe page served (no auth)", f"status={status}", expected="200")
    status, body = call("PUT", f"/api/recipes/{ctx['manual_recipe_id']}/public", token=t,
                        body={"is_public": False})
    check(status == 200, "Make recipe private again", f"status={status}", expected="200")

    # Tags + folders.
    status, body = call("GET", f"/api/tags?instance_id={inst}", token=t)
    check(status == 200 and isinstance(body, list), "List tags", f"status={status}", expected="200")
    check(any(r.get("name") == "imported" for r in (body if isinstance(body, list) else [])),
          "Tag auto-created from recipe", "", expected="'imported' present")

    status, body = call("POST", "/api/folders", token=t,
                        body={"instance_id": inst, "name": "Smoke Folder"})
    folder_id = body.get("id") if status == 201 else None
    check(status == 201 and folder_id, "Create folder", f"status={status}", expected="201")
    status, body = call("PUT", f"/api/folders/{folder_id}", token=t, body={"name": "Smoke Folder 2"})
    check(status == 200 and body.get("name") == "Smoke Folder 2", "Rename folder",
          f"status={status}", expected="200")

    status, body = call("PUT", f"/api/recipes/{ctx['manual_recipe_id']}", token=t,
                        body={"folder_id": folder_id, "instance_id": inst})
    check(status == 200, "Assign recipe to folder", f"status={status}", expected="200")
    status, body = call("GET", f"/api/recipes?instance_id={inst}&folder_id={folder_id}", token=t)
    check(status == 200 and any(r.get("id") == ctx["manual_recipe_id"] for r in body),
          "Folder filter returns recipe", f"status={status}", expected="200")

    status, body = call("DELETE", f"/api/folders/{folder_id}", token=t)
    check(status == 200, "Delete folder", f"status={status}", expected="200")

    # Ingredient autocomplete endpoints.
    status, body = call("GET", "/api/recipe-ingredients/names", token=t)
    check(status == 200 and isinstance(body, list) and len(body) > 0,
          "Recipe ingredient name autocomplete", f"status={status} ({len(body)} entries)")
    status, body = call("GET", "/api/recipe-ingredients/units", token=t)
    check(status == 200 and isinstance(body, list), "Recipe ingredient units autocomplete", f"status={status}")
    status, body = call("GET", "/api/recipe-ingredients/preparations", token=t)
    check(status == 200 and isinstance(body, list), "Recipe ingredient preparations autocomplete", f"status={status}")

    # Import a recipe from a URL (external network; non-fatal).
    url = os.environ.get("PB_EXTRACT_URL", "https://en.wikipedia.org/wiki/Guacamole")
    status, body = call("POST", "/api/extract-recipe", token=t, body={"url": url})
    if status == 200 and isinstance(body, dict) and body.get("recipe", {}).get("title"):
        check(True, "Extract recipe from URL", f"{body['recipe']['title']}", expected="200")
        status, body = call("POST", "/api/recipes", token=t, body={
            "instance_id": inst,
            "title": f"URL Import: {body['recipe']['title']}",
            "ingredients": [{"name": line, "quantity": 1, "unit": ""}
                            for line in body["recipe"].get("ingredients", [])[:5]],
            "sections": [{"title": "Steps", "order_index": 0,
                          "steps": [{"order_index": 0, "instruction": "Follow the source recipe."}]}],
        })
        check(status in (200, 201), "Persist URL-imported recipe", f"status={status}")
    else:
        skip("URL recipe import (external network)", f"status={status} - {body_text(body)}")


# --------------------------------------------------------------------------- #
# D. Grocery list
# --------------------------------------------------------------------------- #
def section_grocery(ctx):
    section("D. Grocery list")
    t = ctx["test_token"]
    inst = ctx["test_instance"]

    status, body = call("POST", "/api/grocery/recipes", token=t,
                        body={"instance_id": inst, "recipe_id": ctx["manual_recipe_id"]})
    check(status == 201, "Add recipe to grocery list", f"status={status}", expected="201")

    status, body = call("GET", f"/api/grocery/recipes?instance_id={inst}", token=t)
    check(status == 200 and isinstance(body, list) and any(r.get("recipe_id") == ctx["manual_recipe_id"] for r in body),
          "Recipe appears in grocery list", f"status={status}", expected="200")

    status, body = call("POST", "/api/grocery/custom", token=t,
                        body={"instance_id": inst, "name": "Salt", "quantity": 1, "unit": "container"})
    custom_id = body.get("id") if status == 201 else None
    check(status == 201 and custom_id, "Add custom grocery item (Salt)", f"status={status}", expected="201")

    status, body = call("PUT", f"/api/grocery/custom/{custom_id}", token=t,
                        body={"is_purchased": True})
    check(status == 200 and body.get("is_purchased") is True, "Check item as bought",
          f"status={status}", expected="200 is_purchased:true")

    status, body = call("POST", "/api/grocery/consolidate", token=t,
                        body={"instance_id": inst})
    check(status == 200 and isinstance(body, list) and any("flour" in str(r.get("name", "")).lower() for r in body),
          "Consolidate grocery list (units merged)", f"status={status} ({len(body)} lines)",
          expected="200 consolidated[]")

    status, body = call("DELETE", f"/api/grocery/recipes/{ctx['manual_recipe_id']}", token=t)
    check(status == 200, "Remove recipe from grocery list", f"status={status}", expected="200")

    status, body = call("DELETE", f"/api/grocery/custom/{custom_id}", token=t)
    check(status == 200, "Delete custom grocery item", f"status={status}", expected="200")

    status, body = call("GET", f"/api/grocery/custom?instance_id={inst}", token=t)
    check(status == 200 and isinstance(body, list) and all(r.get("id") != custom_id for r in body),
          "Grocery item no longer listed", f"status={status}", expected="200")


# --------------------------------------------------------------------------- #
# E. Pantry, ingredients, equipment
# --------------------------------------------------------------------------- #
def section_pantry(ctx):
    section("E. Pantry, ingredients, equipment")
    t = ctx["test_token"]
    inst = ctx["test_instance"]

    # Add a bought item to the pantry with units and cost (3 kg for $3).
    status, body = call("POST", "/api/pantry", token=t, body={
        "instance_id": inst, "ingredient_name": "Salt", "unit": "kg",
        "amount": 3, "price": 3, "price_size": 3,
    })
    salt_id = body.get("id") if status in (200, 201) else None
    check(status in (200, 201) and salt_id, "Add Salt to pantry (3kg / $3)", f"status={status}", expected="201")

    # A second pantry item for the calendar-cook decrement test.
    status, body = call("POST", "/api/pantry", token=t, body={
        "instance_id": inst, "ingredient_name": "Flour", "unit": "kg", "amount": 2,
    })
    ctx["flour_id"] = body.get("id") if status in (200, 201) else None
    check(status in (200, 201) and ctx["flour_id"], "Add Flour to pantry (2kg)", f"status={status}", expected="201")

    status, body = call("GET", f"/api/pantry?instance_id={inst}", token=t)
    salt_rows = [p for p in (body if isinstance(body, list) else [])
                 if p.get("ingredient_name", "").lower() == "salt"]
    check(status == 200 and isinstance(body, list), "List pantry", f"status={status}", expected="200")
    check(len(salt_rows) == 1, "Pantry contains exactly one Salt entry", f"{len(salt_rows)}")

    # Link salt to the nutrition DB, keep 3 kg / $3.
    status, search = call("GET", "/api/nutrition/search?q=salt&limit=5", token=t)
    nutrition_food_id = search[0].get("id") if status == 200 and isinstance(search, list) and search else None
    check(status == 200 and nutrition_food_id, "Search nutrition DB for 'salt'",
          f"nutrition_food_id={nutrition_food_id}", expected="200 [foods]")

    update = {"amount": 3, "unit": "kg", "price": 3, "price_size": 3}
    if nutrition_food_id:
        update["nutrition_food_id"] = nutrition_food_id
    status, body = call("PUT", f"/api/pantry/{salt_id}", token=t, body=update)
    check(status == 200, "Update Salt to 3kg/$3 linked to nutrition DB", f"status={status}", expected="200")

    status, body = call("GET", f"/api/pantry?instance_id={inst}", token=t)
    updated = find(body, lambda p: p.get("id") == salt_id)
    check(updated and float(updated.get("amount", 0)) == 3 and float(updated.get("price", 0)) == 3
          and updated.get("unit") == "kg",
          "Verify pantry shows Salt 3kg / $3",
          f"amount={updated.get('amount') if updated else None} price={updated.get('price') if updated else None}",
          expected="amount 3 / price 3 / unit kg")

    status, body = call("GET", f"/api/pantry/{salt_id}/usage", token=t)
    check(status == 200 and isinstance(body, dict) and "isUsed" in body,
          "Check pantry item usage", f"status={status} isUsed={body.get('isUsed') if isinstance(body, dict) else None}",
          expected="200 {isUsed, recipes}")
    check(status == 200 and body.get("isUsed") is True,
          "Salt usage found in recipes", "", expected="isUsed:true")

    # Equipment.
    status, body = call("POST", "/api/equipment", token=t,
                        body={"instance_id": inst, "name": "Oven", "location": "Counter"})
    oven_id = body.get("id") if status == 201 else None
    check(status == 201 and oven_id, "Add equipment (Oven)", f"status={status}", expected="201")

    status, body = call("PUT", f"/api/equipment/{oven_id}", token=t, body={"location": "Pantry"})
    check(status == 200 and body.get("location") == "Pantry", "Update equipment location",
          f"status={status}", expected="200")

    status, body = call("GET", f"/api/equipment/{oven_id}/usage", token=t)
    check(status == 200 and body.get("isUsed") is True,
          "Oven usage found in recipe", "", expected="200 isUsed:true")

    # Conversions (also auto-created for nutrition-linked ingredients).
    status, body = call("POST", "/api/conversions", token=t, body={
        "instance_id": inst, "ingredient_name": "Butter", "cup_to_g": 227,
    })
    check(status == 201, "Create unit conversion (Butter)", f"status={status}", expected="201")
    status, body = call("GET", f"/api/conversions?instance_id={inst}&ingredient_name=Butter", token=t)
    check(status == 200 and isinstance(body, list) and any(c.get("ingredient_name") == "Butter" for c in body),
          "Conversion listed", f"status={status}", expected="200")

    # Custom locations.
    status, body = call("POST", "/api/locations", token=t,
                        body={"instance_id": inst, "location_name": "Spice Rack"})
    check(status == 201, "Add custom location (Spice Rack)", f"status={status}", expected="201")
    status, body = call("GET", f"/api/locations?instance_id={inst}", token=t)
    check(status == 200 and isinstance(body, list) and "Spice Rack" in body,
          "Custom location listed", f"status={status}", expected="200")

    # Keep Salt in the pantry (teardown cleans it); delete Flour? No — used by
    # the calendar-cook decrement test. Leave both for later sections.
    ctx["salt_id"] = salt_id
    ctx["oven_id"] = oven_id


# --------------------------------------------------------------------------- #
# F. Calendar
# --------------------------------------------------------------------------- #
def section_calendar(ctx):
    section("F. Calendar")
    t = ctx["test_token"]
    inst = ctx["test_instance"]

    status, body = call("POST", "/api/calendar", token=t, body={
        "instance_id": inst, "recipe_id": ctx["manual_recipe_id"],
        "meal_date": "2026-08-15", "meal_type": "dinner",
    })
    meal_id = body.get("id") if status == 201 else None
    check(status == 201 and meal_id, "Schedule a meal (dinner)", f"status={status}", expected="201")

    status, body = call("GET", f"/api/calendar?instance_id={inst}"
                               f"&start_date=2026-08-01&end_date=2026-08-31", token=t)
    meal = find(body, lambda m: m.get("id") == meal_id)
    check(status == 200 and meal, "Calendar shows the meal", f"status={status}", expected="200")
    check(meal and meal.get("recipe", {}).get("title"), "Meal detail includes recipe title",
          meal and meal.get("recipe", {}).get("title") or "missing")

    # Mark as cooked: Flour pantry item is 2kg and recipe uses 1kg.
    status, body = call("POST", f"/api/calendar/{meal_id}/cook", token=t)
    check(status == 200, "Mark meal as cooked", f"status={status}", expected="200")

    status, body = call("GET", f"/api/pantry?instance_id={inst}", token=t)
    flour = find(body, lambda p: p.get("id") == ctx["flour_id"])
    check(flour and float(flour.get("amount", -1)) == 1.0,
          "Pantry Flour decremented by recipe qty (2kg -> 1kg)",
          f"amount={flour.get('amount') if flour else None}", expected="amount 1")

    status, body = call("GET", f"/api/calendar?instance_id={inst}"
                               f"&start_date=2026-08-01&end_date=2026-08-31", token=t)
    meal = find(body, lambda m: m.get("id") == meal_id)
    check(meal and meal.get("is_cooked") is True, "Meal marked cooked in calendar",
          f"is_cooked={meal.get('is_cooked') if meal else None}", expected="true")

    status, body = call("DELETE", f"/api/calendar/{meal_id}", token=t)
    check(status == 200, "Delete calendar meal", f"status={status}", expected="200")


# --------------------------------------------------------------------------- #
# G. Kitchen layout
# --------------------------------------------------------------------------- #
def section_kitchen(ctx):
    section("G. Kitchen layout")
    t = ctx["test_token"]
    inst = ctx["test_instance"]

    status, body = call("POST", "/api/kitchen/models", token=t,
                        body={"instance_id": inst, "name": "Kitchen A"})
    model_id = body.get("id") if status in (200, 201) else None
    check(status in (200, 201) and model_id, "Create kitchen layout (Kitchen A)",
          f"status={status}", expected="201")

    status, body = call("PUT", f"/api/kitchen/models/{model_id}", token=t,
                        body={"name": "Kitchen A Renamed"})
    check(status == 200 and body.get("name") == "Kitchen A Renamed", "Rename kitchen layout",
          f"status={status}", expected="200")

    status, body = call("GET", f"/api/kitchen/models?instance_id={inst}", token=t)
    check(status == 200 and isinstance(body, list) and any(m.get("id") == model_id for m in body),
          "Kitchen layout listed", f"status={status}", expected="200")

    status, body = call("POST", "/api/kitchen/elements", token=t, body={
        "model_id": model_id, "element_type": "pantry", "x": 0, "y": 0,
        "width": 100, "height": 100, "custom_name": "Pantry",
    })
    element_id = body.get("id") if status in (200, 201) else None
    check(status in (200, 201) and element_id, "Add 'Pantry' element to layout",
          f"status={status}", expected="201")

    status, body = call("PUT", f"/api/kitchen/elements/{element_id}", token=t,
                        body={"custom_name": "Pantry Shelf"})
    check(status == 200 and body.get("custom_name") == "Pantry Shelf", "Rename element",
          f"status={status}", expected="200")

    status, body = call("GET", f"/api/kitchen/models/{model_id}/elements", token=t)
    el = find(body, lambda e: e.get("id") == element_id)
    check(status == 200 and el, "Elements listed for model", f"status={status}", expected="200")

    # Place both an ingredient and equipment on the layout.
    status, body = call("POST", "/api/kitchen/placements", token=t, body={
        "element_id": element_id, "item_type": "ingredient", "item_id": ctx["salt_id"],
    })
    check(status == 201 and body.get("id"), "Place ingredient in layout", f"status={status}", expected="201")

    status, body = call("POST", "/api/kitchen/placements", token=t, body={
        "element_id": element_id, "item_type": "equipment", "item_id": ctx["oven_id"],
    })
    check(status == 201 and body.get("id"), "Place equipment in layout", f"status={status}", expected="201")

    status, body = call("GET", f"/api/kitchen/elements/{element_id}/placements", token=t)
    check(status == 200 and isinstance(body, list) and len(body) == 2,
          "Element has 2 placements", f"status={status} ({len(body) if isinstance(body, list) else '?'})",
          expected="2 placements")

    # Location strings must reflect model\element after the rename.
    status, body = call("GET", f"/api/kitchen/locations?instance_id={inst}", token=t)
    expected_loc = "Kitchen A Renamed\\Pantry Shelf"
    check(status == 200 and isinstance(body, list) and expected_loc in body,
          "Kitchen locations include renamed model\\element", f"status={status}",
          expected=expected_loc)

    status, body = call("GET", f"/api/pantry?instance_id={inst}", token=t)
    salt = find(body, lambda p: p.get("id") == ctx["salt_id"])
    check(salt and salt.get("location") == expected_loc,
          "Pantry item location synced from layout",
          f"location={salt.get('location') if salt else None}", expected=expected_loc)

    # Un-place + teardown.
    status, body = call("DELETE", "/api/kitchen/placements/by-item", token=t, body={
        "element_id": element_id, "item_type": "ingredient", "item_id": ctx["salt_id"],
    })
    check(status == 200, "Remove ingredient placement", f"status={status}", expected="200")

    status, body = call("DELETE", f"/api/kitchen/elements/{element_id}", token=t)
    check(status == 200, "Delete element", f"status={status}", expected="200")

    status, body = call("DELETE", f"/api/kitchen/models/{model_id}", token=t)
    check(status == 200, "Delete kitchen layout", f"status={status}", expected="200")


# --------------------------------------------------------------------------- #
# H. Nutrition admin
# --------------------------------------------------------------------------- #
def section_nutrition(ctx):
    section("H. Nutrition admin")
    t = ctx["test_token"]
    inst = ctx["test_instance"]

    status, body = call("GET", "/api/nutrition/search?q=cheddar&limit=5", token=t)
    food = body[0] if status == 200 and isinstance(body, list) and body else None
    check(status == 200 and food, "Search nutrition DB ('cheddar')",
          f"status={status} ({len(body) if isinstance(body, list) else '?'} hits)", expected="200 [foods]")

    if food:
        status, body = call("GET", f"/api/nutrition/{food['id']}", token=t)
        check(status == 200 and body.get("name"), "Fetch nutrition food by id",
              f"status={status}", expected="200")
        check(body.get("name") == food.get("name"), "Fetched food matches search hit",
              f"{body.get('name')} vs {food.get('name')}")

    status, body = call("GET", "/api/nutrition/foods", token=t)
    check(status == 200 and isinstance(body, list) and len(body) > 1000,
          "Full nutrition food list available", f"status={status} ({len(body)} foods)")

    # Nutrition calculation (recipe totals).
    status, body = call("POST", "/api/nutrition/calculate", token=t, body={
        "ingredients": [{"name": "cheddar cheese", "quantity": 100, "unit": "g"}],
        "servings": 2,
    })
    check(status == 200 and isinstance(body, dict) and body.get("total") and body.get("per_serving"),
          "Calculate recipe nutrition", f"status={status}", expected="200 {total, per_serving}")
    check(status == 200 and isinstance(body.get("total"), dict) and "calories" in body["total"],
          "Nutrition totals include calories", f"calories={body['total'].get('calories')}")

    # Custom (user-defined) nutrition entry. Include every NOT NULL column the
    # DB requires (schema has no defaults for fiber/sugar/sodium/cholesterol/
    # serving fields); a fully-filled form is what the UI sends.
    status, body = call("POST", "/api/custom-nutrition", token=t, body={
        "instance_id": inst, "ingredient_name": "Magic Dust",
        "calories": 10, "protein_g": 1, "carbs_g": 2, "fat_g": 0.5,
        "fiber_g": 0, "sugar_g": 0, "sodium_mg": 0, "cholesterol_mg": 0,
        "serving_size": "100", "serving_unit": "g",
    })
    check(status == 201 and body.get("ingredient_name") == "Magic Dust",
          "Create custom nutrition entry", f"status={status}", expected="201")

    # A partially-filled form (optional columns omitted) must still create.
    status, body = call("POST", "/api/custom-nutrition", token=t, body={
        "instance_id": inst, "ingredient_name": "Magic Dust Jr",
        "calories": 5, "protein_g": 0, "carbs_g": 1, "fat_g": 0,
    })
    check(status == 201 and body.get("ingredient_name") == "Magic Dust Jr"
          and float(body.get("fiber_g") or 0) == 0 and body.get("serving_unit") == "g",
          "Custom nutrition partial form defaults NOT NULL columns",
          f"status={status}", expected="201 (fiber_g=0, serving_unit=g)")

    # Nutrition export: a superadmin must be able to export the DB.
    status, body = call("GET", "/api/nutrition/export", token=ctx["admin_token"])
    check(status == 200 and isinstance(body, list) and len(body) > 1000,
          "Superadmin can export nutrition DB", f"status={status}",
          expected="200 [foods] (route shadowed by GET /api/nutrition/:id -> 404)")
    status, body = call("POST", "/api/nutrition/import-batch", token=t, body={"batch_data": []})
    check(status == 403, "Nutrition import-batch requires superadmin", f"status={status}", expected="403")


# --------------------------------------------------------------------------- #
# I. Settings & profile
# --------------------------------------------------------------------------- #
def section_settings_profile(ctx):
    section("I. Settings & profile")
    t = ctx["test_token"]
    inst = ctx["test_instance"]

    status, body = call("GET", f"/api/settings?instance_id={inst}", token=t)
    check(status == 200 and isinstance(body, dict), "Read instance settings",
          f"status={status}", expected="200")

    status, body = call("PUT", "/api/settings", token=t, body={
        "instance_id": inst, "dark_mode": True, "vibrant_mode": True,
        "preferred_unit_system": "metric", "cost_tracking_enabled": True,
    })
    check(status in (200, 201), "Update instance settings", f"status={status}", expected="200/201")
    status, body = call("GET", f"/api/settings?instance_id={inst}", token=t)
    check(status == 200 and body.get("dark_mode") is True and body.get("preferred_unit_system") == "metric",
          "Settings persisted", f"dark_mode={body.get('dark_mode') if isinstance(body, dict) else None}",
          expected="dark_mode:true, metric")

    status, body = call("GET", f"/api/profiles?instance_id={inst}", token=t)
    members = body if status == 200 else []
    check(status == 200 and isinstance(members, list) and any(m.get("id") == ctx["test_uid"] for m in members),
          "List instance members", f"status={status} ({len(members)})", expected="200")
    own = find(members, lambda m: m.get("id") == ctx["test_uid"])
    check(own and own.get("role") == "admin", "Own membership role is admin",
          f"role={own.get('role') if own else None}")

    # Add the test user to the admin instance as a member (then edit the role).
    status, body = call("POST", "/api/instance-members", token=ctx["admin_token"], body={
        "user_id": ctx["test_uid"], "instance_id": ctx["admin_instance"], "role": "user",
    })
    check(status == 201 and body.get("role") == "user",
          "Admin adds test user to their instance", f"status={status}", expected="201")

    status, body = call("PUT", f"/api/instance-members/{ctx['test_uid']}",
                        token=ctx["admin_token"], body={
                            "instance_id": ctx["admin_instance"], "role": "viewer",
                            "can_edit_calendar": False,
                        })
    check(status == 200 and body.get("role") == "viewer",
          "Change member role to viewer", f"status={status}", expected="200")

    # The test user can now switch active instance to the admin instance.
    status, body = call("PUT", "/api/auth/instance", token=t,
                        body={"instance_id": ctx["admin_instance"]})
    check(status == 200 and body.get("profile", {}).get("instance_id") == ctx["admin_instance"],
          "Switch active instance to shared kitchen", f"status={status}", expected="200")
    status, body = call("PUT", "/api/auth/instance", token=t,
                        body={"instance_id": inst})
    check(status == 200, "Switch back to own instance", f"status={status}", expected="200")

    # User tutorials (onboarding state).
    status, body = call("POST", "/api/user-tutorials", token=t, body={
        "user_id": ctx["test_uid"], "tutorial_id": "smoke-test-tutorial",
    })
    check(status == 201, "Mark tutorial as completed", f"status={status}", expected="201")
    status, body = call("GET", "/api/user-tutorials", token=t)
    check(status == 200 and any(x.get("tutorial_id") == "smoke-test-tutorial" for x in body),
          "Tutorial completion persisted", f"status={status}", expected="200")
    status, body = call("DELETE", f"/api/user-tutorials?user_id={ctx['test_uid']}&tutorial_id=smoke-test-tutorial",
                        token=t)
    check(status == 200, "Reset tutorial state", f"status={status}", expected="200")


# --------------------------------------------------------------------------- #
# J. Admin & superadmin
# --------------------------------------------------------------------------- #
def section_admin(ctx):
    section("J. Admin & superadmin")
    at = ctx["admin_token"]
    t = ctx["test_token"]
    inst = ctx["test_instance"]

    status, body = call("GET", "/api/admin/validate", token=at)
    check(status == 200 and isinstance(body, dict) and "nutritionCount" in body,
          "Admin setup validation", f"status={status}", expected="200 {counts}")

    # Instance management is behind ENABLE_ADMIN_FEATURES.
    status, body = call("GET", "/api/admin/instances", token=at)
    if status == 403:
        check(True, "Admin instances (feature-disabled → 403)",
              f"ENABLE_ADMIN_FEATURES=false: {body.get('error')}", expected="403")
    else:
        check(status == 200 and isinstance(body, list),
              "Admin instances list", f"status={status}", expected="200 []")

    # Announcements: instance members see the active list / unseen state.
    status, body = call("GET", f"/api/announcements/active-list?instance_id={inst}", token=t)
    check(status == 200 and isinstance(body, list), "Active announcements list",
          f"status={status}", expected="200 []")

    status, body = call("GET", f"/api/announcements/has-unseen?instance_id={inst}", token=t)
    check(status == 200 and isinstance(body, dict) and "hasUnseen" in body,
          "Has-unseen announcements flag", f"status={status} hasUnseen={body.get('hasUnseen')}",
          expected="200 {hasUnseen}")

    status, body = call("GET", f"/api/announcements/unread-count?instance_id={inst}", token=t)
    check(status == 200 and isinstance(body, dict) and isinstance(body.get("count"), int),
          "Unread announcements count", f"status={status} count={body.get('count')}", expected="200 {count}")

    # Create an announcement in the throwaway test instance (admins may post),
    # view it, and confirm unseen/unread state flips. Teardown deletes the user,
    # which cascades the announcement away.
    status, body = call("POST", "/api/announcements", token=t, body={
        "instance_id": inst, "title": "Smoke Test Notice",
        "message": "This is a generated announcement for the smoke test.",
    })
    ann_id = body.get("id") if status == 201 else None
    check(status == 201 and ann_id, "Create announcement (instance admin)",
          f"status={status}", expected="201")

    if ann_id:
        status, body = call("GET", f"/api/announcements/has-unseen?instance_id={inst}", token=t)
        check(status == 200 and body.get("hasUnseen") is True,
              "New announcement is unseen", "", expected="hasUnseen:true")
        status, body = call("GET", f"/api/announcements/unread-count?instance_id={inst}", token=t)
        check(status == 200 and body.get("count") == 1,
              "New announcement counts as unread", f"count={body.get('count')}", expected="1")

        status, body = call("POST", f"/api/announcements/{ann_id}/view", token=t,
                            body={"instance_id": inst})
        check(status == 200, "Mark announcement as viewed", f"status={status}", expected="200")

        status, body = call("GET", f"/api/announcements/has-unseen?instance_id={inst}", token=t)
        check(status == 200 and body.get("hasUnseen") is False,
              "Announcement no longer unseen after view", "", expected="hasUnseen:false")
        status, body = call("GET", f"/api/announcements/unread-count?instance_id={inst}", token=t)
        check(status == 200 and body.get("count") == 0,
              "Unread count back to zero", f"count={body.get('count')}", expected="0")

    # Management (list/update/delete) is superadmin + feature-flag gated.
    status, body = call("GET", f"/api/announcements?instance_id={inst}", token=t)
    check(status == 403, "Announcement management denied for non-superadmin",
          f"status={status}", expected="403")


# --------------------------------------------------------------------------- #
# K. API tokens
# --------------------------------------------------------------------------- #
def section_tokens(ctx):
    section("K. API tokens")
    t = ctx["test_token"]
    inst = ctx["test_instance"]

    # Mint (JWT-only). A scoped read-only token.
    status, body = call("POST", "/api/tokens", token=t, body={
        "instance_id": inst, "name": "smoke-pantry-read", "scopes": ["pantry:read"],
    })
    token_a = body.get("token") if status == 201 else None
    token_a_id = body.get("id") if status == 201 else None
    check(status == 201 and token_a and token_a.startswith("pb_"),
          "Mint API token (pantry:read)", f"status={status}", expected="201 + pb_ token")

    status, body = call("POST", "/api/tokens", token=t, body={
        "instance_id": inst, "name": "smoke-recipes-read", "scopes": ["recipes:read"],
    })
    token_b = body.get("token") if status == 201 else None
    token_b_id = body.get("id") if status == 201 else None
    check(status == 201 and token_b, "Mint API token (recipes:read)", f"status={status}", expected="201")

    # Scope enforcement on the token itself.
    status, body = call("GET", f"/api/pantry?instance_id={inst}", token=token_a)
    check(status == 200, "pantry:read token lists pantry", f"status={status}", expected="200")
    status, body = call("POST", "/api/pantry", token=token_a, body={
        "instance_id": inst, "ingredient_name": "Nope", "unit": "g", "amount": 1,
    })
    check(status == 403, "pantry:read token cannot write pantry", f"status={status}", expected="403")
    status, body = call("GET", f"/api/recipes?instance_id={inst}", token=token_a)
    check(status == 403, "pantry:read token cannot read recipes", f"status={status}", expected="403")
    status, body = call("GET", f"/api/recipes?instance_id={inst}", token=token_b)
    check(status == 200, "recipes:read token lists recipes", f"status={status}", expected="200")

    # Cross-instance binding: a token minted for the test instance must not be
    # usable against another instance.
    status, body = call("GET", f"/api/pantry?instance_id={ctx['admin_instance']}", token=token_a)
    check(status == 403, "Token rejected for a different instance", f"status={status}", expected="403")

    # Tokens cannot mint sibling tokens (JWT-only route).
    status, body = call("POST", "/api/tokens", token=token_b, body={
        "instance_id": inst, "name": "escalation", "scopes": ["all"],
    })
    check(status == 403, "Token cannot mint sibling tokens", f"status={status}", expected="403")

    # Self-inspection: token sees only its own record.
    status, body = call("GET", "/api/tokens", token=token_b)
    check(status == 200 and (isinstance(body, dict) and body.get("id") == token_b_id),
          "Token self-inspection", f"status={status}", expected="200 own record")

    # A token cannot revoke a sibling token; the owner (JWT) can.
    status, body = call("DELETE", f"/api/tokens/{token_a_id}", token=token_b)
    check(status == 403, "Token cannot revoke a sibling token", f"status={status}", expected="403")

    status, body = call("DELETE", f"/api/tokens/{token_a_id}", token=t)
    check(status == 200, "Owner revokes token (JWT)", f"status={status}", expected="200")
    status, body = call("GET", f"/api/pantry?instance_id={inst}", token=token_a)
    check(status == 401, "Revoked token is rejected", f"status={status}", expected="401")

    status, body = call("DELETE", f"/api/tokens/{token_b_id}", token=t)
    check(status == 200, "Revoke second token", f"status={status}", expected="200")

    status, body = call("GET", "/api/tokens", token=t)
    row_a = find(body, lambda x: x.get("id") == token_a_id) if isinstance(body, list) else None
    row_b = find(body, lambda x: x.get("id") == token_b_id) if isinstance(body, list) else None
    check(status == 200 and isinstance(body, list) and row_a and row_b
          and row_a.get("revoked_at") and row_b.get("revoked_at"),
          "Revoked tokens marked revoked in list",
          f"status={status} revoked_a={bool(row_a and row_a.get('revoked_at'))}"
          f" revoked_b={bool(row_b and row_b.get('revoked_at'))}",
          expected="200 revoked_at set on both (UI filters client-side)")


# --------------------------------------------------------------------------- #
# L. Notifications
# --------------------------------------------------------------------------- #
def section_notifications(ctx):
    section("L. Notifications")
    t = ctx["test_token"]
    inst = ctx["test_instance"]

    # The app does not currently auto-generate notifications for this throwaway
    # user, so seed one directly (via the DB) to exercise the single-read path
    # instead of skipping it. Teardown cascades the user (and this row) away.
    uid = ctx["test_uid"]
    iid = ctx["test_instance"]
    _psql(
        "INSERT INTO notifications (id, user_id, instance_id, type, title, message, is_read) "
        f"VALUES (gen_random_uuid(), '{uid}', '{iid}', 'system', "
        "'Smoke Test Notification', 'Seeded by smoke test', FALSE)"
    )

    status, body = call("GET", f"/api/notifications?instance_id={inst}", token=t)
    check(status == 200 and isinstance(body, list), "List notifications",
          f"status={status}", expected="200 []")

    status, body = call("GET", f"/api/notifications/unread-count?instance_id={inst}", token=t)
    check(status == 200 and isinstance(body, dict) and isinstance(body.get("count"), int),
          "Unread notification count", f"status={status} count={body.get('count')}", expected="200 {count}")

    status, body = call("PUT", f"/api/notifications/read-all?instance_id={inst}", token=t)
    check(status == 200, "Mark all notifications as read", f"status={status}", expected="200")

    status, body = call("GET", f"/api/notifications?instance_id={inst}", token=t)
    if isinstance(body, list) and body:
        nid = body[0].get("id")
        status, body = call("PUT", f"/api/notifications/{nid}/read", token=t)
        check(status == 200, "Mark single notification as read", f"status={status}", expected="200")
    else:
        skip("Mark single notification as read", "no notifications exist for the test user")

    status, body = call("GET", f"/api/notifications/unread-count?instance_id={inst}", token=t)
    check(status == 200 and body.get("count") == 0,
          "All notifications read", f"count={body.get('count')}", expected="0")


# --------------------------------------------------------------------------- #
# M. Files
# --------------------------------------------------------------------------- #
def section_files(ctx):
    section("M. Files")
    t = ctx["test_token"]

    status, body = call_multipart(
        "/api/files/upload", t,
        fields={"bucket": "smoke-test", "folder": "smoketest"},
        file_field="file", filename="pixel.png", file_bytes=PNG_1PX,
        content_type="image/png",
    )
    url = body.get("url") if status == 201 else None
    check(status == 201 and url, "Upload PNG image", f"status={status} url={url}", expected="201 {url}")

    if url:
        status, blob = call("GET", url, raw=True)
        check(status == 200 and blob[:8] == PNG_1PX[:8],
              "Uploaded image is publicly fetchable", f"status={status} ({len(blob)} bytes)",
              expected="200 image/png")

        # Delete via the returned URL path (bucket + path).
        rel = url.replace("/api/files/", "", 1)
        bucket, _, path_part = rel.partition("/")
        status, body = call("DELETE", "/api/files", token=t,
                            body={"bucket": bucket, "path": path_part})
        check(status == 200 and body.get("success") is True,
              "Delete uploaded file", f"status={status}", expected="200 {success:true}")

        status, blob = call("GET", url, raw=True)
        check(status == 404, "Deleted file is gone", f"status={status}", expected="404")

    # Non-image content is rejected by magic-byte inspection.
    status, body = call_multipart(
        "/api/files/upload", t,
        fields={"bucket": "smoke-test", "folder": "smoketest"},
        file_field="file", filename="fake.png", file_bytes=b"not an image at all",
        content_type="image/png",
    )
    check(status == 400, "Reject non-image upload", f"status={status} - {body_text(body)}", expected="400")


# --------------------------------------------------------------------------- #
# N. Account teardown (always LAST)
# --------------------------------------------------------------------------- #
def section_teardown(ctx):
    section("N. Account teardown")
    at = ctx["admin_token"]
    t = ctx["test_token"]

    status, body = call("DELETE", f"/api/profiles/{ctx['test_uid']}", token=t)
    check(status == 403, "User cannot delete their own account", f"status={status}", expected="403")

    status, body = call("DELETE", f"/api/profiles/{ctx['test_uid']}", token=at)
    check(status == 200, "Admin deletes the throwaway test user", f"status={status}", expected="200")

    status, body = call("GET", "/api/auth/me", token=t)
    check(status == 401, "Deleted user's token is invalidated", f"status={status}", expected="401")

    # Remove the throwaway instance so repeated runs leave nothing behind. The
    # user-delete above nulls instances.created_by but keeps the row, so the
    # orphaned instance is cleaned up here (superadmin-only admin API).
    status, body = call("DELETE", f"/api/admin/instances/{ctx['test_instance']}", token=at)
    if status == 200:
        check(True, "Admin deletes the throwaway instance", f"status={status}", expected="200")
    elif status == 403 and "disabled" in body_text(body).lower():
        skip("Admin deletes the throwaway instance",
             "ENABLE_ADMIN_FEATURES is off; orphaned instance row remains")
    else:
        check(status == 200, "Admin deletes the throwaway instance",
              f"status={status} - {body_text(body)}", expected="200")


# --------------------------------------------------------------------------- #
# Optional UI layer (real browser clicks via Playwright)
# --------------------------------------------------------------------------- #
def section_ui(ctx):
    section("UI: browser click-through (Playwright)")

    if not RUN_UI:
        skip("UI click-through (set PB_PLAYWRIGHT=1 to enable)", "browser layer disabled")
        return

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        skip("UI click-through (install 'playwright' + browsers)",
             "python package not installed")
        return

    # Collect JS errors across the entire browser session.
    console_errors: list[str] = []
    page_errors: list[str] = []

    # Known benign console.error messages that are not app bugs.
    _ALLOWED_CONSOLE = (
        "X-Frame-Options may only be set via an HTTP header",
        "Failed to load resource: the server responded with a status of 403",
    )

    def _on_console(msg):
        if msg.type == "error":
            text = (msg.text or "").strip()
            if text and "ResizeObserver" not in text:
                if not any(a in text for a in _ALLOWED_CONSOLE):
                    console_errors.append(text)

    def _on_page_error(err):
        page_errors.append(str(err).strip())

    # Buttons whose labels match these substrings are never clicked.
    _SKIP_BTN = frozenset({
        "delete", "remove", "sign out", "log out", "logout",
        "destroy", "revoke", "reset all", "export",
    })

    def _dismiss(pg):
        """Press Escape to close any Joyride overlay / modal / dropdown."""
        try:
            pg.keyboard.press("Escape")
            pg.wait_for_timeout(200)
        except Exception:
            pass

    def _recover(pg, path):
        """Navigate back to *path* if the page drifted away."""
        try:
            want = path.rstrip("/")
            if not pg.url.rstrip("/").endswith(want):
                pg.goto(f"{BASE}{path}", wait_until="load")
                pg.wait_for_timeout(300)
        except Exception:
            pass

    def _click_buttons_on_page(pg, path):
        """Click every visible non-destructive button; return count."""
        clicked = 0
        try:
            buttons = pg.locator("button:visible").all()
            for btn in buttons:
                try:
                    text = (btn.inner_text(timeout=1000) or "").lower().strip()
                    if any(s in text for s in _SKIP_BTN):
                        continue
                    if btn.is_disabled():
                        continue
                    btn.click(timeout=3000)
                    pg.wait_for_timeout(300)
                    _dismiss(pg)
                    _recover(pg, path)
                    clicked += 1
                except Exception:
                    _recover(pg, path)
        except Exception:
            pass
        return clicked

    def _visit(pg, path, label):
        """Navigate to a page, click its buttons, report."""
        pg.goto(f"{BASE}{path}", wait_until="load")
        pg.wait_for_timeout(500)
        _dismiss(pg)
        clicked = _click_buttons_on_page(pg, path)
        check(True, f"UI: {label}",
              f"loaded, clicked {clicked} button(s)", expected="no crash")

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1440, "height": 900})
            page.on("console", _on_console)
            page.on("pageerror", _on_page_error)

            # ---- Login ------------------------------------------------
            page.goto(f"{BASE}/login", wait_until="load")
            check(page.locator("#login-username").count() == 1,
                  "UI: login page renders", "", expected="username input present")

            page.fill("#login-username", ctx["test_email"])
            page.fill("#login-password", ctx["test_pass"])
            page.locator("button[type='submit']").click()
            try:
                page.wait_for_url("**/recipes", timeout=20000)
            except Exception:
                login_err = ""
                try:
                    login_err = page.locator("text=Too many requests").count() > 0 \
                        and "rate-limited (429)" or ""
                except Exception:
                    pass
                raise RuntimeError(
                    f"login did not navigate to /recipes; url={page.url}"
                    f" {login_err}".strip())
            check(page.url.rstrip("/").endswith("/recipes"),
                  "UI: login navigates to Recipes", page.url, expected=".../recipes")

            # ---- Fetch a recipe id for detail/edit pages ---------------
            recipe_id = None
            try:
                _s, _b = call("GET",
                              f"/api/recipes?instance_id={ctx['test_instance']}",
                              token=ctx["test_token"])
                if _s == 200 and isinstance(_b, list) and _b:
                    recipe_id = _b[0]["id"]
            except Exception:
                pass

            # ---- Authenticated pages ----------------------------------
            auth_pages = [
                ("/recipes", "Recipes"),
                ("/recipes/new", "New Recipe (editor)"),
                ("/grocery-list-creation", "Grocery List Creation"),
                ("/grocery-list", "Grocery List"),
                ("/calendar", "Calendar"),
                ("/pantry", "Pantry"),
                ("/pantry/ingredients", "Ingredients"),
                ("/pantry/equipment", "Equipment"),
                ("/pantry/layout", "Kitchen Layout"),
                ("/kitchen-layout-editor", "Kitchen Layout Editor"),
                ("/profile", "Profile"),
                ("/settings", "Settings"),
                ("/users", "User Management"),
                ("/announcements", "Announcements"),
            ]
            if recipe_id:
                auth_pages.insert(2, (f"/recipes/{recipe_id}", "Recipe Detail"))
                auth_pages.insert(3, (f"/recipes/{recipe_id}/edit", "Edit Recipe"))

            for path, label in auth_pages:
                _visit(page, path, label)

            # ---- Public pages (no auth required) ----------------------
            public_pages = [
                ("/", "Home"),
                ("/login", "Login (logged-out)"),
                ("/docs", "Docs landing"),
                ("/docs/recipes", "Docs: Recipes"),
                ("/docs/meal-planning", "Docs: Meal Planning"),
                ("/docs/grocery-lists", "Docs: Grocery Lists"),
                ("/docs/pantry-equipment", "Docs: Pantry & Equipment"),
                ("/docs/sharing", "Docs: Sharing"),
                ("/docs/nutrition", "Docs: Nutrition"),
                ("/docs/account-settings", "Docs: Account & Settings"),
                ("/docs/api-guidelines", "Docs: API Guidelines"),
                ("/docs/admin-features", "Docs: Admin Features"),
            ]
            for path, label in public_pages:
                _visit(page, path, label)

            # ---- Assert zero JS errors -------------------------------
            if console_errors:
                detail = (f"{len(console_errors)} console error(s):\n"
                          + "\n".join(f"  - {e[:200]}" for e in console_errors[:10]))
                check(False, "UI: zero console errors", detail,
                      expected="0 console.error messages")
            else:
                check(True, "UI: zero console errors", "clean",
                      expected="0 console.error messages")

            if page_errors:
                detail = (f"{len(page_errors)} uncaught exception(s):\n"
                          + "\n".join(f"  - {e[:200]}" for e in page_errors[:10]))
                check(False, "UI: zero uncaught exceptions", detail,
                      expected="0 uncaught exceptions")
            else:
                check(True, "UI: zero uncaught exceptions", "clean",
                      expected="0 uncaught exceptions")

            browser.close()
    except Exception as e:  # noqa: BLE001 — report any UI failure in detail
        check(False, "UI click-through", f"exception: {e}", expected="no exceptions")


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #
def main():
    print(f"PantryButler smoke test -> {BASE}")
    print(f"  admin: {ADMIN_EMAIL} | ui layer: {'ON (PB_PLAYWRIGHT=1)' if RUN_UI else 'off'}")

    ctx = {}

    section_auth(ctx)
    section_setup(ctx)
    section_recipes(ctx)
    section_grocery(ctx)
    section_pantry(ctx)
    section_calendar(ctx)
    section_kitchen(ctx)
    section_nutrition(ctx)
    section_settings_profile(ctx)
    section_admin(ctx)
    section_tokens(ctx)
    section_notifications(ctx)
    section_files(ctx)
    section_ui(ctx)
    section_teardown(ctx)

    total = _passed + _failed
    pct = (100.0 * _passed / total) if total else 100.0
    print("\n" + "=" * 60)
    print(f"Succeeded: {_passed} / {total}  ({pct:.1f}%)")
    if _skipped:
        print(f"Skipped:   {_skipped}")
    print("=" * 60)

    if _failures:
        print("\nFailures:")
        for f in _failures:
            print(f"  - [{f['area']}] {f['name']}")
            if f["method"] or f["path"]:
                print(f"      request:  {f['method']} {f['path']}  ({f['ms']:.0f} ms)")
            if f["expected"]:
                print(f"      expected: {f['expected']}")
            if f["detail"]:
                print(f"      got:      {f['detail']}")

    if _skips:
        print("\nSkipped:")
        for s in _skips:
            print(f"  - [{s['area']}] {s['name']}: {s['detail']}")

    if _failed:
        print("\nRESULT: FAIL")
        sys.exit(1)
    print("\nRESULT: PASS")
    sys.exit(0)


if __name__ == "__main__":
    main()

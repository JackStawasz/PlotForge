#!/bin/bash
# ============================================================
# PlotForge Test Runner — runs ALL tests in one command
# Place in project root alongside start.sh
#   bash run_tests.sh
# ============================================================

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

# Auto-detect test folder (test/ or tests/)
if [ -d "$PROJECT_ROOT/test" ]; then
    TESTS_DIR="$PROJECT_ROOT/test"
elif [ -d "$PROJECT_ROOT/tests" ]; then
    TESTS_DIR="$PROJECT_ROOT/tests"
else
    echo "ERROR: No test/ or tests/ directory found in $PROJECT_ROOT"
    exit 1
fi

PASS=0; FAIL=0; JS_SKIP=false
SERVER_PID=""
SERVER_EXTERNAL=false

GREEN='\033[0;32m'; RED='\033[0;31m'; CYAN='\033[0;36m'; YELLOW='\033[0;33m'
BOLD='\033[1m'; RESET='\033[0m'

header() { echo -e "\n${CYAN}${BOLD}━━━ $1 ━━━${RESET}"; }
ok()     { echo -e "${GREEN}✔  $1${RESET}"; ((PASS++)); }
fail()   { echo -e "${RED}✘  $1${RESET}"; ((FAIL++)); }
warn()   { echo -e "${YELLOW}⚠  $1${RESET}"; }

# ── Server health check (curl with python3 fallback) ─────────
server_alive() {
    if command -v curl &>/dev/null; then
        curl -s --max-time 2 http://localhost:5000/api/templates > /dev/null 2>&1
    else
        python3 -c "
import urllib.request, sys
try:
    urllib.request.urlopen('http://localhost:5000/api/templates', timeout=2)
    sys.exit(0)
except:
    sys.exit(1)
" 2>/dev/null
    fi
}

# ── Called before each test suite that needs the server ──────
assert_server_alive() {
    if ! server_alive; then
        if [ "$SERVER_EXTERNAL" = true ]; then
            echo ""
            echo -e "${RED}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
            echo -e "${RED}${BOLD}  SERVER DROPPED                                          ${RESET}"
            echo -e "${RED}${BOLD}  The external server closed while tests were running.    ${RESET}"
            echo -e "${RED}${BOLD}  Remaining tests have been skipped.                      ${RESET}"
            echo -e "${RED}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
            echo ""
            SERVER_EXTERNAL=false  # suppress repeat banners
        else
            fail "Server process died unexpectedly"
        fi
        return 1
    fi
    return 0
}

# ── Kill OUR server on exit (never touches external server) ──
cleanup() {
    if [ -n "$SERVER_PID" ]; then
        kill "$SERVER_PID" 2>/dev/null
        wait "$SERVER_PID" 2>/dev/null
    fi
}
trap cleanup EXIT

# ── Setup ───────────────────────────────────────────────────
header "Setup"

if [ ! -d "venv" ]; then
    printf "  Creating virtual environment..."
    python3 -m venv venv && printf " Done\n"
else
    echo "  Reusing existing venv"
fi

if [ ! -f "venv/bin/activate" ]; then
    echo -e "${RED}ERROR: venv/bin/activate not found. Delete venv/ and retry.${RESET}"
    exit 1
fi
. venv/bin/activate
ok "venv activated ($(python3 --version))"


REQ_PATH=$(find . -maxdepth 3 -type f -iname "requirements.txt" | head -n 1)
if [ -n "$REQ_PATH" ]; then
    HASH_FILE="venv/.req_hash"
    CURRENT_HASH=$(md5sum "$REQ_PATH" | awk '{print $1}')
    if [ ! -f "$HASH_FILE" ] || [ "$CURRENT_HASH" != "$(cat "$HASH_FILE")" ]; then
        printf "  Installing app dependencies..."; pip install -r "$REQ_PATH" --quiet
        echo "$CURRENT_HASH" > "$HASH_FILE"; printf " Done\n"
    else
        echo "  App dependencies up to date"
    fi
fi

TEST_HASH_FILE="venv/.test_req_hash"
TEST_DEPS="pytest pytest-flask"
TEST_KEY=$(echo "$TEST_DEPS" | md5sum | awk '{print $1}')
if [ ! -f "$TEST_HASH_FILE" ] || [ "$TEST_KEY" != "$(cat "$TEST_HASH_FILE")" ]; then
    printf "  Installing pytest + pytest-flask..."; pip install $TEST_DEPS --quiet
    echo "$TEST_KEY" > "$TEST_HASH_FILE"; printf " Done\n"
else
    echo "  Test dependencies up to date"
fi
ok "Python dependencies ready"


if ! command -v node &>/dev/null; then
    echo "  Node.js not found — skipping JS and UI tests"
    JS_SKIP=true
else
    if [ ! -f "$TESTS_DIR/package.json" ]; then
        printf "  Initialising package.json..."
        npm init -y --prefix "$TESTS_DIR" > /dev/null 2>&1; printf " Done\n"
    fi

    NEED_INSTALL=false
    [ ! -d "$TESTS_DIR/node_modules/vitest" ]      && NEED_INSTALL=true
    [ ! -d "$TESTS_DIR/node_modules/jsdom" ]       && NEED_INSTALL=true
    [ ! -d "$TESTS_DIR/node_modules/@playwright" ] && NEED_INSTALL=true

    if [ "$NEED_INSTALL" = true ]; then
        printf "  Installing Vitest + jsdom + Playwright..."
        npm install --prefix "$TESTS_DIR" --save-dev vitest jsdom @playwright/test > /dev/null 2>&1
        printf " Done\n"
        printf "  Downloading Chromium browser..."
        "$TESTS_DIR/node_modules/.bin/playwright" install chromium > /dev/null 2>&1
        printf " Done\n"
    else
        echo "  Node dependencies up to date"
    fi
    ok "Node dependencies ready (node $(node --version))"
fi


if server_alive; then
    SERVER_EXTERNAL=true
    ok "Using already-running server on port 5000"
    warn "If this server closes mid-test, remaining tests will be skipped"
else
    APP_PATH=$(find "$PROJECT_ROOT/src" "$PROJECT_ROOT" -maxdepth 1 -name "app.py" 2>/dev/null | head -n 1)
    if [ -z "$APP_PATH" ]; then
        fail "app.py not found — API and UI tests will be skipped"
    else
        python3 "$APP_PATH" > /dev/null 2>&1 &
        SERVER_PID=$!

        printf "  Starting server"
        for i in $(seq 1 16); do
            sleep 0.5
            if server_alive; then
                printf "\n"
                ok "Server started (PID $SERVER_PID) — will stop when tests finish"
                break
            fi
            printf "."
            if [ "$i" -eq 16 ]; then
                printf "\n"
                fail "Server did not respond in time — API and UI tests will be skipped"
                SERVER_PID=""
            fi
        done
    fi
fi

# ── 5. Backend API tests (pytest) ────────────────────────────
header "Backend API tests (pytest)"

if ! assert_server_alive; then
    fail "API tests skipped — server unavailable"
else
    if pytest "$TESTS_DIR/test_api.py" --rootdir="$PROJECT_ROOT" --tb=short -q 2>&1; then
        ok "All API tests passed"
    else
        fail "API tests had failures"
    fi
fi

# ── 6. JS math unit tests (Vitest) ───────────────────────────
header "JS math unit tests (Vitest)"

if [ "$JS_SKIP" = true ]; then
    echo "  Skipped — Node.js not available"
else
    VITEST_CFG=""; JS_TEST=""
    [ -f "$TESTS_DIR/vitest.config.js" ]  && VITEST_CFG="$TESTS_DIR/vitest.config.js"
    [ -f "$TESTS_DIR/vitest_config.js" ]  && VITEST_CFG="$TESTS_DIR/vitest_config.js"
    [ -f "$TESTS_DIR/test_math.test.js" ] && JS_TEST="$TESTS_DIR/test_math.test.js"
    [ -f "$TESTS_DIR/test_math.js" ]      && JS_TEST="$TESTS_DIR/test_math.js"

    if [ -z "$JS_TEST" ]; then
        fail "No JS test file found in $TESTS_DIR"
    else
        CFG_ARG=""; [ -n "$VITEST_CFG" ] && CFG_ARG="--config $VITEST_CFG"
        if npx --prefix "$TESTS_DIR" vitest run $CFG_ARG --reporter=verbose "$JS_TEST" 2>&1; then
            ok "All JS math tests passed"
        else
            fail "JS math tests had failures"
        fi
    fi
fi

# ── 7. UI tests (Playwright) ─────────────────────────────────
header "UI tests (Playwright)"

if [ "$JS_SKIP" = true ]; then
    echo "  Skipped — Node.js not available"
elif [ -z "$SERVER_PID" ] && [ "$SERVER_EXTERNAL" = false ]; then
    echo "  Skipped — server did not start"
elif ! assert_server_alive; then
    fail "UI tests skipped — server no longer available"
else
    PW_CFG=""
    [ -f "$TESTS_DIR/playwright.config.js" ] && PW_CFG="$TESTS_DIR/playwright.config.js"
    [ -f "$TESTS_DIR/playwright_config.js" ] && PW_CFG="$TESTS_DIR/playwright_config.js"

    CFG_ARG=""; [ -n "$PW_CFG" ] && CFG_ARG="--config $PW_CFG"

    if "$TESTS_DIR/node_modules/.bin/playwright" test $CFG_ARG 2>&1; then
        ok "All UI tests passed"
    else
        fail "UI tests had failures"
    fi
fi

# ── 8. Summary ───────────────────────────────────────────────
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}Results:  ${GREEN}${PASS} passed${RESET}  ${BOLD}|  ${RED}${FAIL} failed${RESET}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"

[ "$FAIL" -gt 0 ] && exit 1 || exit 0
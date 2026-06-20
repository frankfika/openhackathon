#!/bin/bash

# E2E Test Runner Script for OpenHackathon

set -e

echo "🎭 OpenHackathon E2E Test Runner"
echo "================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if server is running
check_server() {
  if curl -s http://localhost:5173 > /dev/null 2>&1; then
    return 0
  else
    return 1
  fi
}

# Parse arguments
MODE=${1:-"headless"}
TEST_FILE=${2:-""}

# Check server status
if check_server; then
  echo -e "${GREEN}✓ Development server is running at http://localhost:5173${NC}"
else
  echo -e "${YELLOW}⚠ Development server is not running at http://localhost:5173${NC}"
  echo -e "${YELLOW}  Please start it with: npm run dev${NC}"
  echo ""
  read -p "Start server automatically? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}Starting development server...${NC}"
    npm run dev &
    SERVER_PID=$!

    # Wait for server to be ready
    echo "Waiting for server to start..."
    for i in {1..30}; do
      if check_server; then
        echo -e "${GREEN}✓ Server is ready!${NC}"
        break
      fi
      sleep 2
      echo -n "."
    done

    if ! check_server; then
      echo -e "${RED}✗ Server failed to start${NC}"
      exit 1
    fi
  else
    exit 1
  fi
fi

echo ""

case "$MODE" in
  "smoke")
    echo -e "${YELLOW}Running smoke tests only...${NC}"
    npx playwright test smoke.spec.ts --reporter=line "$@"
    ;;

  "headed")
    echo -e "${YELLOW}Running tests in headed mode (visible browser)...${NC}"
    npx playwright test --headed --reporter=line ${TEST_FILE:-}
    ;;

  "ui")
    echo -e "${YELLOW}Opening Playwright UI mode...${NC}"
    npx playwright test --ui
    ;;

  "debug")
    echo -e "${YELLOW}Running tests in debug mode...${NC}"
    npx playwright test --debug ${TEST_FILE:-}
    ;;

  "auth")
    echo -e "${YELLOW}Running authentication tests...${NC}"
    npx playwright test auth.spec.ts --reporter=line
    ;;

  "judge")
    echo -e "${YELLOW}Running judge workflow tests...${NC}"
    npx playwright test judge-flow.spec.ts --reporter=line
    ;;

  "admin")
    echo -e "${YELLOW}Running admin workflow tests...${NC}"
    npx playwright test admin-flow.spec.ts --reporter=line
    ;;

  "public")
    echo -e "${YELLOW}Running public pages tests...${NC}"
    npx playwright test public-pages.spec.ts --reporter=line
    ;;

  "example")
    echo -e "${YELLOW}Running example test...${NC}"
    npx playwright test example.spec.ts --reporter=list
    ;;

  "report")
    echo -e "${YELLOW}Opening last test report...${NC}"
    npx playwright show-report
    exit 0
    ;;

  "install")
    echo -e "${YELLOW}Installing Playwright browsers...${NC}"
    npx playwright install
    exit 0
    ;;

  "codegen")
    echo -e "${YELLOW}Opening Playwright CodeGen (record your actions)...${NC}"
    echo "Navigate to http://localhost:5173 and start recording!"
    npx playwright codegen http://localhost:5173
    exit 0
    ;;

  *)
    # Default: run all tests headless
    echo -e "${YELLOW}Running all tests in headless mode...${NC}"
    echo ""
    echo "Available commands:"
    echo "  ./run-tests.sh headed    - Run with visible browser"
    echo "  ./run-tests.sh ui        - Interactive UI mode"
    echo "  ./run-tests.sh smoke     - Quick smoke tests"
    echo "  ./run-tests.sh auth      - Authentication tests"
    echo "  ./run-tests.sh judge     - Judge workflow tests"
    echo "  ./run-tests.sh admin     - Admin workflow tests"
    echo "  ./run-tests.sh public    - Public pages tests"
    echo "  ./run-tests.sh report    - View test report"
    echo ""

    if [ -n "$TEST_FILE" ]; then
      npx playwright test "$TEST_FILE" --reporter=line
    else
      npx playwright test --reporter=line
    fi
    ;;
esac

echo ""
echo -e "${GREEN}✅ Test run completed!${NC}"
echo ""
echo "View detailed report with: ${YELLOW}npx playwright show-report${NC}"

# Cleanup server if we started it
if [ -n "$SERVER_PID" ]; then
  echo ""
  echo "Stopping development server..."
  kill $SERVER_PID 2>/dev/null || true
fi

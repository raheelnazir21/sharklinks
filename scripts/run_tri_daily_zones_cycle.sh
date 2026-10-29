#!/usr/bin/env bash
# ==============================================================================
# Cotton Collective: Automated 3-Day 6 Control Zones Cycle Runner
# ==============================================================================
# Scheduled via crontab:
# 0 8 */3 * * /home/ubuntu/factory-management-system/scripts/run_tri_daily_zones_cycle.sh >> /home/ubuntu/factory-management-system/logs/zones_cron.log 2>&1
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOGS_DIR="${PROJECT_ROOT}/logs"
mkdir -p "${LOGS_DIR}"

TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
echo "===================================================================="
echo "🚀 [${TIMESTAMP}] Starting Cotton Collective 3-Day 6 Control Zones Cycle"
echo "===================================================================="

cd "${PROJECT_ROOT}"

# Copy latest scripts to backend volume to ensure container is in sync
if [ -d "${PROJECT_ROOT}/scripts" ] && [ -d "${PROJECT_ROOT}/backend/scripts" ]; then
    cp -r "${PROJECT_ROOT}/scripts/"* "${PROJECT_ROOT}/backend/scripts/" 2>/dev/null || true
fi

# Execute cycle within backend container
docker compose -f "${PROJECT_ROOT}/docker-compose.yml" exec -T backend python /app/scripts/run_tri_daily_zones_cycle.py "$@"

END_TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
echo "===================================================================="
echo "✅ [${END_TIMESTAMP}] Completed 3-Day 6 Control Zones Cycle"
echo "===================================================================="

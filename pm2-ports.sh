#!/bin/bash
# Display PM2 processes with their ports

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "$SCRIPT_DIR/pm2-ports.js"

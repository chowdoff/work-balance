#!/bin/bash
set -e

echo "=== Pulling latest code..."
git pull

echo "=== Rebuilding and restarting all services..."
docker compose up -d --build

echo "=== Done! Checking status..."
docker compose ps

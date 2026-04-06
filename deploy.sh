#!/bin/bash
set -e

echo "=== Pulling latest code..."
git pull

echo "=== Rebuilding and restarting app..."
docker compose up -d --build app

echo "=== Done! Checking status..."
docker compose ps

#!/bin/sh
set -e
alembic upgrade head

# Start the application
exec "$@"

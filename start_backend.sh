#!/usr/bin/env bash
# Start the Django backend server

cd "$(dirname "$0")/backend"

if [ ! -d "venv" ]; then
  echo "Creating virtual environment..."
  python -m venv venv
fi

if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
  source venv/Scripts/activate
else
  source venv/bin/activate
fi

echo "Installing dependencies..."
pip install -q -r requirements.txt

echo "Running migrations..."
python manage.py migrate --run-syncdb

echo "Starting Django backend on http://localhost:8000"
python manage.py runserver 0.0.0.0:8000

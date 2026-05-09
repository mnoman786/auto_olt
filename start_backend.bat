@echo off
echo Starting Auto OLT Backend...
cd /d "%~dp0backend"

if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
)

call venv\Scripts\activate.bat

echo Installing dependencies...
pip install -q -r requirements.txt

echo Running migrations...
python manage.py migrate

echo.
echo Backend running at: http://localhost:8000
echo API docs at: http://localhost:8000/api/
echo.

python manage.py runserver 0.0.0.0:8000

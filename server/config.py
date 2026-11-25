import os
from pathlib import Path

from dotenv import load_dotenv


SERVER_DIR = Path(__file__).resolve().parent
load_dotenv(SERVER_DIR / ".env")

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "127.0.0.1"),
    "port": int(os.getenv("DB_PORT", "3306")),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", "sunset123"),
    "database": os.getenv("DB_NAME", "sunset_resort"),
    "charset": "utf8mb4",
    "use_unicode": True,
}

SECRET_KEY = os.getenv("APP_SECRET_KEY", "CHANGE_THIS_TO_A_LONG_RANDOM_SECRET")
APP_HOST = os.getenv("APP_HOST", "127.0.0.1")
APP_PORT = int(os.getenv("APP_PORT", "5000"))
APP_DEBUG = os.getenv("APP_DEBUG", "false").lower() == "true"

ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://127.0.0.1:5000,http://localhost:5000,http://127.0.0.1:8080,http://localhost:8080,null",
    ).split(",")
    if origin.strip()
]

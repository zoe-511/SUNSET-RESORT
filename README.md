# Sunset Resort

Sunset Resort is a responsive resort catalogue, booking cart, account, checkout, and payment-simulation platform. The frontend uses semantic HTML, CSS, and vanilla JavaScript. A Flask API connects it to MySQL.

## Project structure

```text
SUNSET-RESORT/
├── assets/
├── database/
│   └── sunset_resort.sql
├── server/
│   ├── .env.example
│   ├── app.py
│   ├── config.py
│   └── requirements.txt
├── app.js
├── index.html
└── styles.css
```

## Verified runtime status on this Windows machine

No working server runtime is currently installed. The following locations and registration sources were checked:

- `PATH`, Windows App Paths, installed-program registry entries, and AppX packages
- `%LOCALAPPDATA%\Programs\Python`, `%LOCALAPPDATA%\Python`, `C:\Python*`, Program Files, Conda, Miniconda, pyenv, and MySQL Workbench folders
- Node.js, NVM, Volta, FNM, and Scoop folders
- PHP, XAMPP, WAMP, Laragon, Chocolatey, Scoop, and Program Files folders

The only discovered `python.exe` and `python3.exe` files are inaccessible Windows Store aliases under `C:\Users\user\AppData\Local\Microsoft\WindowsApps`. They are not a Python installation. Node.js, PHP, XAMPP, `pip`, `npm`, and Composer are absent.

Because there is no installed alternative runtime, the Flask server has not been replaced with Node.js or PHP. There is no truthful working server-start command on this machine yet.

Install a current Python 3 release from [python.org](https://www.python.org/downloads/windows/) and enable **Add Python to PATH** during installation. Open a new PowerShell window afterward and confirm:

```powershell
python --version
```

## 1. Create the MySQL database in Workbench

1. Start MySQL Server and open MySQL Workbench.
2. Open your local MySQL connection.
3. Select **File → Open SQL Script**.
4. Open `database/sunset_resort.sql` from this project.
5. Click the lightning-bolt **Execute** button to run the complete script.
6. Refresh the **Schemas** panel. Confirm that `sunset_resort` contains `users`, `products`, `orders`, and `order_items`.
7. Open the `products` table to confirm the six seeded Sunset Resort offerings.

The script begins with:

```sql
CREATE DATABASE IF NOT EXISTS sunset_resort;
USE sunset_resort;
```

The product seed is repeatable, but rerunning it restores the seeded prices, stock quantities, and availability values.

## 2. Configure the API

From the project root, copy the configuration template:

```powershell
Copy-Item server\.env.example server\.env
```

The backend already defaults to the required local MySQL configuration. The copied file should contain:

```dotenv
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=sunset123
DB_NAME=sunset_resort
APP_SECRET_KEY=CHANGE_THIS_TO_A_LONG_RANDOM_SECRET
```

Do not commit `server/.env`; it is already ignored by Git.

## 3. Install and start the Flask server after Python is installed

From the project root:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r server\requirements.txt
python server\app.py
```

Then open [http://127.0.0.1:5000](http://127.0.0.1:5000). Flask serves both the frontend and API, avoiding cross-origin configuration problems.

These commands cannot run before a real Python installation exists. If Python is later installed outside `PATH`, replace each `python` token above with the full path reported by:

```powershell
Get-ChildItem "$env:LOCALAPPDATA\Programs\Python\Python*\python.exe" | Select-Object -ExpandProperty FullName
```

For example, if that command returns `C:\Users\user\AppData\Local\Programs\Python\Python313\python.exe`, use:

```powershell
& 'C:\Users\user\AppData\Local\Programs\Python\Python313\python.exe' -m venv .venv
& '.\.venv\Scripts\python.exe' -m pip install -r server\requirements.txt
& '.\.venv\Scripts\python.exe' server\app.py
```

Check the connection at [http://127.0.0.1:5000/api/health](http://127.0.0.1:5000/api/health). A working setup returns:

```json
{"status":"ok","database":"connected"}
```

## API endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Verify that Flask can reach MySQL. |
| `GET` | `/api/products` | Fetch current products, prices, stock, and availability. |
| `POST` | `/api/register` | Create a customer using a server-side password hash. |
| `POST` | `/api/login` | Authenticate a customer and return a signed seven-day token. |
| `POST` | `/api/orders` | Save an order and its items, calculate totals, and decrement stock in one transaction. |

`POST /api/orders` locks the requested product rows while checking stock. If stock reaches zero, the API changes `availability_status` to `Fully Booked`. If anything fails, MySQL rolls the transaction back.

## Frontend fallback behavior

`app.js` attempts to use `http://127.0.0.1:5000/api` when the Flask server is available. If the server is not running or returns a temporary availability error, the existing browser-local catalogue, account, cart, and booking simulation continue to work through `localStorage`.

When served by Flask on port 5000, the frontend automatically uses the same-origin `/api` routes. A different API address can be supplied before `app.js` loads:

```html
<script>window.SUNSET_API_BASE_URL = 'http://your-server.example/api';</script>
```

## Development and security notes

- Payment remains a simulation. Card numbers, CVVs, and mobile-money PINs are never sent to or stored by the API.
- Passwords are hashed by Werkzeug before MySQL storage; the API never returns `password_hash`.
- Replace `APP_SECRET_KEY` before use and serve a deployed version over HTTPS.
- Flask’s built-in server is for development. Use a production WSGI server when deploying publicly.
- The browser fallback is intended for demonstrations, not production authentication or payment processing.

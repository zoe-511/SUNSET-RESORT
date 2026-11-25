from __future__ import annotations

import re
import secrets
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from typing import Any

import mysql.connector
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from mysql.connector import Error as MySQLError
from mysql.connector import IntegrityError
from werkzeug.security import check_password_hash, generate_password_hash

from config import (
    ALLOWED_ORIGINS,
    APP_DEBUG,
    APP_HOST,
    APP_PORT,
    DB_CONFIG,
    SECRET_KEY,
)


PROJECT_ROOT = Path(__file__).resolve().parent.parent
EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
ROOM_CATEGORIES = {"Villas", "Suites"}
RESORT_FEE_PER_ROOM_NIGHT = Decimal("45.00")
TAX_RATE = Decimal("0.125")

app = Flask(__name__, static_folder=None)
app.config["JSON_SORT_KEYS"] = False
CORS(app, resources={r"/api/*": {"origins": ALLOWED_ORIGINS}})
token_signer = URLSafeTimedSerializer(SECRET_KEY, salt="sunset-resort-auth")


def database_connection():
    return mysql.connector.connect(**DB_CONFIG)


def json_error(message: str, status: int):
    return jsonify({"error": message}), status


def request_json() -> dict[str, Any]:
    payload = request.get_json(silent=True)
    return payload if isinstance(payload, dict) else {}


def public_user(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "full_name": row["full_name"],
        "email": row["email"],
        "phone": row["phone"],
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
    }


def create_auth_token(user_id: int) -> str:
    return token_signer.dumps({"user_id": user_id})


def authenticated_user_id() -> int | None:
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    token = header.removeprefix("Bearer ").strip()
    try:
        payload = token_signer.loads(token, max_age=60 * 60 * 24 * 7)
        return int(payload["user_id"])
    except (BadSignature, SignatureExpired, KeyError, TypeError, ValueError):
        return None


def product_payload(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "category": row["category"],
        "description": row["description"],
        "price_usd": float(row["price_usd"]),
        "stock_quantity": row["stock_quantity"],
        "availability_status": row["availability_status"],
        "image_url": row["image_url"],
        "rating": float(row["rating"]),
    }


@app.get("/api/health")
def health():
    try:
        connection = database_connection()
        connection.close()
        return jsonify({"status": "ok", "database": "connected"})
    except MySQLError:
        return jsonify({"status": "degraded", "database": "unavailable"}), 503


@app.get("/api/products")
def get_products():
    connection = None
    cursor = None
    try:
        connection = database_connection()
        cursor = connection.cursor(dictionary=True, buffered=True)
        cursor.execute(
            """
            SELECT id, name, category, description, price_usd, stock_quantity,
                   availability_status, image_url, rating
            FROM products
            ORDER BY id
            """
        )
        return jsonify({"products": [product_payload(row) for row in cursor.fetchall()]})
    except MySQLError:
        app.logger.exception("Could not fetch products")
        return json_error("The product catalogue is temporarily unavailable.", 503)
    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@app.post("/api/register")
def register():
    payload = request_json()
    full_name = str(payload.get("full_name", "")).strip()
    email = str(payload.get("email", "")).strip().lower()
    phone = str(payload.get("phone", "")).strip()
    password = str(payload.get("password", ""))

    if not all((full_name, email, phone, password)):
        return json_error("Full name, email, phone, and password are required.", 400)
    if not EMAIL_PATTERN.match(email):
        return json_error("Enter a valid email address.", 400)
    if len(password) < 6:
        return json_error("Password must be at least 6 characters.", 400)

    connection = None
    cursor = None
    try:
        connection = database_connection()
        cursor = connection.cursor(dictionary=True, buffered=True)
        cursor.execute(
            """
            INSERT INTO users (full_name, email, phone, password_hash)
            VALUES (%s, %s, %s, %s)
            """,
            (full_name, email, phone, generate_password_hash(password)),
        )
        user_id = cursor.lastrowid
        connection.commit()
        cursor.execute(
            "SELECT id, full_name, email, phone, created_at FROM users WHERE id = %s",
            (user_id,),
        )
        user = cursor.fetchone()
        return jsonify({"user": public_user(user), "token": create_auth_token(user_id)}), 201
    except IntegrityError as error:
        if connection:
            connection.rollback()
        if error.errno == 1062:
            return json_error("An account already exists for this email.", 409)
        app.logger.exception("Registration integrity error")
        return json_error("The account could not be created.", 500)
    except MySQLError:
        if connection:
            connection.rollback()
        app.logger.exception("Registration database error")
        return json_error("The account service is temporarily unavailable.", 503)
    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@app.post("/api/login")
def login():
    payload = request_json()
    email = str(payload.get("email", "")).strip().lower()
    password = str(payload.get("password", ""))
    if not email or not password:
        return json_error("Email and password are required.", 400)

    connection = None
    cursor = None
    try:
        connection = database_connection()
        cursor = connection.cursor(dictionary=True, buffered=True)
        cursor.execute(
            """
            SELECT id, full_name, email, phone, password_hash, created_at
            FROM users WHERE email = %s
            """,
            (email,),
        )
        user = cursor.fetchone()
        if not user or not check_password_hash(user["password_hash"], password):
            return json_error("Email or password did not match a registered account.", 401)
        return jsonify({"user": public_user(user), "token": create_auth_token(user["id"])})
    except MySQLError:
        app.logger.exception("Login database error")
        return json_error("The login service is temporarily unavailable.", 503)
    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@app.post("/api/orders")
def create_order():
    payload = request_json()
    customer_name = str(payload.get("customer_name", "")).strip()
    customer_email = str(payload.get("customer_email", "")).strip().lower()
    delivery_address = str(payload.get("delivery_address", "")).strip()
    payment_method = str(payload.get("payment_method", "")).strip()
    raw_items = payload.get("items", [])

    try:
        nights = int(payload.get("nights", 1))
    except (TypeError, ValueError):
        nights = 0

    if not customer_name or not customer_email or not delivery_address or not payment_method:
        return json_error("Customer, address, and payment details are required.", 400)
    if not EMAIL_PATTERN.match(customer_email):
        return json_error("Enter a valid customer email address.", 400)
    if nights < 1 or nights > 90:
        return json_error("Nights must be between 1 and 90.", 400)
    if not isinstance(raw_items, list) or not raw_items:
        return json_error("At least one order item is required.", 400)

    quantities: dict[int, int] = {}
    try:
        for item in raw_items:
            product_id = int(item["product_id"])
            quantity = int(item["quantity"])
            if product_id < 1 or quantity < 1:
                raise ValueError
            quantities[product_id] = quantities.get(product_id, 0) + quantity
    except (KeyError, TypeError, ValueError):
        return json_error("Every item needs a valid product_id and positive quantity.", 400)

    connection = None
    cursor = None
    try:
        connection = database_connection()
        connection.start_transaction()
        cursor = connection.cursor(dictionary=True, buffered=True)
        locked_products: list[dict[str, Any]] = []

        for product_id, quantity in quantities.items():
            cursor.execute(
                """
                SELECT id, name, category, price_usd, stock_quantity, availability_status
                FROM products WHERE id = %s FOR UPDATE
                """,
                (product_id,),
            )
            product = cursor.fetchone()
            if not product:
                connection.rollback()
                return json_error(f"Product {product_id} was not found.", 404)
            if quantity > product["stock_quantity"]:
                connection.rollback()
                return json_error(
                    f"Only {product['stock_quantity']} unit(s) of {product['name']} remain.",
                    409,
                )
            product["quantity"] = quantity
            locked_products.append(product)

        subtotal = Decimal("0.00")
        resort_fees = Decimal("0.00")
        for product in locked_products:
            price = Decimal(product["price_usd"])
            quantity = product["quantity"]
            if product["category"] in ROOM_CATEGORIES:
                subtotal += price * quantity * nights
                resort_fees += RESORT_FEE_PER_ROOM_NIGHT * quantity * nights
            else:
                subtotal += price * quantity

        tax = ((subtotal + resort_fees) * TAX_RATE).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        total = (subtotal + resort_fees + tax).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        booking_ref = f"SSR-{datetime.now(timezone.utc):%Y%m%d}-{secrets.token_hex(3).upper()}"
        user_id = authenticated_user_id()

        cursor.execute(
            """
            INSERT INTO orders
              (booking_ref, user_id, customer_name, customer_email, delivery_address,
               total_amount, payment_method, payment_status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, 'Paid')
            """,
            (
                booking_ref,
                user_id,
                customer_name,
                customer_email,
                delivery_address,
                total,
                payment_method,
            ),
        )
        order_id = cursor.lastrowid
        updated_products = []

        for product in locked_products:
            quantity = product["quantity"]
            new_stock = product["stock_quantity"] - quantity
            if new_stock == 0:
                new_status = "Fully Booked"
            elif new_stock <= 2:
                new_status = "Limited Spots"
            else:
                new_status = product["availability_status"]

            cursor.execute(
                """
                INSERT INTO order_items (order_id, product_id, quantity, unit_price)
                VALUES (%s, %s, %s, %s)
                """,
                (order_id, product["id"], quantity, product["price_usd"]),
            )
            cursor.execute(
                """
                UPDATE products
                SET stock_quantity = %s, availability_status = %s
                WHERE id = %s
                """,
                (new_stock, new_status, product["id"]),
            )
            updated_products.append(
                {
                    "id": product["id"],
                    "stock_quantity": new_stock,
                    "availability_status": new_status,
                }
            )

        connection.commit()
        return jsonify(
            {
                "order": {
                    "id": order_id,
                    "booking_ref": booking_ref,
                    "total_amount": float(total),
                    "payment_status": "Paid",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                },
                "totals": {
                    "subtotal": float(subtotal),
                    "resort_fees": float(resort_fees),
                    "tax": float(tax),
                    "grand_total": float(total),
                },
                "updated_products": updated_products,
            }
        ), 201
    except MySQLError:
        if connection:
            connection.rollback()
        app.logger.exception("Order transaction failed")
        return json_error("The order could not be saved. Your cart has not been changed.", 503)
    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@app.get("/")
def frontend_index():
    return send_from_directory(PROJECT_ROOT, "index.html")


@app.get("/<path:asset_path>")
def frontend_assets(asset_path: str):
    if asset_path.startswith("api/"):
        return json_error("API endpoint not found.", 404)
    return send_from_directory(PROJECT_ROOT, asset_path)


if __name__ == "__main__":
    app.run(host=APP_HOST, port=APP_PORT, debug=APP_DEBUG)

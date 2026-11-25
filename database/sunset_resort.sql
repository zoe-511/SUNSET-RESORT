CREATE DATABASE IF NOT EXISTS sunset_resort;
USE sunset_resort;

ALTER DATABASE sunset_resort
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS products (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(160) NOT NULL,
  category VARCHAR(80) NOT NULL,
  description TEXT NOT NULL,
  price_usd DECIMAL(10, 2) UNSIGNED NOT NULL,
  stock_quantity INT UNSIGNED NOT NULL DEFAULT 0,
  availability_status ENUM('Available', 'Limited Spots', 'Fully Booked') NOT NULL DEFAULT 'Available',
  image_url VARCHAR(500) NOT NULL,
  rating DECIMAL(2, 1) UNSIGNED NOT NULL DEFAULT 0.0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_products_name (name),
  KEY idx_products_category (category),
  KEY idx_products_availability (availability_status),
  CONSTRAINT chk_products_rating CHECK (rating BETWEEN 0.0 AND 5.0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  booking_ref VARCHAR(40) NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  customer_name VARCHAR(120) NOT NULL,
  customer_email VARCHAR(190) NOT NULL,
  delivery_address TEXT NOT NULL,
  total_amount DECIMAL(12, 2) UNSIGNED NOT NULL,
  payment_method VARCHAR(80) NOT NULL,
  payment_status ENUM('Pending', 'Paid', 'Failed', 'Refunded') NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_booking_ref (booking_ref),
  KEY idx_orders_user_id (user_id),
  KEY idx_orders_customer_email (customer_email),
  CONSTRAINT fk_orders_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  unit_price DECIMAL(10, 2) UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  KEY idx_order_items_order_id (order_id),
  KEY idx_order_items_product_id (product_id),
  CONSTRAINT chk_order_items_quantity CHECK (quantity > 0),
  CONSTRAINT fk_order_items_order
    FOREIGN KEY (order_id) REFERENCES orders (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product
    FOREIGN KEY (product_id) REFERENCES products (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB;

INSERT INTO products
  (id, name, category, description, price_usd, stock_quantity, availability_status, image_url, rating)
VALUES
  (1, 'Ocean Villa', 'Villas', 'A secluded one-bedroom retreat with an infinity pool, sunset deck, and uninterrupted ocean views.', 680.00, 4, 'Available', 'assets/sunset-resort-hero.png', 4.9),
  (2, 'Horizon Suite', 'Suites', 'An airy signature suite with a generous terrace, soaking tub, and golden-hour views from every angle.', 420.00, 2, 'Limited Spots', 'assets/sunset-resort-hero.png', 4.7),
  (3, 'Garden Casita', 'Suites', 'A peaceful garden hideaway with a shaded courtyard, outdoor shower, and a path straight to the beach.', 285.00, 0, 'Fully Booked', 'assets/sunset-resort-hero.png', 4.6),
  (4, 'Sunset Sailing', 'Experiences', 'Drift into golden hour aboard a private catamaran with chilled refreshments and an open horizon.', 145.00, 6, 'Limited Spots', 'assets/sunset-resort-hero.png', 4.8),
  (5, 'Ocean-to-Table Dining', 'Spa & Dining', 'A five-course coastal menu that follows the day''s catch, served under an open evening sky.', 120.00, 8, 'Available', 'assets/sunset-resort-hero.png', 4.7),
  (6, 'Stillness by the Sea Spa', 'Spa & Dining', 'A restorative ocean-inspired ritual with warm stone therapy, botanical oils, and quiet time by the sea.', 195.00, 0, 'Fully Booked', 'assets/sunset-resort-hero.png', 4.8)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  category = VALUES(category),
  description = VALUES(description),
  price_usd = VALUES(price_usd),
  stock_quantity = VALUES(stock_quantity),
  availability_status = VALUES(availability_status),
  image_url = VALUES(image_url),
  rating = VALUES(rating);

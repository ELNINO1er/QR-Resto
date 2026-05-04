CREATE DATABASE IF NOT EXISTS qr_resto CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE qr_resto;

CREATE TABLE restaurants (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(80) NOT NULL UNIQUE,
  status ENUM('active', 'suspended') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  restaurant_id BIGINT UNSIGNED NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('superadmin', 'admin', 'serveur', 'cuisine', 'caisse') NOT NULL DEFAULT 'admin',
  name VARCHAR(80) NOT NULL,
  default_password_changed TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_users_restaurant (restaurant_id),
  CONSTRAINT fk_users_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
);

CREATE TABLE dishes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  restaurant_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(600) DEFAULT '',
  price INT UNSIGNED NOT NULL,
  category ENUM('entrees', 'plats', 'desserts', 'boissons') NOT NULL,
  image MEDIUMTEXT,
  stock INT UNSIGNED NOT NULL DEFAULT 0,
  available TINYINT(1) NOT NULL DEFAULT 1,
  visible TINYINT(1) NOT NULL DEFAULT 1,
  veg TINYINT(1) NOT NULL DEFAULT 0,
  gluten_free TINYINT(1) NOT NULL DEFAULT 0,
  spicy TINYINT(1) NOT NULL DEFAULT 0,
  prep_time INT UNSIGNED NOT NULL DEFAULT 15,
  rating DECIMAL(2,1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_dishes_restaurant (restaurant_id),
  CONSTRAINT fk_dishes_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
);

CREATE TABLE orders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  restaurant_id BIGINT UNSIGNED NOT NULL,
  table_number INT UNSIGNED NOT NULL,
  total INT UNSIGNED NOT NULL,
  status ENUM('pending', 'preparing', 'ready', 'served', 'cancelled') NOT NULL DEFAULT 'pending',
  payment_status ENUM('unpaid', 'paid', 'refunded') NOT NULL DEFAULT 'unpaid',
  payment_method ENUM('', 'cash', 'mobile_money', 'card') NOT NULL DEFAULT '',
  amount_paid INT UNSIGNED NOT NULL DEFAULT 0,
  change_due INT UNSIGNED NOT NULL DEFAULT 0,
  paid_at DATETIME NULL,
  notes VARCHAR(600) DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_orders_restaurant_created (restaurant_id, created_at),
  CONSTRAINT fk_orders_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
);

CREATE TABLE order_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  dish_id BIGINT UNSIGNED NULL,
  name VARCHAR(120) NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  price INT UNSIGNED NOT NULL,
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_dish FOREIGN KEY (dish_id) REFERENCES dishes(id) ON DELETE SET NULL
);

CREATE TABLE settings (
  restaurant_id BIGINT UNSIGNED NOT NULL,
  `key` VARCHAR(80) NOT NULL,
  `value` TEXT NOT NULL,
  PRIMARY KEY (restaurant_id, `key`),
  CONSTRAINT fk_settings_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);

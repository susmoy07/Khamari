-- ============================================================================
-- Khamari Agricultural Marketplace — MySQL 8.0+ Relational Schema (3NF)
-- Storage Engine: InnoDB (ACID Compliant, Row-Level Locking, Foreign Keys)
-- ============================================================================

CREATE DATABASE IF NOT EXISTS khamari_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE khamari_db;

-- ----------------------------------------------------------------------------
-- 1. Users Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('FARMER', 'BUYER', 'INSTITUTION', 'BAZAAR_COMMITTEE', 'ADMIN') NOT NULL,
    organization_name VARCHAR(120) NULL,
    region VARCHAR(100) NOT NULL,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    avatar_url VARCHAR(255) NULL,
    bio TEXT NULL,
    nid_number VARCHAR(50) NULL,
    address VARCHAR(255) NULL,
    specialty_crops VARCHAR(255) NULL,
    years_experience INT UNSIGNED NULL,
    otp_code_hash VARCHAR(255) NULL,
    otp_expires_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT uq_users_phone UNIQUE (phone),
    INDEX idx_users_role_region (role, region)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 2. BazaarPrices Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS BazaarPrices (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    crop_category VARCHAR(80) NOT NULL,
    bazaar_region VARCHAR(100) NOT NULL,
    unit ENUM('KG', 'MAUND', 'TON') NOT NULL DEFAULT 'KG',
    min_price DECIMAL(10, 2) NOT NULL,
    modal_price DECIMAL(10, 2) NOT NULL,
    max_price DECIMAL(10, 2) NOT NULL,
    verified_by BIGINT UNSIGNED NOT NULL,
    effective_date DATE NOT NULL,
    market_notes VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_bazaar_prices_verifier
        FOREIGN KEY (verified_by) REFERENCES Users(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT chk_bazaar_price_corridor
        CHECK (min_price > 0 AND min_price <= modal_price AND modal_price <= max_price),
    CONSTRAINT uq_bazaar_daily_crop_region
        UNIQUE (crop_category, bazaar_region, unit, effective_date),
    INDEX idx_bazaar_lookup (crop_category, bazaar_region, effective_date DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3. Crops Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Crops (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    farmer_id BIGINT UNSIGNED NOT NULL,
    bazaar_price_id BIGINT UNSIGNED NULL,
    title VARCHAR(120) NOT NULL,
    crop_category VARCHAR(80) NOT NULL,
    variety VARCHAR(80) NULL,
    bazaar_region VARCHAR(100) NOT NULL,
    quantity_available DECIMAL(12, 2) NOT NULL,
    min_order_quantity DECIMAL(12, 2) NOT NULL DEFAULT 10.00,
    unit ENUM('KG', 'MAUND', 'TON') NOT NULL DEFAULT 'KG',
    base_price_per_unit DECIMAL(10, 2) NOT NULL,
    bulk_threshold_qty DECIMAL(12, 2) NULL,
    bulk_discount_pct DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    harvest_date DATE NOT NULL,
    quality_grade ENUM('GRADE_A', 'GRADE_B', 'STANDARD') NOT NULL DEFAULT 'GRADE_A',
    image_url VARCHAR(255) NULL,
    status ENUM('AVAILABLE', 'RESERVED', 'SOLD_OUT', 'ARCHIVED') NOT NULL DEFAULT 'AVAILABLE',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_crops_farmer
        FOREIGN KEY (farmer_id) REFERENCES Users(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_crops_bazaar_price
        FOREIGN KEY (bazaar_price_id) REFERENCES BazaarPrices(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT chk_crops_quantities
        CHECK (quantity_available >= 0 AND min_order_quantity > 0),
    CONSTRAINT chk_crops_pricing
        CHECK (base_price_per_unit > 0 AND bulk_discount_pct >= 0.00 AND bulk_discount_pct <= 50.00),
    INDEX idx_crops_marketplace (status, crop_category, bazaar_region),
    INDEX idx_crops_farmer (farmer_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 4. Negotiations Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Negotiations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    crop_id BIGINT UNSIGNED NOT NULL,
    buyer_id BIGINT UNSIGNED NOT NULL,
    farmer_id BIGINT UNSIGNED NOT NULL,
    requested_quantity DECIMAL(12, 2) NOT NULL,
    current_offer_price DECIMAL(10, 2) NOT NULL,
    last_offered_by ENUM('BUYER', 'FARMER') NOT NULL,
    status ENUM('OPEN', 'COUNTERED', 'ACCEPTED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_negotiations_crop
        FOREIGN KEY (crop_id) REFERENCES Crops(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_negotiations_buyer
        FOREIGN KEY (buyer_id) REFERENCES Users(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_negotiations_farmer
        FOREIGN KEY (farmer_id) REFERENCES Users(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT chk_negotiations_positive
        CHECK (requested_quantity > 0 AND current_offer_price > 0),
    INDEX idx_negotiations_crop_status (crop_id, status),
    INDEX idx_negotiations_buyer (buyer_id, status),
    INDEX idx_negotiations_farmer (farmer_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 5. Messages Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Messages (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    negotiation_id BIGINT UNSIGNED NOT NULL,
    sender_id BIGINT UNSIGNED NOT NULL,
    message_type ENUM('TEXT', 'BID_OFFER', 'COUNTER_OFFER', 'SYSTEM_ALERT') NOT NULL DEFAULT 'TEXT',
    content TEXT NOT NULL,
    offered_unit_price DECIMAL(10, 2) NULL,
    offered_quantity DECIMAL(12, 2) NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_messages_negotiation
        FOREIGN KEY (negotiation_id) REFERENCES Negotiations(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_messages_sender
        FOREIGN KEY (sender_id) REFERENCES Users(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX idx_messages_negotiation_time (negotiation_id, created_at ASC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 6. Orders Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Orders (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    receipt_number VARCHAR(40) NOT NULL,
    crop_id BIGINT UNSIGNED NOT NULL,
    negotiation_id BIGINT UNSIGNED NULL,
    buyer_id BIGINT UNSIGNED NOT NULL,
    farmer_id BIGINT UNSIGNED NOT NULL,
    quantity_ordered DECIMAL(12, 2) NOT NULL,
    unit ENUM('KG', 'MAUND', 'TON') NOT NULL,
    unit_price_agreed DECIMAL(10, 2) NOT NULL,
    subtotal_amount DECIMAL(12, 2) NOT NULL,
    discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(12, 2) NOT NULL,
    pricing_strategy_used VARCHAR(60) NOT NULL,
    receipt_type ENUM('WHOLESALE_STANDARD', 'INSTITUTIONAL_TAX', 'BAZAAR_CERTIFIED') NOT NULL,
    payment_status ENUM('PENDING', 'ESCROW_HELD', 'PAID', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
    order_status ENUM('CONFIRMED', 'DISPATCHED', 'DELIVERED', 'CANCELLED') NOT NULL DEFAULT 'CONFIRMED',
    delivery_address VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT uq_orders_receipt_number UNIQUE (receipt_number),
    CONSTRAINT uq_orders_negotiation UNIQUE (negotiation_id),
    CONSTRAINT fk_orders_crop
        FOREIGN KEY (crop_id) REFERENCES Crops(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_orders_negotiation
        FOREIGN KEY (negotiation_id) REFERENCES Negotiations(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_orders_buyer
        FOREIGN KEY (buyer_id) REFERENCES Users(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_orders_farmer
        FOREIGN KEY (farmer_id) REFERENCES Users(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT chk_orders_amounts
        CHECK (quantity_ordered > 0 AND unit_price_agreed > 0 AND discount_amount >= 0 AND total_amount >= 0),
    INDEX idx_orders_buyer_created (buyer_id, created_at DESC),
    INDEX idx_orders_farmer_created (farmer_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

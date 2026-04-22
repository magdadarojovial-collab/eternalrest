-- ============================================================
--  Eternal Rest Funeral Services – Updated Schema
--  Changes: 2-branch constraint, casket inclusions,
--           retrieval/burial info, inventory chat messages
-- ============================================================

CREATE DATABASE IF NOT EXISTS `eternal_rest`;
USE `eternal_rest`;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `inventory_messages`;
DROP TABLE IF EXISTS `casket_inclusions`;
DROP TABLE IF EXISTS `memorial_tributes`;
DROP TABLE IF EXISTS `memorial_photos`;
DROP TABLE IF EXISTS `memorials`;
DROP TABLE IF EXISTS `audit_log`;
DROP TABLE IF EXISTS `inventory_transfers`;
DROP TABLE IF EXISTS `deceased_records`;
DROP TABLE IF EXISTS `reservations`;
DROP TABLE IF EXISTS `caskets`;
DROP TABLE IF EXISTS `clients`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `branches`;

-- ── BRANCHES (fixed: only 2) ────────────────────────────────
CREATE TABLE `branches` (
  `id`           int(11) NOT NULL AUTO_INCREMENT,
  `name`         varchar(150) NOT NULL,
  `address`      varchar(255) DEFAULT NULL,
  `phone`        varchar(30)  DEFAULT NULL,
  `email`        varchar(180) DEFAULT NULL,
  `manager_name` varchar(200) DEFAULT NULL,
  `status`       enum('active','inactive') DEFAULT 'active',
  `created_at`   datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── AUDIT LOG ───────────────────────────────────────────────
CREATE TABLE `audit_log` (
  `id`         int(11) NOT NULL AUTO_INCREMENT,
  `branch_id`  int(11) DEFAULT NULL,
  `user`       varchar(80)  DEFAULT NULL,
  `action`     varchar(100) DEFAULT NULL,
  `details`    text         DEFAULT NULL,
  `ip`         varchar(45)  DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `branch_id` (`branch_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── CLIENTS ─────────────────────────────────────────────────
CREATE TABLE `clients` (
  `id`         int(11) NOT NULL AUTO_INCREMENT,
  `fname`      varchar(100) NOT NULL,
  `lname`      varchar(100) NOT NULL,
  `email`      varchar(180) NOT NULL,
  `phone`      varchar(30)  NOT NULL,
  `password`   varchar(255) NOT NULL,
  `address`    varchar(255) DEFAULT NULL,
  `status`     enum('active','inactive') DEFAULT 'active',
  `last_login` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── CASKETS ─────────────────────────────────────────────────
-- category restricted to: wood | metal  (per requirements)
CREATE TABLE `caskets` (
  `id`          int(11) NOT NULL AUTO_INCREMENT,
  `branch_id`   int(11) DEFAULT NULL,
  `name`        varchar(150) NOT NULL,
  `category`    enum('wood','metal') NOT NULL DEFAULT 'wood',
  `material`    varchar(120) DEFAULT NULL,
  `price`       decimal(12,2) NOT NULL,
  `stock`       int(11) DEFAULT 1,
  `status`      enum('available','reserved','limited') DEFAULT 'available',
  `description` text DEFAULT NULL,
  `features`    longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL
                CHECK (json_valid(`features`)),
  `size_length` decimal(6,2) NOT NULL DEFAULT 76.00,
  `size_width`  decimal(6,2) NOT NULL DEFAULT 26.00,
  `size_height` decimal(6,2) NOT NULL DEFAULT 23.00,
  `image_url`   varchar(255) DEFAULT NULL,
  `created_at`  datetime DEFAULT current_timestamp(),
  `updated_at`  datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `branch_id` (`branch_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── CASKET INCLUSIONS ────────────────────────────────────────
-- Predefined package inclusions per casket
CREATE TABLE `casket_inclusions` (
  `id`         int(11) NOT NULL AUTO_INCREMENT,
  `casket_id`  int(11) NOT NULL,
  `item_name`  varchar(150) NOT NULL,
  `quantity`   int(11) DEFAULT 1,
  `unit`       varchar(50)  DEFAULT NULL,  -- e.g. 'pcs', 'pair', 'set'
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `casket_id` (`casket_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── USERS ───────────────────────────────────────────────────
CREATE TABLE `users` (
  `id`         int(11) NOT NULL AUTO_INCREMENT,
  `branch_id`  int(11) DEFAULT NULL,
  `fname`      varchar(100) NOT NULL,
  `lname`      varchar(100) NOT NULL,
  `username`   varchar(80)  NOT NULL,
  `email`      varchar(180) NOT NULL,
  `password`   varchar(255) NOT NULL,
  `role`       enum('admin','staff','superadmin') DEFAULT 'staff',
  `status`     enum('active','inactive') DEFAULT 'active',
  `last_login` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email`    (`email`),
  KEY `branch_id` (`branch_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── INVENTORY MESSAGES (chatbox for stock/order requests) ────
CREATE TABLE `inventory_messages` (
  `id`          int(11) NOT NULL AUTO_INCREMENT,
  `sender_id`   int(11) NOT NULL,             -- users.id
  `sender_role` enum('admin','superadmin') NOT NULL,
  `branch_id`   int(11) DEFAULT NULL,         -- sender's branch
  `message`     text NOT NULL,
  `status`      enum('unread','read') DEFAULT 'unread',
  `msg_type`    enum('request','reply','info') DEFAULT 'info',
  `created_at`  datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `sender_id`  (`sender_id`),
  KEY `branch_id`  (`branch_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── RESERVATIONS ────────────────────────────────────────────
CREATE TABLE `reservations` (
  `id`                     int(11) NOT NULL AUTO_INCREMENT,
  `branch_id`              int(11) DEFAULT NULL,
  `client_id`              int(11) DEFAULT NULL,
  -- Client info
  `fname`                  varchar(100) NOT NULL,
  `lname`                  varchar(100) NOT NULL,
  `email`                  varchar(180) NOT NULL,
  `phone`                  varchar(30)  NOT NULL,
  `client_address`         varchar(255) DEFAULT NULL,
  -- Deceased info
  `deceased_name`          varchar(150) DEFAULT NULL,
  `deceased_age`           tinyint(3) UNSIGNED DEFAULT NULL,
  `deceased_address`       varchar(255) DEFAULT NULL,
  -- Retrieval info (NEW)
  `retrieval_location`     varchar(255) DEFAULT NULL,   -- where deceased will be retrieved
  `retrieval_datetime`     datetime     DEFAULT NULL,   -- date & time for retrieval
  -- Burial/service info
  `burial_time`            time    DEFAULT NULL,
  `burial_place`           varchar(255) DEFAULT NULL,
  `burial_schedule`        datetime DEFAULT NULL,        -- full burial schedule (NEW)
  -- Casket & service
  `casket_id`              int(11) DEFAULT NULL,
  `casket_name`            varchar(150) DEFAULT NULL,
  `service_date`           date    DEFAULT NULL,
  `service_type`           varchar(100) DEFAULT NULL,
  `notes`                  text    DEFAULT NULL,
  -- Pricing
  `price_coffin`           decimal(12,2) NOT NULL DEFAULT 0.00,
  `price_funeral_car`      decimal(12,2) NOT NULL DEFAULT 0.00,
  `price_funeral_services` decimal(12,2) NOT NULL DEFAULT 0.00,
  `price_embalming`        decimal(12,2) NOT NULL DEFAULT 0.00,
  `price_other`            decimal(12,2) NOT NULL DEFAULT 0.00,
  `price_advance`          decimal(12,2) NOT NULL DEFAULT 0.00,
  `price_total`            decimal(12,2) NOT NULL DEFAULT 0.00,
  `price_balance`          decimal(12,2) NOT NULL DEFAULT 0.00,
  -- Balance payment
  `balance_paid`            tinyint(1) NOT NULL DEFAULT 0,
  `balance_paid_at`         datetime DEFAULT NULL,
  `balance_payment_method`  varchar(30) DEFAULT NULL,
  -- Payment
  `payment_method`          varchar(80)  DEFAULT NULL,
  `payment_reference`       varchar(120) DEFAULT NULL,
  `payment_status`          enum('pending_verification','verified','rejected') DEFAULT 'pending_verification',
  `status`                  enum('pending','confirmed','completed','cancelled') DEFAULT 'pending',
  -- Installment
  `installment_plan`        tinyint(1) DEFAULT 0,
  `installment_months`      int(11) DEFAULT NULL,
  `installment_monthly`     decimal(12,2) DEFAULT NULL,
  `created_at`              datetime DEFAULT current_timestamp(),
  `updated_at`              datetime DEFAULT NULL ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `branch_id`        (`branch_id`),
  KEY `casket_id`        (`casket_id`),
  KEY `client_id`        (`client_id`),
  KEY `idx_balance_paid` (`balance_paid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── MEMORIALS ───────────────────────────────────────────────
CREATE TABLE `memorials` (
  `id`         int(11) NOT NULL AUTO_INCREMENT,
  `branch_id`  int(11) DEFAULT NULL,
  `name`       varchar(200) NOT NULL,
  `born`       date DEFAULT NULL,
  `died`       date DEFAULT NULL,
  `quote`      text DEFAULT NULL,
  `initials`   varchar(4) DEFAULT NULL,
  `candles`    int(11) DEFAULT 0,
  `photo_url`  varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `branch_id` (`branch_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `memorial_photos` (
  `id`          int(11) NOT NULL AUTO_INCREMENT,
  `memorial_id` int(11) NOT NULL,
  `photo_url`   varchar(255) NOT NULL,
  `caption`     varchar(300) DEFAULT NULL,
  `uploaded_by` varchar(120) DEFAULT NULL,
  `created_at`  datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_memorial_photos` (`memorial_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `memorial_tributes` (
  `id`          int(11) NOT NULL AUTO_INCREMENT,
  `memorial_id` int(11) NOT NULL,
  `author_name` varchar(120) NOT NULL,
  `relation`    varchar(80)  DEFAULT NULL,
  `message`     text NOT NULL,
  `photo_url`   varchar(255) DEFAULT NULL,
  `created_at`  datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_memorial_tributes` (`memorial_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── DECEASED RECORDS ────────────────────────────────────────
CREATE TABLE `deceased_records` (
  `id`             int(11) NOT NULL AUTO_INCREMENT,
  `branch_id`      int(11) DEFAULT NULL,
  `reservation_id` int(11) DEFAULT NULL,
  `full_name`      varchar(200) NOT NULL,
  `date_of_birth`  date DEFAULT NULL,
  `date_of_death`  date DEFAULT NULL,
  `cause_of_death` varchar(255) DEFAULT NULL,
  `address`        varchar(255) DEFAULT NULL,
  `notes`          text DEFAULT NULL,
  `created_at`     datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `branch_id`      (`branch_id`),
  KEY `reservation_id` (`reservation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── INVENTORY TRANSFERS ─────────────────────────────────────
CREATE TABLE `inventory_transfers` (
  `id`             int(11) NOT NULL AUTO_INCREMENT,
  `casket_id`      int(11) DEFAULT NULL,
  `from_branch_id` int(11) DEFAULT NULL,
  `to_branch_id`   int(11) DEFAULT NULL,
  `quantity`       int(11) DEFAULT 1,
  `notes`          text DEFAULT NULL,
  `transferred_by` varchar(80) DEFAULT NULL,
  `created_at`     datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `casket_id`      (`casket_id`),
  KEY `from_branch_id` (`from_branch_id`),
  KEY `to_branch_id`   (`to_branch_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  SEED DATA
-- ============================================================

-- Two fixed branches only
INSERT INTO `branches` (`id`, `name`, `address`, `phone`, `email`, `manager_name`, `status`) VALUES
(1, 'General Santos Branch', 'Lagao, General Santos City, South Cotabato', '+63 (83) 301-0001', 'gensan@eternalrest.ph', 'Maria Santos', 'active'),
(2, 'Bohol Branch', 'CPG Avenue, Tagbilaran City, Bohol', '+63 (38) 501-0002', 'bohol@eternalrest.ph', 'Jose Reyes', 'active');

-- Users
INSERT INTO `users` (`id`, `fname`, `lname`, `username`, `email`, `password`, `role`, `branch_id`, `status`) VALUES
(1, 'Super', 'Admin',   'superadmin', 'admin@eternalrest.com',    '$2b$10$7xT2XeFf1r4lA8OXLi8iC.XW1mLz679TSuFXxDbw/G8gpTOJkdYDK', 'superadmin', NULL, 'active'),
(2, 'Maria', 'Santos',  'msantos',    'msantos@eternalrest.ph',   '$2b$10$7xT2XeFf1r4lA8OXLi8iC.XW1mLz679TSuFXxDbw/G8gpTOJkdYDK', 'admin', 1, 'active'),
(3, 'Jose',  'Reyes',   'jreyes',     'jreyes@eternalrest.ph',    '$2b$10$7xT2XeFf1r4lA8OXLi8iC.XW1mLz679TSuFXxDbw/G8gpTOJkdYDK', 'admin', 2, 'active');

-- Caskets — 6 models (wood below 50k, metal above 50k), standard size L76×W26×H23
INSERT INTO `caskets` (`id`, `branch_id`, `name`, `category`, `material`, `price`, `stock`, `status`, `description`, `features`, `size_length`, `size_width`, `size_height`, `image_url`) VALUES
-- General Santos Branch
(1, 1, 'Eternal Dita',    'wood',  'Dita Wood',       35000.00, 3, 'available',
 'Wood Casket, Double Top (split and full lid covers), Full Glass, Elegant Interiors, corners and handles',
 '["Double Top","Full Glass","Elegant Interiors","Corners & Handles"]', 76.00, 26.00, 23.00, '/uploads/caskets/eternal_dita.jpg'),
(2, 1, 'Classic Oak',     'wood',  'Oak Wood',        40000.00, 3, 'available',
 'Wood Casket, Single Top (Split Lid Cover), Full Glass, Elegant Interiors, corners and handles',
 '["Single Top","Full Glass","Elegant Interiors","Corners & Handles"]', 76.00, 26.00, 23.00, '/uploads/caskets/classic_oak.jpg'),
(3, 1, 'Royal Mahogany',  'wood',  'Mahogany Wood',   45000.00, 2, 'available',
 'Wood Casket, Single Top (half lid cover), Half Glass, Elegant Interiors, corners and handles',
 '["Single Top","Half Glass","Elegant Interiors","Corners & Handles"]', 76.00, 26.00, 23.00, '/uploads/caskets/royal_mahogany.jpg'),
-- Bohol Branch
(4, 2, 'Silver Serenity', 'metal', 'Stainless Steel', 55000.00, 4, 'available',
 'Metal Casket, Single Top (Split Lid Cover), Full Glass, Elegant Interiors, corners and handles',
 '["Single Top","Full Glass","Elegant Interiors","Corners & Handles"]', 76.00, 26.00, 23.00, '/uploads/caskets/silver_serenity.jpg'),
(5, 2, 'Iron Grace',      'metal', 'Iron',            65000.00, 2, 'available',
 'Metal Casket, Single Top (full lid cover), Full Glass, Elegant Interiors, corners and handles',
 '["Single Top","Full Glass","Elegant Interiors","Corners & Handles"]', 76.00, 26.00, 23.00, '/uploads/caskets/iron_grace.jpg'),
(6, 2, 'Heritage Narra',  'wood',  'Narra Wood',      48000.00, 3, 'available',
 'Wood Casket, Single Top (full lid cover), Half Glass, Elegant Interiors, corners and handles',
 '["Single Top","Half Glass","Elegant Interiors","Corners & Handles"]', 76.00, 26.00, 23.00, '/uploads/caskets/heritage_narra.jpg');

-- Casket inclusions per package
INSERT INTO `casket_inclusions` (`casket_id`, `item_name`, `quantity`, `unit`) VALUES
-- Eternal Dita (id=1)
(1, 'Candles',         6, 'pcs'),
(1, 'Barong/Attire',   1, 'set'),
(1, 'Monobloc Chairs', 30, 'pcs'),
(1, 'Folding Tables',  4, 'pcs'),
(1, 'Funeral Tent',    1, 'set'),
-- Classic Oak (id=2)
(2, 'Candles',         6, 'pcs'),
(2, 'Barong/Attire',   1, 'set'),
(2, 'Monobloc Chairs', 30, 'pcs'),
(2, 'Folding Tables',  4, 'pcs'),
(2, 'Funeral Tent',    1, 'set'),
-- Royal Mahogany (id=3)
(3, 'Candles',         8, 'pcs'),
(3, 'Barong/Attire',   1, 'set'),
(3, 'Monobloc Chairs', 40, 'pcs'),
(3, 'Folding Tables',  4, 'pcs'),
(3, 'Funeral Tent',    1, 'set'),
-- Silver Serenity (id=4)
(4, 'Candles',         8, 'pcs'),
(4, 'Barong/Attire',   1, 'set'),
(4, 'Monobloc Chairs', 40, 'pcs'),
(4, 'Folding Tables',  4, 'pcs'),
(4, 'Funeral Tent',    1, 'set'),
-- Iron Grace (id=5)
(5, 'Candles',         10, 'pcs'),
(5, 'Barong/Attire',   1,  'set'),
(5, 'Monobloc Chairs', 50, 'pcs'),
(5, 'Folding Tables',  6,  'pcs'),
(5, 'Funeral Tent',    2,  'set'),
(5, 'Memorial Flowers', 2, 'arrangement'),
-- Heritage Narra (id=6)
(6, 'Candles',         8, 'pcs'),
(6, 'Barong/Attire',   1, 'set'),
(6, 'Monobloc Chairs', 40, 'pcs'),
(6, 'Folding Tables',  4, 'pcs'),
(6, 'Funeral Tent',    1, 'set');

-- Clients
INSERT INTO `clients` (`id`, `fname`, `lname`, `email`, `phone`, `password`, `status`) VALUES
(1, 'Jovial', 'Magdadaro', 'magdadarojovial@gmail.com', '09476293738',
 '$2b$10$y0Pisx.UOwegLgfs6MDC1eyRek1QXqmAiyNDq.GrIpKy4r2r9Hg6m', 'active');

-- Memorials
INSERT INTO `memorials` (`id`, `branch_id`, `name`, `born`, `died`, `quote`, `initials`, `candles`) VALUES
(1, 1, 'Maria Clara Reyes',  '1945-04-12', '2024-11-03', 'She filled every room with laughter and love.', 'MC', 14),
(2, 2, 'Jose Andres Santos', '1938-07-22', '2024-09-18', 'A quiet strength that held our family together.', 'JA', 9),
(3, 1, 'Lourdes Bautista',   '1952-01-30', '2024-12-25', 'Her faith was her foundation and her joy was our strength.', 'LB', 22);

-- ── FOREIGN KEYS ─────────────────────────────────────────────
ALTER TABLE `audit_log`
  ADD CONSTRAINT `audit_log_ibfk_1` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE SET NULL;

ALTER TABLE `caskets`
  ADD CONSTRAINT `caskets_ibfk_1` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE SET NULL;

ALTER TABLE `casket_inclusions`
  ADD CONSTRAINT `casket_inclusions_ibfk_1` FOREIGN KEY (`casket_id`) REFERENCES `caskets` (`id`) ON DELETE CASCADE;

ALTER TABLE `users`
  ADD CONSTRAINT `users_ibfk_1` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE SET NULL;

ALTER TABLE `inventory_messages`
  ADD CONSTRAINT `inv_msg_ibfk_1` FOREIGN KEY (`sender_id`)  REFERENCES `users`    (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `inv_msg_ibfk_2` FOREIGN KEY (`branch_id`)  REFERENCES `branches` (`id`) ON DELETE SET NULL;

ALTER TABLE `reservations`
  ADD CONSTRAINT `reservations_ibfk_1` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `reservations_ibfk_2` FOREIGN KEY (`casket_id`) REFERENCES `caskets`  (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_reservations_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE SET NULL;

ALTER TABLE `memorials`
  ADD CONSTRAINT `memorials_ibfk_1` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE SET NULL;

ALTER TABLE `memorial_photos`
  ADD CONSTRAINT `memorial_photos_ibfk_1` FOREIGN KEY (`memorial_id`) REFERENCES `memorials` (`id`) ON DELETE CASCADE;

ALTER TABLE `memorial_tributes`
  ADD CONSTRAINT `memorial_tributes_ibfk_1` FOREIGN KEY (`memorial_id`) REFERENCES `memorials` (`id`) ON DELETE CASCADE;

ALTER TABLE `deceased_records`
  ADD CONSTRAINT `deceased_records_ibfk_1` FOREIGN KEY (`branch_id`)      REFERENCES `branches`     (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `deceased_records_ibfk_2` FOREIGN KEY (`reservation_id`) REFERENCES `reservations` (`id`) ON DELETE SET NULL;

ALTER TABLE `inventory_transfers`
  ADD CONSTRAINT `inventory_transfers_ibfk_1` FOREIGN KEY (`casket_id`)      REFERENCES `caskets`  (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `inventory_transfers_ibfk_2` FOREIGN KEY (`from_branch_id`) REFERENCES `branches` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `inventory_transfers_ibfk_3` FOREIGN KEY (`to_branch_id`)   REFERENCES `branches` (`id`) ON DELETE CASCADE;

SET FOREIGN_KEY_CHECKS = 1;

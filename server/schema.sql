-- Safe to run on every start: only creates what is missing.

CREATE TABLE IF NOT EXISTS admins (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(255) UNIQUE NOT NULL,
  name          VARCHAR(160) NOT NULL DEFAULT '',
  password_hash VARCHAR(255) NOT NULL,
  token_version INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reviews (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(160) NOT NULL,
  email       VARCHAR(255) NOT NULL,
  phone       VARCHAR(40) NOT NULL DEFAULT '',
  rating      TINYINT NOT NULL,
  message     TEXT NOT NULL,
  status      ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  verified    TINYINT(1) NOT NULL DEFAULT 0,
  avatar      JSON NULL,
  media       JSON NOT NULL,
  video_link  VARCHAR(600) NOT NULL DEFAULT '',
  admin_note  VARCHAR(1000) NOT NULL DEFAULT '',
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP NULL DEFAULT NULL,
  CONSTRAINT reviews_rating_chk CHECK (rating BETWEEN 1 AND 5),
  INDEX reviews_status_created_idx (status, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS gallery_items (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  type          ENUM('image','video') NOT NULL,
  url           VARCHAR(2000) NOT NULL,
  public_id     VARCHAR(2000),
  title         VARCHAR(160) NOT NULL DEFAULT '',
  caption       VARCHAR(600) NOT NULL DEFAULT '',
  published     TINYINT(1) NOT NULL DEFAULT 1,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX gallery_order_idx (sort_order, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS enquiries (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(160) NOT NULL,
  phone      VARCHAR(40) NOT NULL,
  email      VARCHAR(255) NOT NULL DEFAULT '',
  topic      VARCHAR(100) NOT NULL DEFAULT '',
  message    TEXT NOT NULL,
  handled    TINYINT(1) NOT NULL DEFAULT 0,
  lead_status VARCHAR(40) NOT NULL DEFAULT 'new',
  lead_note VARCHAR(1000) NOT NULL DEFAULT '',
  follow_up_at DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX enquiries_created_idx (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS site_settings (
  setting_key   VARCHAR(80) PRIMARY KEY,
  setting_value JSON NOT NULL,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

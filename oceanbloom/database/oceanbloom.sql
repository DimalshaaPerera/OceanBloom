-- =====================================================================
-- OceanBloom database (MySQL 8 / MariaDB 10.4+, e.g. XAMPP phpMyAdmin)
-- Run the whole file in phpMyAdmin -> SQL tab -> Go.
-- Running it again rebuilds the database from scratch (ALL DATA IS LOST).
-- =====================================================================

DROP DATABASE IF EXISTS oceanbloom;
CREATE DATABASE oceanbloom
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;   -- case-insensitive: "Nemo" and "nemo" count as the same username
USE oceanbloom;

-- ---------------------------------------------------------------------
-- 1. USERS - one row per player account (only created after the email
--    code has been verified). The password is never stored: only a random
--    salt and the scrypt hash (64 bytes = 128 hex characters).
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id                 INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  username           VARCHAR(15)      NOT NULL,
  email              VARCHAR(100)     NOT NULL,
  password_salt      CHAR(32)         NOT NULL,
  password_hash      CHAR(128)        NOT NULL,
  email_verified     TINYINT(1)       NOT NULL DEFAULT 0,
  email_verified_at  DATETIME         NULL,
  created_at         DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email (email),
  CONSTRAINT chk_users_username CHECK (username REGEXP '^[A-Za-z0-9_]{3,15}$'),
  CONSTRAINT chk_users_email    CHECK (email LIKE '%_@_%._%')
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 2. PLAYER_STATS - one row per user: best results so far
--    (6 levels; the highest possible score is 968, so 1000 is the cap).
-- ---------------------------------------------------------------------
CREATE TABLE player_stats (
  user_id          INT UNSIGNED       NOT NULL,
  best_score       SMALLINT UNSIGNED  NOT NULL DEFAULT 0,
  highest_level    TINYINT UNSIGNED   NOT NULL DEFAULT 0,
  games_completed  INT UNSIGNED       NOT NULL DEFAULT 0,
  total_mistakes   INT UNSIGNED       NOT NULL DEFAULT 0,
  updated_at       DATETIME           NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  KEY idx_stats_ranking (best_score, highest_level),
  CONSTRAINT fk_stats_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT chk_stats_score CHECK (best_score <= 1000),
  CONSTRAINT chk_stats_level CHECK (highest_level BETWEEN 0 AND 6)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 3. GAME_RESULTS - one row per finished game (the dashboard shows the
--    most recent ones).
-- ---------------------------------------------------------------------
CREATE TABLE game_results (
  id           BIGINT UNSIGNED    NOT NULL AUTO_INCREMENT,
  user_id      INT UNSIGNED       NOT NULL,
  score        SMALLINT UNSIGNED  NOT NULL,
  mistakes     SMALLINT UNSIGNED  NOT NULL DEFAULT 0,
  finished_at  DATETIME           NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_results_user_time (user_id, finished_at),
  CONSTRAINT fk_results_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT chk_results_score    CHECK (score <= 1000),
  CONSTRAINT chk_results_mistakes CHECK (mistakes <= 10000)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 4. SESSIONS - who is logged in. The browser cookie holds a random token;
--    we store only its SHA-256 hash, so a stolen copy of this table cannot
--    be used to log in. Sessions last 2 hours.
-- ---------------------------------------------------------------------
CREATE TABLE sessions (
  token_hash   CHAR(64)       NOT NULL,
  user_id      INT UNSIGNED   NOT NULL,
  ip_address   VARCHAR(45)    NULL,          -- 45 characters fits an IPv6 address
  user_agent   VARCHAR(255)   NULL,
  created_at   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at   DATETIME       NOT NULL,
  PRIMARY KEY (token_hash),
  KEY idx_sessions_user (user_id),
  KEY idx_sessions_expires (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 5. EMAIL_VERIFICATIONS - sign-ups waiting for their 6-digit code (OTP).
--    No account exists yet. Only a hash of the code is kept. A code lasts
--    10 minutes, allows 5 wrong tries, and can be re-sent at most 5 times.
-- ---------------------------------------------------------------------
CREATE TABLE email_verifications (
  id             CHAR(48)          NOT NULL,   -- random id the page sends back with the code
  username       VARCHAR(15)       NOT NULL,
  email          VARCHAR(100)      NOT NULL,
  password_salt  CHAR(32)          NOT NULL,
  password_hash  CHAR(128)         NOT NULL,
  code_salt      CHAR(32)          NOT NULL,
  code_hash      CHAR(64)          NOT NULL,   -- HMAC-SHA256 of the code
  attempts       TINYINT UNSIGNED  NOT NULL DEFAULT 0,
  sends          TINYINT UNSIGNED  NOT NULL DEFAULT 1,
  ip_address     VARCHAR(45)       NULL,
  last_sent_at   DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at     DATETIME          NOT NULL,
  created_at     DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_verify_email (email),          -- one pending sign-up per email
  KEY idx_verify_username (username),
  KEY idx_verify_ip_time (ip_address, created_at),
  KEY idx_verify_expires (expires_at),
  CONSTRAINT chk_verify_attempts CHECK (attempts <= 5),
  CONSTRAINT chk_verify_sends    CHECK (sends <= 5)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 6. LOGIN_ATTEMPTS - brute-force protection: after 5 wrong passwords
--    from the same IP for the same username, login is locked for 30 seconds.
-- ---------------------------------------------------------------------
CREATE TABLE login_attempts (
  ip_address    VARCHAR(45)       NOT NULL,
  username      VARCHAR(15)       NOT NULL,
  failed_count  TINYINT UNSIGNED  NOT NULL DEFAULT 0,
  locked_until  DATETIME          NULL,
  last_attempt  DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (ip_address, username),
  KEY idx_attempts_locked (locked_until)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 7. EMAIL_LOG - a record of every email the server tried to send
--    (verification codes and welcome emails). Never stores the code itself.
-- ---------------------------------------------------------------------
CREATE TABLE email_log (
  id          BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED     NULL,           -- NULL for a code sent before the account exists
  recipient   VARCHAR(100)     NOT NULL,
  email_type  ENUM('verification', 'welcome') NOT NULL,
  provider    ENUM('mailpit', 'brevo', 'terminal') NOT NULL,
  sent_ok     TINYINT(1)       NOT NULL,
  error_text  VARCHAR(300)     NULL,
  created_at  DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_email_log_recipient (recipient, created_at),
  CONSTRAINT fk_email_log_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 8. Every new user automatically gets an empty player_stats row.
-- ---------------------------------------------------------------------
CREATE TRIGGER trg_users_after_insert
AFTER INSERT ON users
FOR EACH ROW
  INSERT INTO player_stats (user_id) VALUES (NEW.id);

-- ---------------------------------------------------------------------
-- 9. LEADERBOARD view - everyone who has played at least once, best first
--    (same order as the game: best score, then highest level, then name).
-- ---------------------------------------------------------------------
CREATE VIEW leaderboard AS
SELECT
  ROW_NUMBER() OVER (ORDER BY s.best_score DESC, s.highest_level DESC, u.username ASC) AS player_rank,
  u.id               AS user_id,
  u.username,
  s.best_score,
  s.highest_level,
  s.games_completed,
  s.total_mistakes
FROM users u
JOIN player_stats s ON s.user_id = u.id
WHERE s.highest_level > 0;

-- ---------------------------------------------------------------------
-- Handy queries (examples, not run automatically)
-- ---------------------------------------------------------------------
-- Top 10:                 SELECT * FROM leaderboard ORDER BY player_rank LIMIT 10;
-- A player's last games:  SELECT score, mistakes, finished_at FROM game_results
--                         WHERE user_id = 1 ORDER BY finished_at DESC LIMIT 10;
-- Remove expired rows:    DELETE FROM sessions WHERE expires_at < NOW();
--                         DELETE FROM email_verifications WHERE expires_at < NOW();

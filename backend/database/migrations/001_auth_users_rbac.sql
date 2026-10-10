-- =====================================================================
-- Etapa 1: autenticación, usuarios y control de acceso basado en roles
-- =====================================================================
-- Convenciones para las siguientes etapas:
--   * Claves primarias INT UNSIGNED AUTO_INCREMENT llamadas `id`.
--   * Tablas en plural y snake_case; timestamps created_at / updated_at.
--   * Borrado lógico mediante deleted_at cuando el registro deba conservarse
--     por trazabilidad (usuarios, y más adelante tickets, comentarios...).
--   * Las futuras tablas (companies, departments, tickets, ...) referenciarán
--     users.id y podrán añadir company_id a users mediante una nueva migración.
-- =====================================================================

CREATE TABLE roles (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code         VARCHAR(50)  NOT NULL,
  name         VARCHAR(100) NOT NULL,
  description  VARCHAR(255) NULL,
  -- Jerarquía: un usuario solo puede gestionar usuarios de nivel inferior.
  level        SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  -- Los roles de sistema no se pueden eliminar ni renombrar desde la app.
  is_system    TINYINT(1)   NOT NULL DEFAULT 0,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE permissions (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code         VARCHAR(100) NOT NULL,          -- p. ej. users.create
  module       VARCHAR(50)  NOT NULL,          -- p. ej. users, tickets
  name         VARCHAR(150) NOT NULL,
  description  VARCHAR(255) NULL,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_permissions_code (code),
  KEY idx_permissions_module (module)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE role_permissions (
  role_id        INT UNSIGNED NOT NULL,
  permission_id  INT UNSIGNED NOT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id, permission_id),
  KEY idx_role_permissions_permission (permission_id),
  CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id)
    REFERENCES roles (id) ON DELETE CASCADE,
  CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id)
    REFERENCES permissions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE users (
  id                     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  first_name             VARCHAR(100) NOT NULL,
  last_name              VARCHAR(100) NOT NULL,
  email                  VARCHAR(191) NOT NULL,
  password_hash          VARCHAR(255) NOT NULL,
  role_id                INT UNSIGNED NOT NULL,
  status                 ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  must_change_password   TINYINT(1)   NOT NULL DEFAULT 0,
  failed_login_attempts  SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  locked_until           DATETIME     NULL,
  last_login_at          DATETIME     NULL,
  password_changed_at    DATETIME     NULL,
  created_by             INT UNSIGNED NULL,
  updated_by             INT UNSIGNED NULL,
  created_at             TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at             DATETIME     NULL,
  -- Correo único solo entre usuarios no eliminados (los NULL no colisionan).
  active_email           VARCHAR(191) GENERATED ALWAYS AS (IF(deleted_at IS NULL, email, NULL)) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_active_email (active_email),
  KEY idx_users_email (email),
  KEY idx_users_role (role_id),
  KEY idx_users_status (status),
  KEY idx_users_created_at (created_at),
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles (id),
  CONSTRAINT fk_users_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_users_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sesiones del lado del servidor. El navegador solo guarda un token aleatorio
-- en una cookie HttpOnly; aquí se almacena su hash SHA-256, nunca el token.
CREATE TABLE user_sessions (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id       INT UNSIGNED NOT NULL,
  token_hash    CHAR(64)     NOT NULL,
  remember_me   TINYINT(1)   NOT NULL DEFAULT 0,
  ip_address    VARCHAR(45)  NULL,
  user_agent    VARCHAR(255) NULL,
  expires_at    DATETIME     NOT NULL,
  last_seen_at  DATETIME     NOT NULL,
  revoked_at    DATETIME     NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_sessions_token (token_hash),
  KEY idx_user_sessions_user (user_id),
  KEY idx_user_sessions_expires (expires_at),
  CONSTRAINT fk_user_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

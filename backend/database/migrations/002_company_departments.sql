-- =====================================================================
-- Etapa 2: empresa, departamentos, pertenencia de usuarios y auditoría
-- =====================================================================
-- Multiempresa: toda entidad de negocio lleva company_id. Las relaciones
-- entre entidades de la misma empresa usan claves foráneas COMPUESTAS
-- (id, company_id), de modo que la propia base de datos impide, por
-- ejemplo, asignar como responsable a un usuario de otra empresa.
-- =====================================================================

CREATE TABLE companies (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name           VARCHAR(150) NOT NULL,              -- razón social
  trade_name     VARCHAR(150) NULL,                  -- nombre comercial
  rfc            VARCHAR(13)  NULL,
  email          VARCHAR(191) NULL,
  phone          VARCHAR(30)  NULL,
  address        VARCHAR(255) NULL,
  city           VARCHAR(100) NULL,
  state          VARCHAR(100) NULL,
  postal_code    VARCHAR(10)  NULL,
  country        VARCHAR(100) NULL DEFAULT 'México',
  website        VARCHAR(255) NULL,
  -- Solo la referencia al archivo (nombre aleatorio dentro de uploads/).
  logo_path      VARCHAR(255) NULL,
  timezone       VARCHAR(64)  NOT NULL DEFAULT 'America/Mexico_City',
  status         ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_companies_rfc (rfc)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Empresa inicial: los usuarios existentes de la Etapa 1 pasan a pertenecer a ella.
INSERT INTO companies (name, trade_name) VALUES ('Mi Empresa', 'Mi Empresa');

ALTER TABLE users ADD COLUMN company_id INT UNSIGNED NULL AFTER id;
UPDATE users SET company_id = (SELECT MIN(id) FROM companies);
ALTER TABLE users
  MODIFY company_id INT UNSIGNED NOT NULL,
  ADD KEY idx_users_company (company_id),
  ADD UNIQUE KEY uq_users_id_company (id, company_id),
  ADD CONSTRAINT fk_users_company FOREIGN KEY (company_id) REFERENCES companies (id);

CREATE TABLE departments (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id   INT UNSIGNED NOT NULL,
  name         VARCHAR(120) NOT NULL,
  code         VARCHAR(20)  NOT NULL,       -- normalizado en mayúsculas
  description  VARCHAR(500) NULL,
  manager_id   INT UNSIGNED NULL,
  status       ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_by   INT UNSIGNED NULL,
  updated_by   INT UNSIGNED NULL,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- El código es único DENTRO de cada empresa (no globalmente).
  UNIQUE KEY uq_departments_company_code (company_id, code),
  UNIQUE KEY uq_departments_id_company (id, company_id),
  KEY idx_departments_status (company_id, status),
  KEY idx_departments_manager (manager_id),
  CONSTRAINT fk_departments_company FOREIGN KEY (company_id) REFERENCES companies (id),
  -- El responsable debe ser un usuario de la MISMA empresa.
  CONSTRAINT fk_departments_manager FOREIGN KEY (manager_id, company_id) REFERENCES users (id, company_id),
  CONSTRAINT fk_departments_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_departments_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Pertenencia usuario ↔ departamento (N:M preparada para el futuro).
-- Hoy cada usuario tiene como máximo un departamento PRINCIPAL; puede tener
-- membresías secundarias (p. ej. el responsable de un área que no es la suya).
CREATE TABLE user_departments (
  user_id          INT UNSIGNED NOT NULL,
  department_id    INT UNSIGNED NOT NULL,
  company_id       INT UNSIGNED NOT NULL,
  is_primary       TINYINT(1)   NOT NULL DEFAULT 0,
  -- Preparado para la Etapa 3: el usuario atiende tickets de este departamento.
  is_agent         TINYINT(1)   NOT NULL DEFAULT 0,
  assigned_by      INT UNSIGNED NULL,
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  -- Garantiza un único departamento principal por usuario.
  primary_user_id  INT UNSIGNED GENERATED ALWAYS AS (IF(is_primary = 1, user_id, NULL)) STORED,
  PRIMARY KEY (user_id, department_id),
  UNIQUE KEY uq_user_departments_primary (primary_user_id),
  KEY idx_user_departments_department (department_id, is_agent),
  KEY idx_user_departments_company (company_id),
  CONSTRAINT fk_user_departments_user FOREIGN KEY (user_id, company_id) REFERENCES users (id, company_id),
  CONSTRAINT fk_user_departments_department FOREIGN KEY (department_id, company_id) REFERENCES departments (id, company_id),
  CONSTRAINT fk_user_departments_assigned_by FOREIGN KEY (assigned_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bitácora de auditoría (el módulo de consulta llegará en una etapa posterior).
CREATE TABLE audit_logs (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id   INT UNSIGNED NULL,
  actor_id     INT UNSIGNED NULL,
  action       VARCHAR(80)  NOT NULL,        -- p. ej. department.created
  entity_type  VARCHAR(50)  NOT NULL,        -- p. ej. department
  entity_id    VARCHAR(64)  NULL,
  changes      JSON         NULL,            -- { campo: { from, to } } o datos relevantes
  ip_address   VARCHAR(45)  NULL,
  user_agent   VARCHAR(255) NULL,
  created_at   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_audit_company_date (company_id, created_at),
  KEY idx_audit_entity (entity_type, entity_id),
  KEY idx_audit_actor (actor_id),
  CONSTRAINT fk_audit_company FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE SET NULL,
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

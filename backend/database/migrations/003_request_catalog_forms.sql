-- =====================================================================
-- Etapa 3: catálogo de solicitudes (categorías, tipos) y formularios dinámicos
-- =====================================================================
-- Jerarquía: empresa → departamento → categoría → tipo de solicitud → campos
-- Igual que en la Etapa 2, las relaciones usan claves foráneas compuestas
-- con company_id / department_id para que la base de datos impida mezclar
-- datos de empresas o departamentos distintos.
--
-- Integración con la Etapa 4 (tickets):
--   ticket.ticket_type_id → ticket_types.id
--   ticket.form_version   → ticket_types.form_version (versión usada al crearlo)
--   ticket.form_snapshot  → copia JSON de los campos en ese momento, de modo que
--                           editar el formulario no altere tickets históricos.
-- =====================================================================

-- Categorías: agrupan los tipos de solicitud de un departamento.
CREATE TABLE categories (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id     INT UNSIGNED NOT NULL,
  department_id  INT UNSIGNED NOT NULL,
  name           VARCHAR(100) NOT NULL,
  description    VARCHAR(300) NULL,
  sort_order     INT UNSIGNED NOT NULL DEFAULT 0,
  status         ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_by     INT UNSIGNED NULL,
  updated_by     INT UNSIGNED NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_department_name (department_id, name),
  UNIQUE KEY uq_categories_id_company (id, company_id),
  UNIQUE KEY uq_categories_id_department (id, department_id),
  KEY idx_categories_company (company_id, status),
  KEY idx_categories_order (department_id, sort_order),
  CONSTRAINT fk_categories_department FOREIGN KEY (department_id, company_id) REFERENCES departments (id, company_id),
  CONSTRAINT fk_categories_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_categories_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tipos de solicitud (lo que el usuario elige al abrir un ticket).
CREATE TABLE ticket_types (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id        INT UNSIGNED NOT NULL,
  department_id     INT UNSIGNED NOT NULL,
  category_id       INT UNSIGNED NULL,
  name              VARCHAR(120) NOT NULL,
  code              VARCHAR(30)  NOT NULL,
  description       VARCHAR(500) NULL,
  -- Catálogo fijo por ahora; podrá migrarse a una tabla de prioridades.
  default_priority  ENUM('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium',
  -- department = grupo de agentes del departamento; user = un responsable concreto.
  assignment_mode   ENUM('department', 'user') NOT NULL DEFAULT 'department',
  assignee_user_id  INT UNSIGNED NULL,
  sort_order        INT UNSIGNED NOT NULL DEFAULT 0,
  status            ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  -- Se incrementa cada vez que cambia el formulario (los tickets guardarán la versión usada).
  form_version      INT UNSIGNED NOT NULL DEFAULT 1,
  form_updated_at   DATETIME NULL,
  created_by        INT UNSIGNED NULL,
  updated_by        INT UNSIGNED NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ticket_types_department_code (department_id, code),
  UNIQUE KEY uq_ticket_types_id_company (id, company_id),
  KEY idx_ticket_types_company (company_id, status),
  KEY idx_ticket_types_order (department_id, sort_order),
  KEY idx_ticket_types_category (category_id),
  CONSTRAINT fk_ticket_types_department FOREIGN KEY (department_id, company_id) REFERENCES departments (id, company_id),
  -- La categoría debe ser del MISMO departamento.
  CONSTRAINT fk_ticket_types_category FOREIGN KEY (category_id, department_id) REFERENCES categories (id, department_id),
  -- El responsable debe ser un usuario de la MISMA empresa.
  CONSTRAINT fk_ticket_types_assignee FOREIGN KEY (assignee_user_id, company_id) REFERENCES users (id, company_id),
  CONSTRAINT fk_ticket_types_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_ticket_types_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Campos del formulario dinámico de cada tipo de solicitud.
CREATE TABLE form_fields (
  id                     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id             INT UNSIGNED NOT NULL,
  ticket_type_id         INT UNSIGNED NOT NULL,
  field_key              VARCHAR(60)  NOT NULL,     -- nombre interno (snake_case), estable
  label                  VARCHAR(120) NOT NULL,     -- etiqueta visible
  description            VARCHAR(300) NULL,         -- texto de ayuda
  placeholder            VARCHAR(120) NULL,
  field_type             ENUM('short_text', 'long_text', 'number', 'date', 'time', 'datetime', 'email', 'phone',
                              'select', 'multiselect', 'boolean', 'file', 'image', 'user', 'department',
                              'asset', 'location', 'currency') NOT NULL,
  is_required            TINYINT(1)   NOT NULL DEFAULT 0,
  default_value          JSON         NULL,
  -- Reglas por tipo: minLength, maxLength, min, max, decimals, currency,
  -- minSelected, maxSelected, maxFiles, maxSizeMb, allowedExtensions, showIf.
  rules                  JSON         NULL,
  sort_order             INT UNSIGNED NOT NULL DEFAULT 0,
  visible_to_requester   TINYINT(1)   NOT NULL DEFAULT 1,
  visible_to_agent       TINYINT(1)   NOT NULL DEFAULT 1,
  status                 ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_form_fields_type_key (ticket_type_id, field_key),
  UNIQUE KEY uq_form_fields_id_company (id, company_id),
  KEY idx_form_fields_order (ticket_type_id, sort_order),
  CONSTRAINT fk_form_fields_ticket_type FOREIGN KEY (ticket_type_id, company_id) REFERENCES ticket_types (id, company_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Opciones de listas (lista, selección múltiple, equipo, ubicación).
CREATE TABLE form_field_options (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id   INT UNSIGNED NOT NULL,
  field_id     INT UNSIGNED NOT NULL,
  value        VARCHAR(80)  NOT NULL,      -- valor guardado (estable)
  label        VARCHAR(150) NOT NULL,      -- texto visible
  sort_order   INT UNSIGNED NOT NULL DEFAULT 0,
  is_active    TINYINT(1)   NOT NULL DEFAULT 1,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_form_field_options_value (field_id, value),
  KEY idx_form_field_options_order (field_id, sort_order),
  CONSTRAINT fk_form_field_options_field FOREIGN KEY (field_id, company_id) REFERENCES form_fields (id, company_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

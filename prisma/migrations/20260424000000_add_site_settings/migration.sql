-- CreateTable: site_settings
-- Stores editable website content managed via the admin dashboard.
-- Each row is a named JSON blob keyed by `key` (e.g. "brand", "hero", "footer").

CREATE TABLE `site_settings` (
  `id`        VARCHAR(191) NOT NULL,
  `key`       VARCHAR(191) NOT NULL,
  `value`     JSON         NOT NULL,
  `group`     VARCHAR(191) NOT NULL DEFAULT 'general',
  `createdAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3)  NOT NULL,

  UNIQUE INDEX `site_settings_key_key`(`key`),
  INDEX `site_settings_key_idx`(`key`),
  INDEX `site_settings_group_idx`(`group`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

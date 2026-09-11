import type {
  ManagerDashboardFilters,
  ManagerDashboardScope,
} from '../reporting/manager-dashboard.types.js';

/*
 * Explicit server-owned export types.
 *
 * Never allow callers to provide arbitrary
 * table names, SQL fragments or column names.
 */
export const CONTROLLED_EXPORT_TYPES = ['assignments', 'activities', 'follow_ups'] as const;

export type ControlledExportType = (typeof CONTROLLED_EXPORT_TYPES)[number];

/*
 * Formats supported by TR-025.
 */
export const CONTROLLED_EXPORT_FORMATS = ['csv', 'xlsx'] as const;

export type ControlledExportFormat = (typeof CONTROLLED_EXPORT_FORMATS)[number];

/*
 * We intentionally reuse the reporting authority
 * model instead of creating a second authorization
 * hierarchy specifically for exports.
 *
 * client_admin -> tenant
 * director     -> organization
 * manager      -> team
 *
 * prospector / observer have no controlled-export
 * authority in TR-025.
 */
export type ControlledExportScope = ManagerDashboardScope;

export type ControlledExportFilters = ManagerDashboardFilters;

export interface ControlledExportDateRange {
  from: Date;

  to: Date;
}
export const MAX_CONTROLLED_EXPORT_ROWS = 10_000;

/*
 * Fully normalized internal request.
 *
 * Nothing from the HTTP request should reach an
 * export repository until authorization scope has
 * been resolved server-side.
 */
export interface ControlledExportRequest {
  tenantId: string;

  actorUserId: string;

  exportId: string;

  type: ControlledExportType;

  format: ControlledExportFormat;

  generatedAt: Date;

  range: ControlledExportDateRange;

  scope: ControlledExportScope;

  filters: ControlledExportFilters;
}

/*
 * Generic scalar value that may be written into
 * an export row.
 *
 * Complex objects are deliberately excluded from
 * the export layer.
 */
export type ExportCellValue = string | number | boolean | null;

export type ExportRow = Record<string, ExportCellValue>;

export interface GeneratedExportFile {
  exportId: string;

  type: ControlledExportType;

  format: ControlledExportFormat;

  filename: string;

  contentType: string;

  content: Buffer;

  rowCount: number;
}

import type { ControlledExportType } from './export.types.js';

export interface ExportColumn {
  key: string;

  header: string;
}

/*
 * Explicit column allowlists.
 *
 * Never derive exported columns directly from
 * database rows or request input.
 */
export const CONTROLLED_EXPORT_COLUMNS: Record<ControlledExportType, readonly ExportColumn[]> = {
  assignments: [
    {
      key: 'id',
      header: 'ID',
    },
    {
      key: 'campaignId',
      header: 'Campaign ID',
    },
    {
      key: 'campaignProspectId',
      header: 'Campaign Prospect ID',
    },
    {
      key: 'organizationId',
      header: 'Organization ID',
    },
    {
      key: 'teamId',
      header: 'Team ID',
    },
    {
      key: 'assignedUserId',
      header: 'Assigned User ID',
    },
    {
      key: 'assignedAt',
      header: 'Assigned At',
    },
    {
      key: 'endedAt',
      header: 'Ended At',
    },
  ],

  activities: [
    {
      key: 'id',
      header: 'ID',
    },
    {
      key: 'campaignId',
      header: 'Campaign ID',
    },
    {
      key: 'campaignProspectId',
      header: 'Campaign Prospect ID',
    },
    {
      key: 'establishmentId',
      header: 'Establishment ID',
    },
    {
      key: 'assignmentId',
      header: 'Assignment ID',
    },
    {
      key: 'organizationId',
      header: 'Organization ID',
    },
    {
      key: 'teamId',
      header: 'Team ID',
    },
    {
      key: 'userId',
      header: 'User ID',
    },
    {
      key: 'reservationId',
      header: 'Reservation ID',
    },
    {
      key: 'type',
      header: 'Activity Type',
    },
    {
      key: 'occurredAt',
      header: 'Occurred At',
    },
    {
      key: 'createdAt',
      header: 'Created At',
    },
  ],

  follow_ups: [
    {
      key: 'id',
      header: 'ID',
    },
    {
      key: 'campaignId',
      header: 'Campaign ID',
    },
    {
      key: 'campaignProspectId',
      header: 'Campaign Prospect ID',
    },
    {
      key: 'establishmentId',
      header: 'Establishment ID',
    },
    {
      key: 'assignmentId',
      header: 'Assignment ID',
    },
    {
      key: 'organizationId',
      header: 'Organization ID',
    },
    {
      key: 'teamId',
      header: 'Team ID',
    },
    {
      key: 'assignedUserId',
      header: 'Assigned User ID',
    },
    {
      key: 'createdBy',
      header: 'Created By',
    },
    {
      key: 'dueAt',
      header: 'Due At',
    },
    {
      key: 'status',
      header: 'Status',
    },
    {
      key: 'completedAt',
      header: 'Completed At',
    },
    {
      key: 'cancelledAt',
      header: 'Cancelled At',
    },
    {
      key: 'createdAt',
      header: 'Created At',
    },
    {
      key: 'updatedAt',
      header: 'Updated At',
    },
  ],
};

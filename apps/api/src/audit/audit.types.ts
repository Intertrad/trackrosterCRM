export type AuditMetadata = Record<string, unknown>;

export interface UserAuditActor {
  actorType: 'user';

  actorUserId: string;
}

export interface SystemAuditActor {
  actorType: 'system';

  actorUserId?: never;
}

export type AuditActor = UserAuditActor | SystemAuditActor;

export type RecordAuditEventInput = AuditActor & {
  tenantId: string;

  action: string;

  resourceType: string;

  resourceId: string;

  metadata?: AuditMetadata;
};

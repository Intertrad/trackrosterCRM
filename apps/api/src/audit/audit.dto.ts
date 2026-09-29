import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

/*
 * A class so the global ValidationPipe applies: a `Record<string, unknown>`
 * @Body() has no runtime metatype and Nest skips the handler entirely, which
 * let an unbounded JSON document be persisted verbatim.
 */

export const EVIDENCE_RESOURCE_TYPES = [
  'assignment',
  'collision',
  'export',
  'override_request',
  'prospect',
  'security',
  'tenant_membership',
  'role',
  'import',
] as const;

export const MAX_EVIDENCE_ACTIONS = 50;

/** The scope of an evidence export: what to gather, over what window. */
export class EvidenceExportScopeDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_EVIDENCE_ACTIONS)
  @ArrayUnique()
  @IsIn(EVIDENCE_RESOURCE_TYPES, { each: true })
  resourceTypes?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_EVIDENCE_ACTIONS)
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(/^[a-z][a-z0-9_.]{0,63}$/, { each: true })
  actions?: string[];

  @IsOptional() @IsUUID() membershipId?: string;

  /* Both bounds carry an explicit offset so the window is unambiguous. */
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  to?: string;

  /** Free-text note recorded with the request, for the auditor's own record. */
  @IsOptional() @IsString() @MaxLength(1000) reason?: string;
}

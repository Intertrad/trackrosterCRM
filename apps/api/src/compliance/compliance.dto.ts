import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

/* See saved-views.dto.ts: a class is what makes the global pipe apply. */

export const ACCESS_REVIEW_DECISIONS = ['approve', 'revoke', 'remediate'] as const;

export type AccessReviewDecision = (typeof ACCESS_REVIEW_DECISIONS)[number];

export class AccessReviewDecisionDto {
  @IsUUID() membershipId!: string;

  @IsIn(ACCESS_REVIEW_DECISIONS) decision!: AccessReviewDecision;

  /*
   * A revoke or remediate is an access change someone will later be asked to
   * justify, so the reason is worth keeping — but the column is nullable and
   * an approval rarely needs one, so it stays optional here rather than
   * becoming a new required field on an existing endpoint.
   */
  @IsOptional() @IsString() @MaxLength(2000) reason?: string;
}

/** Matches the report_type column width. */
export const MAX_REPORT_TYPE = 60;

export class CreateComplianceReportDto {
  @IsString() @MinLength(1) @MaxLength(MAX_REPORT_TYPE) reportType!: string;

  /*
   * Report parameters are defined by the report being run, so their keys
   * cannot be enumerated here. Bounding to an object still rejects an array
   * or a scalar, which the previous `any` accepted.
   */
  @IsOptional() @IsObject() parameters?: Record<string, unknown>;
}

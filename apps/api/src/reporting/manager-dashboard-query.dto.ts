import { Type } from 'class-transformer';
import {
  IsDate,
  IsOptional,
  IsUUID,
  Validate,
  ValidateIf,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

const MAX_DASHBOARD_RANGE_DAYS = 366;

const MAX_DASHBOARD_RANGE_MS = MAX_DASHBOARD_RANGE_DAYS * 24 * 60 * 60 * 1000;

/*
 * Cross-field validation for the reporting window.
 *
 * Rules:
 *
 * - from/to may both be omitted
 * - if one is supplied, both are required
 * - from must be strictly before to
 * - maximum supported reporting window is 366 days
 *
 * The service will later apply the default:
 *
 *   to   = generatedAt
 *   from = generatedAt - 30 days
 *
 * when both are omitted.
 */
@ValidatorConstraint({
  name: 'managerDashboardDateRange',
  async: false,
})
class ManagerDashboardDateRangeConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, validationArguments: ValidationArguments): boolean {
    const query = validationArguments.object as ManagerDashboardQueryDto;

    /*
     * Both omitted is valid.
     *
     * Default range resolution belongs to the
     * dashboard service rather than the DTO.
     */
    if (query.from === undefined && query.to === undefined) {
      return true;
    }

    /*
     * One without the other is invalid.
     */
    if (query.from === undefined || query.to === undefined) {
      return false;
    }

    /*
     * Let IsDate provide the normal validation
     * error for malformed query parameters.
     */
    if (
      !(query.from instanceof Date) ||
      Number.isNaN(query.from.getTime()) ||
      !(query.to instanceof Date) ||
      Number.isNaN(query.to.getTime())
    ) {
      return false;
    }

    const rangeMs = query.to.getTime() - query.from.getTime();

    return rangeMs > 0 && rangeMs <= MAX_DASHBOARD_RANGE_MS;
  }

  defaultMessage(): string {
    return (
      'from and to must be supplied together, ' +
      'from must be before to, and the reporting ' +
      'range must not exceed 366 days'
    );
  }
}

export class ManagerDashboardQueryDto {
  /*
   * Reporting window semantics:
   *
   *   from <= timestamp < to
   *
   * Using a half-open interval avoids double
   * counting when adjacent reporting periods meet.
   */
  @ValidateIf(
    (query: ManagerDashboardQueryDto) => query.from !== undefined || query.to !== undefined,
  )
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ValidateIf(
    (query: ManagerDashboardQueryDto) => query.from !== undefined || query.to !== undefined,
  )
  @Type(() => Date)
  @IsDate()
  @Validate(ManagerDashboardDateRangeConstraint)
  to?: Date;

  /*
   * Optional dimensional filters.
   *
   * These values are only syntactically validated
   * here.
   *
   * Authorization/scoping is TR-023-D.
   *
   * A valid UUID does NOT imply that the caller is
   * allowed to report on that organization/team/
   * user/campaign.
   */
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsUUID()
  campaignId?: string;
}

export { MAX_DASHBOARD_RANGE_DAYS };

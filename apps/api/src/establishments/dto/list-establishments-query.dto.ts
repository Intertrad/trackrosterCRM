import { IsIn, IsOptional } from 'class-validator';

import type { EstablishmentCategory } from '../../database/schema/establishments.js';

/*
 * Filters for the référentiel listing.
 *
 * Category is the first one the dispatch workflow needs: a manager picks the
 * kind of establishment before anything else. The enum is validated here as
 * well as in the database so an unknown value is a 400 rather than a failed
 * query, and so the error names the field.
 */
export class ListEstablishmentsQueryDto {
  @IsOptional()
  @IsIn([
    'prospection',
    'justice_enquetes',
    'sante',
    'asile_social',
    'douanes_onaf',
    'cra',
    'prescripteurs',
  ] satisfies EstablishmentCategory[])
  category?: EstablishmentCategory;
}

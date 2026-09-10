import { IsOptional, IsUUID } from 'class-validator';

export class AcquireReservationDto {
  @IsOptional()
  @IsUUID()
  overrideId?: string;
}

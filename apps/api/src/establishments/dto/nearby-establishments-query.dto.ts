import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class NearbyEstablishmentsQueryDto {
  @Type(() => Number)
  @IsNumber({
    allowInfinity: false,
    allowNaN: false,
  })
  @Min(-90)
  @Max(90)
  latitude!: number;

  @Type(() => Number)
  @IsNumber({
    allowInfinity: false,
    allowNaN: false,
  })
  @Min(-180)
  @Max(180)
  longitude!: number;

  /*
   * V1 deliberately caps radius searches at
   * 100 km so an accidental request cannot turn
   * into an unbounded tenant-wide spatial scan.
   */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  radiusMeters!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

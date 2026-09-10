import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateCollisionOverrideDto {
  @IsUUID()
  prospectorUserId!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason!: string;
}

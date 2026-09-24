import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class PlatformGrantDto {
  @IsIn(['super_admin', 'support_operator'])
  role!: 'super_admin' | 'support_operator';

  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason!: string;
}

export class PlatformGrantRevokeDto {
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason!: string;
}

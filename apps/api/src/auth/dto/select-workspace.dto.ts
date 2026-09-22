import { IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class SelectWorkspaceDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  @MaxLength(43)
  selectionToken!: string;

  @IsUUID()
  membershipId!: string;
}

import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ListWorkQueueQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 50;

  @IsOptional()
  @IsString()
  cursor?: string;
}

export interface WorkQueueItemDto {
  assignmentId: string;
  campaignProspectId: string;

  assignedAt: string;

  campaign: {
    id: string;
    name: string;
  };

  establishment: {
    id: string;
    name: string;

    addressLine1: string | null;
    postalCode: string | null;
    city: string | null;
    countryCode: string;

    phone: string | null;
    website: string | null;

    latitude: number | null;
    longitude: number | null;
  };

  primaryContact: {
    id: string;
    name: string | null;
    jobTitle: string | null;
    email: string | null;
    phone: string | null;
  } | null;
}

export interface WorkQueueResponseDto {
  items: WorkQueueItemDto[];

  nextCursor: string | null;
}

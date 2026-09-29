import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

/*
 * These classes exist so the global ValidationPipe actually runs.
 *
 * A TypeScript type literal or `any` on an @Body() parameter carries no
 * runtime metatype, so Nest skips validation for that handler entirely —
 * `whitelist` and `forbidNonWhitelisted` silently do not apply. Every
 * messaging body is therefore declared as a class.
 */

/** The conversation body column is unbounded `text`; the API bounds it here. */
export const MAX_MESSAGE_BODY = 10_000;

export const CONVERSATION_KINDS = ['direct', 'team', 'prospect', 'campaign'] as const;

export class CreateConversationDto {
  @IsIn(CONVERSATION_KINDS) kind!: (typeof CONVERSATION_KINDS)[number];

  @IsOptional() @IsString() @MaxLength(200) title?: string;

  /*
   * Bounded so one request cannot fan a conversation out across the whole
   * tenant. Every id is re-checked against an active membership before it is
   * inserted.
   */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  participantIds?: string[];
}

export class UpdateConversationDto {
  @IsOptional() @IsString() @MaxLength(200) title?: string;

  @IsOptional() @IsIn(['active', 'archived']) status?: 'active' | 'archived';
}

export class AddParticipantDto {
  @IsUUID() membershipId!: string;
}

export class SendMessageDto {
  @IsString() @MinLength(1) @MaxLength(MAX_MESSAGE_BODY) body!: string;
}

export class MuteConversationDto {
  /*
   * null clears the mute. An unparseable string previously reached
   * `new Date(...)` and produced an Invalid Date, so the format is pinned.
   */
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsISO8601({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  mutedUntil?: string | null;
}

/**
 * Keyset cursor for a list ordered by (timestamp DESC, id DESC).
 *
 * Both listings previously paged on `id > cursor` while ordering by a
 * timestamp, so following a cursor returned an arbitrary subset rather than
 * the next page. The cursor now carries both halves of the sort key.
 */
export class ConversationListDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z\|[0-9a-fA-F-]{36}$/)
  cursor?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 50;
}

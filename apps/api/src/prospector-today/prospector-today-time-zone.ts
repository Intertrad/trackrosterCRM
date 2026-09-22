import { BadRequestException } from '@nestjs/common';

import { isIanaTimeZone } from './prospector-today-query.dto.js';

interface ZonedDateTimeParts {
  year: number;

  month: number;

  day: number;

  hour: number;

  minute: number;

  second: number;
}

export interface ProspectorTodayDay {
  date: string;

  timeZone: string;

  startsAt: Date;

  endsAt: Date;
}

function createFormatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-CA', {
    calendar: 'iso8601',
    numberingSystem: 'latn',
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
}

function getZonedParts(date: Date, formatter: Intl.DateTimeFormat): ZonedDateTimeParts {
  const values = new Map(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );

  const year = values.get('year');
  const month = values.get('month');
  const day = values.get('day');
  const hour = values.get('hour');
  const minute = values.get('minute');
  const second = values.get('second');

  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    hour === undefined ||
    minute === undefined ||
    second === undefined
  ) {
    throw new BadRequestException('Unable to resolve the requested time zone');
  }

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
  };
}

function toIsoDate(parts: Pick<ZonedDateTimeParts, 'year' | 'month' | 'day'>): string {
  return [
    parts.year.toString().padStart(4, '0'),
    parts.month.toString().padStart(2, '0'),
    parts.day.toString().padStart(2, '0'),
  ].join('-');
}

function addCalendarDay(
  parts: Pick<ZonedDateTimeParts, 'year' | 'month' | 'day'>,
): Pick<ZonedDateTimeParts, 'year' | 'month' | 'day'> {
  const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1));

  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

function compareLocalDate(
  left: Pick<ZonedDateTimeParts, 'year' | 'month' | 'day'>,
  right: Pick<ZonedDateTimeParts, 'year' | 'month' | 'day'>,
): number {
  const leftKey = left.year * 10_000 + left.month * 100 + left.day;

  const rightKey = right.year * 10_000 + right.month * 100 + right.day;

  return leftKey - rightKey;
}

/*
 * A small set of zones advances the clock at local midnight. In those zones,
 * 00:00 does not exist on the transition date, so fixed-point conversion
 * cannot resolve an exact local midnight.
 *
 * Find the first instant whose rendered local calendar date is the target (or
 * later when an entire civil date is skipped). The hourly scan identifies the
 * first false -> true bracket and the binary search then resolves its exact
 * millisecond boundary without assuming a particular UTC offset.
 */
function findEarliestInstantOfLocalDate(
  localDate: Pick<ZonedDateTimeParts, 'year' | 'month' | 'day'>,
  formatter: Intl.DateTimeFormat,
): Date {
  const utcDate = Date.UTC(localDate.year, localDate.month - 1, localDate.day);

  const scanStartsAt = utcDate - 48 * 60 * 60 * 1000;

  const scanEndsAt = utcDate + 48 * 60 * 60 * 1000;

  const stepMs = 60 * 60 * 1000;

  let previousTimestamp = scanStartsAt;

  let previousReachedTarget =
    compareLocalDate(getZonedParts(new Date(previousTimestamp), formatter), localDate) >= 0;

  for (
    let candidateTimestamp = scanStartsAt + stepMs;
    candidateTimestamp <= scanEndsAt;
    candidateTimestamp += stepMs
  ) {
    const reachedTarget =
      compareLocalDate(getZonedParts(new Date(candidateTimestamp), formatter), localDate) >= 0;

    if (!previousReachedTarget && reachedTarget) {
      let low = previousTimestamp;

      let high = candidateTimestamp;

      while (high - low > 1) {
        const middle = low + Math.floor((high - low) / 2);

        const middleReachedTarget =
          compareLocalDate(getZonedParts(new Date(middle), formatter), localDate) >= 0;

        if (middleReachedTarget) {
          high = middle;
        } else {
          low = middle;
        }
      }

      return new Date(high);
    }

    previousTimestamp = candidateTimestamp;
    previousReachedTarget = reachedTarget;
  }

  throw new BadRequestException('Unable to resolve the requested calendar day');
}

/*
 * Convert local midnight in an IANA zone to an instant.
 *
 * We intentionally do not add 24 hours to startsAt. On a daylight-saving
 * transition, one local day can contain 23 or 25 hours. Resolving both local
 * midnights independently preserves the half-open [startsAt, endsAt) day.
 */
function localMidnightToInstant(
  localDate: Pick<ZonedDateTimeParts, 'year' | 'month' | 'day'>,
  formatter: Intl.DateTimeFormat,
): Date {
  const targetTimestamp = Date.UTC(localDate.year, localDate.month - 1, localDate.day);

  let candidateTimestamp = targetTimestamp;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const rendered = getZonedParts(new Date(candidateTimestamp), formatter);

    const renderedAsUtc = Date.UTC(
      rendered.year,
      rendered.month - 1,
      rendered.day,
      rendered.hour,
      rendered.minute,
      rendered.second,
    );

    const adjustment = targetTimestamp - renderedAsUtc;

    candidateTimestamp += adjustment;

    if (adjustment === 0) {
      const immediatelyBefore = getZonedParts(new Date(candidateTimestamp - 1), formatter);

      if (compareLocalDate(immediatelyBefore, localDate) < 0) {
        return new Date(candidateTimestamp);
      }

      /*
       * Midnight can itself be repeated when an offset moves backward. The
       * fixed point may land on the later occurrence, so fall back to the
       * boundary search unless the previous millisecond is the prior date.
       */
      return findEarliestInstantOfLocalDate(localDate, formatter);
    }
  }

  return findEarliestInstantOfLocalDate(localDate, formatter);
}

export function resolveProspectorTodayDay(now: Date, timeZone: string): ProspectorTodayDay {
  if (!isIanaTimeZone(timeZone)) {
    throw new BadRequestException('timeZone must be a valid IANA time zone');
  }

  const formatter = createFormatter(timeZone);

  const today = getZonedParts(now, formatter);

  const tomorrow = addCalendarDay(today);

  return {
    date: toIsoDate(today),
    timeZone,
    startsAt: localMidnightToInstant(today, formatter),
    endsAt: localMidnightToInstant(tomorrow, formatter),
  };
}

import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';
import 'reflect-metadata';

import {
  AttachUploadDto,
  MAX_UPLOAD_BYTES,
  NotificationPreferencesDto,
  PresignUploadDto,
  RegisterDeviceDto,
  normalizeNotificationPreferences,
} from './communications.dto.js';

function check<T extends object>(cls: new () => T, payload: unknown) {
  return validateSync(plainToInstance(cls, payload) as object, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}

const VALID_ATTACHMENT = {
  objectKey: 'tenant/member/uuid-report.csv',
  filename: 'report.csv',
  contentType: 'text/csv',
  byteSize: 2048,
};

describe('PresignUploadDto', () => {
  it('accepts a bounded upload', () => {
    expect(
      check(PresignUploadDto, { filename: 'photo.jpg', contentType: 'image/jpeg', byteSize: 1 }),
    ).toEqual([]);
  });

  it('rejects an upload beyond the size ceiling', () => {
    expect(
      check(PresignUploadDto, {
        filename: 'huge.bin',
        contentType: 'application/octet-stream',
        byteSize: MAX_UPLOAD_BYTES + 1,
      }),
    ).not.toEqual([]);
  });

  it('rejects a zero-byte upload', () => {
    expect(
      check(PresignUploadDto, { filename: 'empty', contentType: 'text/plain', byteSize: 0 }),
    ).not.toEqual([]);
  });
});

describe('AttachUploadDto', () => {
  it('accepts a well-formed attachment', () => {
    expect(check(AttachUploadDto, VALID_ATTACHMENT)).toEqual([]);
  });

  /*
   * This is the case the fix is really about. The handler used to spread the
   * whole body into the insert, so any extra key rode along into the row.
   */
  it('rejects an extra property instead of letting it reach the insert', () => {
    const errors = check(AttachUploadDto, { ...VALID_ATTACHMENT, uploadedBy: 'someone-else' });

    expect(errors.map((error) => error.property)).toContain('uploadedBy');
  });

  it('rejects an object key longer than the column', () => {
    expect(check(AttachUploadDto, { ...VALID_ATTACHMENT, objectKey: 'x'.repeat(501) })).not.toEqual(
      [],
    );
  });

  it('rejects a filename longer than the column', () => {
    expect(check(AttachUploadDto, { ...VALID_ATTACHMENT, filename: 'x'.repeat(256) })).not.toEqual(
      [],
    );
  });
});

describe('RegisterDeviceDto', () => {
  it('accepts each supported platform', () => {
    for (const platform of ['ios', 'android', 'web']) {
      expect(check(RegisterDeviceDto, { token: 'abc', platform })).toEqual([]);
    }
  });

  it('rejects an unsupported platform', () => {
    expect(check(RegisterDeviceDto, { token: 'abc', platform: 'blackberry' })).not.toEqual([]);
  });

  it('rejects an empty token', () => {
    expect(check(RegisterDeviceDto, { token: '', platform: 'web' })).not.toEqual([]);
  });
});

describe('NotificationPreferencesDto', () => {
  it('accepts a known category with channel flags', () => {
    expect(
      check(NotificationPreferencesDto, { assignments: { email: true, push: false } }),
    ).toEqual([]);
  });

  /* Preferences were an arbitrary JSON blob; unknown keys are now refused so
   * the document cannot be used as unbounded per-user storage. */
  it('rejects an unknown category', () => {
    const errors = check(NotificationPreferencesDto, { anythingAtAll: { email: true } });

    expect(errors.map((error) => error.property)).toContain('anythingAtAll');
  });

  it('rejects a non-boolean channel flag', () => {
    expect(check(NotificationPreferencesDto, { messages: { email: 'yes' } })).not.toEqual([]);
  });

  it('accepts an empty document', () => {
    expect(check(NotificationPreferencesDto, {})).toEqual([]);
  });

  it('keeps collision alerts enabled in the in-app inbox', () => {
    expect(
      normalizeNotificationPreferences(
        plainToInstance(NotificationPreferencesDto, {
          collisions: { email: false, inApp: false },
        }),
      ).collisions,
    ).toEqual({ email: false, inApp: true });
  });
});

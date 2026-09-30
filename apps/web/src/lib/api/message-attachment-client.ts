import { ApiError } from './api-error';
import { isRecord, writeOperation } from '@/lib/workspace/client';

const MAX_UPLOAD_BYTES = 25_000_000;

function safeUploadUrl(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Missing upload URL');
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Invalid upload URL');
  return url.href;
}

function uploadToStorage(url: string, file: File, onProgress?: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', url);
    request.setRequestHeader('content-type', file.type || 'application/octet-stream');
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error('Storage upload failed'));
    };
    request.onerror = () => reject(new Error('Storage upload failed'));
    request.send(file);
  });
}

/** Upload and persist one attachment after its message has been created. */
export async function uploadMessageAttachment(
  messageId: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<void> {
  if (!file.size || file.size > MAX_UPLOAD_BYTES) {
    throw new ApiError({
      statusCode: 400,
      code: 'INVALID_UPLOAD',
      message: 'Choose a non-empty file smaller than 25 MB.',
      error: 'Bad Request',
    });
  }

  const metadata = {
    filename: file.name,
    contentType: file.type || 'application/octet-stream',
    byteSize: file.size,
  };
  const requestKey = crypto.randomUUID();
  const { resource } = await writeOperation(
    'POST /uploads/presign',
    {},
    metadata,
    `${requestKey}-presign`,
  );
  if (!isRecord(resource) || typeof resource.objectKey !== 'string') {
    throw new Error('Invalid upload response');
  }
  await uploadToStorage(safeUploadUrl(resource.uploadUrl), file, onProgress);
  await writeOperation(
    'POST /messages/:messageId/attachments',
    { messageId },
    { ...metadata, objectKey: resource.objectKey },
    `${requestKey}-attach`,
  );
}

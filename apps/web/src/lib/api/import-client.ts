import { browserJson } from './browser-json';

import type { ImportExecutionResult, ImportPreviewResult } from './import-types';

function buildImportFormData(file: File): FormData {
  const formData = new FormData();

  formData.append('file', file);

  return formData;
}

export async function previewImport(file: File): Promise<ImportPreviewResult> {
  return browserJson<ImportPreviewResult>('/api/imports/preview', {
    method: 'POST',

    body: buildImportFormData(file),
  });
}

export async function executeImport(file: File): Promise<ImportExecutionResult> {
  return browserJson<ImportExecutionResult>('/api/imports/execute', {
    method: 'POST',

    body: buildImportFormData(file),
  });
}

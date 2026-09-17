'use client';

import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  ShieldAlert,
  Trash2,
  UploadCloud,
  XCircle,
} from 'lucide-react';
import { type ChangeEvent, useRef, useState } from 'react';

import { executeImport, previewImport } from '@/lib/api/import-client';
import {
  MAX_IMPORT_FILE_BYTES,
  type ImportExecutionResult,
  type ImportExecutionRowResult,
  type ImportPreviewResult,
  type ImportPreviewRow,
} from '@/lib/api/import-types';
import { useAuth } from '@/lib/auth/auth-context';

import styles from './page.module.css';

const PREVIEW_ROW_RENDER_LIMIT = 250;
const EXECUTION_ROW_RENDER_LIMIT = 250;

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function validateFile(file: File): string | null {
  if (!file.name.toLowerCase().endsWith('.csv')) {
    return 'Choose a CSV file with a .csv filename.';
  }

  if (file.size > MAX_IMPORT_FILE_BYTES) {
    return `CSV files must be ${formatBytes(MAX_IMPORT_FILE_BYTES)} or smaller.`;
  }

  return null;
}

function getStatusLabel(status: ImportPreviewRow['status']): string {
  switch (status) {
    case 'valid':
      return 'Valid';

    case 'warning':
      return 'Warning';

    case 'invalid':
      return 'Invalid';
  }
}

function getExecutionStatusLabel(status: ImportExecutionRowResult['status']): string {
  switch (status) {
    case 'created':
      return 'Created';

    case 'reused':
      return 'Reused';

    case 'skipped':
      return 'Skipped';

    case 'failed':
      return 'Failed';
  }
}

function getContactSummary(row: ImportPreviewRow): string {
  if (!row.contact) {
    return '—';
  }

  return row.contact.name ?? row.contact.email ?? row.contact.phone ?? 'Contact';
}

function getLocationSummary(row: ImportPreviewRow): string {
  if (!row.establishment) {
    return '—';
  }

  const parts = [
    row.establishment.postalCode,
    row.establishment.city,
    row.establishment.countryCode,
  ].filter((value): value is string => Boolean(value));

  return parts.join(', ') || '—';
}

export default function ImportsPage() {
  const { activeWorkspace } = useAuth();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [fileError, setFileError] = useState<string | null>(null);

  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);

  const [previewing, setPreviewing] = useState(false);

  const [previewError, setPreviewError] = useState<string | null>(null);

  const [execution, setExecution] = useState<ImportExecutionResult | null>(null);

  const [executing, setExecuting] = useState(false);

  const [executionError, setExecutionError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const requestSequence = useRef(0);

  const isClientAdmin = activeWorkspace?.mode === 'admin';

  function clearImport(): void {
    requestSequence.current += 1;

    setSelectedFile(null);
    setFileError(null);

    setPreview(null);
    setPreviewError(null);
    setPreviewing(false);

    setExecution(null);
    setExecutionError(null);
    setExecuting(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>): void {
    requestSequence.current += 1;

    const file = event.target.files?.[0] ?? null;

    setPreview(null);
    setPreviewError(null);
    setPreviewing(false);

    setExecution(null);
    setExecutionError(null);
    setExecuting(false);

    if (!file) {
      setSelectedFile(null);
      setFileError(null);

      return;
    }

    const validationError = validateFile(file);

    setSelectedFile(file);
    setFileError(validationError);
  }

  async function handlePreview(): Promise<void> {
    if (!selectedFile || fileError || !isClientAdmin) {
      return;
    }

    const requestId = ++requestSequence.current;

    setPreviewing(true);
    setPreviewError(null);
    setPreview(null);

    setExecution(null);
    setExecutionError(null);

    try {
      const result = await previewImport(selectedFile);

      if (requestId !== requestSequence.current) {
        return;
      }

      setPreview(result);
    } catch (error) {
      if (requestId !== requestSequence.current) {
        return;
      }

      setPreviewError(getErrorMessage(error, 'TrackRoster could not preview this CSV file.'));
    } finally {
      if (requestId === requestSequence.current) {
        setPreviewing(false);
      }
    }
  }

  async function handleExecute(): Promise<void> {
    if (!selectedFile || !preview || fileError || previewing || executing || !isClientAdmin) {
      return;
    }

    const hasPotentiallyImportableRows =
      preview.summary.validRows + preview.summary.warningRows > 0;

    if (!hasPotentiallyImportableRows) {
      setExecutionError('This preview contains no rows that can be submitted for import.');

      return;
    }

    const requestId = ++requestSequence.current;

    setExecuting(true);
    setExecutionError(null);
    setExecution(null);

    try {
      const result = await executeImport(selectedFile);

      if (requestId !== requestSequence.current) {
        return;
      }

      setExecution(result);
    } catch (error) {
      if (requestId !== requestSequence.current) {
        return;
      }

      setExecutionError(getErrorMessage(error, 'TrackRoster could not execute this import.'));
    } finally {
      if (requestId === requestSequence.current) {
        setExecuting(false);
      }
    }
  }

  if (!isClientAdmin) {
    return (
      <main className={styles.page}>
        <section className={styles.unavailableCard} aria-labelledby="imports-unavailable">
          <div className={styles.unavailableIcon}>
            <ShieldAlert size={25} strokeWidth={1.8} aria-hidden="true" />
          </div>

          <p className={styles.eyebrow}>Client Admin workspace required</p>

          <h1 id="imports-unavailable">Imports are not available in this workspace.</h1>

          <p>Select a Client Admin workspace to preview and import establishment data.</p>
        </section>
      </main>
    );
  }

  const renderedRows = preview?.rows.slice(0, PREVIEW_ROW_RENDER_LIMIT) ?? [];

  const hiddenRowCount =
    preview === null ? 0 : Math.max(0, preview.rows.length - renderedRows.length);

  const renderedExecutionRows = execution?.rows.slice(0, EXECUTION_ROW_RENDER_LIMIT) ?? [];

  const hiddenExecutionRowCount =
    execution === null ? 0 : Math.max(0, execution.rows.length - renderedExecutionRows.length);

  const canExecute =
    selectedFile !== null &&
    preview !== null &&
    !fileError &&
    preview.summary.validRows + preview.summary.warningRows > 0 &&
    !previewing &&
    !executing;

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Data management</p>

          <h1>Imports</h1>

          <p className={styles.pageDescription}>
            Upload a CSV file and review TrackRoster&apos;s validation result before any records are
            written.
          </p>
        </div>
      </header>

      <section className={styles.uploadCard} aria-labelledby="csv-upload-title">
        <div className={styles.uploadHeading}>
          <div className={styles.uploadIcon}>
            <UploadCloud size={23} strokeWidth={1.8} aria-hidden="true" />
          </div>

          <div>
            <h2 id="csv-upload-title">Choose CSV file</h2>

            <p>
              Maximum 5 MiB and 10,000 data rows. Required columns are <code>name</code> and{' '}
              <code>country_code</code>.
            </p>
          </div>
        </div>

        <div className={styles.fileControls}>
          <label className={styles.filePicker}>
            <UploadCloud size={18} aria-hidden="true" />

            <span>{selectedFile ? 'Choose another CSV' : 'Choose CSV'}</span>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              disabled={previewing || executing}
            />
          </label>

          {selectedFile ? (
            <button
              type="button"
              className={styles.clearButton}
              onClick={clearImport}
              disabled={previewing || executing}
            >
              <Trash2 size={17} aria-hidden="true" />
              Clear
            </button>
          ) : null}
        </div>

        {selectedFile ? (
          <div className={styles.selectedFile}>
            <div className={styles.fileIcon}>
              <FileText size={21} aria-hidden="true" />
            </div>

            <div className={styles.selectedFileDetails}>
              <strong>{selectedFile.name}</strong>

              <span>{formatBytes(selectedFile.size)}</span>
            </div>

            <span className={styles.fileReady}>
              {fileError ? 'Needs attention' : preview ? 'Previewed' : 'Ready to preview'}
            </span>
          </div>
        ) : null}

        {fileError ? (
          <div className={styles.inlineError} role="alert">
            <XCircle size={18} aria-hidden="true" />

            <span>{fileError}</span>
          </div>
        ) : null}

        <div className={styles.previewActions}>
          <button
            type="button"
            className={styles.previewButton}
            disabled={!selectedFile || Boolean(fileError) || previewing || executing}
            onClick={() => {
              void handlePreview();
            }}
          >
            {previewing ? (
              <>
                <span className={styles.spinner} aria-hidden="true" />
                Previewing…
              </>
            ) : (
              <>
                <FileText size={18} aria-hidden="true" />

                {preview ? 'Preview again' : 'Preview CSV'}
              </>
            )}
          </button>

          <p>Previewing does not write records to TrackRoster.</p>
        </div>
      </section>

      {previewError ? (
        <section className={styles.errorCard} role="alert">
          <AlertTriangle size={22} aria-hidden="true" />

          <div>
            <h2>CSV preview failed</h2>

            <p>{previewError}</p>

            <button
              type="button"
              disabled={!selectedFile || previewing || executing}
              onClick={() => {
                void handlePreview();
              }}
            >
              Try again
            </button>
          </div>
        </section>
      ) : null}

      {preview ? (
        <>
          <section className={styles.summaryGrid} aria-label="Import preview summary">
            <article className={styles.summaryCard}>
              <span>Total rows</span>

              <strong>{preview.summary.totalRows}</strong>
            </article>

            <article className={`${styles.summaryCard} ${styles.validCard}`}>
              <span>Valid</span>

              <strong>{preview.summary.validRows}</strong>
            </article>

            <article className={`${styles.summaryCard} ${styles.warningCard}`}>
              <span>Warnings</span>

              <strong>{preview.summary.warningRows}</strong>
            </article>

            <article className={`${styles.summaryCard} ${styles.invalidCard}`}>
              <span>Invalid</span>

              <strong>{preview.summary.invalidRows}</strong>
            </article>
          </section>

          {preview.summary.invalidRows > 0 ? (
            <div className={styles.previewNotice}>
              <AlertTriangle size={19} aria-hidden="true" />

              <div>
                <strong>Some rows cannot be imported</strong>

                <span>Review the validation issues below before execution.</span>
              </div>
            </div>
          ) : (
            <div className={styles.successNotice}>
              <CheckCircle2 size={19} aria-hidden="true" />

              <div>
                <strong>Preview completed</strong>

                <span>TrackRoster did not detect any invalid rows.</span>
              </div>
            </div>
          )}

          <section className={styles.tablePanel} aria-labelledby="preview-rows-title">
            <div className={styles.tableHeader}>
              <div>
                <p className={styles.panelEyebrow}>Validation result</p>

                <h2 id="preview-rows-title">Preview rows</h2>

                <p>
                  Warnings remain visible for review. Invalid rows have no parsed establishment
                  payload.
                </p>
              </div>

              <span className={styles.rowCount}>{preview.rows.length} rows</span>
            </div>

            <div className={styles.tableScroller}>
              <table>
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Status</th>
                    <th>Establishment</th>
                    <th>Location</th>
                    <th>Contact</th>
                    <th>Issues</th>
                  </tr>
                </thead>

                <tbody>
                  {renderedRows.map((row) => (
                    <tr key={row.rowNumber}>
                      <td>{row.rowNumber}</td>

                      <td>
                        <span
                          className={`${styles.statusBadge} ${
                            styles[`status${getStatusLabel(row.status)}`]
                          }`}
                        >
                          {getStatusLabel(row.status)}
                        </span>
                      </td>

                      <td>
                        {row.establishment?.name ?? '—'}

                        {row.establishment?.externalReference ? (
                          <small>{row.establishment.externalReference}</small>
                        ) : null}
                      </td>

                      <td>{getLocationSummary(row)}</td>

                      <td>{getContactSummary(row)}</td>

                      <td>
                        {row.issues.length === 0 ? (
                          <span className={styles.noIssues}>None</span>
                        ) : (
                          <ul className={styles.issueList}>
                            {row.issues.map((issue, index) => (
                              <li
                                key={`${issue.code}-${index}`}
                                className={
                                  issue.severity === 'error'
                                    ? styles.issueError
                                    : styles.issueWarning
                                }
                              >
                                {issue.message}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {hiddenRowCount > 0 ? (
              <p className={styles.renderLimitNotice}>
                Showing the first {PREVIEW_ROW_RENDER_LIMIT} rows to keep the browser responsive.{' '}
                {hiddenRowCount} more rows are included in the preview summary and backend result.
              </p>
            ) : null}
          </section>

          <section className={styles.executionCard} aria-labelledby="execute-import-title">
            <div className={styles.executionHeading}>
              <div>
                <p className={styles.panelEyebrow}>Import execution</p>

                <h2 id="execute-import-title">Execute import</h2>

                <p>
                  TrackRoster will process the original CSV. Invalid and duplicate-in-file rows may
                  be skipped, while existing establishments can be safely reused.
                </p>
              </div>

              <button
                type="button"
                className={styles.executeButton}
                disabled={!canExecute}
                onClick={() => {
                  void handleExecute();
                }}
              >
                {executing ? (
                  <>
                    <span className={styles.buttonSpinner} aria-hidden="true" />
                    Importing…
                  </>
                ) : execution ? (
                  'Run import again'
                ) : (
                  'Execute import'
                )}
              </button>
            </div>

            {preview.summary.invalidRows > 0 ? (
              <div className={styles.executionGuidance}>
                <AlertTriangle size={18} aria-hidden="true" />

                <span>
                  {preview.summary.invalidRows} invalid row
                  {preview.summary.invalidRows === 1 ? '' : 's'} will not create records.
                </span>
              </div>
            ) : null}

            {executionError ? (
              <div className={styles.executionError} role="alert">
                <XCircle size={19} aria-hidden="true" />

                <div>
                  <strong>Import execution failed</strong>

                  <span>{executionError}</span>
                </div>
              </div>
            ) : null}
          </section>

          {execution ? (
            <>
              <section
                className={styles.executionSummaryGrid}
                aria-label="Import execution summary"
              >
                <article className={styles.executionSummaryCard}>
                  <span>Total rows</span>

                  <strong>{execution.summary.totalRows}</strong>
                </article>

                <article className={`${styles.executionSummaryCard} ${styles.createdCard}`}>
                  <span>Establishments created</span>

                  <strong>{execution.summary.createdEstablishments}</strong>
                </article>

                <article className={`${styles.executionSummaryCard} ${styles.reusedCard}`}>
                  <span>Establishments reused</span>

                  <strong>{execution.summary.reusedEstablishments}</strong>
                </article>

                <article className={styles.executionSummaryCard}>
                  <span>Contacts created</span>

                  <strong>{execution.summary.createdContacts}</strong>
                </article>

                <article className={`${styles.executionSummaryCard} ${styles.skippedCard}`}>
                  <span>Rows skipped</span>

                  <strong>{execution.summary.skippedRows}</strong>
                </article>

                <article
                  className={`${styles.executionSummaryCard} ${
                    execution.summary.failedRows > 0 ? styles.failedCard : ''
                  }`}
                >
                  <span>Rows failed</span>

                  <strong>{execution.summary.failedRows}</strong>
                </article>
              </section>

              {execution.summary.failedRows > 0 ? (
                <div className={styles.executionWarningNotice}>
                  <AlertTriangle size={19} aria-hidden="true" />

                  <div>
                    <strong>Import completed with failed rows</strong>

                    <span>
                      Successful rows remain committed. Review the failed-row reasons below.
                    </span>
                  </div>
                </div>
              ) : (
                <div className={styles.executionSuccessNotice}>
                  <CheckCircle2 size={19} aria-hidden="true" />

                  <div>
                    <strong>Import completed</strong>

                    <span>TrackRoster finished processing the CSV without row failures.</span>
                  </div>
                </div>
              )}

              <section className={styles.tablePanel} aria-labelledby="execution-results-title">
                <div className={styles.tableHeader}>
                  <div>
                    <p className={styles.panelEyebrow}>Execution result</p>

                    <h2 id="execution-results-title">Import rows</h2>

                    <p>
                      Created and reused identifiers are returned by the backend. Skipped and failed
                      rows include their backend reason when available.
                    </p>
                  </div>

                  <span className={styles.rowCount}>{execution.rows.length} rows</span>
                </div>

                <div className={styles.tableScroller}>
                  <table>
                    <thead>
                      <tr>
                        <th>Row</th>
                        <th>Status</th>
                        <th>Establishment ID</th>
                        <th>Contact ID</th>
                        <th>Reason</th>
                      </tr>
                    </thead>

                    <tbody>
                      {renderedExecutionRows.map((row) => (
                        <tr key={row.rowNumber}>
                          <td>{row.rowNumber}</td>

                          <td>
                            <span
                              className={`${styles.statusBadge} ${
                                styles[`execution${getExecutionStatusLabel(row.status)}`]
                              }`}
                            >
                              {getExecutionStatusLabel(row.status)}
                            </span>
                          </td>

                          <td>{row.establishmentId ? <code>{row.establishmentId}</code> : '—'}</td>

                          <td>{row.contactId ? <code>{row.contactId}</code> : '—'}</td>

                          <td>{row.reason ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {hiddenExecutionRowCount > 0 ? (
                  <p className={styles.renderLimitNotice}>
                    Showing the first {EXECUTION_ROW_RENDER_LIMIT} execution rows.{' '}
                    {hiddenExecutionRowCount} additional rows are included in the backend result and
                    summary.
                  </p>
                ) : null}
              </section>
            </>
          ) : null}
        </>
      ) : null}
    </main>
  );
}

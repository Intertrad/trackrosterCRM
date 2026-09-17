/* @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MAX_IMPORT_FILE_BYTES,
  type ImportExecutionResult,
  type ImportPreviewResult,
} from '@/lib/api/import-types';

const { useAuthMock, previewImportMock, executeImportMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),

  previewImportMock: vi.fn(),

  executeImportMock: vi.fn(),
}));

vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: useAuthMock,
}));

vi.mock('@/lib/api/import-client', () => ({
  previewImport: previewImportMock,

  executeImport: executeImportMock,
}));

import ImportsPage from './page';

const previewResult: ImportPreviewResult = {
  summary: {
    totalRows: 1,

    validRows: 1,

    warningRows: 0,

    invalidRows: 0,
  },

  rows: [
    {
      rowNumber: 2,

      status: 'valid',

      establishment: {
        externalReference: 'REST-001',

        name: 'Restaurant Paris',

        addressLine1: null,

        postalCode: '75001',

        city: 'Paris',

        countryCode: 'FR',

        phone: null,

        website: null,

        latitude: null,

        longitude: null,
      },

      contact: {
        name: 'Marie Dupont',

        jobTitle: 'Manager',

        email: 'marie@example.com',

        phone: null,

        isPrimary: true,
      },

      issues: [],
    },
  ],
};

const executionResult: ImportExecutionResult = {
  summary: {
    totalRows: 1,

    createdEstablishments: 1,

    reusedEstablishments: 0,

    createdContacts: 1,

    skippedRows: 0,

    failedRows: 0,
  },

  rows: [
    {
      rowNumber: 2,

      status: 'created',

      establishmentId: '11111111-1111-4111-8111-111111111111',

      contactId: '22222222-2222-4222-8222-222222222222',

      reason: null,
    },
  ],
};

function setAdminWorkspace(): void {
  useAuthMock.mockReturnValue({
    activeWorkspace: {
      key: 'tenant:client_admin:-:-',

      mode: 'admin',

      role: 'client_admin',

      scopeType: 'tenant',

      organizationId: null,

      teamId: null,
    },
  });
}

function setProspectorWorkspace(): void {
  useAuthMock.mockReturnValue({
    activeWorkspace: {
      key: 'team:prospector:org:team',

      mode: 'prospector',

      role: 'prospector',

      scopeType: 'team',

      organizationId: '11111111-1111-4111-8111-111111111111',

      teamId: '22222222-2222-4222-8222-222222222222',
    },
  });
}

function createCsvFile(
  name = 'prospects.csv',
  content = 'name,country_code\nRestaurant Paris,FR',
): File {
  return new File([content], name, {
    type: 'text/csv',
  });
}

function getFileInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');

  if (!input) {
    throw new Error('CSV file input was not rendered');
  }

  return input;
}

function chooseFile(file: File): void {
  fireEvent.change(getFileInput(), {
    target: {
      files: [file],
    },
  });
}

afterEach(() => {
  cleanup();
});

describe('ImportsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    setAdminWorkspace();

    previewImportMock.mockResolvedValue(previewResult);

    executeImportMock.mockResolvedValue(executionResult);
  });

  it('fails closed outside the Client Admin workspace', () => {
    setProspectorWorkspace();

    render(<ImportsPage />);

    expect(screen.getByText('Imports are not available in this workspace.')).toBeInTheDocument();

    expect(previewImportMock).not.toHaveBeenCalled();

    expect(executeImportMock).not.toHaveBeenCalled();
  });

  it('rejects a non-CSV filename before calling the preview API', () => {
    render(<ImportsPage />);

    const file = new File(['hello'], 'prospects.txt', {
      type: 'text/plain',
    });

    chooseFile(file);

    expect(screen.getByRole('alert')).toHaveTextContent('Choose a CSV file with a .csv filename.');

    expect(
      screen.getByRole('button', {
        name: 'Preview CSV',
      }),
    ).toBeDisabled();

    expect(previewImportMock).not.toHaveBeenCalled();
  });

  it('rejects a CSV above the client-side size convenience limit', () => {
    render(<ImportsPage />);

    const file = new File([new Uint8Array(MAX_IMPORT_FILE_BYTES + 1)], 'oversized.csv', {
      type: 'text/csv',
    });

    chooseFile(file);

    expect(screen.getByRole('alert')).toHaveTextContent('CSV files must be 5.00 MB or smaller.');

    expect(
      screen.getByRole('button', {
        name: 'Preview CSV',
      }),
    ).toBeDisabled();

    expect(previewImportMock).not.toHaveBeenCalled();
  });

  it('previews the selected CSV and enables execution for importable rows', async () => {
    render(<ImportsPage />);

    const file = createCsvFile();

    chooseFile(file);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Preview CSV',
      }),
    );

    await waitFor(() => {
      expect(previewImportMock).toHaveBeenCalledWith(file);
    });

    expect(await screen.findByText('Restaurant Paris')).toBeInTheDocument();

    expect(screen.getByText('Marie Dupont')).toBeInTheDocument();

    expect(
      screen.getByRole('button', {
        name: 'Execute import',
      }),
    ).toBeEnabled();

    expect(executeImportMock).not.toHaveBeenCalled();
  });

  it('keeps execution disabled when the preview contains only invalid rows', async () => {
    previewImportMock.mockResolvedValue({
      summary: {
        totalRows: 1,

        validRows: 0,

        warningRows: 0,

        invalidRows: 1,
      },

      rows: [
        {
          rowNumber: 2,

          status: 'invalid',

          establishment: null,

          contact: null,

          issues: [
            {
              field: 'name',

              code: 'required',

              message: 'Establishment name is required',

              severity: 'error',
            },
          ],
        },
      ],
    } satisfies ImportPreviewResult);

    render(<ImportsPage />);

    chooseFile(createCsvFile());

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Preview CSV',
      }),
    );

    expect(await screen.findByText('Some rows cannot be imported')).toBeInTheDocument();

    expect(screen.getByText('Establishment name is required')).toBeInTheDocument();

    expect(
      screen.getByRole('button', {
        name: 'Execute import',
      }),
    ).toBeDisabled();

    expect(executeImportMock).not.toHaveBeenCalled();
  });

  it('renders preview errors and allows retry', async () => {
    previewImportMock
      .mockRejectedValueOnce(new Error('CSV header is invalid'))
      .mockResolvedValueOnce(previewResult);

    render(<ImportsPage />);

    chooseFile(createCsvFile());

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Preview CSV',
      }),
    );

    expect(await screen.findByText('CSV preview failed')).toBeInTheDocument();

    expect(screen.getByText('CSV header is invalid')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Try again',
      }),
    );

    expect(await screen.findByText('Restaurant Paris')).toBeInTheDocument();

    expect(previewImportMock).toHaveBeenCalledTimes(2);
  });

  it('executes the exact selected file and renders the execution result', async () => {
    render(<ImportsPage />);

    const file = createCsvFile();

    chooseFile(file);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Preview CSV',
      }),
    );

    await screen.findByText('Restaurant Paris');

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Execute import',
      }),
    );

    await waitFor(() => {
      expect(executeImportMock).toHaveBeenCalledWith(file);
    });

    expect(await screen.findByText('Import completed')).toBeInTheDocument();

    expect(screen.getByText('11111111-1111-4111-8111-111111111111')).toBeInTheDocument();

    expect(screen.getByText('22222222-2222-4222-8222-222222222222')).toBeInTheDocument();

    expect(
      screen.getByRole('button', {
        name: 'Run import again',
      }),
    ).toBeEnabled();
  });

  it('renders execution errors without discarding the successful preview', async () => {
    executeImportMock.mockRejectedValue(new Error('Import execution unavailable'));

    render(<ImportsPage />);

    chooseFile(createCsvFile());

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Preview CSV',
      }),
    );

    await screen.findByText('Restaurant Paris');

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Execute import',
      }),
    );

    expect(await screen.findByText('Import execution failed')).toBeInTheDocument();

    expect(screen.getByText('Import execution unavailable')).toBeInTheDocument();

    expect(screen.getByText('Restaurant Paris')).toBeInTheDocument();
  });

  it('clears old preview and execution state when a different CSV is selected', async () => {
    render(<ImportsPage />);

    const firstFile = createCsvFile('first.csv');

    chooseFile(firstFile);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Preview CSV',
      }),
    );

    await screen.findByText('Restaurant Paris');

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Execute import',
      }),
    );

    expect(await screen.findByText('11111111-1111-4111-8111-111111111111')).toBeInTheDocument();

    const secondFile = createCsvFile('second.csv', 'name,country_code\nHotel Lyon,FR');

    chooseFile(secondFile);

    expect(screen.getByText('second.csv')).toBeInTheDocument();

    expect(screen.queryByText('Restaurant Paris')).not.toBeInTheDocument();

    expect(screen.queryByText('11111111-1111-4111-8111-111111111111')).not.toBeInTheDocument();

    expect(
      screen.getByRole('button', {
        name: 'Preview CSV',
      }),
    ).toBeEnabled();
  });

  it('clears the complete workflow when Clear is selected', async () => {
    render(<ImportsPage />);

    chooseFile(createCsvFile());

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Preview CSV',
      }),
    );

    await screen.findByText('Restaurant Paris');

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Clear',
      }),
    );

    expect(screen.queryByText('Restaurant Paris')).not.toBeInTheDocument();

    expect(screen.queryByText('prospects.csv')).not.toBeInTheDocument();

    expect(
      screen.getByRole('button', {
        name: 'Preview CSV',
      }),
    ).toBeDisabled();
  });

  it('shows importing state while execution is pending', async () => {
    let resolveExecution: ((value: ImportExecutionResult) => void) | undefined;

    const pendingExecution = new Promise<ImportExecutionResult>((resolve) => {
      resolveExecution = resolve;
    });

    executeImportMock.mockReturnValue(pendingExecution);

    render(<ImportsPage />);

    chooseFile(createCsvFile());

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Preview CSV',
      }),
    );

    await screen.findByText('Restaurant Paris');

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Execute import',
      }),
    );

    expect(
      screen.getByRole('button', {
        name: 'Importing…',
      }),
    ).toBeDisabled();

    expect(getFileInput()).toBeDisabled();

    await act(async () => {
      resolveExecution?.(executionResult);

      await pendingExecution;
    });

    expect(await screen.findByText('Import completed')).toBeInTheDocument();
  });
});

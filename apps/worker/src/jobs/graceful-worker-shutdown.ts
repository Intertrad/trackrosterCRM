export interface BullMqWorkerCloser {
  close(force?: boolean): Promise<void>;
}

export type WorkerShutdownResult = 'graceful' | 'forced';

export async function closeWorkerGracefully(
  worker: BullMqWorkerCloser,
  timeoutMs: number,
): Promise<WorkerShutdownResult> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const gracefulClose = worker
    .close(false)
    .then(() => ({
      kind: 'graceful' as const,
    }))
    .catch((error: unknown) => ({
      kind: 'error' as const,
      error,
    }));

  const timeoutReached = new Promise<{
    kind: 'timeout';
  }>((resolve) => {
    timeout = setTimeout(() => {
      resolve({
        kind: 'timeout',
      });
    }, timeoutMs);
  });

  const result = await Promise.race([gracefulClose, timeoutReached]);

  if (timeout !== undefined) {
    clearTimeout(timeout);
  }

  if (result.kind === 'graceful') {
    return 'graceful';
  }

  if (result.kind === 'error') {
    throw result.error;
  }

  /*
   * Grace period expired.
   *
   * Force the BullMQ Worker to stop instead of
   * allowing a stuck processor to prevent the
   * process from terminating indefinitely.
   */
  await worker.close(true);

  return 'forced';
}

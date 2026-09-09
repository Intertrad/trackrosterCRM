import { UnrecoverableError } from 'bullmq';

/*
 * Processors should depend on our worker-level
 * error abstraction instead of importing BullMQ
 * directly.
 *
 * Throw this only when retrying cannot reasonably
 * make the job succeed.
 */
export class PermanentJobError extends UnrecoverableError {}

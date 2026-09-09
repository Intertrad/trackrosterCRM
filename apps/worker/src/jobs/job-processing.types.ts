export interface JobProcessingContext {
  /*
   * Application-level job correlation ID.
   */
  jobId: string;

  /*
   * Human-friendly attempt number.
   *
   * First execution = 1.
   */
  attempt: number;

  /*
   * Maximum configured attempts.
   */
  maxAttempts: number;
}

export type JobProcessorResult =
  | {
      status: 'processed';
    }
  | {
      /*
       * A no-op is a successful business outcome.
       *
       * Example:
       * a reminder fires after its follow-up has
       * already been cancelled.
       *
       * Do not throw for business no-ops because
       * retrying cannot make them useful again.
       */
      status: 'noop';

      reason: string;
    };

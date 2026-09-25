/*
 * Reading a message out of the local mailbox, without racing its delivery.
 *
 * A queued message is not a delivered one. `AuthMailService` writes to
 * `auth_mail_outbox` and a separate pass hands it to Mailpit over HTTP, after
 * which Mailpit has to index it before its search API will return it. A test
 * that dispatches once and searches once is asserting on all of that having
 * finished within a single event-loop turn, which it usually has and
 * occasionally has not — the shape of flakiness that gets blamed on whatever
 * changed most recently rather than on the read.
 *
 * So this polls: dispatch, search, and if the message is not there yet, wait a
 * little and try again until the deadline. The delay matters. The previous
 * version of this loop in invitations-security ran twenty iterations with no
 * pause at all, which can exhaust every attempt inside a millisecond and is
 * indistinguishable from not retrying.
 */
const POLL_INTERVAL_MS = 50;
const DEFAULT_TIMEOUT_MS = 20_000;

/*
 * AuthMailService.dispatchPending delivers one message per call — it takes the
 * oldest undelivered row with `limit(1)`. A shared development database
 * accumulates a backlog across suites, and each unreachable row can hold a
 * five second fetch timeout, so a poll that dispatches once per iteration can
 * spend its whole budget draining other suites' mail and never reach the
 * message it is waiting for. Each iteration therefore drains a run of
 * messages rather than one.
 */
const DRAIN_PER_ATTEMPT = 8;

interface SearchResponse {
  messages: { ID: string }[];
}

function mailboxUrl(): string {
  const url = process.env.MAILPIT_URL;

  if (!url) throw new Error('MAILPIT_URL is required to read the local mailbox');

  return url;
}

/**
 * Resolves the id of a message addressed to `email` that `seen` does not
 * already contain, dispatching pending mail between attempts.
 *
 * `seen` is mutated with the id that is returned, so consecutive calls in one
 * suite each pick up the next message rather than re-reading the first.
 */
export async function waitForNewMessage(
  email: string,
  options: {
    deliver: () => Promise<unknown>;
    seen: string[];
    timeoutMs?: number;
  },
): Promise<string> {
  const deadline = Date.now() + (options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  let lastCount = 0;

  for (;;) {
    for (let drained = 0; drained < DRAIN_PER_ATTEMPT; drained += 1) {
      await options.deliver();
    }

    const response = await fetch(
      `${mailboxUrl()}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
    );
    const body = (await response.json()) as SearchResponse;
    lastCount = body.messages.length;

    const found = body.messages.find((message) => !options.seen.includes(message.ID));

    if (found) {
      options.seen.push(found.ID);

      return found.ID;
    }

    if (Date.now() >= deadline)
      throw new Error(
        `No new message for ${email} within ${options.timeoutMs ?? DEFAULT_TIMEOUT_MS}ms ` +
          `(${lastCount} message(s) already seen). The mail pass may not have run, or ` +
          'MAILPIT_URL may point at a mailbox nothing is delivering to.',
      );

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

/** The single-use token carried in a message body. */
export async function readTokenFromMessage(id: string): Promise<string> {
  const detail = (await (await fetch(`${mailboxUrl()}/api/v1/message/${id}`)).json()) as {
    Text: string;
  };
  const token = /#token=([A-Za-z0-9_-]{43})/.exec(detail.Text);

  if (!token)
    throw new Error(`Message ${id} carried no token; body began: ${detail.Text.slice(0, 120)}`);

  return token[1]!;
}

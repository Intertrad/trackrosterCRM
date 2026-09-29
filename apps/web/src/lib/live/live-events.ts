/** Invalidations carry no record data or credentials. Reads always re-authorize. */
export const LIVE_CHANGE_EVENT = 'trackroster:changed';
const CHANNEL = 'trackroster:changes';

export function announceMutation(method = 'GET'): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase()) || typeof window === 'undefined')
    return;
  window.dispatchEvent(new Event(LIVE_CHANGE_EVENT));
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage('changed');
    channel.close();
  }
}

export function listenForChanges(listener: () => void): () => void {
  window.addEventListener(LIVE_CHANGE_EVENT, listener);
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL) : null;
  if (channel) channel.onmessage = listener;
  return () => {
    window.removeEventListener(LIVE_CHANGE_EVENT, listener);
    channel?.close();
  };
}

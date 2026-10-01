import { ApiError } from './api-error';

export function describeCampaignError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'Something went wrong. Please try again.';
  }

  if (error.statusCode === 403) {
    return 'You are not authorized to manage campaigns.';
  }

  if (error.statusCode === 409 || error.statusCode === 412) {
    return 'This campaign changed elsewhere. Reload before trying again.';
  }

  if (error.statusCode === 400) {
    return error.messages.join(' ');
  }

  return 'We could not load campaigns. Please try again.';
}

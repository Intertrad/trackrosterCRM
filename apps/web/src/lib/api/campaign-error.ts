import { ApiError } from './api-error';
import { text } from '@/lib/workspace/copy';

export function describeCampaignError(error: unknown, language = 'en'): string {
  const l = (en: string, fr: string) => text(en, fr, language);
  if (!(error instanceof ApiError)) {
    return l('Something went wrong. Please try again.', 'Une erreur est survenue. Réessayez.');
  }

  if (error.statusCode === 403) {
    return l(
      'You are not authorized to manage campaigns.',
      'Vous n’êtes pas autorisé à gérer les campagnes.',
    );
  }

  if (error.statusCode === 409 || error.statusCode === 412) {
    return l(
      'This campaign changed elsewhere. Reload before trying again.',
      'Cette campagne a changé ailleurs. Rechargez avant de réessayer.',
    );
  }

  if (error.statusCode === 400) {
    return error.messages.join(' ');
  }

  return l(
    'We could not load campaigns. Please try again.',
    'Impossible de charger les campagnes. Réessayez.',
  );
}

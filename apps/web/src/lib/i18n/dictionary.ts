import type { UiLanguage } from './languages';

/**
 * One line per sentence, every language side by side.
 *
 * Adding a language means adding a column to each line, and a missing one
 * fails the type check rather than silently rendering English in the middle
 * of a French screen.
 */
type Entry = Record<UiLanguage, string>;

export const DICTIONARY = {
  /* ---------- navigation ---------- */
  'nav.today': { en: 'Today', fr: "Aujourd'hui" },
  'nav.workQueue': { en: 'My prospects', fr: 'Mes prospects' },
  'nav.map': { en: 'Map', fr: 'Carte' },
  'nav.actions': { en: 'Actions', fr: 'Actions' },
  'nav.messages': { en: 'Messages', fr: 'Messages' },
  'nav.routes': { en: 'Routes', fr: 'Tournées' },
  'nav.loggedActions': { en: 'Logged actions', fr: 'Actions enregistrées' },
  'nav.search': { en: 'Search', fr: 'Rechercher' },
  'nav.overview': { en: 'Overview', fr: "Vue d'ensemble" },
  'nav.dashboard': { en: 'Team overview', fr: "Vue d'ensemble de l'équipe" },
  'nav.team': { en: 'Team', fr: 'Équipe' },
  'nav.assignments': { en: 'Assignments', fr: 'Attributions' },
  'nav.campaigns': { en: 'Campaigns', fr: 'Campagnes' },
  'nav.reports': { en: 'Reports', fr: 'Rapports' },
  'nav.exports': { en: 'Exports', fr: 'Exports' },
  'nav.imports': { en: 'Imports', fr: 'Imports' },
  'nav.collisions': { en: 'Collision center', fr: 'Centre des conflits' },
  'nav.approvals': { en: 'Approvals', fr: 'Validations' },
  'nav.overrides': { en: 'Overrides', fr: 'Dérogations' },
  'nav.users': { en: 'Users & roles', fr: 'Utilisateurs et rôles' },
  'nav.audit': { en: 'Audit', fr: 'Audit' },
  'nav.administration': { en: 'Overview', fr: "Vue d'ensemble" },
  'nav.workspace': { en: 'Workspace', fr: 'Espace de travail' },
  'nav.primary': { en: 'Primary', fr: 'Navigation principale' },
  'nav.more': { en: 'More', fr: 'Plus' },
  'nav.expand': { en: 'Expand sidebar', fr: 'Déplier le menu' },
  'nav.collapse': { en: 'Collapse sidebar', fr: 'Replier le menu' },
  'nav.unavailable': {
    en: '{label} is not available yet',
    fr: '{label} n’est pas encore disponible',
  },

  /* ---------- account menu ---------- */
  'account.settings': { en: 'Account settings', fr: 'Paramètres du compte' },
  'account.switchWorkspace': { en: 'Switch workspace', fr: "Changer d'espace de travail" },
  'account.signOut': { en: 'Sign out', fr: 'Déconnexion' },
  'account.signingOut': { en: 'Signing out…', fr: 'Déconnexion…' },
  'account.language': { en: 'Language', fr: 'Langue' },
  'account.languageHint': {
    en: 'Applies to your account on every device.',
    fr: 'S’applique à votre compte sur tous vos appareils.',
  },

  /* ---------- roles ---------- */
  'role.admin': { en: 'Client Admin', fr: 'Administrateur client' },
  'role.director': { en: 'Director', fr: 'Directeur' },
  'role.manager': { en: 'Manager', fr: 'Manager' },
  'role.prospector': { en: 'Prospector', fr: 'Prospecteur' },
  'role.observer': { en: 'Observer', fr: 'Observateur' },

  /* ---------- common ---------- */
  'common.close': { en: 'Close', fr: 'Fermer' },
  'common.cancel': { en: 'Cancel', fr: 'Annuler' },
  'common.confirm': { en: 'Confirm', fr: 'Confirmer' },
  'common.search': { en: 'Search', fr: 'Rechercher' },
  'common.retry': { en: 'Try again', fr: 'Réessayer' },
  'common.loading': { en: 'Loading…', fr: 'Chargement…' },
  'common.notifications': { en: 'Notifications', fr: 'Notifications' },

  /* ---------- today ---------- */
  'today.title': { en: 'Today', fr: "Aujourd'hui" },
  'today.subtitle': { en: 'Your priorities for today', fr: 'Vos priorités du jour' },
  'today.refresh': { en: 'Refresh today', fr: 'Actualiser la journée' },
  'today.scope': { en: 'My prospects', fr: 'Mes prospects' },
  'today.nextActions': { en: 'Next actions', fr: 'Prochaines actions' },
  'today.filter.all': { en: 'All', fr: 'Toutes' },
  'today.filter.overdue': { en: 'Overdue', fr: 'En retard' },
  'today.filter.dueToday': { en: 'Due today', fr: "Prévues aujourd'hui" },
  'today.visits': { en: "Today's visits", fr: 'Visites du jour' },
  'today.visitOrder': { en: "Today's visit order", fr: 'Ordre des visites' },
  'today.stops': { en: '{count} stops', fr: '{count} arrêts' },
  'today.stops.one': { en: '{count} stop', fr: '{count} arrêt' },
  'today.openRoute': { en: 'Open route', fr: 'Ouvrir la tournée' },
  'today.noPlottableStop': {
    en: 'No stop today has coordinates to plot.',
    fr: 'Aucun arrêt du jour ne dispose de coordonnées.',
  },
  'today.directDistance': {
    en: 'Distances are direct point-to-point, not driving distance.',
    fr: 'Distances à vol d’oiseau, et non distances routières.',
  },
  'today.progress': { en: 'Progress today', fr: 'Progression du jour' },
  'today.completed': { en: 'Actions completed', fr: 'Actions terminées' },
  'today.remaining': { en: 'Remaining today', fr: "Restantes aujourd'hui" },
  'today.overdue': { en: 'Follow-ups overdue', fr: 'Relances en retard' },
  'today.clear': { en: 'Clear to proceed', fr: 'Aucun blocage' },
  'today.clearBody': {
    en: 'The anti-collision engine has not blocked any prospect on today’s list.',
    fr: 'Le moteur anti-collision n’a bloqué aucun prospect de la liste du jour.',
  },
  'today.empty': { en: 'Your day is clear', fr: 'Votre journée est dégagée' },
  'today.emptyBody': {
    en: 'No actions are due. New work appears here as it is assigned.',
    fr: 'Aucune action prévue. Le nouveau travail apparaîtra ici dès son attribution.',
  },
  'today.noMatch': {
    en: 'Nothing matches this filter right now.',
    fr: 'Aucun élément ne correspond à ce filtre.',
  },
  'today.logAction': { en: 'Log action', fr: "Enregistrer l'action" },
  'today.viewProspect': { en: 'View prospect', fr: 'Voir le prospect' },
  'today.moreFor': { en: 'More for {name}', fr: 'Plus d’options pour {name}' },
  'today.activityHistory': { en: 'Activity history', fr: 'Historique des activités' },
  'today.allFollowUps': { en: 'All follow-ups', fr: 'Toutes les relances' },
  'today.loadError': {
    en: 'We could not load your day. Please try again.',
    fr: 'Impossible de charger votre journée. Veuillez réessayer.',
  },
  'today.sessionExpired': {
    en: 'Your session has expired. Please sign in again.',
    fr: 'Votre session a expiré. Veuillez vous reconnecter.',
  },

  /* ---------- lifecycle ---------- */
  'stage.to_contact': { en: 'To contact', fr: 'À contacter' },
  'stage.contact_made': { en: 'Contact made', fr: 'Contact établi' },
  'stage.in_progress': { en: 'In progress', fr: 'En cours' },
  'stage.follow_up': { en: 'Follow-up', fr: 'Relance' },
  'stage.qualified': { en: 'Qualified', fr: 'Qualifié' },
  'stage.converted': { en: 'Converted', fr: 'Converti' },

  /* ---------- due state ---------- */
  'due.overdue': { en: 'Overdue', fr: 'En retard' },
  'due.today': { en: 'Due today', fr: "Prévue aujourd'hui" },
  'due.upcoming': { en: 'Upcoming', fr: 'À venir' },

  /* ---------- channels ---------- */
  'channel.call': { en: 'Call', fr: 'Appel' },
  'channel.email': { en: 'Email', fr: 'Email' },
  'channel.message': { en: 'Message', fr: 'Message' },
  'channel.visit': { en: 'Visit', fr: 'Visite' },
  'channel.letter': { en: 'Letter', fr: 'Courrier' },
  'channel.action': { en: 'Action', fr: 'Action' },

  /* ---------- calling ---------- */
  'call.start': { en: 'Call {name}', fr: 'Appeler {name}' },
  'call.noNumber': { en: 'No phone number on record', fr: 'Aucun numéro enregistré' },
  'call.logPrompt': {
    en: 'Did the call connect? Log the outcome so the timeline stays accurate.',
    fr: 'L’appel a-t-il abouti ? Enregistrez le résultat pour garder un historique fiable.',
  },
  'call.logNow': { en: 'Log this call', fr: 'Enregistrer cet appel' },
  'call.notNow': { en: 'Not now', fr: 'Plus tard' },
} as const satisfies Record<string, Entry>;

export type MessageKey = keyof typeof DICTIONARY;

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

  /* ---------- action categories ---------- */
  'category.todo': { en: 'To do', fr: 'À faire' },
  'category.follow_up': { en: 'Follow-up', fr: 'Relance' },
  'category.meeting': { en: 'Meeting', fr: 'Rendez-vous' },

  /* ---------- today, continued ---------- */
  'today.teamScoped': { en: 'Today is a team view.', fr: "Aujourd'hui est une vue d'équipe." },
  'today.teamScopedBody': {
    en: 'Your current workspace is not scoped to a team, so there is no personal daily queue to show. Switch to a team workspace to see your priorities.',
    fr: "Votre espace de travail n'est pas rattaché à une équipe : il n'y a donc pas de file de travail personnelle. Changez d'espace pour voir vos priorités.",
  },
  'today.loadErrorTitle': {
    en: 'We could not load your day.',
    fr: 'Impossible de charger votre journée.',
  },
  'today.loading': { en: 'Loading your day…', fr: 'Chargement de votre journée…' },
  'today.dueSoon': { en: 'Due soon', fr: 'Bientôt due' },
  'today.hideCollision': {
    en: 'Hide this collision notice',
    fr: 'Masquer cet avertissement de conflit',
  },
  'today.collisionBlocked': {
    en: 'Contact already reserved by another team',
    fr: 'Contact déjà réservé par une autre équipe',
  },
  'today.collisionOverride': {
    en: 'This contact needs an override',
    fr: 'Ce contact nécessite une dérogation',
  },
  'today.collisionHidden': {
    en: 'The collision notice is hidden for this visit. It reappears on reload until the claim is resolved.',
    fr: "L'avertissement est masqué pour cette visite. Il réapparaîtra au rechargement tant que le conflit n'est pas résolu.",
  },
  'today.collisionDetected': {
    en: '{reason}. Detected {day} at {time}.',
    fr: '{reason}. Détecté le {day} à {time}.',
  },
  'today.viewDetails': { en: 'View details', fr: 'Voir le détail' },

  /* ---------- workspace overview ---------- */
  'overview.subtitle': {
    en: 'Coordinate prospecting across your teams, campaigns and territories.',
    fr: 'Coordonnez la prospection entre vos équipes, campagnes et territoires.',
  },
  'overview.available': { en: 'Available in this workspace', fr: 'Disponible dans cet espace' },
  'overview.none': {
    en: 'No screens are available for this role yet.',
    fr: "Aucun écran n'est encore disponible pour ce rôle.",
  },

  /* ---------- my prospects ---------- */
  'portfolio.title': { en: 'My prospects', fr: 'Mes prospects' },
  'portfolio.assigned': {
    en: '{count} establishments assigned to me',
    fr: '{count} établissements qui me sont attribués',
  },
  'portfolio.assigned.one': {
    en: '{count} establishment assigned to me',
    fr: '{count} établissement qui m’est attribué',
  },
  'portfolio.loading': { en: 'Loading your portfolio…', fr: 'Chargement de votre portefeuille…' },
  'portfolio.teamScoped': {
    en: 'This view is scoped to a team.',
    fr: 'Cette vue est rattachée à une équipe.',
  },
  'portfolio.teamScopedBody': {
    en: 'Switch to a team workspace to see the portfolio assigned to you.',
    fr: "Changez d'espace de travail pour voir le portefeuille qui vous est attribué.",
  },
  'portfolio.loadErrorTitle': {
    en: 'We could not load your portfolio.',
    fr: 'Impossible de charger votre portefeuille.',
  },
  'portfolio.loadError': {
    en: 'We could not load your portfolio. Please try again.',
    fr: 'Impossible de charger votre portefeuille. Veuillez réessayer.',
  },
  'portfolio.partialTitle': {
    en: 'Showing the first part of your portfolio.',
    fr: 'Affichage de la première partie de votre portefeuille.',
  },
  'portfolio.partialBody': {
    en: 'It is larger than this screen reads in one go, so the totals below describe what was loaded rather than every assignment.',
    fr: "Il dépasse ce que cet écran lit en une fois : les totaux ci-dessous décrivent ce qui a été chargé, et non l'ensemble des attributions.",
  },
  'portfolio.search': { en: 'Search my portfolio', fr: 'Rechercher dans mon portefeuille' },
  'portfolio.status': { en: 'Status', fr: 'Statut' },
  'portfolio.campaign': { en: 'Campaign', fr: 'Campagne' },
  'portfolio.sort': { en: 'Sort', fr: 'Trier' },
  'portfolio.all': { en: 'All', fr: 'Tous' },
  'portfolio.view': { en: 'View', fr: 'Affichage' },
  'portfolio.list': { en: 'List', fr: 'Liste' },
  'portfolio.map': { en: 'Map', fr: 'Carte' },
  'portfolio.establishment': { en: 'Establishment', fr: 'Établissement' },
  'portfolio.lastAction': { en: 'Last action', fr: 'Dernière action' },
  'portfolio.nextStep': { en: 'Next step', fr: 'Prochaine étape' },
  'portfolio.noMatch': {
    en: 'No prospect matches these filters.',
    fr: 'Aucun prospect ne correspond à ces filtres.',
  },
  'portfolio.empty': {
    en: 'No prospects are assigned to you yet.',
    fr: 'Aucun prospect ne vous est encore attribué.',
  },
  'portfolio.showing': { en: 'Showing {shown} of {total}', fr: '{shown} sur {total} affichés' },
  /*
   * Four separate counts rather than one sentence: French agrees the noun and
   * the adjective with the number, so "1 relances dues" is simply wrong and a
   * single compound key cannot express it.
   */
  'portfolio.summary.assigned': { en: '{count} assigned', fr: '{count} attribués' },
  'portfolio.summary.assigned.one': { en: '{count} assigned', fr: '{count} attribué' },
  'portfolio.summary.toContact': { en: '{count} to contact', fr: '{count} à contacter' },
  'portfolio.summary.due': { en: '{count} follow-ups due', fr: '{count} relances dues' },
  'portfolio.summary.due.one': { en: '{count} follow-up due', fr: '{count} relance due' },
  'portfolio.summary.blocked': {
    en: '{count} blocked by an anti-collision rule',
    fr: '{count} bloqués par une règle anti-collision',
  },
  'portfolio.summary.blocked.one': {
    en: '{count} blocked by an anti-collision rule',
    fr: '{count} bloqué par une règle anti-collision',
  },
  'portfolio.region': { en: 'Region {code}', fr: 'Région {code}' },
  'portfolio.regions': { en: 'Regions {codes}', fr: 'Régions {codes}' },
  'portfolio.visible': { en: '{visible} of {total} visible', fr: '{visible} sur {total} visibles' },
  'portfolio.withoutCoordinates': {
    en: '{count} without coordinates',
    fr: '{count} sans coordonnées',
  },
  'portfolio.nearby': { en: 'Nearby', fr: 'À proximité' },
  'portfolio.nearbyPrompt': {
    en: 'Select a prospect on the map to see the rest of your portfolio around it.',
    fr: 'Sélectionnez un prospect sur la carte pour voir le reste de votre portefeuille autour.',
  },
  'portfolio.near': { en: 'Near {place}', fr: 'Autour de {place}' },
  'portfolio.nearbyCount': {
    en: '{count} of my prospects within {radius}',
    fr: '{count} de mes prospects dans un rayon de {radius}',
  },
  'portfolio.nearbyLoading': { en: 'Looking…', fr: 'Recherche…' },
  'portfolio.nearbyEmpty': {
    en: 'Nothing else of yours is within {radius}.',
    fr: "Vous n'avez rien d'autre dans un rayon de {radius}.",
  },
  'portfolio.nearbyError': {
    en: 'We could not load what is nearby.',
    fr: 'Impossible de charger les prospects à proximité.',
  },
  'portfolio.planRound': { en: 'Plan a round', fr: 'Planifier une tournée' },
  'portfolio.scopeNote': {
    en: 'Only prospects assigned to you are shown — never territory-wide or unassigned records.',
    fr: 'Seuls les prospects qui vous sont attribués apparaissent — jamais les enregistrements du territoire ou non attribués.',
  },
  'portfolio.openProspect': { en: 'Open prospect', fr: 'Ouvrir le prospect' },
  'portfolio.noCollision': { en: 'No collision', fr: 'Aucun conflit' },
  'portfolio.blockedByClaim': {
    en: 'Blocked by another claim',
    fr: 'Bloqué par une autre réservation',
  },

  /* ---------- quick filters and sorting ---------- */
  'filter.myFollowUps': { en: 'My follow-ups', fr: 'Mes relances' },
  'filter.toContact': { en: 'To contact', fr: 'À contacter' },
  'filter.dueThisWeek': { en: 'Due this week', fr: 'Dues cette semaine' },
  'filter.dataGaps': { en: 'Data to complete', fr: 'Données à compléter' },
  'sort.priority': { en: 'Priority', fr: 'Priorité' },
  'sort.name': { en: 'Name', fr: 'Nom' },
  'sort.recent': { en: 'Recent activity', fr: 'Activité récente' },

  /* ---------- next step ---------- */
  'next.blocked': { en: 'Blocked — cooldown', fr: 'Bloqué — délai de carence' },
  'next.closed': { en: 'Closed', fr: 'Clôturé' },
  'next.followUpOverdue': { en: 'Follow-up overdue', fr: 'Relance en retard' },
  'next.followUpToday': { en: 'Follow-up today', fr: "Relance aujourd'hui" },
  'next.followUpAt': { en: 'Follow-up · {when}', fr: 'Relance · {when}' },
  'next.addContact': { en: 'Add contact person', fr: 'Ajouter un contact' },
  'next.logAction': { en: 'Log next action', fr: 'Enregistrer la prochaine action' },

  /* ---------- relative time ---------- */
  'when.today': { en: 'today', fr: "aujourd'hui" },
  'when.yesterday': { en: 'yesterday', fr: 'hier' },
  'when.daysAgo': { en: '{count} days ago', fr: 'il y a {count} jours' },
  'when.unknown': { en: 'unknown', fr: 'inconnu' },
  'when.channelAt': { en: '{channel} · {when}', fr: '{channel} · {when}' },

  /* ---------- contacts ---------- */
  'contacts.title': { en: 'Contacts', fr: 'Contacts' },
  'contacts.named': { en: 'Named contacts', fr: 'Contacts nommés' },
  'contacts.addresses': { en: 'Addresses', fr: 'Adresses' },
  'contacts.primary': { en: 'Primary', fr: 'Principal' },
  'contacts.unnamed': { en: 'Unnamed contact', fr: 'Contact sans nom' },
  'contacts.loadError': {
    en: 'We could not load contact details.',
    fr: 'Impossible de charger les coordonnées.',
  },

  /* ---------- actions queue ---------- */
  'actions.title': { en: 'Actions', fr: 'Actions' },
  'actions.subtitle': {
    en: 'Manage your calls, emails, visits and follow-ups',
    fr: 'Gérez vos appels, emails, visites et relances',
  },
  'actions.teamScoped': {
    en: 'This view is scoped to a team.',
    fr: 'Cette vue est rattachée à une équipe.',
  },
  'actions.teamScopedBody': {
    en: 'Switch to a team workspace to manage your actions.',
    fr: "Changez d'espace de travail pour gérer vos actions.",
  },
  'actions.loadError': {
    en: 'We could not load your actions. Please try again.',
    fr: 'Impossible de charger vos actions. Veuillez réessayer.',
  },
  'actions.search': { en: 'Search actions', fr: 'Rechercher une action' },
  'actions.loading': { en: 'Loading your actions…', fr: 'Chargement de vos actions…' },
  'actions.tab.todo': { en: 'To do', fr: 'À faire' },
  'actions.tab.overdue': { en: 'Overdue', fr: 'En retard' },
  'actions.tab.completed': { en: 'Completed', fr: 'Terminées' },
  'actions.noSearchMatch': {
    en: 'No actions match your search',
    fr: 'Aucune action ne correspond à votre recherche',
  },
  'actions.emptyList': { en: 'Nothing in this list', fr: 'Rien dans cette liste' },
  'actions.noOverdue': {
    en: 'You have no overdue follow-ups.',
    fr: "Vous n'avez aucune relance en retard.",
  },
  'actions.emptyBody': {
    en: 'New follow-ups appear here when they are created.',
    fr: 'Les nouvelles relances apparaîtront ici dès leur création.',
  },
  'actions.bulk': { en: 'Bulk actions', fr: 'Actions groupées' },
  'actions.selected': { en: '{count} actions selected', fr: '{count} actions sélectionnées' },
  'actions.selected.one': { en: '{count} action selected', fr: '{count} action sélectionnée' },
  'actions.markCompleted': { en: 'Mark completed', fr: 'Marquer comme terminées' },
  'actions.cancelActions': { en: 'Cancel actions', fr: 'Annuler les actions' },
  'actions.clearSelection': { en: 'Clear selection', fr: 'Effacer la sélection' },
  'actions.select': {
    en: 'Select follow-up for {name}',
    fr: 'Sélectionner la relance pour {name}',
  },
  'actions.owner.team': { en: 'Team', fr: 'Équipe' },
  'actions.owner.you': { en: 'You', fr: 'Vous' },
  'actions.status.open': { en: 'Open', fr: 'Ouverte' },
  'actions.status.completed': { en: 'Completed', fr: 'Terminée' },
  'actions.status.overdue': { en: 'Overdue', fr: 'En retard' },

  /* ---------- messages ---------- */
  'messages.title': { en: 'Messages', fr: 'Messages' },
  'messages.subtitle': {
    en: 'Coordinate with your team without leaving TrackRoster',
    fr: 'Coordonnez-vous avec votre équipe sans quitter TrackRoster',
  },
  'messages.search': { en: 'Search conversations', fr: 'Rechercher une conversation' },
  'messages.none': { en: 'No conversations yet', fr: 'Aucune conversation pour le moment' },
  'messages.noMatches': { en: 'No matches', fr: 'Aucun résultat' },
  'messages.startOne': {
    en: 'Start one to coordinate a visit or hand a prospect over.',
    fr: 'Démarrez-en une pour organiser une visite ou transmettre un prospect.',
  },
  'messages.unread': { en: 'Unread messages', fr: 'Messages non lus' },
  'messages.unmute': { en: 'Unmute', fr: 'Réactiver' },
  'messages.mute8h': { en: 'Mute 8h', fr: 'Mettre en sourdine 8 h' },
  'messages.unknownSender': { en: 'Unknown', fr: 'Inconnu' },
  'messages.deleteMessage': { en: 'Delete message', fr: 'Supprimer le message' },
  'messages.message': { en: 'Message', fr: 'Message' },
  'messages.writeMessage': { en: 'Write a message…', fr: 'Écrire un message…' },
  'messages.send': { en: 'Send', fr: 'Envoyer' },
  'messages.newConversation': { en: 'New conversation', fr: 'Nouvelle conversation' },
  'messages.kind': { en: 'Kind', fr: 'Type' },
  'messages.titleOptional': { en: 'Title (optional)', fr: 'Titre (facultatif)' },
  'messages.titlePlaceholder': { en: 'What is this about?', fr: 'De quoi s’agit-il ?' },
  'messages.participants': { en: 'Participants', fr: 'Participants' },
  'messages.nobodyAvailable': {
    en: 'Nobody else is available in this workspace.',
    fr: "Personne d'autre n'est disponible dans cet espace de travail.",
  },
  'messages.genericError': {
    en: 'Something went wrong. Please try again.',
    fr: 'Une erreur est survenue. Veuillez réessayer.',
  },
  'messages.notParticipant': {
    en: 'You are not a participant in this conversation.',
    fr: 'Vous ne participez pas à cette conversation.',
  },
  'messages.gone': {
    en: 'That conversation no longer exists.',
    fr: "Cette conversation n'existe plus.",
  },
  'messages.unreachable': {
    en: 'We could not reach messaging. Please try again.',
    fr: 'Impossible de joindre la messagerie. Veuillez réessayer.',
  },

  /* ---------- conversation kinds ---------- */
  'conversation.direct': { en: 'Direct', fr: 'Direct' },
  'conversation.team': { en: 'Team', fr: 'Équipe' },
  'conversation.prospect': { en: 'Prospect', fr: 'Prospect' },
  'conversation.campaign': { en: 'Campaign', fr: 'Campagne' },
  'conversation.named': { en: '{kind} conversation', fr: 'Conversation {kind}' },

  /* ---------- lifecycle ---------- */
  'stage.to_contact': { en: 'To contact', fr: 'À contacter' },
  'stage.contact_made': { en: 'Contact made', fr: 'Contact établi' },
  'stage.in_progress': { en: 'In progress', fr: 'En cours' },
  'stage.follow_up': { en: 'Follow-up', fr: 'Relance' },
  'stage.qualified': { en: 'Qualified', fr: 'Qualifié' },
  'stage.converted': { en: 'Converted', fr: 'Converti' },
  'stage.assigned': { en: 'Assigned', fr: 'Attribué' },

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

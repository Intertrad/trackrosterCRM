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
  'nav.objectives': { en: 'Objectives', fr: 'Objectifs' },
  'nav.territories': { en: 'Territories', fr: 'Territoires' },
  'nav.security': { en: 'Security', fr: 'Sécurité' },
  'nav.tenants': { en: 'Tenants', fr: 'Clients' },
  'nav.platformAccess': { en: 'Platform access', fr: 'Accès plateforme' },
  'nav.platform': { en: 'Platform', fr: 'Plateforme' },
  'nav.serviceHealth': { en: 'Service health', fr: 'État des services' },
  'role.platform': { en: 'Platform administrator', fr: 'Administrateur plateforme' },
  'nav.workspaceTools': { en: 'Workspace tools', fr: 'Outils de l’espace' },

  'nav.live': { en: 'Live activity', fr: 'En direct' },
  'nav.activity': { en: 'Activity', fr: 'Activité' },
  'nav.scripts': { en: 'Scripts and emails', fr: 'Scripts et e-mails' },
  'nav.organizations': { en: 'Companies', fr: 'Entreprises' },
  'nav.rules': { en: 'Rules and settings', fr: 'Règles et réglages' },
  'nav.configuration': { en: 'Configuration', fr: 'Configuration' },
  'nav.operate': { en: 'Operate', fr: 'Opérations' },
  'nav.control': { en: 'Control', fr: 'Contrôle' },
  'nav.tools': { en: 'Other tools', fr: 'Autres outils' },
  'nav.followUps': { en: 'Follow-ups', fr: 'Relances' },
  'nav.history': { en: 'History', fr: 'Historique' },
  /* ---------- navigation ---------- */
  'nav.today': { en: 'My day', fr: 'Ma journée' },
  'nav.workQueue': { en: 'My prospects', fr: 'Mes prospects' },
  'nav.prospects': { en: 'Prospects', fr: 'Prospects' },
  'nav.map': { en: 'Map', fr: 'Carte' },
  'nav.actions': { en: 'Actions', fr: 'Actions' },
  'nav.actionsHistory': { en: 'Actions / History', fr: 'Actions / Historique' },
  'nav.performance': { en: 'My Performance', fr: 'Ma performance' },
  'nav.teamPerformance': { en: 'Performance', fr: 'Performance' },
  'nav.messages': { en: 'Messages', fr: 'Messages' },
  'nav.routes': { en: 'Routes', fr: 'Tournées' },
  'nav.loggedActions': { en: 'Logged actions', fr: 'Actions enregistrées' },
  'nav.search': { en: 'Search', fr: 'Rechercher' },
  'nav.overview': { en: 'Overview', fr: "Vue d'ensemble" },
  'nav.executiveDashboard': { en: 'Executive Dashboard', fr: 'Tableau de bord exécutif' },
  'nav.dashboard': { en: 'Team overview', fr: "Vue d'ensemble de l'équipe" },
  'nav.team': { en: 'Team', fr: 'Équipe' },
  'nav.assignments': { en: 'Assignments', fr: 'Attributions' },
  'nav.campaigns': { en: 'Campaigns', fr: 'Campagnes' },
  'nav.reports': { en: 'Reports', fr: 'Rapports' },
  'nav.exports': { en: 'Exports', fr: 'Exports' },
  'nav.imports': { en: 'Imports', fr: 'Import de données' },
  'nav.referential': { en: 'Prospects', fr: 'Prospects' },
  'nav.collisions': { en: 'Collision center', fr: 'Centre des conflits' },
  'nav.approvals': { en: 'Approvals', fr: 'Validations' },
  'nav.followUpReviews': { en: 'Follow-up reviews', fr: 'Validation des relances' },
  'nav.overrides': { en: 'Overrides', fr: 'Dérogations' },
  'nav.users': { en: 'Users & roles', fr: 'Utilisateurs et rôles' },
  'nav.audit': { en: 'Audit log', fr: 'Journal d’audit' },
  'nav.administration': { en: 'Overview', fr: "Vue d'ensemble" },
  'nav.workspace': { en: 'Workspace', fr: 'Espace de travail' },
  'nav.primary': { en: 'Primary', fr: 'Navigation principale' },
  'nav.more': { en: 'More', fr: 'Plus' },
  'nav.expand': { en: 'Expand sidebar', fr: 'Déplier le menu' },
  'nav.collapse': { en: 'Collapse sidebar', fr: 'Replier le menu' },
  'nav.searchAssignedProspects': {
    en: 'Search my assigned prospects',
    fr: 'Rechercher mes prospects attribués',
  },
  'nav.searchWorkspace': {
    en: 'Search workspace',
    fr: 'Rechercher dans l’espace de travail',
  },
  'nav.helpWorkspaceTools': {
    en: 'Help and workspace tools',
    fr: 'Aide et outils de l’espace de travail',
  },
  'nav.assignedWorkspace': { en: 'Assigned workspace', fr: 'Espace attribué' },
  'nav.currentWorkspace': { en: 'Current workspace', fr: 'Espace de travail actuel' },
  'nav.organizationScope': { en: 'Organization scope', fr: 'Périmètre de l’organisation' },
  'nav.workspaceScope': { en: 'Workspace scope', fr: 'Périmètre de l’espace de travail' },
  'nav.teamScope': { en: 'Team', fr: 'Équipe' },
  'nav.unavailable': {
    en: '{label} is not available yet',
    fr: '{label} n’est pas encore disponible',
  },

  /* ---------- account menu ---------- */
  'account.settings': { en: 'Account settings', fr: 'Paramètres du compte' },
  'account.switchWorkspace': { en: 'Switch workspace', fr: "Changer d'espace de travail" },
  'account.workspaceRole': { en: 'Workspace role', fr: 'Rôle de l’espace de travail' },
  'account.signOut': { en: 'Sign out', fr: 'Déconnexion' },
  'account.signingOut': { en: 'Signing out…', fr: 'Déconnexion…' },
  'account.language': { en: 'Language', fr: 'Langue' },
  'account.languageHint': {
    en: 'Applies to your account on every device.',
    fr: 'S’applique à votre compte sur tous vos appareils.',
  },
  'account.settingsSubtitle': {
    en: 'Manage your identity, security, and workspace access.',
    fr: 'Gérez votre identité, votre sécurité et vos accès aux espaces de travail.',
  },
  'account.settingsSections': {
    en: 'Account settings sections',
    fr: 'Sections des paramètres du compte',
  },
  'account.tab.profile': { en: 'Profile', fr: 'Profil' },
  'account.tab.security': { en: 'Security', fr: 'Sécurité' },
  'account.tab.notifications': { en: 'Notifications', fr: 'Notifications' },
  'account.tab.sessions': { en: 'Sessions', fr: 'Sessions' },
  'account.navigationHint': {
    en: 'Your navigation and available settings adapt to the active workspace role.',
    fr: 'Votre navigation et les réglages disponibles s’adaptent au rôle actif dans l’espace de travail.',
  },
  'account.profile.personalInformation': {
    en: 'Personal information',
    fr: 'Informations personnelles',
  },
  'account.profile.displayName': { en: 'Display name', fr: 'Nom affiché' },
  'account.profile.displayNameHint': {
    en: 'Shown to your team across assignments, actions and history.',
    fr: 'Visible par votre équipe dans les attributions, les actions et l’historique.',
  },
  'account.profile.workEmail': { en: 'Work email', fr: 'E-mail professionnel' },
  'account.profile.workEmailHint': {
    en: 'Your sign-in address is managed by your administrator.',
    fr: 'Votre adresse de connexion est gérée par votre administrateur.',
  },
  'account.profile.phone': { en: 'Phone number', fr: 'Numéro de téléphone' },
  'account.profile.language': { en: 'Language', fr: 'Langue' },
  'account.profile.timezone': { en: 'Time zone', fr: 'Fuseau horaire' },
  'account.profile.conflictTitle': {
    en: 'This profile changed somewhere else.',
    fr: 'Ce profil a été modifié ailleurs.',
  },
  'account.profile.conflictBody': {
    en: 'Reload it before applying your changes.',
    fr: 'Rechargez-le avant d’appliquer vos modifications.',
  },
  'account.profile.reload': { en: 'Reload profile', fr: 'Recharger le profil' },
  'account.profile.save': { en: 'Save changes', fr: 'Enregistrer les modifications' },
  'account.profile.saved': {
    en: 'Your changes were saved.',
    fr: 'Vos modifications ont été enregistrées.',
  },
  'account.profile.loadError': {
    en: 'We could not load your account. Please try again.',
    fr: 'Impossible de charger votre compte. Veuillez réessayer.',
  },
  'account.profile.saveError': {
    en: 'We could not save your changes. Please try again.',
    fr: 'Impossible d’enregistrer vos modifications. Veuillez réessayer.',
  },
  'account.profile.validationError': {
    en: 'Please check the highlighted fields and try again.',
    fr: 'Vérifiez les champs signalés et réessayez.',
  },
  'account.profile.reloadError': {
    en: 'We could not reload your account.',
    fr: 'Impossible de recharger votre compte.',
  },
  'account.profile.currentAccess': { en: 'Current access', fr: 'Accès actuel' },
  'account.profile.noRole': { en: 'No role assigned', fr: 'Aucun rôle attribué' },
  'account.profile.primaryRole': { en: 'Primary role', fr: 'Rôle principal' },
  'account.profile.workspace': { en: 'Workspace', fr: 'Espace de travail' },
  'account.profile.territoryScope': { en: 'Territory scope', fr: 'Périmètre territorial' },
  'account.profile.permissionSummary': { en: 'Permission summary', fr: 'Résumé des permissions' },
  'account.profile.additionalGrants': {
    en: 'Additional grants',
    fr: 'Autorisations supplémentaires',
  },
  'account.profile.memberships': { en: 'Workspace memberships', fr: 'Appartenances aux espaces' },
  'account.profile.noOtherWorkspaces': {
    en: 'You have no other active workspaces.',
    fr: 'Vous n’avez aucun autre espace de travail actif.',
  },
  'account.profile.active': { en: 'Active', fr: 'Actif' },
  'account.profile.open': { en: 'Open', fr: 'Ouvrir' },
  'account.profile.membershipsHint': {
    en: 'Only active workspaces appear here. Pending invitations are accepted from the link in your email.',
    fr: 'Seuls les espaces actifs apparaissent ici. Les invitations en attente s’acceptent depuis le lien reçu par e-mail.',
  },
  'account.profile.loading': { en: 'Loading your account…', fr: 'Chargement de votre compte…' },
  'account.workspaceSwitched': { en: 'Workspace switched.', fr: 'Espace de travail changé.' },
  'account.preferences.interface': { en: 'Interface preferences', fr: 'Préférences d’interface' },
  'account.preferences.loadError': {
    en: 'We could not load your preferences.',
    fr: 'Impossible de charger vos préférences.',
  },
  'account.preferences.saved': {
    en: 'Your preferences were saved.',
    fr: 'Vos préférences ont été enregistrées.',
  },
  'account.preferences.conflict': {
    en: 'These preferences changed somewhere else. Reload the page and try again.',
    fr: 'Ces préférences ont été modifiées ailleurs. Rechargez la page et réessayez.',
  },
  'account.preferences.saveError': {
    en: 'We could not save your preferences. Please try again.',
    fr: 'Impossible d’enregistrer vos préférences. Veuillez réessayer.',
  },
  'account.preferences.theme': { en: 'Theme', fr: 'Thème' },
  'account.preferences.system': { en: 'Match system', fr: 'Selon le système' },
  'account.preferences.light': { en: 'Light', fr: 'Clair' },
  'account.preferences.dark': { en: 'Dark', fr: 'Sombre' },
  'account.preferences.density': { en: 'Density', fr: 'Densité' },
  'account.preferences.comfortable': { en: 'Comfortable', fr: 'Confortable' },
  'account.preferences.compact': { en: 'Compact', fr: 'Compacte' },
  'account.preferences.accessibility': { en: 'Accessibility', fr: 'Accessibilité' },
  'account.preferences.reduceMotion': { en: 'Reduce motion', fr: 'Réduire les animations' },
  'account.preferences.increaseContrast': { en: 'Increase contrast', fr: 'Augmenter le contraste' },
  'account.preferences.save': { en: 'Save preferences', fr: 'Enregistrer les préférences' },
  'account.preferences.contactSafety': { en: 'Contact safety', fr: 'Sécurité des contacts' },
  'account.preferences.contactSafetyBody': {
    en: 'Reservation, collision and consent rules are checked by the server before contact actions. Notification preferences do not grant permission to contact a prospect.',
    fr: 'Les règles de réservation, de conflit et de consentement sont vérifiées par le serveur avant toute action de contact. Les préférences de notification n’autorisent pas le contact d’un prospect.',
  },
  'account.notifications.title': {
    en: 'What we notify you about',
    fr: 'Ce pour quoi nous vous notifions',
  },
  'account.notifications.loadError': {
    en: 'We could not load your notification preferences.',
    fr: 'Impossible de charger vos préférences de notification.',
  },
  'account.notifications.saved': {
    en: 'Notification preferences saved.',
    fr: 'Préférences de notification enregistrées.',
  },
  'account.notifications.saveError': {
    en: 'We could not save your preferences. Please try again.',
    fr: 'Impossible d’enregistrer vos préférences. Veuillez réessayer.',
  },
  'account.notifications.event': { en: 'Event', fr: 'Événement' },
  'account.notifications.save': { en: 'Save preferences', fr: 'Enregistrer les préférences' },
  'account.notifications.discard': { en: 'Discard changes', fr: 'Annuler les modifications' },
  'account.notifications.note': {
    en: 'A channel you have never set stays on. Critical collision alerts always stay in the in-app inbox. Push also needs a registered device.',
    fr: 'Un canal jamais configuré reste activé. Les alertes critiques de conflit restent toujours dans la boîte de réception. Les notifications push nécessitent aussi un appareil enregistré.',
  },
  'account.security.status': { en: 'Security status', fr: 'État de la sécurité' },
  'account.security.resetError': {
    en: 'We could not send the reset email. Please try again.',
    fr: 'Impossible d’envoyer l’e-mail de réinitialisation. Veuillez réessayer.',
  },
  'account.security.password': { en: 'Password', fr: 'Mot de passe' },
  'account.security.passwordValue': {
    en: 'Change by email link',
    fr: 'Modifier via un lien e-mail',
  },
  'account.security.passwordDetail': {
    en: 'A signed link is sent to your work address.',
    fr: 'Un lien signé est envoyé à votre adresse professionnelle.',
  },
  'account.security.sessions': { en: 'Active sessions', fr: 'Sessions actives' },
  'account.security.sessionsUnavailable': { en: 'Unavailable', fr: 'Indisponibles' },
  'account.security.sessionCount': { en: '{count} session(s)', fr: '{count} session(s)' },
  'account.security.workspaceOnly': { en: 'In this workspace.', fr: 'Dans cet espace de travail.' },
  'account.security.checkInbox': {
    en: 'Check your inbox',
    fr: 'Consultez votre boîte de réception',
  },
  'account.security.resetSent': {
    en: 'If an account exists for this email, a reset link is on its way. It expires in 30 minutes.',
    fr: 'Si un compte existe pour cette adresse, un lien de réinitialisation est en route. Il expire dans 30 minutes.',
  },
  'account.security.sendReset': {
    en: 'Send password reset link',
    fr: 'Envoyer le lien de réinitialisation',
  },
  'account.security.mfa': {
    en: 'Multi-factor authentication',
    fr: 'Authentification multifacteur',
  },
  'account.security.authenticator': {
    en: 'Authenticator app',
    fr: 'Application d’authentification',
  },
  'account.security.mfaBody': {
    en: 'Enrolment and recovery codes are handled during sign-in, and step-up authentication is required to change them.',
    fr: 'L’inscription et les codes de récupération sont gérés lors de la connexion ; une authentification renforcée est requise pour les modifier.',
  },
  'account.security.mfaUnavailable': {
    en: 'Enrolment status is not readable yet.',
    fr: 'L’état d’inscription n’est pas encore disponible.',
  },
  'account.security.mfaUnavailableBody': {
    en: 'GET /me does not return MFA state, so this screen cannot show whether your account is enrolled or offer a disable action.',
    fr: 'GET /me ne renvoie pas l’état MFA ; cet écran ne peut donc pas indiquer si votre compte est inscrit ni proposer sa désactivation.',
  },
  'account.sessions.signOutOthers': {
    en: 'Sign out other sessions',
    fr: 'Déconnecter les autres sessions',
  },
  'account.sessions.title': { en: 'Active sessions', fr: 'Sessions actives' },
  'account.sessions.loadError': {
    en: 'We could not load your sessions. Please try again.',
    fr: 'Impossible de charger vos sessions. Veuillez réessayer.',
  },
  'account.sessions.revokeError': {
    en: 'We could not revoke that session. Please try again.',
    fr: 'Impossible de révoquer cette session. Veuillez réessayer.',
  },
  'account.sessions.revokeOthersError': {
    en: 'We could not revoke the other sessions. Please try again.',
    fr: 'Impossible de révoquer les autres sessions. Veuillez réessayer.',
  },
  'account.sessions.none': {
    en: 'No active sessions in this workspace.',
    fr: 'Aucune session active dans cet espace de travail.',
  },
  'account.sessions.signedIn': { en: 'Signed in {date}', fr: 'Connecté le {date}' },
  'account.sessions.expires': { en: 'Expires {date}', fr: 'Expire le {date}' },
  'account.sessions.thisDevice': { en: 'This device', fr: 'Cet appareil' },
  'account.sessions.signOut': { en: 'Sign out', fr: 'Déconnecter' },
  'account.sessions.signedOut': {
    en: 'That session was signed out.',
    fr: 'Cette session a été déconnectée.',
  },
  'account.sessions.noOthers': {
    en: 'There were no other sessions to sign out.',
    fr: 'Aucune autre session à déconnecter.',
  },
  'account.sessions.signedOutOthers': {
    en: 'Signed out {count} other session(s).',
    fr: '{count} autre(s) session(s) déconnectée(s).',
  },
  'account.sessions.workspaceNote': {
    en: 'Sessions are listed for this workspace only. Signing out a session takes effect immediately and is recorded in the audit log.',
    fr: 'Les sessions affichées concernent uniquement cet espace. La déconnexion prend effet immédiatement et est inscrite dans le journal d’audit.',
  },
  'account.security.passwordSection': { en: 'Password', fr: 'Mot de passe' },
  /* ---------- director ---------- */
  'director.companies.title': { en: 'Companies', fr: 'Entreprises' },
  'director.companies.subtitle': {
    en: 'Organization-wide read-only view · coordination stays with workspace administrators',
    fr: 'Vue en lecture seule à l’échelle de l’organisation · la coordination reste gérée par les administrateurs',
  },
  'director.refresh': { en: 'Refresh', fr: 'Actualiser' },
  'director.companies.unavailable': {
    en: 'Companies unavailable',
    fr: 'Entreprises indisponibles',
  },
  'director.companies.inScope': { en: 'Companies in scope', fr: 'Entreprises dans le périmètre' },
  'director.campaignsLinked': { en: 'Campaigns linked', fr: 'Campagnes liées' },
  'director.activeCompanies': { en: 'Active companies', fr: 'Entreprises actives' },
  'director.status': { en: 'Status', fr: 'Statut' },
  'director.active': { en: 'Active', fr: 'Actif' },
  'director.inactive': { en: 'Inactive', fr: 'Inactif' },
  'director.all': { en: 'All', fr: 'Toutes' },
  'director.searchCompanies': { en: 'Search companies', fr: 'Rechercher une entreprise' },
  'director.searchCompanyPlaceholder': {
    en: 'Search company name or slug…',
    fr: 'Rechercher un nom ou un identifiant…',
  },
  'director.noCompanies': {
    en: 'No companies match this scope.',
    fr: 'Aucune entreprise ne correspond à ce périmètre.',
  },
  'director.company': { en: 'Company', fr: 'Entreprise' },
  'director.campaigns': { en: 'Campaigns', fr: 'Campagnes' },
  'director.website': { en: 'Website', fr: 'Site web' },
  'director.details': { en: 'Details', fr: 'Détails' },
  'director.companyDetail': { en: 'Company detail', fr: 'Détail de l’entreprise' },
  'director.loadingCompany': {
    en: 'Loading company detail…',
    fr: 'Chargement du détail de l’entreprise…',
  },
  'director.companyProfile': { en: 'Company profile', fr: 'Profil de l’entreprise' },
  'director.openDetail': { en: 'Open detail', fr: 'Ouvrir le détail' },
  'director.name': { en: 'Name', fr: 'Nom' },
  'director.address': { en: 'Address', fr: 'Adresse' },
  'director.noCampaigns': {
    en: 'No campaigns in the authorized scope.',
    fr: 'Aucune campagne dans le périmètre autorisé.',
  },
  'director.readOnlyNotice': {
    en: 'Director access is read-only. Changes to company profiles and coordination policies remain in the administrator workspace.',
    fr: 'L’accès directeur est en lecture seule. Les modifications des profils d’entreprise et des règles de coordination restent dans l’espace administrateur.',
  },
  'director.backCompanies': { en: 'Back to companies', fr: 'Retour aux entreprises' },
  'director.directorReadOnly': {
    en: 'Director read-only view',
    fr: 'Vue directeur en lecture seule',
  },
  'director.email': { en: 'E-mail', fr: 'E-mail' },
  'director.phone': { en: 'Phone', fr: 'Téléphone' },
  'director.campaignsInScope': { en: 'Campaigns in scope', fr: 'Campagnes dans le périmètre' },
  'director.noDescription': { en: 'No description', fr: 'Aucune description' },
  'director.teams.title': { en: 'Teams', fr: 'Équipes' },
  'director.teams.subtitle': {
    en: 'Organization-wide team capacity and workload · read-only',
    fr: 'Capacité et charge des équipes à l’échelle de l’organisation · lecture seule',
  },
  'director.team': { en: 'Team', fr: 'Équipe' },
  'director.organization': { en: 'Organization', fr: 'Organisation' },
  'director.members': { en: 'Members', fr: 'Membres' },
  'director.assignedProspects': { en: 'Assigned prospects', fr: 'Prospects attribués' },
  'director.paused': { en: 'Paused', fr: 'En pause' },
  'director.loadingCapacity': {
    en: 'Loading team capacity…',
    fr: 'Chargement de la capacité des équipes…',
  },
  'director.readOnlyAccess': {
    en: 'Read-only director access',
    fr: 'Accès directeur en lecture seule',
  },
  'director.teamsNotice': {
    en: 'Team membership, capacity targets and assignments are managed by authorized administrators and managers. This view reflects the live team APIs.',
    fr: 'Les membres, objectifs de capacité et attributions sont gérés par les administrateurs et managers autorisés. Cette vue reflète les API en direct.',
  },
  'director.scopeError': {
    en: 'Your director grant does not include this scope.',
    fr: 'Votre autorisation directeur ne couvre pas ce périmètre.',
  },
  'director.loadCompaniesError': {
    en: 'We could not load companies.',
    fr: 'Impossible de charger les entreprises.',
  },
  'director.loadCompanyError': {
    en: 'We could not load this company.',
    fr: 'Impossible de charger cette entreprise.',
  },
  'director.loadTeamsError': {
    en: 'We could not load teams.',
    fr: 'Impossible de charger les équipes.',
  },
  'director.campaignAuthorityError': {
    en: 'You do not hold director campaign authority for this scope.',
    fr: 'Vous ne disposez pas de l’autorisation directeur pour les campagnes de ce périmètre.',
  },
  'director.loadCampaignsError': {
    en: 'We could not load campaigns.',
    fr: 'Impossible de charger les campagnes.',
  },
  'director.campaignPerformance': { en: 'Campaign Performance', fr: 'Performance des campagnes' },
  'director.campaignSubtitle': {
    en: 'Comparative activity and conversion · last 90 days',
    fr: 'Activité et conversion comparées · 90 derniers jours',
  },
  'director.exportComparison': { en: 'Export comparison', fr: 'Exporter la comparaison' },
  'director.detailedComparison': { en: 'Detailed comparison', fr: 'Comparaison détaillée' },
  'director.campaign': { en: 'Campaign', fr: 'Campagne' },
  'director.prospects': { en: 'Prospects', fr: 'Prospects' },
  'director.actions': { en: 'Actions', fr: 'Actions' },
  'director.contacts': { en: 'Contacts', fr: 'Contacts' },
  'director.qualified': { en: 'Qualified', fr: 'Qualifiés' },
  'director.conversion': { en: 'Conversion', fr: 'Conversion' },
  'director.progress': { en: 'Progress', fr: 'Progression' },
  'director.progressNoticeTitle': {
    en: 'Progress targets and remaining prospects are not returned by the API.',
    fr: 'Les objectifs de progression et les prospects restants ne sont pas renvoyés par l’API.',
  },
  'director.progressNoticeBody': {
    en: 'The table uses live campaign, actions, conversions and coverage reports. A dedicated campaign-comparison endpoint is still needed for the grouped chart, target progress and remaining counts shown in the reference.',
    fr: 'Le tableau utilise les rapports en direct des campagnes, actions, conversions et couverture. Une API dédiée de comparaison reste nécessaire pour le graphique groupé, les objectifs et les volumes restants du modèle.',
  },
  'director.performanceTitle': { en: 'Team Performance', fr: 'Performance de l’équipe' },
  'director.performanceSubtitle': {
    en: 'Comparative execution and conversion · selected period',
    fr: 'Exécution et conversion comparées · période sélectionnée',
  },
  'director.period': { en: 'Period', fr: 'Période' },
  'director.last7': { en: 'Last 7 days', fr: '7 derniers jours' },
  'director.last30': { en: 'Last 30 days', fr: '30 derniers jours' },
  'director.last90': { en: 'Last 90 days', fr: '90 derniers jours' },
  'director.prospectorPerformance': {
    en: 'Prospector performance',
    fr: 'Performance des prospecteurs',
  },
  'director.noProspectors': {
    en: 'No prospectors returned in this scope.',
    fr: 'Aucun prospecteur dans ce périmètre.',
  },
  'director.teamMember': { en: 'Team / member', fr: 'Équipe / membre' },
  'director.openFollowUps': { en: 'Open follow-ups', fr: 'Relances ouvertes' },
  'director.overdue': { en: 'Overdue', fr: 'En retard' },
  'director.lateCompleted': { en: 'Late completed', fr: 'Terminées en retard' },
  'director.needsAttention': { en: 'Needs attention', fr: 'À surveiller' },
  'director.onTrack': { en: 'On track', fr: 'Dans les temps' },
  'director.performanceAuthorityError': {
    en: 'You do not hold director reporting authority for this scope.',
    fr: 'Vous ne disposez pas de l’autorisation directeur pour les rapports de ce périmètre.',
  },
  'director.loadPerformanceError': {
    en: 'We could not load team performance.',
    fr: 'Impossible de charger la performance de l’équipe.',
  },
  'director.additionalFieldsTitle': {
    en: 'Additional comparison fields are not exposed yet.',
    fr: 'Certains champs de comparaison ne sont pas encore disponibles.',
  },
  'director.additionalFieldsBody': {
    en: 'The director API currently provides assignments, actions and follow-up workload per prospector. Contacts, opportunities, conversion rate and on-time follow-ups require a team-performance aggregation endpoint before they can be shown accurately.',
    fr: 'L’API directeur fournit actuellement les attributions, actions et charges de relance par prospecteur. Les contacts, opportunités, taux de conversion et relances à l’heure nécessitent une API d’agrégation de performance avant d’être affichés avec fiabilité.',
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
  'common.unreadMessages': { en: '{count} unread messages', fr: '{count} messages non lus' },
  'common.accountMenu': { en: 'Account menu', fr: 'Menu du compte' },
  'common.account': { en: 'Account', fr: 'Compte' },
  'common.availableWorkspaces': {
    en: 'Available workspaces',
    fr: 'Espaces de travail disponibles',
  },
  'common.availableRoles': { en: 'Available workspace roles', fr: 'Rôles disponibles' },
  'common.loadingWorkspace': {
    en: 'Loading your workspace…',
    fr: 'Chargement de votre espace de travail…',
  },
  'common.loadingWorkspaces': {
    en: 'Loading workspaces…',
    fr: 'Chargement des espaces de travail…',
  },
  'common.current': { en: 'Current', fr: 'Actuel' },
  'common.open': { en: 'Open', fr: 'Ouvrir' },
  'common.noActiveWorkspaces': {
    en: 'No active workspaces are available.',
    fr: 'Aucun espace de travail actif n’est disponible.',
  },
  'common.noWorkspaceAccess': {
    en: 'No workspace access',
    fr: 'Aucun accès à un espace de travail',
  },
  'common.noWorkspaceAccessHint': {
    en: 'Your account is signed in, but it has no active role grant. Ask an administrator to restore access.',
    fr: 'Votre compte est connecté, mais aucun rôle actif ne lui est attribué. Demandez à un administrateur de rétablir votre accès.',
  },
  'common.notificationsUnread': {
    en: 'Notifications, {count} unread',
    fr: 'Notifications, {count} non lues',
  },
  'common.closeNotifications': {
    en: 'Close notifications',
    fr: 'Fermer les notifications',
  },
  'common.markAllRead': { en: 'Mark all read', fr: 'Tout marquer comme lu' },
  'common.viewAll': { en: 'View all', fr: 'Tout afficher' },
  'common.nothingToCatchUp': {
    en: 'Nothing to catch up on.',
    fr: 'Aucune notification à rattraper.',
  },
  'common.sessionExpired': {
    en: 'Your session has expired. Please sign in again.',
    fr: 'Votre session a expiré. Veuillez vous reconnecter.',
  },
  'common.loadWorkspacesError': {
    en: 'We could not load your workspaces. Please try again.',
    fr: 'Impossible de charger vos espaces de travail. Veuillez réessayer.',
  },
  'common.switchWorkspaceError': {
    en: 'We could not switch workspace. Please try again.',
    fr: 'Impossible de changer d’espace de travail. Veuillez réessayer.',
  },
  'common.sessionRestoreError': {
    en: 'We could not restore your session.',
    fr: 'Impossible de restaurer votre session.',
  },
  'common.connectionRetry': {
    en: 'Check your connection and try again.',
    fr: 'Vérifiez votre connexion et réessayez.',
  },

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
  'today.empty': { en: 'No follow-ups due today', fr: 'Aucune relance prévue aujourd’hui' },
  'today.emptyBody': {
    en: 'You can continue with your assigned prospects above.',
    fr: 'Vous pouvez poursuivre avec les établissements attribués ci-dessus.',
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
  'actions.tab.review': { en: 'Manager review', fr: 'Validation manager' },
  'actions.tab.overdue': { en: 'Overdue', fr: 'En retard' },
  'actions.truncated': {
    en: 'Showing your first 100 follow-ups; groups describe those.',
    fr: 'Vos 100 premières relances sont affichées ; les groupes portent sur celles-ci.',
  },
  'actions.tab.today': { en: 'Today', fr: "Aujourd'hui" },
  'actions.tab.upcoming': { en: 'Upcoming', fr: 'À venir' },
  'actions.appointment': { en: 'Appointment', fr: 'Rendez-vous' },
  'actions.reschedule': { en: 'Reschedule', fr: 'Reporter' },
  'actions.reschedule.title': { en: 'Reschedule follow-up', fr: 'Reporter la relance' },
  'actions.reschedule.current': { en: 'Currently due', fr: 'Échéance actuelle' },
  'actions.reschedule.newDate': { en: 'New date', fr: 'Nouvelle date' },
  'actions.reschedule.newTime': { en: 'New time', fr: 'Nouvelle heure' },
  'actions.reschedule.confirm': { en: 'Confirm', fr: 'Confirmer' },
  'actions.reschedule.requestReview': {
    en: 'Request manager review',
    fr: 'Demander une validation au manager',
  },
  'actions.reschedule.overdueWarning': {
    en: 'This follow-up is overdue and cannot be rescheduled directly. Explain what happened and a manager must approve the new date.',
    fr: 'Cette relance est en retard et ne peut pas être reportée directement. Expliquez ce qui s’est passé ; un manager doit valider la nouvelle date.',
  },
  'actions.reschedule.missedReason': {
    en: 'Why was this follow-up missed?',
    fr: 'Pourquoi cette relance a-t-elle été manquée ?',
  },
  'actions.reschedule.missedReasonHint': {
    en: 'Add the context a manager needs to review the missed follow-up.',
    fr: 'Ajoutez le contexte nécessaire à la validation par le manager.',
  },
  'actions.reschedule.reviewRequested': {
    en: 'Review requested. Your manager must approve the new date before it is scheduled.',
    fr: 'Demande envoyée. Votre manager doit valider la nouvelle date avant sa planification.',
  },
  'actions.reschedule.reasonRequired': {
    en: 'Explain why the follow-up was missed before requesting review.',
    fr: 'Expliquez pourquoi la relance a été manquée avant de demander une validation.',
  },
  'actions.reschedule.failed': {
    en: 'The follow-up could not be rescheduled. Its current date is unchanged.',
    fr: 'La relance n’a pas pu être reportée. Son échéance actuelle est inchangée.',
  },
  'actions.empty.overdue': { en: 'No overdue follow-ups.', fr: 'Aucune relance en retard.' },
  'actions.empty.review': {
    en: 'No follow-ups are waiting for manager review.',
    fr: 'Aucune relance n’attend une validation manager.',
  },
  'actions.empty.today': { en: 'Nothing else due today.', fr: "Rien d'autre pour aujourd'hui." },
  'actions.empty.upcoming': { en: 'No upcoming follow-ups.', fr: 'Aucune relance à venir.' },
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
  'actions.status.review': { en: 'Under review', fr: 'En validation' },

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

  /* ---------- campaign enrolment (TR-925) ---------- */
  'enrol.title': { en: 'Campaign enrolment', fr: 'Ajout à la campagne' },
  'enrol.subtitle': {
    en: 'Add establishments from the shared base to a campaign so they can be dispatched',
    fr: 'Ajoutez des établissements de la base partagée à une campagne pour pouvoir les attribuer',
  },
  'enrol.step.select': { en: '1. Choose the establishments', fr: '1. Choisir les établissements' },
  'enrol.step.enrol': { en: '2. Add them to the campaign', fr: '2. Les ajouter à la campagne' },
  'enrol.step.dispatch': {
    en: '3. Assign them to prospectors',
    fr: '3. Les attribuer aux prospecteurs',
  },
  'enrol.campaign': { en: 'Campaign', fr: 'Campagne' },
  'enrol.campaign.none': { en: 'No campaign available', fr: 'Aucune campagne disponible' },
  'enrol.section': { en: 'Section', fr: 'Section' },
  'enrol.section.all': { en: 'All sections', fr: 'Toutes les sections' },
  'enrol.department': { en: 'Department', fr: 'Département' },
  'enrol.department.hint': {
    en: 'Two digits, or three overseas (974)',
    fr: 'Deux chiffres, ou trois en outre-mer (974)',
  },
  'enrol.city': { en: 'City', fr: 'Commune' },
  'enrol.search': { en: 'Name, address or postcode', fr: 'Nom, adresse ou code postal' },
  /* The API refuses an empty selection; this is why, said before it is refused. */
  'enrol.selectionRequired': {
    en: 'Select at least one criterion to define which establishments are added to the campaign.',
    fr: 'Sélectionnez au moins un critère pour définir les établissements à ajouter à la campagne.',
  },
  'enrol.preview': { en: 'Check the selection', fr: 'Vérifier la sélection' },
  'enrol.previewing': { en: 'Checking…', fr: 'Vérification…' },
  'enrol.apply': { en: 'Add to the campaign', fr: 'Ajouter à la campagne' },
  'enrol.applying': { en: 'Adding…', fr: 'Ajout en cours…' },
  'enrol.matched': { en: 'Matching establishments', fr: 'Établissements correspondants' },
  'enrol.enrollable': { en: 'To be added', fr: 'À ajouter' },
  'enrol.enrolled': { en: 'Added', fr: 'Ajoutés' },
  'enrol.alreadyActive': { en: 'Already in the campaign', fr: 'Déjà dans la campagne' },
  'enrol.alreadyExcluded': { en: 'Excluded, left as is', fr: 'Exclus, conservés tels quels' },
  'enrol.truncated': {
    en: '{matched} match and {selected} were taken. Narrow the selection or run it again to continue.',
    fr: '{matched} correspondent et {selected} ont été pris en compte. Affinez la sélection ou relancez pour continuer.',
  },
  'enrol.nothingToAdd': {
    en: 'Nothing to add: every matching establishment is already in this campaign.',
    fr: 'Rien à ajouter : tous les établissements correspondants sont déjà dans cette campagne.',
  },
  'enrol.excludedKept': {
    en: 'Establishments excluded from this campaign stay excluded. Reactivate them one at a time if that was a mistake.',
    fr: 'Les établissements exclus de cette campagne restent exclus. Réactivez-les un par un si c’est une erreur.',
  },
  'enrol.noMatches': {
    en: 'No establishment in the shared base matches these criteria.',
    fr: 'Aucun établissement de la base partagée ne correspond à ces critères.',
  },
  'enrol.queue.title': { en: 'Ready to assign', fr: 'Prêts à être attribués' },
  'enrol.queue.explain': {
    en: 'The same criteria, now read from the campaign. These are the prospects nobody owns yet.',
    fr: 'Les mêmes critères, appliqués à la campagne. Voici les prospects que personne ne suit encore.',
  },
  'enrol.queue.empty': {
    en: 'No unassigned prospect matches these criteria in this campaign.',
    fr: 'Aucun prospect non attribué ne correspond à ces critères dans cette campagne.',
  },
  'enrol.queue.opposition': { en: 'Opposition', fr: 'Opposition' },
  'enrol.queue.elsewhere': { en: 'Active elsewhere', fr: 'Suivi ailleurs' },
  'enrol.goAssign': { en: 'Go to assignments', fr: 'Aller aux attributions' },
  'enrol.assignHint': {
    en: 'Assigning prospects to a prospector is done from a team workspace.',
    fr: 'L’attribution des prospects à un prospecteur se fait depuis un espace d’équipe.',
  },
} as const satisfies Record<string, Entry>;

export type MessageKey = keyof typeof DICTIONARY;

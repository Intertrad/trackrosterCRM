import type { WorkspaceModule } from './types';

export const WORKSPACE_MODULES: WorkspaceModule[] = [
  {
    id: 'organizations',
    title: {
      en: 'Organizations',
      fr: 'Organisations',
    },
    description: {
      en: 'Manage the organizations sharing this workspace.',
      fr: 'Gérez les organisations de cet espace.',
    },
    read: 'GET /organizations',
    columns: ['name', 'slug', 'status', 'updatedAt'],
    roles: ['admin', 'director', 'manager', 'prospector', 'observer'],
    actions: [
      {
        operation: 'POST /organizations',
        label: {
          en: 'Create',
          fr: 'Créer',
        },
        scope: 'collection',
        roles: ['admin'],
      },
      {
        operation: 'PATCH /organizations/:organizationId',
        label: {
          en: 'Edit',
          fr: 'Modifier',
        },
        scope: 'record',
        roles: ['admin'],
      },
      {
        operation: 'DELETE /organizations/:organizationId',
        label: {
          en: 'Deactivate',
          fr: 'Désactiver',
        },
        scope: 'record',
        danger: true,
        roles: ['admin'],
      },
    ],
    section: {
      en: 'Workspace setup',
      fr: 'Configuration',
    },
    detail: 'GET /organizations/:organizationId',
    idParam: 'organizationId',
  },
  {
    id: 'teams',
    title: {
      en: 'Teams & capacity',
      fr: 'Équipes et capacité',
    },
    description: {
      en: 'Build teams and control their assignment capacity.',
      fr: 'Configurez les équipes et leur capacité.',
    },
    read: 'GET /teams',
    columns: ['name', 'capacity', 'status', 'managerMembershipId'],
    roles: ['admin', 'director', 'manager'],
    actions: [
      {
        operation: 'POST /teams',
        label: {
          en: 'Create',
          fr: 'Créer',
        },
        scope: 'collection',
        roles: ['admin'],
      },
      {
        operation: 'PATCH /teams/:teamId',
        label: {
          en: 'Edit',
          fr: 'Modifier',
        },
        scope: 'record',
        roles: ['admin', 'director', 'manager'],
      },
      {
        operation: 'DELETE /teams/:teamId',
        label: {
          en: 'Deactivate',
          fr: 'Désactiver',
        },
        scope: 'record',
        danger: true,
        roles: ['admin', 'director', 'manager'],
      },
    ],
    section: {
      en: 'Workspace setup',
      fr: 'Configuration',
    },
    detail: 'GET /teams/:teamId',
    idParam: 'teamId',
    related: [
      {
        operation: 'GET /teams/:teamId/capacity',
        label: {
          en: 'Capacity',
          fr: 'Capacité',
        },
      },
      {
        operation: 'GET /teams/:teamId/members',
        label: {
          en: 'Members',
          fr: 'Membres',
        },
      },
    ],
  },
  {
    id: 'relationships',
    title: {
      en: 'Organization relationships',
      fr: 'Relations entre organisations',
    },
    description: {
      en: 'Define parent, partner, brand and coordination relationships.',
      fr: 'Définissez les relations de groupe, partenariat et coordination.',
    },
    read: 'GET /organization-relationships',
    columns: ['relationshipType', 'parentOrganizationId', 'childOrganizationId', 'startsAt'],
    roles: ['admin', 'director', 'manager'],
    actions: [
      {
        operation: 'POST /organization-relationships',
        label: {
          en: 'Add relationship',
          fr: 'Ajouter une relation',
        },
        scope: 'collection',
        roles: ['admin'],
      },
      {
        operation: 'DELETE /organization-relationships/:id',
        label: {
          en: 'End relationship',
          fr: 'Terminer la relation',
        },
        scope: 'record',
        danger: true,
        roles: ['admin'],
      },
    ],
    section: {
      en: 'Workspace setup',
      fr: 'Configuration',
    },
    idParam: 'id',
  },
  {
    id: 'team-members',
    title: {
      en: 'Team membership',
      fr: 'Membres des équipes',
    },
    description: {
      en: 'Choose a team to manage its roster and membership periods.',
      fr: 'Choisissez une équipe pour gérer ses membres et leurs périodes.',
    },
    read: 'GET /teams/:teamId/members',
    columns: ['membershipId', 'teamRole', 'state', 'startsAt', 'endsAt'],
    roles: ['admin', 'director', 'manager'],
    actions: [
      {
        operation: 'POST /teams/:teamId/members',
        label: {
          en: 'Create',
          fr: 'Créer',
        },
        scope: 'collection',
        roles: ['admin', 'director', 'manager'],
      },
      {
        operation: 'PATCH /teams/:teamId/members/:membershipId',
        label: {
          en: 'Edit',
          fr: 'Modifier',
        },
        scope: 'record',
        roles: ['admin', 'director', 'manager'],
      },
      {
        operation: 'DELETE /teams/:teamId/members/:membershipId',
        label: {
          en: 'Remove',
          fr: 'Retirer',
        },
        scope: 'record',
        danger: true,
        roles: ['admin', 'director', 'manager'],
      },
    ],
    section: {
      en: 'Workspace setup',
      fr: 'Configuration',
    },
    idParam: 'membershipId',
  },
  {
    id: 'territories',
    title: {
      en: 'Territories',
      fr: 'Territoires',
    },
    description: {
      en: 'Define geographic coverage and campaign boundaries.',
      fr: 'Définissez la couverture géographique des campagnes.',
    },
    read: 'GET /territories',
    columns: ['name', 'code', 'status', 'parentId'],
    roles: ['admin', 'director', 'manager'],
    actions: [
      {
        operation: 'POST /territories',
        label: {
          en: 'Create',
          fr: 'Créer',
        },
        scope: 'collection',
        roles: ['admin'],
      },
      {
        operation: 'PATCH /territories/:territoryId',
        label: {
          en: 'Edit',
          fr: 'Modifier',
        },
        scope: 'record',
        roles: ['admin', 'director', 'manager'],
      },
      {
        operation: 'DELETE /territories/:territoryId',
        label: {
          en: 'Remove',
          fr: 'Retirer',
        },
        scope: 'record',
        danger: true,
        roles: ['admin', 'director', 'manager'],
      },
    ],
    section: {
      en: 'Workspace setup',
      fr: 'Configuration',
    },
    detail: 'GET /territories/:territoryId',
    idParam: 'territoryId',
  },
  {
    id: 'territory-assignments',
    title: {
      en: 'Territory coverage',
      fr: 'Couverture des territoires',
    },
    description: {
      en: 'Assign territories to teams or individual members.',
      fr: 'Attribuez les territoires aux équipes ou à leurs membres.',
    },
    read: 'GET /territory-assignments',
    columns: ['territoryId', 'teamId', 'membershipId', 'priority', 'startsAt', 'endsAt'],
    roles: ['admin', 'director', 'manager'],
    actions: [
      {
        operation: 'POST /territory-assignments',
        label: {
          en: 'Create',
          fr: 'Créer',
        },
        scope: 'collection',
        roles: ['admin', 'director', 'manager'],
      },
      {
        operation: 'PATCH /territory-assignments/:id',
        label: {
          en: 'Edit',
          fr: 'Modifier',
        },
        scope: 'record',
        roles: ['admin', 'director', 'manager'],
      },
      {
        operation: 'DELETE /territory-assignments/:id',
        label: {
          en: 'Remove',
          fr: 'Retirer',
        },
        scope: 'record',
        danger: true,
        roles: ['admin', 'director', 'manager'],
      },
    ],
    section: {
      en: 'Workspace setup',
      fr: 'Configuration',
    },
    idParam: 'id',
  },
  {
    id: 'regions',
    title: {
      en: 'Regions',
      fr: 'Régions',
    },
    description: {
      en: 'Maintain the geographic reference used by prospects.',
      fr: 'Gérez le référentiel géographique des prospects.',
    },
    read: 'GET /regions',
    columns: ['name', 'code', 'status'],
    roles: ['admin', 'director', 'manager'],
    actions: [
      {
        operation: 'POST /regions',
        label: {
          en: 'Create',
          fr: 'Créer',
        },
        scope: 'collection',
        roles: ['admin', 'director', 'manager'],
      },
      {
        operation: 'PATCH /regions/:regionId',
        label: {
          en: 'Edit',
          fr: 'Modifier',
        },
        scope: 'record',
        roles: ['admin', 'director', 'manager'],
      },
    ],
    section: {
      en: 'Workspace setup',
      fr: 'Configuration',
    },
    idParam: 'regionId',
  },
  {
    id: 'objectives',
    title: {
      en: 'Objectives',
      fr: 'Objectifs',
    },
    description: {
      en: 'Set measurable goals and follow actual progress.',
      fr: 'Fixez des objectifs mesurables et suivez les résultats.',
    },
    read: 'GET /objectives',
    columns: ['name', 'metric', 'target', 'progress.status', 'progress.actual', 'endsAt'],
    roles: ['admin', 'director', 'manager'],
    actions: [
      {
        operation: 'POST /objectives',
        label: {
          en: 'Create',
          fr: 'Créer',
        },
        scope: 'collection',
        roles: ['admin', 'director', 'manager'],
      },
      {
        operation: 'PATCH /objectives/:objectiveId',
        label: {
          en: 'Edit',
          fr: 'Modifier',
        },
        scope: 'record',
        roles: ['admin', 'director', 'manager'],
      },
    ],
    section: {
      en: 'Performance',
      fr: 'Performance',
    },
    detail: 'GET /objectives/:objectiveId',
    idParam: 'objectiveId',
    related: [
      {
        operation: 'GET /objectives/:objectiveId',
        label: {
          en: 'Progress & history',
          fr: 'Progression et historique',
        },
      },
    ],
  },
  {
    id: 'assignment-rules',
    title: {
      en: 'Assignment rules',
      fr: 'Règles d’attribution',
    },
    description: {
      en: 'Configure distribution strategies before applying assignments.',
      fr: 'Configurez les stratégies avant de répartir les prospects.',
    },
    read: 'GET /assignment-rules',
    columns: ['name', 'strategy', 'priority', 'isActive'],
    roles: ['admin', 'director', 'manager'],
    actions: [
      {
        operation: 'POST /assignment-rules',
        label: {
          en: 'Create',
          fr: 'Créer',
        },
        scope: 'collection',
        roles: ['admin', 'director', 'manager'],
      },
      {
        operation: 'PATCH /assignment-rules/:ruleId',
        label: {
          en: 'Edit',
          fr: 'Modifier',
        },
        scope: 'record',
        roles: ['admin', 'director', 'manager'],
      },
      {
        operation: 'DELETE /assignment-rules/:ruleId',
        label: {
          en: 'Remove',
          fr: 'Retirer',
        },
        scope: 'record',
        danger: true,
        roles: ['admin', 'director', 'manager'],
      },
      {
        operation: 'POST /assignment-rules/:ruleId/simulate',
        label: {
          en: 'Simulate',
          fr: 'Simuler',
        },
        scope: 'record',
      },
    ],
    section: {
      en: 'Coordination',
      fr: 'Coordination',
    },
    idParam: 'ruleId',
  },
  {
    id: 'assignment-suggestions',
    title: {
      en: 'Assignment suggestions',
      fr: 'Suggestions d’attribution',
    },
    description: {
      en: 'Review suggested owners before using the assignment workflow.',
      fr: 'Examinez les suggestions avant de lancer une attribution.',
    },
    read: 'GET /assignment-suggestions',
    columns: ['campaignProspectId', 'suggestedTeamId', 'reason'],
    roles: ['admin', 'director', 'manager'],
    actions: [],
    section: {
      en: 'Coordination',
      fr: 'Coordination',
    },
  },
  {
    id: 'campaign-settings',
    title: {
      en: 'Campaign settings',
      fr: 'Configuration des campagnes',
    },
    description: {
      en: 'Create campaigns and manage their lifecycle.',
      fr: 'Créez des campagnes et gérez leur cycle de vie.',
    },
    read: 'GET /campaigns',
    columns: ['name', 'status', 'startsAt', 'endsAt'],
    roles: ['admin', 'director', 'manager'],
    actions: [
      {
        operation: 'POST /campaigns',
        label: {
          en: 'Create',
          fr: 'Créer',
        },
        scope: 'collection',
        roles: ['admin', 'director', 'manager'],
      },
      {
        operation: 'PATCH /campaigns/:campaignId',
        label: {
          en: 'Edit',
          fr: 'Modifier',
        },
        scope: 'record',
        roles: ['admin', 'director', 'manager'],
      },
    ],
    section: {
      en: 'Coordination',
      fr: 'Coordination',
    },
    detail: 'GET /campaigns/:campaignId',
    idParam: 'campaignId',
    related: [
      {
        operation: 'GET /campaigns/:campaignId/organizations',
        label: {
          en: 'Organizations',
          fr: 'Organisations',
        },
      },
      {
        operation: 'GET /campaigns/:campaignId/territories',
        label: {
          en: 'Territories',
          fr: 'Territoires',
        },
      },
      {
        operation: 'GET /campaigns/:campaignId/members',
        label: {
          en: 'Members',
          fr: 'Membres',
        },
      },
    ],
  },
  {
    id: 'campaign-organizations',
    title: {
      en: 'Campaign participation',
      fr: 'Participation des organisations',
    },
    description: {
      en: 'Choose a campaign to manage participating organizations.',
      fr: 'Choisissez une campagne pour gérer les organisations participantes.',
    },
    read: 'GET /campaigns/:campaignId/organizations',
    columns: ['organizationId', 'accessMode', 'endedAt'],
    roles: ['admin', 'director', 'manager'],
    actions: [
      {
        operation: 'POST /campaigns/:campaignId/organizations',
        label: {
          en: 'Create',
          fr: 'Créer',
        },
        scope: 'collection',
        roles: ['admin', 'director', 'manager'],
      },
      {
        operation: 'PATCH /campaigns/:campaignId/organizations/:organizationId',
        label: {
          en: 'Edit',
          fr: 'Modifier',
        },
        scope: 'record',
        roles: ['admin', 'director', 'manager'],
      },
      {
        operation: 'DELETE /campaigns/:campaignId/organizations/:organizationId',
        label: {
          en: 'Remove',
          fr: 'Retirer',
        },
        scope: 'record',
        danger: true,
        roles: ['admin', 'director', 'manager'],
      },
    ],
    section: {
      en: 'Coordination',
      fr: 'Coordination',
    },
    idParam: 'organizationId',
  },
  {
    id: 'campaign-territories',
    title: {
      en: 'Campaign territories',
      fr: 'Territoires de campagne',
    },
    description: {
      en: 'Link a campaign to its coverage areas.',
      fr: 'Associez une campagne à ses zones de couverture.',
    },
    read: 'GET /campaigns/:campaignId/territories',
    columns: ['name', 'territoryId', 'code'],
    roles: ['admin', 'director', 'manager'],
    actions: [
      {
        operation: 'POST /campaigns/:campaignId/territories',
        label: {
          en: 'Create',
          fr: 'Créer',
        },
        scope: 'collection',
        roles: ['admin', 'director', 'manager'],
      },
      {
        operation: 'DELETE /campaigns/:campaignId/territories/:territoryId',
        label: {
          en: 'Remove',
          fr: 'Retirer',
        },
        scope: 'record',
        danger: true,
        roles: ['admin', 'director', 'manager'],
      },
    ],
    section: {
      en: 'Coordination',
      fr: 'Coordination',
    },
    idParam: 'territoryId',
  },
  {
    id: 'campaign-members',
    title: {
      en: 'Campaign members',
      fr: 'Membres de campagne',
    },
    description: {
      en: 'Manage campaign participation and validity periods.',
      fr: 'Gérez la participation aux campagnes et les périodes de validité.',
    },
    read: 'GET /campaigns/:campaignId/members',
    columns: ['membershipId', 'teamId', 'role', 'startsAt', 'endsAt'],
    roles: ['admin', 'director', 'manager'],
    actions: [
      {
        operation: 'POST /campaigns/:campaignId/members',
        label: {
          en: 'Add member',
          fr: 'Ajouter un membre',
        },
        scope: 'collection',
      },
      {
        operation: 'PATCH /campaign-members/:id',
        label: {
          en: 'Edit',
          fr: 'Modifier',
        },
        scope: 'record',
      },
      {
        operation: 'DELETE /campaign-members/:id',
        label: {
          en: 'Remove',
          fr: 'Retirer',
        },
        scope: 'record',
        danger: true,
      },
    ],
    section: {
      en: 'Coordination',
      fr: 'Coordination',
    },
    idParam: 'id',
  },
  {
    id: 'tags',
    title: {
      en: 'Prospect tags',
      fr: 'Étiquettes des prospects',
    },
    description: {
      en: 'Organize prospects with shared labels.',
      fr: 'Organisez les prospects avec des étiquettes communes.',
    },
    read: 'GET /tags',
    columns: ['name', 'color'],
    roles: ['admin', 'director', 'manager', 'prospector', 'observer'],
    actions: [
      {
        operation: 'POST /tags',
        label: {
          en: 'Create',
          fr: 'Créer',
        },
        scope: 'collection',
        roles: ['admin'],
      },
      {
        operation: 'PATCH /tags/:tagId',
        label: {
          en: 'Edit',
          fr: 'Modifier',
        },
        scope: 'record',
        roles: ['admin'],
      },
      {
        operation: 'DELETE /tags/:tagId',
        label: {
          en: 'Remove',
          fr: 'Retirer',
        },
        scope: 'record',
        danger: true,
        roles: ['admin'],
      },
    ],
    section: {
      en: 'Data quality',
      fr: 'Qualité des données',
    },
    idParam: 'tagId',
  },
  {
    id: 'custom-fields',
    title: {
      en: 'Custom fields',
      fr: 'Champs personnalisés',
    },
    description: {
      en: 'Define extra prospect information and who can see it.',
      fr: 'Définissez les informations complémentaires des prospects et leur visibilité.',
    },
    read: 'GET /custom-fields',
    columns: ['label', 'fieldKey', 'dataType', 'isActive'],
    roles: ['admin', 'director', 'manager', 'prospector', 'observer'],
    actions: [
      {
        operation: 'POST /custom-fields',
        label: {
          en: 'Create',
          fr: 'Créer',
        },
        scope: 'collection',
        roles: ['admin'],
      },
      {
        operation: 'PATCH /custom-fields/:fieldId',
        label: {
          en: 'Edit',
          fr: 'Modifier',
        },
        scope: 'record',
        roles: ['admin'],
      },
      {
        operation: 'DELETE /custom-fields/:fieldId',
        label: {
          en: 'Remove',
          fr: 'Retirer',
        },
        scope: 'record',
        danger: true,
        roles: ['admin'],
      },
    ],
    section: {
      en: 'Data quality',
      fr: 'Qualité des données',
    },
    idParam: 'fieldId',
  },
  {
    id: 'duplicates',
    title: {
      en: 'Duplicate review',
      fr: 'Doublons à examiner',
    },
    description: {
      en: 'Compare both prospects before recording a resolution.',
      fr: 'Comparez les deux prospects avant de résoudre le doublon.',
    },
    read: 'GET /prospect-duplicates',
    columns: ['leftProspectId', 'rightProspectId', 'matchingKeys', 'resolution'],
    roles: ['admin'],
    actions: [
      {
        operation: 'POST /prospect-duplicates/:duplicateId/resolve',
        label: {
          en: 'Resolve duplicate',
          fr: 'Résoudre le doublon',
        },
        scope: 'record',
        danger: true,
      },
    ],
    section: {
      en: 'Data quality',
      fr: 'Qualité des données',
    },
    detail: 'GET /prospect-duplicates/:duplicateId',
    idParam: 'duplicateId',
  },
  {
    id: 'data-quality',
    title: {
      en: 'Data quality',
      fr: 'Qualité des données',
    },
    description: {
      en: 'Monitor completeness and duplicate indicators.',
      fr: 'Suivez les indicateurs de complétude et de doublons.',
    },
    read: 'GET /data-quality/overview',
    columns: [],
    roles: ['admin', 'director', 'manager'],
    actions: [],
    section: {
      en: 'Data quality',
      fr: 'Qualité des données',
    },
  },
  {
    id: 'workspace-settings',
    title: {
      en: 'Workspace settings',
      fr: 'Paramètres de l’espace',
    },
    description: {
      en: 'Manage workspace identity, language and timezone.',
      fr: 'Gérez l’identité, la langue et le fuseau horaire de l’espace.',
    },
    read: 'GET /tenant',
    columns: ['name', 'slug', 'status', 'locale', 'timezone'],
    roles: ['admin'],
    actions: [
      {
        operation: 'PATCH /tenant',
        label: {
          en: 'Edit settings',
          fr: 'Modifier les paramètres',
        },
        scope: 'collection',
      },
    ],
    section: {
      en: 'Workspace setup',
      fr: 'Configuration',
    },
  },
  {
    id: 'security-policy',
    title: {
      en: 'Security policy',
      fr: 'Politique de sécurité',
    },
    description: {
      en: 'Configure sign-in requirements and session limits.',
      fr: 'Configurez les exigences de connexion et les durées de session.',
    },
    read: 'GET /settings/security',
    columns: ['requireMfa', 'passwordMinLength', 'sessionMaxHours'],
    roles: ['admin'],
    actions: [
      {
        operation: 'PATCH /settings/security',
        label: {
          en: 'Edit policy',
          fr: 'Modifier la politique',
        },
        scope: 'collection',
      },
    ],
    section: {
      en: 'Workspace setup',
      fr: 'Configuration',
    },
  },
  {
    id: 'outcomes',
    title: {
      en: 'Action outcomes',
      fr: 'Résultats des actions',
    },
    description: {
      en: 'Maintain the outcome choices used by the field team.',
      fr: 'Gérez les choix de résultats proposés aux équipes terrain.',
    },
    read: 'GET /settings/default-statuses',
    columns: [],
    roles: ['admin'],
    actions: [
      {
        operation: 'PATCH /settings/default-statuses',
        label: {
          en: 'Save outcomes',
          fr: 'Enregistrer les résultats',
        },
        scope: 'collection',
      },
    ],
    section: {
      en: 'Workspace setup',
      fr: 'Configuration',
    },
  },
  {
    id: 'saved-views',
    title: {
      en: 'Saved views',
      fr: 'Vues enregistrées',
    },
    description: {
      en: 'Save reusable filters, columns and sorting.',
      fr: 'Enregistrez les filtres, colonnes et tris à réutiliser.',
    },
    read: 'GET /saved-views',
    columns: ['name', 'resource', 'shared', 'isDefault'],
    roles: ['admin', 'director', 'manager', 'prospector', 'observer'],
    actions: [
      {
        operation: 'POST /saved-views',
        label: {
          en: 'Create',
          fr: 'Créer',
        },
        scope: 'collection',
        roles: ['admin', 'director', 'manager', 'prospector', 'observer'],
      },
      {
        operation: 'PATCH /saved-views/:viewId',
        label: {
          en: 'Edit',
          fr: 'Modifier',
        },
        scope: 'record',
        roles: ['admin', 'director', 'manager', 'prospector', 'observer'],
      },
      {
        operation: 'DELETE /saved-views/:viewId',
        label: {
          en: 'Remove',
          fr: 'Retirer',
        },
        scope: 'record',
        danger: true,
        roles: ['admin', 'director', 'manager', 'prospector', 'observer'],
      },
    ],
    section: {
      en: 'Personal workspace',
      fr: 'Espace personnel',
    },
    idParam: 'viewId',
  },
  {
    id: 'notifications',
    title: {
      en: 'Notifications',
      fr: 'Notifications',
    },
    description: {
      en: 'Read updates about assignments, follow-ups and coordination.',
      fr: 'Consultez les mises à jour des attributions, relances et actions.',
    },
    read: 'GET /notifications',
    columns: ['title', 'type', 'severity', 'createdAt', 'readAt'],
    roles: ['admin', 'director', 'manager', 'prospector', 'observer'],
    actions: [
      {
        operation: 'POST /notifications/read-all',
        label: {
          en: 'Mark all as read',
          fr: 'Tout marquer comme lu',
        },
        scope: 'collection',
      },
      {
        operation: 'POST /notifications/:notificationId/read',
        label: {
          en: 'Mark as read',
          fr: 'Marquer comme lu',
        },
        scope: 'record',
      },
    ],
    section: {
      en: 'Personal workspace',
      fr: 'Espace personnel',
    },
    idParam: 'notificationId',
  },
  {
    id: 'scheduled-reports',
    title: {
      en: 'Scheduled reports',
      fr: 'Rapports planifiés',
    },
    description: {
      en: 'Manage recurring reports and inspect delivery history.',
      fr: 'Gérez les rapports récurrents et leur historique de livraison.',
    },
    read: 'GET /scheduled-reports',
    columns: ['reportKey', 'cadence', 'format', 'timezone', 'nextRunAt'],
    roles: ['admin', 'director', 'manager'],
    actions: [
      {
        operation: 'POST /scheduled-reports',
        label: {
          en: 'Create',
          fr: 'Créer',
        },
        scope: 'collection',
        roles: ['admin', 'director', 'manager'],
      },
      {
        operation: 'PATCH /scheduled-reports/:scheduleId',
        label: {
          en: 'Edit',
          fr: 'Modifier',
        },
        scope: 'record',
        roles: ['admin', 'director', 'manager'],
      },
      {
        operation: 'DELETE /scheduled-reports/:scheduleId',
        label: {
          en: 'Remove',
          fr: 'Retirer',
        },
        scope: 'record',
        danger: true,
        roles: ['admin', 'director', 'manager'],
      },
    ],
    section: {
      en: 'Performance',
      fr: 'Performance',
    },
    idParam: 'scheduleId',
    related: [
      {
        operation: 'GET /scheduled-reports/:scheduleId/deliveries',
        label: {
          en: 'Delivery history',
          fr: 'Historique des livraisons',
        },
      },
    ],
  },
  {
    id: 'access-reviews',
    title: {
      en: 'Access reviews',
      fr: 'Revues des accès',
    },
    description: {
      en: 'Review current membership and record access decisions.',
      fr: 'Examinez les accès actuels et consignez les décisions.',
    },
    read: 'GET /access-reviews',
    columns: ['status', 'periodStart', 'createdAt', 'completedAt'],
    roles: ['admin'],
    actions: [
      {
        operation: 'POST /access-reviews',
        label: {
          en: 'Start review',
          fr: 'Démarrer une revue',
        },
        scope: 'collection',
      },
      {
        operation: 'POST /access-reviews/:reviewId/decisions',
        label: {
          en: 'Record decision',
          fr: 'Enregistrer une décision',
        },
        scope: 'record',
      },
      {
        operation: 'POST /access-reviews/:reviewId/complete',
        label: {
          en: 'Complete review',
          fr: 'Terminer la revue',
        },
        scope: 'record',
        danger: true,
      },
    ],
    section: {
      en: 'Audit & compliance',
      fr: 'Audit et conformité',
    },
    detail: 'GET /access-reviews/:reviewId',
    idParam: 'reviewId',
    related: [
      {
        operation: 'GET /access-reviews/:reviewId/memberships',
        label: {
          en: 'Membership decisions',
          fr: 'Décisions sur les accès',
        },
      },
    ],
  },
  {
    id: 'compliance-reports',
    title: {
      en: 'Compliance reports',
      fr: 'Rapports de conformité',
    },
    description: {
      en: 'Request a report and follow its generation status.',
      fr: 'Demandez un rapport et suivez sa génération.',
    },
    read: 'GET /compliance-reports',
    columns: ['reportType', 'status', 'createdAt', 'completedAt'],
    roles: ['admin', 'observer'],
    actions: [
      {
        operation: 'POST /compliance-reports',
        label: {
          en: 'Request report',
          fr: 'Demander un rapport',
        },
        scope: 'collection',
      },
    ],
    section: {
      en: 'Audit & compliance',
      fr: 'Audit et conformité',
    },
    detail: 'GET /compliance-reports/:reportId',
    idParam: 'reportId',
    related: [
      {
        operation: 'GET /compliance-reports/:reportId/download',
        label: {
          en: 'Download report',
          fr: 'Télécharger le rapport',
        },
      },
    ],
  },
  {
    id: 'integrations',
    title: {
      en: 'Connected services',
      fr: 'Services connectés',
    },
    description: {
      en: 'Manage configured providers and inspect connection health.',
      fr: 'Gérez les fournisseurs configurés et vérifiez leur connexion.',
    },
    read: 'GET /integrations',
    columns: ['provider', 'status', 'updatedAt'],
    roles: ['admin'],
    actions: [
      {
        operation: 'POST /integrations/:provider/connect',
        label: {
          en: 'Connect service',
          fr: 'Connecter un service',
        },
        scope: 'collection',
      },
      {
        operation: 'POST /integrations/:integrationId/test',
        label: {
          en: 'Test connection',
          fr: 'Tester la connexion',
        },
        scope: 'record',
      },
      {
        operation: 'POST /integrations/:integrationId/sync',
        label: {
          en: 'Synchronize',
          fr: 'Synchroniser',
        },
        scope: 'record',
      },
      {
        operation: 'DELETE /integrations/:integrationId',
        label: {
          en: 'Disconnect',
          fr: 'Déconnecter',
        },
        scope: 'record',
        danger: true,
      },
    ],
    section: {
      en: 'Connections',
      fr: 'Connexions',
    },
    related: [
      {
        operation: 'GET /integrations/:provider/health',
        label: {
          en: 'Connection health',
          fr: 'État de connexion',
        },
      },
    ],
    idParam: 'integrationId',
  },
  {
    id: 'api-clients',
    title: {
      en: 'API access',
      fr: 'Accès API',
    },
    description: {
      en: 'Manage application access and rotate client secrets.',
      fr: 'Gérez les accès applicatifs et renouvelez les secrets.',
    },
    read: 'GET /api-clients',
    columns: ['name', 'scopes', 'expiresAt', 'revokedAt'],
    roles: ['admin'],
    actions: [
      {
        operation: 'POST /api-clients',
        label: {
          en: 'Create',
          fr: 'Créer',
        },
        scope: 'collection',
        roles: ['admin'],
      },
      {
        operation: 'PATCH /api-clients/:clientId',
        label: {
          en: 'Edit',
          fr: 'Modifier',
        },
        scope: 'record',
        roles: ['admin'],
      },
      {
        operation: 'DELETE /api-clients/:clientId',
        label: {
          en: 'Remove',
          fr: 'Retirer',
        },
        scope: 'record',
        danger: true,
        roles: ['admin'],
      },
      {
        operation: 'POST /api-clients/:clientId/rotate-secret',
        label: {
          en: 'Rotate secret',
          fr: 'Renouveler le secret',
        },
        scope: 'record',
        danger: true,
      },
    ],
    section: {
      en: 'Connections',
      fr: 'Connexions',
    },
    idParam: 'clientId',
  },
  {
    id: 'webhooks',
    title: {
      en: 'Event subscriptions',
      fr: 'Abonnements aux événements',
    },
    description: {
      en: 'Manage event destinations and inspect delivery attempts.',
      fr: 'Gérez les destinations des événements et les tentatives de livraison.',
    },
    read: 'GET /webhooks',
    columns: ['url', 'events', 'active', 'createdAt'],
    roles: ['admin'],
    actions: [
      {
        operation: 'POST /webhooks',
        label: {
          en: 'Create',
          fr: 'Créer',
        },
        scope: 'collection',
        roles: ['admin'],
      },
      {
        operation: 'PATCH /webhooks/:webhookId',
        label: {
          en: 'Edit',
          fr: 'Modifier',
        },
        scope: 'record',
        roles: ['admin'],
      },
      {
        operation: 'DELETE /webhooks/:webhookId',
        label: {
          en: 'Remove',
          fr: 'Retirer',
        },
        scope: 'record',
        danger: true,
        roles: ['admin'],
      },
      {
        operation: 'POST /webhooks/:webhookId/test',
        label: {
          en: 'Send test event',
          fr: 'Envoyer un événement de test',
        },
        scope: 'record',
      },
    ],
    section: {
      en: 'Connections',
      fr: 'Connexions',
    },
    idParam: 'webhookId',
    related: [
      {
        operation: 'GET /webhooks/:webhookId/deliveries',
        label: {
          en: 'Delivery history',
          fr: 'Historique des livraisons',
        },
      },
    ],
  },
  {
    id: 'webhook-delivery',
    title: {
      en: 'Event delivery',
      fr: 'Livraison d’événement',
    },
    description: {
      en: 'Inspect a delivery and retry a failed attempt.',
      fr: 'Examinez une livraison et relancez une tentative échouée.',
    },
    read: 'GET /webhook-deliveries/:deliveryId',
    columns: ['status', 'event', 'attempts', 'responseCode', 'lastAttemptAt'],
    roles: ['admin'],
    actions: [
      {
        operation: 'POST /webhook-deliveries/:deliveryId/retry',
        label: {
          en: 'Retry delivery',
          fr: 'Relancer la livraison',
        },
        scope: 'collection',
      },
    ],
    section: {
      en: 'Connections',
      fr: 'Connexions',
    },
  },
  {
    id: 'platform-tenants',
    title: {
      en: 'Platform tenants',
      fr: 'Clients de la plateforme',
    },
    description: {
      en: 'Review tenant status, configuration and usage.',
      fr: 'Examinez le statut, la configuration et l’utilisation des clients.',
    },
    read: 'GET /platform/tenants',
    columns: ['name', 'slug', 'status', 'createdAt'],
    roles: ['platform'],
    actions: [
      {
        operation: 'PATCH /platform/tenants/:tenantId/status',
        label: {
          en: 'Change status',
          fr: 'Modifier le statut',
        },
        scope: 'record',
        danger: true,
      },
      {
        operation: 'PATCH /platform/tenants/:tenantId/config',
        label: {
          en: 'Edit configuration',
          fr: 'Modifier la configuration',
        },
        scope: 'record',
      },
    ],
    section: {
      en: 'Platform',
      fr: 'Plateforme',
    },
    detail: 'GET /platform/tenants/:tenantId',
    idParam: 'tenantId',
    related: [
      {
        operation: 'GET /platform/tenants/:tenantId/usage',
        label: {
          en: 'Usage',
          fr: 'Utilisation',
        },
      },
      {
        operation: 'GET /platform/tenants/:tenantId/config',
        label: {
          en: 'Configuration',
          fr: 'Configuration',
        },
      },
    ],
  },
  {
    id: 'platform-users',
    title: {
      en: 'Platform access',
      fr: 'Accès plateforme',
    },
    description: {
      en: 'Review and manage privileged platform grants.',
      fr: 'Examinez et gérez les accès privilégiés à la plateforme.',
    },
    read: 'GET /platform/users',
    columns: ['email', 'role', 'status', 'grantedAt'],
    roles: ['platform'],
    actions: [
      {
        operation: 'POST /platform/users/:identityId/grants',
        label: {
          en: 'Grant access',
          fr: 'Accorder un accès',
        },
        scope: 'collection',
      },
      {
        operation: 'POST /platform/invitations',
        label: {
          en: 'Invite super administrator',
          fr: 'Inviter un super administrateur',
        },
        scope: 'collection',
        description: {
          en: 'Send a single-use invitation. Platform access activates after acceptance.',
          fr: 'Envoyer une invitation à usage unique. L’accès plateforme est activé après acceptation.',
        },
      },
      {
        operation: 'POST /platform/users/:identityId/grants/:grantId/revoke',
        label: {
          en: 'Revoke grant',
          fr: 'Révoquer l’accès',
        },
        scope: 'record',
        danger: true,
      },
    ],
    section: {
      en: 'Platform',
      fr: 'Plateforme',
    },
    idField: 'grantId',
  },
  {
    id: 'audit-overview',
    title: {
      en: 'Audit overview',
      fr: 'Vue d’ensemble de l’audit',
    },
    description: {
      en: 'Inspect server-recorded evidence within your authorized scope.',
      fr: 'Examinez les preuves enregistrées dans votre périmètre autorisé.',
    },
    read: 'GET /audit/overview',
    columns: [],
    roles: ['admin', 'observer'],
    actions: [],
    section: {
      en: 'Audit & compliance',
      fr: 'Audit et conformité',
    },
  },
  {
    id: 'audit-events',
    title: {
      en: 'Event log',
      fr: 'Journal des événements',
    },
    description: {
      en: 'Inspect server-recorded evidence within your authorized scope.',
      fr: 'Examinez les preuves enregistrées dans votre périmètre autorisé.',
    },
    read: 'GET /audit/events',
    columns: ['action', 'resourceType', 'actorUserId', 'occurredAt'],
    roles: ['admin', 'observer'],
    actions: [
      {
        operation: 'POST /audit/evidence-exports',
        label: {
          en: 'Export evidence',
          fr: 'Exporter les preuves',
        },
        scope: 'collection',
      },
    ],
    section: {
      en: 'Audit & compliance',
      fr: 'Audit et conformité',
    },
    detail: 'GET /audit/events/:eventId',
    idParam: 'eventId',
  },
  {
    id: 'audit-data-changes',
    title: {
      en: 'Data changes',
      fr: 'Modifications des données',
    },
    description: {
      en: 'Inspect server-recorded evidence within your authorized scope.',
      fr: 'Examinez les preuves enregistrées dans votre périmètre autorisé.',
    },
    read: 'GET /audit/data-changes',
    columns: ['action', 'resourceType', 'actorUserId', 'occurredAt'],
    roles: ['admin', 'observer'],
    actions: [],
    section: {
      en: 'Audit & compliance',
      fr: 'Audit et conformité',
    },
  },
  {
    id: 'audit-security',
    title: {
      en: 'Security events',
      fr: 'Événements de sécurité',
    },
    description: {
      en: 'Inspect server-recorded evidence within your authorized scope.',
      fr: 'Examinez les preuves enregistrées dans votre périmètre autorisé.',
    },
    read: 'GET /audit/security-events',
    columns: ['action', 'actorUserId', 'occurredAt'],
    roles: ['admin', 'observer'],
    actions: [],
    section: {
      en: 'Audit & compliance',
      fr: 'Audit et conformité',
    },
    detail: 'GET /audit/security-events/:eventId',
    idParam: 'eventId',
    idField: 'resourceId',
  },
  {
    id: 'audit-assignments',
    title: {
      en: 'Assignment evidence',
      fr: 'Historique des attributions',
    },
    description: {
      en: 'Inspect server-recorded evidence within your authorized scope.',
      fr: 'Examinez les preuves enregistrées dans votre périmètre autorisé.',
    },
    read: 'GET /audit/assignments',
    columns: ['action', 'resourceId', 'occurredAt'],
    roles: ['admin', 'observer'],
    actions: [],
    section: {
      en: 'Audit & compliance',
      fr: 'Audit et conformité',
    },
    detail: 'GET /audit/assignments/:assignmentId',
    idParam: 'assignmentId',
    idField: 'resourceId',
  },
  {
    id: 'audit-overrides',
    title: {
      en: 'Override evidence',
      fr: 'Historique des dérogations',
    },
    description: {
      en: 'Inspect server-recorded evidence within your authorized scope.',
      fr: 'Examinez les preuves enregistrées dans votre périmètre autorisé.',
    },
    read: 'GET /audit/overrides',
    columns: ['action', 'resourceId', 'occurredAt'],
    roles: ['admin', 'observer'],
    actions: [],
    section: {
      en: 'Audit & compliance',
      fr: 'Audit et conformité',
    },
    detail: 'GET /audit/overrides/:overrideId',
    idParam: 'overrideId',
    idField: 'resourceId',
  },
  {
    id: 'audit-collisions',
    title: {
      en: 'Collision evidence',
      fr: 'Historique des collisions',
    },
    description: {
      en: 'Inspect server-recorded evidence within your authorized scope.',
      fr: 'Examinez les preuves enregistrées dans votre périmètre autorisé.',
    },
    read: 'GET /audit/collisions',
    columns: ['action', 'resourceId', 'occurredAt'],
    roles: ['admin', 'observer'],
    actions: [],
    section: {
      en: 'Audit & compliance',
      fr: 'Audit et conformité',
    },
    detail: 'GET /audit/collisions/:collisionId',
    idParam: 'collisionId',
    idField: 'resourceId',
  },
  {
    id: 'audit-exports',
    title: {
      en: 'Export evidence',
      fr: 'Historique des exports',
    },
    description: {
      en: 'Inspect server-recorded evidence within your authorized scope.',
      fr: 'Examinez les preuves enregistrées dans votre périmètre autorisé.',
    },
    read: 'GET /audit/exports',
    columns: ['action', 'resourceId', 'occurredAt'],
    roles: ['admin', 'observer'],
    actions: [],
    section: {
      en: 'Audit & compliance',
      fr: 'Audit et conformité',
    },
    detail: 'GET /audit/exports/:exportId',
    idParam: 'exportId',
    idField: 'resourceId',
  },
  {
    id: 'audit-retention',
    title: {
      en: 'Data retention',
      fr: 'Conservation des données',
    },
    description: {
      en: 'Inspect server-recorded evidence within your authorized scope.',
      fr: 'Examinez les preuves enregistrées dans votre périmètre autorisé.',
    },
    read: 'GET /audit/retention',
    columns: [],
    roles: ['admin', 'observer'],
    actions: [],
    section: {
      en: 'Audit & compliance',
      fr: 'Audit et conformité',
    },
  },
  {
    id: 'prospect-records',
    title: {
      en: 'Manage prospects',
      fr: 'Gérer les prospects',
    },
    description: {
      en: 'Create, edit, archive and restore master prospect records.',
      fr: 'Créez, modifiez, archivez et restaurez les prospects.',
    },
    read: 'GET /prospects',
    columns: ['name', 'city', 'category', 'status'],
    roles: ['admin'],
    actions: [
      {
        operation: 'POST /prospects',
        label: {
          en: 'Create',
          fr: 'Créer',
        },
        scope: 'collection',
        roles: ['admin'],
      },
      {
        operation: 'PATCH /prospects/:prospectId',
        label: {
          en: 'Edit',
          fr: 'Modifier',
        },
        scope: 'record',
        roles: ['admin'],
      },
      {
        operation: 'DELETE /prospects/:prospectId',
        label: {
          en: 'Archive prospect',
          fr: 'Archiver le prospect',
        },
        scope: 'record',
        danger: true,
        roles: ['admin'],
      },
      {
        operation: 'POST /prospects/:prospectId/restore',
        label: {
          en: 'Restore prospect',
          fr: 'Restaurer le prospect',
        },
        scope: 'record',
      },
    ],
    section: {
      en: 'Data quality',
      fr: 'Qualité des données',
    },
    detail: 'GET /prospects/:prospectId',
    idParam: 'prospectId',
    related: [
      {
        operation: 'GET /prospects/:prospectId/addresses',
        label: {
          en: 'Addresses',
          fr: 'Adresses',
        },
      },
      {
        operation: 'GET /prospects/:prospectId/contacts',
        label: {
          en: 'Contacts',
          fr: 'Contacts',
        },
      },
      {
        operation: 'GET /prospects/:prospectId/consents',
        label: {
          en: 'Contact permissions',
          fr: 'Autorisations de contact',
        },
      },
      {
        operation: 'GET /prospects/:prospectId/campaign-memberships',
        label: {
          en: 'Campaign participation',
          fr: 'Participation aux campagnes',
        },
      },
    ],
  },
  {
    id: 'prospect-record',
    title: {
      en: 'Prospect information',
      fr: 'Informations du prospect',
    },
    description: {
      en: 'Manage this prospect’s record, tags and extra information.',
      fr: 'Gérez la fiche de ce prospect, ses étiquettes et ses informations complémentaires.',
    },
    read: 'GET /prospects/:prospectId',
    columns: [],
    roles: ['admin', 'director', 'manager', 'prospector', 'observer'],
    actions: [
      {
        operation: 'PATCH /prospects/:prospectId',
        label: {
          en: 'Edit prospect',
          fr: 'Modifier le prospect',
        },
        scope: 'collection',
        roles: ['admin', 'director', 'manager', 'prospector'],
      },
      {
        operation: 'POST /prospects/:prospectId/tags/:tagId',
        label: {
          en: 'Add tag',
          fr: 'Ajouter une étiquette',
        },
        scope: 'collection',
        roles: ['admin', 'director', 'manager', 'prospector'],
      },
      {
        operation: 'DELETE /prospects/:prospectId/tags/:tagId',
        label: {
          en: 'Remove tag',
          fr: 'Retirer une étiquette',
        },
        scope: 'collection',
        roles: ['admin', 'director', 'manager', 'prospector'],
      },
      {
        operation: 'PUT /prospects/:prospectId/custom-fields',
        label: {
          en: 'Edit extra information',
          fr: 'Modifier les informations complémentaires',
        },
        scope: 'collection',
        roles: ['admin', 'director', 'manager', 'prospector'],
      },
    ],
    section: {
      en: 'Data quality',
      fr: 'Qualité des données',
    },
  },
  {
    id: 'prospect-addresses',
    title: {
      en: 'Prospect addresses',
      fr: 'Adresses des prospects',
    },
    description: {
      en: 'Maintain primary and secondary prospect addresses.',
      fr: 'Gérez les adresses principales et secondaires des prospects.',
    },
    read: 'GET /prospects/:prospectId/addresses',
    columns: ['label', 'line1', 'postalCode', 'city', 'countryCode', 'isPrimary'],
    roles: ['admin', 'director', 'manager', 'prospector', 'observer'],
    actions: [
      {
        operation: 'POST /prospects/:prospectId/addresses',
        label: {
          en: 'Add address',
          fr: 'Ajouter une adresse',
        },
        scope: 'collection',
        roles: ['admin', 'director', 'manager', 'prospector'],
      },
      {
        operation: 'PATCH /prospect-addresses/:addressId',
        label: {
          en: 'Edit address',
          fr: 'Modifier l’adresse',
        },
        scope: 'record',
        roles: ['admin', 'director', 'manager', 'prospector'],
      },
      {
        operation: 'DELETE /prospect-addresses/:addressId',
        label: {
          en: 'Remove address',
          fr: 'Retirer l’adresse',
        },
        scope: 'record',
        danger: true,
        roles: ['admin', 'director', 'manager', 'prospector'],
      },
    ],
    section: {
      en: 'Data quality',
      fr: 'Qualité des données',
    },
    idParam: 'addressId',
  },
  {
    id: 'prospect-contacts',
    title: {
      en: 'Prospect contacts',
      fr: 'Contacts des prospects',
    },
    description: {
      en: 'Maintain contact details and the primary point of contact.',
      fr: 'Gérez les coordonnées et le contact principal.',
    },
    read: 'GET /prospects/:prospectId/contacts',
    columns: ['name', 'jobTitle', 'email', 'phone', 'isPrimary'],
    roles: ['admin', 'director', 'manager', 'prospector', 'observer'],
    actions: [
      {
        operation: 'POST /prospects/:prospectId/contacts',
        label: {
          en: 'Add contact',
          fr: 'Ajouter un contact',
        },
        scope: 'collection',
        roles: ['admin', 'director', 'manager', 'prospector'],
      },
      {
        operation: 'PATCH /prospect-contacts/:contactId',
        label: {
          en: 'Edit contact',
          fr: 'Modifier le contact',
        },
        scope: 'record',
        roles: ['admin', 'director', 'manager', 'prospector'],
      },
      {
        operation: 'DELETE /prospect-contacts/:contactId',
        label: {
          en: 'Archive contact',
          fr: 'Archiver le contact',
        },
        scope: 'record',
        danger: true,
        roles: ['admin', 'director', 'manager', 'prospector'],
      },
    ],
    section: {
      en: 'Data quality',
      fr: 'Qualité des données',
    },
    idParam: 'contactId',
  },
  {
    id: 'prospect-consents',
    title: {
      en: 'Contact permissions',
      fr: 'Autorisations de contact',
    },
    description: {
      en: 'Record permission or opposition with its supporting reason.',
      fr: 'Consignez une autorisation ou une opposition et son motif.',
    },
    read: 'GET /prospects/:prospectId/consents',
    columns: ['channel', 'status', 'reason', 'effectiveAt', 'expiresAt'],
    roles: ['admin', 'director', 'manager', 'prospector', 'observer'],
    actions: [
      {
        operation: 'POST /prospects/:prospectId/consents',
        label: {
          en: 'Record permission',
          fr: 'Enregistrer une autorisation',
        },
        scope: 'collection',
        roles: ['admin', 'director', 'manager', 'prospector'],
      },
    ],
    section: {
      en: 'Data quality',
      fr: 'Qualité des données',
    },
  },
  {
    id: 'reservation-rules',
    title: {
      en: 'Reservation rules',
      fr: 'Règles de réservation',
    },
    description: {
      en: 'Control hold periods, cooldowns and allowed extensions.',
      fr: 'Définissez les durées, délais et prolongations autorisées.',
    },
    read: 'GET /reservation-rules',
    columns: [
      'campaignId',
      'durationMinutes',
      'cooldownMinutes',
      'maxHoldMinutes',
      'allowExtension',
    ],
    roles: ['admin'],
    actions: [
      {
        operation: 'POST /reservation-rules',
        label: {
          en: 'Create',
          fr: 'Créer',
        },
        scope: 'collection',
        roles: ['admin'],
      },
      {
        operation: 'PATCH /reservation-rules/:ruleId',
        label: {
          en: 'Edit',
          fr: 'Modifier',
        },
        scope: 'record',
        roles: ['admin'],
      },
      {
        operation: 'DELETE /reservation-rules/:ruleId',
        label: {
          en: 'Remove',
          fr: 'Retirer',
        },
        scope: 'record',
        danger: true,
        roles: ['admin'],
      },
    ],
    section: {
      en: 'Coordination',
      fr: 'Coordination',
    },
    detail: 'GET /reservation-rules/:ruleId',
    idParam: 'ruleId',
  },
  {
    id: 'reservations',
    title: {
      en: 'Active reservations',
      fr: 'Réservations actives',
    },
    description: {
      en: 'Review active holds and release or extend them where authorized.',
      fr: 'Consultez les réservations actives et gérez-les selon vos droits.',
    },
    read: 'GET /reservations',
    columns: ['campaignId', 'campaignProspectId', 'status', 'expiresAt'],
    roles: ['admin', 'director', 'manager'],
    actions: [
      {
        operation: 'POST /reservations/:reservationId/extend',
        label: {
          en: 'Extend reservation',
          fr: 'Prolonger la réservation',
        },
        scope: 'record',
      },
      {
        operation: 'POST /reservations/:reservationId/release',
        label: {
          en: 'Release reservation',
          fr: 'Libérer la réservation',
        },
        scope: 'record',
        danger: true,
      },
    ],
    section: {
      en: 'Coordination',
      fr: 'Coordination',
    },
    detail: 'GET /reservations/:reservationId',
    idParam: 'reservationId',
  },
  {
    id: 'audit-access',
    title: {
      en: 'Access evidence',
      fr: 'Historique des accès',
    },
    description: {
      en: 'Inspect a member’s grants and access history.',
      fr: 'Examinez les autorisations et l’historique d’accès d’un membre.',
    },
    read: 'GET /audit/users/:membershipId/access',
    columns: [],
    roles: ['admin', 'observer'],
    actions: [],
    section: {
      en: 'Audit & compliance',
      fr: 'Audit et conformité',
    },
  },
  {
    id: 'evidence-export',
    title: {
      en: 'Evidence export status',
      fr: 'État de l’export de preuves',
    },
    description: {
      en: 'Follow a requested evidence export.',
      fr: 'Suivez un export de preuves demandé.',
    },
    read: 'GET /audit/evidence-exports/:exportId',
    columns: [],
    roles: ['admin', 'observer'],
    actions: [],
    section: {
      en: 'Audit & compliance',
      fr: 'Audit et conformité',
    },
  },
  {
    id: 'platform-health',
    title: {
      en: 'Service health',
      fr: 'État des services',
    },
    description: {
      en: 'Inspect database and coordination service readiness.',
      fr: 'Vérifiez la disponibilité de la base de données et du service de coordination.',
    },
    read: 'GET /health/ready',
    columns: [],
    roles: ['platform'],
    actions: [],
    section: {
      en: 'Platform',
      fr: 'Plateforme',
    },
  },
  {
    id: 'membership-scopes',
    title: {
      en: 'Member access scopes',
      fr: 'Périmètres d’accès des membres',
    },
    description: {
      en: 'Review effective access and grant organization, team, campaign or territory access.',
      fr: 'Examinez les accès effectifs et attribuez un périmètre organisation, équipe, campagne ou territoire.',
    },
    read: 'GET /memberships/:membershipId/scopes',
    columns: [],
    roles: ['admin'],
    actions: [
      {
        operation: 'POST /memberships/:membershipId/scopes',
        label: {
          en: 'Add scope',
          fr: 'Ajouter un périmètre',
        },
        scope: 'collection',
      },
    ],
    section: {
      en: 'Workspace setup',
      fr: 'Configuration',
    },
  },
  {
    id: 'access-grants',
    title: {
      en: 'Structural access grants',
      fr: 'Autorisations structurelles',
    },
    description: {
      en: 'Review, add or revoke role grants for a workspace member.',
      fr: 'Examinez, ajoutez ou révoquez les rôles d’un membre.',
    },
    read: 'GET /users/:userId/access-grants',
    columns: ['role', 'scopeType', 'organizationId', 'teamId'],
    roles: ['admin'],
    actions: [
      {
        operation: 'POST /users/:userId/access-grants',
        label: {
          en: 'Grant access',
          fr: 'Accorder un accès',
        },
        scope: 'collection',
      },
      {
        operation: 'DELETE /users/:userId/access-grants/:grantId',
        label: {
          en: 'Revoke access',
          fr: 'Révoquer l’accès',
        },
        scope: 'record',
        danger: true,
      },
    ],
    section: {
      en: 'Workspace setup',
      fr: 'Configuration',
    },
    idParam: 'grantId',
  },
  {
    id: 'conversation-settings',
    title: {
      en: 'Conversation settings',
      fr: 'Paramètres de conversation',
    },
    description: {
      en: 'Update the title or archive this conversation.',
      fr: 'Modifiez le titre ou archivez cette conversation.',
    },
    read: 'GET /conversations/:id',
    columns: ['title', 'kind', 'status'],
    roles: ['admin', 'director', 'manager', 'prospector', 'observer'],
    actions: [
      {
        operation: 'PATCH /conversations/:id',
        label: {
          en: 'Edit conversation',
          fr: 'Modifier la conversation',
        },
        scope: 'collection',
      },
    ],
    section: {
      en: 'Personal workspace',
      fr: 'Espace personnel',
    },
  },
  {
    id: 'conversation-members',
    title: {
      en: 'Conversation members',
      fr: 'Membres de la conversation',
    },
    description: {
      en: 'Manage the people participating in this conversation.',
      fr: 'Gérez les personnes participant à cette conversation.',
    },
    read: 'GET /conversations/:id/participants',
    columns: ['membershipId', 'joinedAt'],
    roles: ['admin', 'director', 'manager', 'prospector', 'observer'],
    actions: [
      {
        operation: 'POST /conversations/:id/participants',
        label: {
          en: 'Add member',
          fr: 'Ajouter un membre',
        },
        scope: 'collection',
      },
      {
        operation: 'DELETE /conversations/:id/participants/:membershipId',
        label: {
          en: 'Remove member',
          fr: 'Retirer le membre',
        },
        scope: 'record',
        danger: true,
      },
    ],
    section: {
      en: 'Personal workspace',
      fr: 'Espace personnel',
    },
  },
];

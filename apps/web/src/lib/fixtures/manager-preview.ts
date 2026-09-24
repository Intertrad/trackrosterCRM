/**
 * PRESENTATION FIXTURES — NOT REAL DATA.
 *
 * Every value here stands in for an endpoint that does not exist yet. The
 * manager screens are built to the approved design first and wired to the API
 * in a later phase, so all placeholder data lives in this one file.
 *
 * Integration checklist — delete a block once its endpoint lands:
 *
 *   teamMembers            -> GET /manager/dashboard (needs displayName +
 *                             capacity_target on the per-prospector rows)
 *   overrideRequests       -> GET /override-requests
 *   potentialCollisions    -> GET /collision-events
 *   performanceSnapshot    -> GET /reports/conversions
 *   actionsAndCoverage     -> GET /reports/actions
 *   effectivenessFunnel    -> GET /reports/funnel
 *   coordinationSummary    -> GET /reports/collisions
 *   unassignedProspects    -> GET /assignments/unassigned
 *   scopeOptions           -> GET /teams, /campaigns, /territories
 *
 * Anything marked `isPreview` must render with a visible preview affordance so
 * a reviewer is never misled into reading these as production figures.
 */
export const IS_PREVIEW_DATA = true;

export interface PreviewTeamMember {
  id: string;
  name: string;
  initials: string;
  location: string;
  activeProspects: number;
  actionsThisWeek: number;
  overdue: number;
  capacityPercent: number;
  availability: 'high' | 'medium' | 'low';
}

export const teamMembers: PreviewTeamMember[] = [
  {
    id: 'nb',
    name: 'Nabil Benchariki',
    initials: 'NB',
    location: 'Verdun',
    activeProspects: 142,
    actionsThisWeek: 48,
    overdue: 2,
    capacityPercent: 78,
    availability: 'high',
  },
  {
    id: 'sc',
    name: 'Sophie Chevalier',
    initials: 'SC',
    location: 'Verdun',
    activeProspects: 128,
    actionsThisWeek: 37,
    overdue: 5,
    capacityPercent: 85,
    availability: 'medium',
  },
  {
    id: 'md',
    name: 'Marie Dupont',
    initials: 'MD',
    location: 'Verdun',
    activeProspects: 96,
    actionsThisWeek: 28,
    overdue: 4,
    capacityPercent: 72,
    availability: 'high',
  },
  {
    id: 'tl',
    name: 'Thomas Leroy',
    initials: 'TL',
    location: 'Verdun',
    activeProspects: 110,
    actionsThisWeek: 31,
    overdue: 3,
    capacityPercent: 88,
    availability: 'medium',
  },
  {
    id: 'aj',
    name: 'Amine Jaber',
    initials: 'AJ',
    location: 'Verdun',
    activeProspects: 86,
    actionsThisWeek: 26,
    overdue: 1,
    capacityPercent: 65,
    availability: 'high',
  },
  {
    id: 'cm',
    name: 'Chloé Moreau',
    initials: 'CM',
    location: 'Verdun',
    activeProspects: 122,
    actionsThisWeek: 33,
    overdue: 2,
    capacityPercent: 80,
    availability: 'medium',
  },
];

export interface PreviewOverrideRequest {
  id: string;
  reference: string;
  prospect: string;
  prospectLocation: string;
  prospectCategory: string;
  requester: string;
  requesterTeam: string;
  currentOwner: string;
  requestedAt: string;
  requestedAction: 'call' | 'email' | 'visit';
  currentAction: string;
  campaign: string;
  campaignScope: string;
  reason: string;
  requestedDuration: string;
  requestedTime: string;
  reservationExpiry: string;
  reservationExpiresIn: string;
  lastContact: string;
  lastContactDate: string;
  priority: 'high' | 'normal';
  usersAffected: number;
  activeActions: number;
}

export const overrideRequests: PreviewOverrideRequest[] = [
  {
    id: 'or-0248',
    reference: 'OR-0248',
    prospect: 'Carrefour Contact',
    prospectLocation: 'Verdun',
    prospectCategory: 'Retail',
    requester: 'Nabil Benchariki',
    requesterTeam: 'Verdun',
    currentOwner: 'Marie Dupont',
    requestedAt: '8 minutes ago',
    requestedAction: 'call',
    currentAction: 'Email follow-up',
    campaign: 'Q4 Outreach',
    campaignScope: 'Local Authorities',
    reason:
      'Client requested a call today to discuss new product range. Time-sensitive opportunity before end of quarter.',
    requestedDuration: '30 minutes',
    requestedTime: 'Today at 15:30',
    reservationExpiry: 'Today at 18:00',
    reservationExpiresIn: 'in 2h 12m',
    lastContact: '2 days ago',
    lastContactDate: 'Mon, 21 Sep',
    priority: 'high',
    usersAffected: 2,
    activeActions: 1,
  },
  {
    id: 'or-0247',
    reference: 'OR-0247',
    prospect: 'Garage Dupont',
    prospectLocation: 'Belrupt-en-Verdunois',
    prospectCategory: 'Automotive',
    requester: 'Marie Dupont',
    requesterTeam: 'Verdun',
    currentOwner: 'Thomas Leroy',
    requestedAt: 'Mon, 21 Sep',
    requestedAction: 'visit',
    currentAction: 'Call follow-up',
    campaign: 'Automotive',
    campaignScope: 'Local Authorities',
    reason: 'On-site visit already scheduled with the owner for the same afternoon.',
    requestedDuration: '45 minutes',
    requestedTime: 'Mon, 21 Sep at 16:00',
    reservationExpiry: 'Mon, 21 Sep at 17:30',
    reservationExpiresIn: 'expired',
    lastContact: '5 days ago',
    lastContactDate: 'Thu, 17 Sep',
    priority: 'normal',
    usersAffected: 2,
    activeActions: 1,
  },
  {
    id: 'or-0246',
    reference: 'OR-0246',
    prospect: 'Clinique Saint-Nicolas',
    prospectLocation: 'Verdun',
    prospectCategory: 'Health & Care',
    requester: 'Sophie Chevalier',
    requesterTeam: 'Verdun',
    currentOwner: 'Amine Jaber',
    requestedAt: 'Sun, 20 Sep',
    requestedAction: 'email',
    currentAction: 'Visit planned',
    campaign: 'Health & Care',
    campaignScope: 'Local Authorities',
    reason: 'Documentation requested by the practice manager ahead of the planned visit.',
    requestedDuration: '15 minutes',
    requestedTime: 'Sun, 20 Sep at 09:00',
    reservationExpiry: 'Sun, 20 Sep at 12:00',
    reservationExpiresIn: 'expired',
    lastContact: '8 days ago',
    lastContactDate: 'Mon, 14 Sep',
    priority: 'normal',
    usersAffected: 2,
    activeActions: 1,
  },
];

export interface PreviewPolicyCheck {
  id: string;
  label: string;
  detail: string;
  result: 'pass' | 'fail';
}

export const policyChecks: PreviewPolicyCheck[] = [
  { id: 'team', label: 'Same team', detail: 'Both members are in Verdun', result: 'pass' },
  {
    id: 'action-types',
    label: 'Compatible action types',
    detail: 'Email and call cannot run in parallel',
    result: 'fail',
  },
  {
    id: 'cooldown',
    label: 'Cooldown period',
    detail: 'Last contact was 2 days ago (minimum 24h required)',
    result: 'pass',
  },
  {
    id: 'opposition',
    label: 'Opposition clear',
    detail: 'No explicit opposition from current owner',
    result: 'pass',
  },
];

export interface PreviewTimelineEvent {
  at: string;
  title: string;
  detail: string;
  tone: 'override' | 'action' | 'note' | 'system';
}

export const conflictTimeline: PreviewTimelineEvent[] = [
  {
    at: 'Today 13:22',
    title: 'Override requested by Nabil Benchariki',
    detail: '"Client requested a call today to discuss new product range."',
    tone: 'override',
  },
  {
    at: 'Today 11:05',
    title: 'Email sent to Carrefour Contact by Marie Dupont',
    detail: 'Q4 Outreach',
    tone: 'action',
  },
  {
    at: 'Mon, 21 Sep 09:14',
    title: 'Note added by Marie Dupont',
    detail: '"Interested in new range. Follow up this week."',
    tone: 'note',
  },
  {
    at: 'Fri, 18 Sep 16:40',
    title: 'Prospect assigned to Marie Dupont',
    detail: 'System event',
    tone: 'system',
  },
];

export interface PreviewCollision {
  id: string;
  prospect: string;
  detail: string;
}

export const potentialCollisions: PreviewCollision[] = [
  { id: 'c1', prospect: 'Pharmacie des Quais', detail: 'Assigned to 2 team members' },
  { id: 'c2', prospect: 'Metz police station', detail: 'Visit planned by another team member' },
];

export const performanceSnapshot = [
  { id: 'contact', label: 'Contact rate', value: 62, delta: '+6 pp' },
  { id: 'appointment', label: 'Appointment rate', value: 18, delta: '+3 pp' },
  { id: 'ontime', label: 'Follow-ups on time', value: 91, delta: '+5 pp' },
];

export const actionsAndCoverage = [
  { label: '1–7 Sep', actions: 120, coverage: 62 },
  { label: '8–14 Sep', actions: 135, coverage: 67 },
  { label: '15–21 Sep', actions: 157, coverage: 74 },
];

export const effectivenessFunnel = [
  { label: 'Attempts', value: 412, caption: '100% of actions' },
  { label: 'Useful contacts', value: 255, caption: '62% of attempts' },
  { label: 'Appointments', value: 46, caption: '18% of useful contacts' },
  { label: 'Converted', value: 12, caption: '26% of appointments' },
];

export const coordinationSummary = [
  {
    id: 'avoided',
    value: 18,
    label: 'Collisions avoided',
    detail: 'Thanks to automated checks and team coordination',
  },
  { id: 'overrides', value: 3, label: 'Overrides', detail: 'Approved manual overrides' },
  {
    id: 'reassignments',
    value: 7,
    label: 'Reassignments',
    detail: 'Prospects reassigned within the team',
  },
];

export interface PreviewTeamComparisonRow {
  id: string;
  name: string;
  initials: string;
  location: string;
  contactRate: number;
  appointments: number;
  onTime: number;
  completeness: number;
}

export const teamComparison: PreviewTeamComparisonRow[] = [
  {
    id: 'nb',
    name: 'Nabil Benchariki',
    initials: 'NB',
    location: 'Verdun',
    contactRate: 68,
    appointments: 12,
    onTime: 78,
    completeness: 92,
  },
  {
    id: 'sc',
    name: 'Sophie Chevalier',
    initials: 'SC',
    location: 'Verdun',
    contactRate: 72,
    appointments: 8,
    onTime: 85,
    completeness: 88,
  },
  {
    id: 'md',
    name: 'Marie Dupont',
    initials: 'MD',
    location: 'Verdun',
    contactRate: 61,
    appointments: 7,
    onTime: 72,
    completeness: 95,
  },
  {
    id: 'tl',
    name: 'Thomas Leroy',
    initials: 'TL',
    location: 'Verdun',
    contactRate: 75,
    appointments: 11,
    onTime: 88,
    completeness: 90,
  },
  {
    id: 'aj',
    name: 'Amine Jaber',
    initials: 'AJ',
    location: 'Verdun',
    contactRate: 58,
    appointments: 5,
    onTime: 65,
    completeness: 86,
  },
];

export interface PreviewUnassignedProspect {
  id: string;
  name: string;
  initials: string;
  location: string;
  priority: 'high' | 'medium' | 'low';
  status: 'New' | 'Contacted';
}

export const unassignedProspects: PreviewUnassignedProspect[] = [
  {
    id: 'jm',
    name: 'Jean Morel',
    initials: 'JM',
    location: 'Verdun',
    priority: 'high',
    status: 'New',
  },
  {
    id: 'cl',
    name: 'Claire Lefèvre',
    initials: 'CL',
    location: 'Belleville-sur-Meuse',
    priority: 'high',
    status: 'New',
  },
  {
    id: 'pd',
    name: 'Pierre Dubois',
    initials: 'PD',
    location: 'Verdun',
    priority: 'medium',
    status: 'Contacted',
  },
  {
    id: 'sl',
    name: 'Sophie Lambert',
    initials: 'SL',
    location: 'Verdun',
    priority: 'medium',
    status: 'New',
  },
  {
    id: 'ap',
    name: 'Antoine Petit',
    initials: 'AP',
    location: 'Verdun',
    priority: 'low',
    status: 'New',
  },
  {
    id: 'cm2',
    name: 'Céline Martin',
    initials: 'CM',
    location: 'Belrupt-en-Verdunois',
    priority: 'medium',
    status: 'New',
  },
  {
    id: 'nf',
    name: 'Nicolas Faure',
    initials: 'NF',
    location: 'Verdun',
    priority: 'low',
    status: 'Contacted',
  },
  {
    id: 'er',
    name: 'Emma Richard',
    initials: 'ER',
    location: 'Thierville-sur-Meuse',
    priority: 'high',
    status: 'New',
  },
  {
    id: 'lt',
    name: 'Lucas Thomas',
    initials: 'LT',
    location: 'Belleville-sur-Meuse',
    priority: 'medium',
    status: 'New',
  },
  {
    id: 'cc',
    name: 'Camille Colin',
    initials: 'CC',
    location: 'Verdun',
    priority: 'low',
    status: 'New',
  },
  {
    id: 'ad',
    name: 'Axel Dupont',
    initials: 'AD',
    location: 'Verdun',
    priority: 'medium',
    status: 'Contacted',
  },
  {
    id: 'ml',
    name: 'Manon Leroy',
    initials: 'ML',
    location: 'Belrupt-en-Verdunois',
    priority: 'low',
    status: 'New',
  },
  {
    id: 'gb',
    name: 'Gabriel Bernard',
    initials: 'GB',
    location: 'Verdun',
    priority: 'high',
    status: 'New',
  },
];

export const scopeOptions = {
  teams: [
    { value: 'verdun', label: 'Verdun' },
    { value: 'nancy', label: 'Nancy' },
    { value: 'metz', label: 'Metz' },
  ],
  campaigns: [
    { value: 'all', label: 'All' },
    { value: 'local-authorities', label: 'Local Authorities' },
    { value: 'q4-outreach', label: 'Q4 Outreach' },
    { value: 'health-care', label: 'Health & Care' },
    { value: 'retail', label: 'Retail' },
  ],
  territories: [
    { value: 'region-54', label: 'Region 54' },
    { value: 'region-55', label: 'Region 55' },
    { value: 'region-57', label: 'Region 57' },
  ],
  organizations: [
    { value: 'intertrad', label: 'InterTrad' },
    { value: 'gftij', label: 'GFTIJ' },
    { value: 'sdi', label: 'SDI' },
  ],
  statuses: [
    { value: 'active', label: 'Active' },
    { value: 'paused', label: 'Paused' },
    { value: 'completed', label: 'Completed' },
  ],
};

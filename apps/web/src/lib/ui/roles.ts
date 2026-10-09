import type { UserRole } from '@/lib/api/auth-types';
import type { UiLanguage } from '@/lib/i18n/languages';

/*
 * The API exposes product role names at its boundary (client_admin is
 * published as tenant_admin, observer as auditor). These labels follow the
 * design dossier's governance table.
 */
const ROLE_LABELS: Record<string, string> = {
  tenant_admin: 'Tenant Admin',
  client_admin: 'Tenant Admin',
  director: 'Director',
  manager: 'Manager',
  prospector: 'Prospector',
  auditor: 'Observer / Auditor',
  observer: 'Observer / Auditor',
  super_admin: 'Super Administrator',
};

const ROLE_LABELS_FR: Record<string, string> = {
  tenant_admin: 'Administrateur client',
  client_admin: 'Administrateur client',
  director: 'Directeur',
  manager: 'Manager',
  prospector: 'Prospecteur',
  auditor: 'Observateur / Auditeur',
  observer: 'Observateur / Auditeur',
  super_admin: 'Administrateur plateforme',
};

const ROLE_SUMMARIES: Record<string, string> = {
  tenant_admin: 'Full workspace administration access',
  director: 'Organization-wide read access and exports',
  manager: 'Team assignments, approvals and oversight',
  prospector: 'Personal portfolio, actions and follow-ups',
  auditor: 'Read-only evidence within a defined scope',
  super_admin: 'Platform administration without tenant data',
};

const ROLE_SUMMARIES_FR: Record<string, string> = {
  tenant_admin: 'Administration complète de l’espace de travail',
  director: 'Accès en lecture et exports à l’échelle de l’organisation',
  manager: 'Attributions, validations et supervision de l’équipe',
  prospector: 'Portefeuille personnel, actions et relances',
  auditor: 'Éléments d’audit en lecture seule dans un périmètre défini',
  super_admin: 'Administration de la plateforme sans données client',
};

const ROLE_PERMISSIONS: Record<string, string> = {
  tenant_admin: 'Users, campaigns, integrations, reports',
  director: 'Objectives, performance, reporting, exports',
  manager: 'Assignments, overrides, team oversight',
  prospector: 'Own prospects, actions, follow-ups, schedule',
  auditor: 'Audit evidence, exports, access reviews',
  super_admin: 'Tenants, plans, platform configuration',
};

const ROLE_PERMISSIONS_FR: Record<string, string> = {
  tenant_admin: 'Utilisateurs, campagnes, intégrations, rapports',
  director: 'Objectifs, performance, reporting, exports',
  manager: 'Attributions, dérogations, supervision d’équipe',
  prospector: 'Prospects attribués, actions, relances, agenda',
  auditor: 'Preuves d’audit, exports, revues des accès',
  super_admin: 'Clients, offres, configuration plateforme',
};

function normalize(role: string): string {
  if (role === 'client_admin') return 'tenant_admin';
  if (role === 'observer') return 'auditor';

  return role;
}

export function getRoleLabel(role: UserRole | string, language: UiLanguage = 'en'): string {
  const labels = language === 'fr' ? ROLE_LABELS_FR : ROLE_LABELS;

  return labels[normalize(role)] ?? role;
}

export function getRoleSummary(
  role: UserRole | string,
  language: UiLanguage = 'en',
): string | null {
  const summaries = language === 'fr' ? ROLE_SUMMARIES_FR : ROLE_SUMMARIES;

  return summaries[normalize(role)] ?? null;
}

export function getRolePermissionSummary(
  role: UserRole | string,
  language: UiLanguage = 'en',
): string | null {
  const permissions = language === 'fr' ? ROLE_PERMISSIONS_FR : ROLE_PERMISSIONS;

  return permissions[normalize(role)] ?? null;
}

export function getScopeLabel(
  scopeType: 'tenant' | 'organization' | 'team',
  language: UiLanguage = 'en',
): string {
  switch (scopeType) {
    case 'tenant':
      return language === 'fr' ? 'Toutes les régions' : 'All regions';
    case 'organization':
      return language === 'fr' ? 'Périmètre de l’organisation' : 'Organization scope';
    case 'team':
      return language === 'fr' ? 'Périmètre de l’équipe' : 'Team scope';
  }
}

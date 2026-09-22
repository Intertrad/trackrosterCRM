import { and, eq, isNull } from 'drizzle-orm';

import type { Database, DatabaseExecutor } from '../database.types.js';
import { campaignProspectAssignments } from '../schema/campaign-prospect-assignments.js';
import {
  campaignProspects,
  type CampaignProspectLifecycleStage,
} from '../schema/campaign-prospects.js';
import { campaigns } from '../schema/campaigns.js';
import { establishments } from '../schema/establishments.js';
import { prospectActivities, type ProspectActivityType } from '../schema/prospect-activities.js';
import {
  prospectFollowUps,
  type ProspectFollowUpCategory,
  type ProspectFollowUpChannel,
} from '../schema/prospect-follow-ups.js';

const LEGACY_CAMPAIGN = {
  key: 'LEGACY_MANAGER',
  id: '30000000-0000-4000-8000-000000000001',
  name: 'France Healthcare Outreach',
  description: 'Development campaign retained for same-team ownership-isolation testing.',
} as const;

const PROTOTYPE_CAMPAIGNS = [
  {
    key: 'GFTIJ',
    id: '40000000-0000-4000-8000-000000000001',
    name: 'GFTIJ',
  },
  {
    key: 'SDI',
    id: '40000000-0000-4000-8000-000000000002',
    name: 'SDI',
  },
  {
    key: 'AFTIJ',
    id: '40000000-0000-4000-8000-000000000003',
    name: 'AFTIJ',
  },
] as const;

const PROTOTYPE_CAMPAIGN_DESCRIPTION =
  'Development campaign imported from the TrackRoster frontend prototype.';

const LEGACY_PROSPECTOR_EXTERNAL_REFERENCES = [
  'dev-tr031-paris-medical-center',
  'dev-tr031-lyon-dental-group',
  'dev-tr031-acme-health-france',
] as const;

const LEGACY_RETIRED_AT = new Date('2026-09-20T00:00:00.000Z');

const activityTypes = [
  'call',
  'email',
  'message',
  'visit',
] as const satisfies readonly ProspectActivityType[];

type PrototypeCampaignKey = (typeof PROTOTYPE_CAMPAIGNS)[number]['key'];

interface DevelopmentWorkQueueSeedInput {
  database: Database;
  tenantId: string;
  organizationId: string;
  teamId: string;
  prospectorUserId: string;
  otherProspectorUserId: string;
}

interface CampaignFixture {
  key: string;
  id: string;
  name: string;
  description: string;
}

interface EstablishmentFixture {
  id: string;
  externalReference: string;
  name: string;
  normalizedName: string;
  addressLine1: string | null;
  postalCode: string;
  city: string;
  countryCode: string;
  phone: string | null;
  website: string | null;
}

/*
 * Approximate city-centre coordinates for the development fixtures.
 *
 * The seed has no geocoder, and an establishment without coordinates cannot
 * be plotted, so the map would stay empty on a fresh database. These are
 * city centres, not surveyed addresses — good enough to exercise clustering,
 * the nearby panel and route previews, and never presented as precise.
 */
const DEVELOPMENT_CITY_COORDINATES: Record<string, { latitude: number; longitude: number }> = {
  Nancy: { latitude: 48.6921, longitude: 6.1844 },
  Verdun: { latitude: 49.1596, longitude: 5.3828 },
  Épinal: { latitude: 48.1744, longitude: 6.4514 },
  Metz: { latitude: 49.1193, longitude: 6.1757 },
  Toul: { latitude: 48.6759, longitude: 5.8918 },
  Colmar: { latitude: 48.0794, longitude: 7.3585 },
  'Belleville-sur-Meuse': { latitude: 49.1793, longitude: 5.3806 },
  'Thierville-sur-Meuse': { latitude: 49.1653, longitude: 5.3542 },
  Paris: { latitude: 48.8566, longitude: 2.3522 },
};

/*
 * Nudges each establishment off its city centre so fixtures in the same city
 * are distinguishable as separate markers rather than stacking exactly.
 */
function developmentCoordinates(
  city: string,
  externalReference: string,
): { latitude: number | null; longitude: number | null } {
  const base = DEVELOPMENT_CITY_COORDINATES[city];

  if (!base) {
    return { latitude: null, longitude: null };
  }

  let hash = 0;

  for (const character of externalReference) {
    hash = (hash * 31 + character.charCodeAt(0)) % 1000;
  }

  return {
    latitude: Number((base.latitude + ((hash % 50) - 25) / 2000).toFixed(6)),
    longitude: Number((base.longitude + ((Math.floor(hash / 50) % 50) - 25) / 2000).toFixed(6)),
  };
}

interface ProspectFixture {
  establishment: EstablishmentFixture;
  campaignKey: PrototypeCampaignKey | typeof LEGACY_CAMPAIGN.key;
  campaignProspectId: string;
  lifecycleStage: CampaignProspectLifecycleStage;
  assignmentId: string;
  assignedUserId: string;
  assignedAt: Date;
  activityCount: number;
  activityOffset: number;
  activityStartAt: Date;
  latestActivityType: ProspectActivityType;
  followUp: {
    id: string;
    dueAt: Date;
    assignedUserId: string | null;
    category: ProspectFollowUpCategory;
    channel: ProspectFollowUpChannel | null;
  } | null;
}

interface SeededProspectSummary {
  name: string;
  campaignId: string;
  campaignName: string;
  campaignProspectId: string;
  assignedUserId: string;
  activityCount: number;
}

function seededUuid(prefix: string, index: number): string {
  return `${prefix}000000-0000-4000-8000-` + index.toString().padStart(12, '0');
}

function localDateAt(reference: Date, dayOffset: number, hours: number, minutes = 0): Date {
  const date = new Date(reference);

  date.setDate(date.getDate() + dayOffset);
  date.setHours(hours, minutes, 0, 0);

  return date;
}

async function ensureCampaign(
  database: DatabaseExecutor,
  tenantId: string,
  organizationId: string,
  fixture: CampaignFixture,
) {
  await database
    .insert(campaigns)
    .values({
      id: fixture.id,
      tenantId,
      organizationId,
      name: fixture.name,
      description: fixture.description,
      status: 'active',
      startsAt: null,
      endsAt: null,
    })
    .onConflictDoNothing();

  const [campaign] = await database
    .update(campaigns)
    .set({
      organizationId,
      name: fixture.name,
      description: fixture.description,
      status: 'active',
      startsAt: null,
      endsAt: null,
      updatedAt: new Date(),
    })
    .where(and(eq(campaigns.tenantId, tenantId), eq(campaigns.id, fixture.id)))
    .returning();

  if (!campaign) {
    throw new Error(`Failed to prepare ${fixture.name} development campaign`);
  }

  return campaign;
}

async function ensureEstablishment(
  database: DatabaseExecutor,
  tenantId: string,
  input: EstablishmentFixture,
) {
  await database
    .insert(establishments)
    .values({
      id: input.id,
      tenantId,
      regionId: null,
      externalReference: input.externalReference,
      name: input.name,
      normalizedName: input.normalizedName,
      addressLine1: input.addressLine1,
      postalCode: input.postalCode,
      city: input.city,
      countryCode: input.countryCode,
      phone: input.phone,
      website: input.website,
      status: 'active',
      source: 'manual',
      ...developmentCoordinates(input.city, input.externalReference),
    })
    .onConflictDoNothing();

  /* externalReference is the stable identity for a development fixture. */
  const [existing] = await database
    .select()
    .from(establishments)
    .where(
      and(
        eq(establishments.tenantId, tenantId),
        eq(establishments.source, 'manual'),
        eq(establishments.externalReference, input.externalReference),
      ),
    )
    .limit(1);

  if (!existing) {
    throw new Error(`Failed to prepare development establishment: ${input.name}`);
  }

  const [establishment] = await database
    .update(establishments)
    .set({
      regionId: null,
      name: input.name,
      normalizedName: input.normalizedName,
      addressLine1: input.addressLine1,
      postalCode: input.postalCode,
      city: input.city,
      countryCode: input.countryCode,
      phone: input.phone,
      website: input.website,
      status: 'active',
      source: 'manual',
      ...developmentCoordinates(input.city, input.externalReference),
      updatedAt: new Date(),
    })
    .where(and(eq(establishments.tenantId, tenantId), eq(establishments.id, existing.id)))
    .returning();

  if (!establishment) {
    throw new Error(`Failed to synchronize development establishment: ${input.name}`);
  }

  return establishment;
}

async function ensureCampaignProspect(
  database: DatabaseExecutor,
  input: {
    id: string;
    tenantId: string;
    campaignId: string;
    establishmentId: string;
    lifecycleStage: CampaignProspectLifecycleStage;
  },
) {
  const [existing] = await database
    .select()
    .from(campaignProspects)
    .where(
      and(
        eq(campaignProspects.tenantId, input.tenantId),
        eq(campaignProspects.campaignId, input.campaignId),
        eq(campaignProspects.establishmentId, input.establishmentId),
      ),
    )
    .limit(1);

  if (existing) {
    const [updated] = await database
      .update(campaignProspects)
      .set({
        status: 'active',
        lifecycleStage: input.lifecycleStage,
        updatedAt: new Date(),
      })
      .where(
        and(eq(campaignProspects.tenantId, input.tenantId), eq(campaignProspects.id, existing.id)),
      )
      .returning();

    if (!updated) {
      throw new Error('Failed to reactivate development campaign prospect');
    }

    return updated;
  }

  const [created] = await database
    .insert(campaignProspects)
    .values({
      id: input.id,
      tenantId: input.tenantId,
      campaignId: input.campaignId,
      establishmentId: input.establishmentId,
      status: 'active',
      lifecycleStage: input.lifecycleStage,
    })
    .returning();

  if (!created) {
    throw new Error('Failed to create development campaign prospect');
  }

  return created;
}

async function ensureCurrentAssignment(
  database: DatabaseExecutor,
  input: {
    preferredId: string;
    tenantId: string;
    campaignId: string;
    campaignProspectId: string;
    organizationId: string;
    teamId: string;
    assignedUserId: string;
    assignedAt: Date;
  },
) {
  const [existing] = await database
    .select()
    .from(campaignProspectAssignments)
    .where(
      and(
        eq(campaignProspectAssignments.tenantId, input.tenantId),
        eq(campaignProspectAssignments.campaignId, input.campaignId),
        eq(campaignProspectAssignments.campaignProspectId, input.campaignProspectId),
        isNull(campaignProspectAssignments.endedAt),
      ),
    )
    .limit(1);

  if (existing) {
    const [updated] = await database
      .update(campaignProspectAssignments)
      .set({
        organizationId: input.organizationId,
        teamId: input.teamId,
        assignedUserId: input.assignedUserId,
        assignedAt: input.assignedAt,
      })
      .where(
        and(
          eq(campaignProspectAssignments.tenantId, input.tenantId),
          eq(campaignProspectAssignments.id, existing.id),
        ),
      )
      .returning();

    if (!updated) {
      throw new Error('Failed to synchronize development assignment');
    }

    return updated;
  }

  const assignmentValues = {
    tenantId: input.tenantId,
    campaignId: input.campaignId,
    campaignProspectId: input.campaignProspectId,
    organizationId: input.organizationId,
    teamId: input.teamId,
    assignedUserId: input.assignedUserId,
    assignedAt: input.assignedAt,
    endedAt: null,
  };

  const [created] = await database
    .insert(campaignProspectAssignments)
    .values({ id: input.preferredId, ...assignmentValues })
    .onConflictDoNothing()
    .returning();

  if (created) {
    return created;
  }

  /* A historical row may already own the preferred deterministic UUID. */
  const [fallback] = await database
    .insert(campaignProspectAssignments)
    .values(assignmentValues)
    .returning();

  if (!fallback) {
    throw new Error('Failed to create development assignment');
  }

  return fallback;
}

async function ensureHistoricalActivities(
  database: DatabaseExecutor,
  input: {
    tenantId: string;
    campaignId: string;
    campaignProspectId: string;
    establishmentId: string;
    assignmentId: string;
    userId: string;
    count: number;
    offset: number;
    startAt: Date;
    latestType: ProspectActivityType;
  },
): Promise<void> {
  if (input.count === 0) {
    return;
  }

  const rows = Array.from({ length: input.count }, (_, index) => {
    const sequence = input.offset + index;
    const occurredAt = new Date(input.startAt.getTime() - index * 15 * 60 * 1000);

    return {
      id: seededUuid('44', sequence),
      tenantId: input.tenantId,
      campaignId: input.campaignId,
      campaignProspectId: input.campaignProspectId,
      establishmentId: input.establishmentId,
      assignmentId: input.assignmentId,
      userId: input.userId,
      reservationId: seededUuid('45', sequence),
      type: index === 0 ? input.latestType : activityTypes[(index - 1) % activityTypes.length]!,
      occurredAt,
      createdAt: occurredAt,
    };
  });

  await database.insert(prospectActivities).values(rows).onConflictDoNothing();
}

async function ensurePendingFollowUp(
  database: DatabaseExecutor,
  input: {
    id: string;
    tenantId: string;
    campaignId: string;
    campaignProspectId: string;
    establishmentId: string;
    assignmentId: string;
    assignedUserId: string | null;
    createdBy: string;
    dueAt: Date;
    category: ProspectFollowUpCategory;
    channel: ProspectFollowUpChannel | null;
  },
): Promise<void> {
  await database
    .insert(prospectFollowUps)
    .values({
      ...input,
      status: 'pending',
      completedAt: null,
      cancelledAt: null,
    })
    .onConflictDoNothing();

  const [existing] = await database
    .select()
    .from(prospectFollowUps)
    .where(and(eq(prospectFollowUps.tenantId, input.tenantId), eq(prospectFollowUps.id, input.id)))
    .limit(1);

  if (!existing) {
    throw new Error('Failed to prepare development follow-up');
  }

  const [followUp] = await database
    .update(prospectFollowUps)
    .set({
      campaignId: input.campaignId,
      campaignProspectId: input.campaignProspectId,
      establishmentId: input.establishmentId,
      assignmentId: input.assignmentId,
      assignedUserId: input.assignedUserId,
      createdBy: input.createdBy,
      dueAt: input.dueAt,
      category: input.category,
      channel: input.channel,
      status: 'pending',
      completedAt: null,
      cancelledAt: null,
      updatedAt: new Date(),
    })
    .where(and(eq(prospectFollowUps.tenantId, input.tenantId), eq(prospectFollowUps.id, input.id)))
    .returning();

  if (!followUp) {
    throw new Error('Failed to synchronize development follow-up');
  }
}

async function retireLegacyProspectorFixtures(
  database: DatabaseExecutor,
  tenantId: string,
  prospectorUserId: string,
): Promise<void> {
  for (const externalReference of LEGACY_PROSPECTOR_EXTERNAL_REFERENCES) {
    const [establishment] = await database
      .select()
      .from(establishments)
      .where(
        and(
          eq(establishments.tenantId, tenantId),
          eq(establishments.source, 'manual'),
          eq(establishments.externalReference, externalReference),
        ),
      )
      .limit(1);

    if (!establishment) {
      continue;
    }

    let canArchiveEstablishment = true;

    const legacyProspects = await database
      .select()
      .from(campaignProspects)
      .where(
        and(
          eq(campaignProspects.tenantId, tenantId),
          eq(campaignProspects.campaignId, LEGACY_CAMPAIGN.id),
          eq(campaignProspects.establishmentId, establishment.id),
        ),
      );

    for (const legacyProspect of legacyProspects) {
      const activeAssignments = await database
        .select()
        .from(campaignProspectAssignments)
        .where(
          and(
            eq(campaignProspectAssignments.tenantId, tenantId),
            eq(campaignProspectAssignments.campaignProspectId, legacyProspect.id),
            isNull(campaignProspectAssignments.endedAt),
          ),
        );

      const ownedByAnotherUser = activeAssignments.some(
        (assignment) => assignment.assignedUserId !== prospectorUserId,
      );

      if (ownedByAnotherUser) {
        canArchiveEstablishment = false;

        continue;
      }

      for (const assignment of activeAssignments) {
        const endedAt = new Date(
          Math.max(LEGACY_RETIRED_AT.getTime(), assignment.assignedAt.getTime()),
        );

        await database
          .update(campaignProspectAssignments)
          .set({ endedAt })
          .where(
            and(
              eq(campaignProspectAssignments.tenantId, tenantId),
              eq(campaignProspectAssignments.id, assignment.id),
              eq(campaignProspectAssignments.assignedUserId, prospectorUserId),
              isNull(campaignProspectAssignments.endedAt),
            ),
          );
      }

      await database
        .update(campaignProspects)
        .set({ status: 'excluded', updatedAt: new Date() })
        .where(
          and(
            eq(campaignProspects.tenantId, tenantId),
            eq(campaignProspects.id, legacyProspect.id),
          ),
        );
    }

    if (canArchiveEstablishment) {
      await database
        .update(establishments)
        .set({ status: 'archived', updatedAt: new Date() })
        .where(and(eq(establishments.tenantId, tenantId), eq(establishments.id, establishment.id)));
    }
  }
}

function prototypeProspectFixtures(input: DevelopmentWorkQueueSeedInput): ProspectFixture[] {
  const seedRunAt = new Date();
  const rows: Array<{
    name: string;
    normalizedName: string;
    slug: string;
    postalCode: string;
    city: string;
    campaignKey: PrototypeCampaignKey;
    lifecycleStage: CampaignProspectLifecycleStage;
    assignedAt: string;
    activityCount: number;
    activityStartAt: string;
    latestActivityType: ProspectActivityType;
    followUpDueAt: Date | null;
    followUpCategory?: ProspectFollowUpCategory;
    followUpChannel?: ProspectFollowUpChannel | null;
    followUpOwnership?: 'user' | 'team';
  }> = [
    {
      name: 'Nancy central police station',
      normalizedName: 'nancy central police station',
      slug: 'nancy-central-police-station',
      postalCode: '54000',
      city: 'Nancy',
      campaignKey: 'GFTIJ',
      lifecycleStage: 'in_progress',
      assignedAt: '2026-08-20T08:00:00.000Z',
      activityCount: 30,
      activityStartAt: '2026-09-17T08:00:00.000Z',
      latestActivityType: 'call',
      followUpDueAt: localDateAt(seedRunAt, -1, 13),
      followUpCategory: 'follow_up',
      followUpChannel: 'visit',
    },
    {
      name: 'Verdun gendarmerie',
      normalizedName: 'verdun gendarmerie',
      slug: 'verdun-gendarmerie',
      postalCode: '55100',
      city: 'Verdun',
      campaignKey: 'SDI',
      lifecycleStage: 'follow_up',
      assignedAt: '2026-08-19T08:00:00.000Z',
      activityCount: 1,
      activityStartAt: '2026-09-08T08:00:00.000Z',
      latestActivityType: 'message',
      followUpDueAt: null,
    },
    {
      name: 'Épinal city hall',
      normalizedName: 'épinal city hall',
      slug: 'epinal-city-hall',
      postalCode: '88000',
      city: 'Épinal',
      campaignKey: 'GFTIJ',
      lifecycleStage: 'to_contact',
      assignedAt: '2026-08-18T08:00:00.000Z',
      activityCount: 0,
      activityStartAt: '2026-09-18T08:00:00.000Z',
      latestActivityType: 'call',
      followUpDueAt: localDateAt(seedRunAt, 0, 9, 30),
      followUpCategory: 'todo',
      followUpChannel: 'call',
    },
    {
      name: 'Metz police station',
      normalizedName: 'metz police station',
      slug: 'metz-police-station',
      postalCode: '57000',
      city: 'Metz',
      campaignKey: 'AFTIJ',
      lifecycleStage: 'qualified',
      assignedAt: '2026-08-17T08:00:00.000Z',
      activityCount: 1,
      activityStartAt: '2026-09-14T08:00:00.000Z',
      latestActivityType: 'visit',
      followUpDueAt: null,
    },
    {
      name: 'Toul court',
      normalizedName: 'toul court',
      slug: 'toul-court',
      postalCode: '54200',
      city: 'Toul',
      campaignKey: 'GFTIJ',
      lifecycleStage: 'contact_made',
      assignedAt: '2026-08-16T08:00:00.000Z',
      activityCount: 1,
      activityStartAt: '2026-09-19T08:00:00.000Z',
      latestActivityType: 'call',
      followUpDueAt: null,
    },
    {
      name: 'Colmar gendarmerie',
      normalizedName: 'colmar gendarmerie',
      slug: 'colmar-gendarmerie',
      postalCode: '68000',
      city: 'Colmar',
      campaignKey: 'SDI',
      lifecycleStage: 'converted',
      assignedAt: '2026-08-15T08:00:00.000Z',
      activityCount: 1,
      activityStartAt: '2026-08-27T08:00:00.000Z',
      latestActivityType: 'visit',
      followUpDueAt: null,
    },
    {
      name: 'Verdun court',
      normalizedName: 'verdun court',
      slug: 'verdun-court',
      postalCode: '55100',
      city: 'Verdun',
      campaignKey: 'GFTIJ',
      lifecycleStage: 'to_contact',
      assignedAt: '2026-08-14T08:00:00.000Z',
      activityCount: 0,
      activityStartAt: '2026-09-14T08:00:00.000Z',
      latestActivityType: 'call',
      followUpDueAt: localDateAt(seedRunAt, 0, 14),
      followUpCategory: 'meeting',
      followUpChannel: 'message',
    },
    {
      name: 'Verdun clinic',
      normalizedName: 'verdun clinic',
      slug: 'verdun-clinic',
      postalCode: '55100',
      city: 'Verdun',
      campaignKey: 'SDI',
      lifecycleStage: 'in_progress',
      assignedAt: '2026-08-13T08:00:00.000Z',
      activityCount: 1,
      activityStartAt: '2026-09-19T09:00:00.000Z',
      latestActivityType: 'call',
      followUpDueAt: null,
    },
    {
      name: 'Belleville city hall',
      normalizedName: 'belleville city hall',
      slug: 'belleville-city-hall',
      postalCode: '55430',
      city: 'Belleville-sur-Meuse',
      campaignKey: 'AFTIJ',
      lifecycleStage: 'follow_up',
      assignedAt: '2026-08-12T08:00:00.000Z',
      activityCount: 1,
      activityStartAt: '2026-09-15T08:00:00.000Z',
      latestActivityType: 'visit',
      followUpDueAt: localDateAt(seedRunAt, 0, 17, 30),
      followUpCategory: 'follow_up',
      followUpChannel: 'email',
      followUpOwnership: 'team',
    },
    {
      name: 'Thierville police',
      normalizedName: 'thierville police',
      slug: 'thierville-police',
      postalCode: '55840',
      city: 'Thierville-sur-Meuse',
      campaignKey: 'GFTIJ',
      lifecycleStage: 'qualified',
      assignedAt: '2026-08-11T08:00:00.000Z',
      activityCount: 1,
      activityStartAt: '2026-09-18T08:00:00.000Z',
      latestActivityType: 'visit',
      followUpDueAt: null,
    },
  ];

  return rows.map((row, position) => {
    const index = position + 1;

    return {
      establishment: {
        id: seededUuid('41', index),
        externalReference: `dev-frontend-${row.slug}`,
        name: row.name,
        normalizedName: row.normalizedName,
        addressLine1: null,
        postalCode: row.postalCode,
        city: row.city,
        countryCode: 'FR',
        phone: null,
        website: null,
      },
      campaignKey: row.campaignKey,
      campaignProspectId: seededUuid('42', index),
      lifecycleStage: row.lifecycleStage,
      assignmentId: seededUuid('43', index),
      assignedUserId: input.prospectorUserId,
      assignedAt: new Date(row.assignedAt),
      activityCount: row.activityCount,
      activityOffset: index * 100,
      activityStartAt: new Date(row.activityStartAt),
      latestActivityType: row.latestActivityType,
      followUp: row.followUpDueAt
        ? {
            id: seededUuid('46', index),
            dueAt: row.followUpDueAt,
            assignedUserId: row.followUpOwnership === 'team' ? null : input.prospectorUserId,
            category: row.followUpCategory ?? 'follow_up',
            channel: row.followUpChannel ?? null,
          }
        : null,
    };
  });
}

function managerFixture(input: DevelopmentWorkQueueSeedInput): ProspectFixture {
  return {
    establishment: {
      id: seededUuid('31', 4),
      externalReference: 'dev-tr031-rive-gauche-diagnostics',
      name: 'Rive Gauche Diagnostics',
      normalizedName: 'rive gauche diagnostics',
      addressLine1: '9 Boulevard Saint-Germain',
      postalCode: '75005',
      city: 'Paris',
      countryCode: 'FR',
      phone: '+33 1 84 80 20 04',
      website: 'https://example.com/rive-gauche-diagnostics',
    },
    campaignKey: LEGACY_CAMPAIGN.key,
    campaignProspectId: seededUuid('32', 4),
    lifecycleStage: 'to_contact',
    assignmentId: seededUuid('33', 4),
    assignedUserId: input.otherProspectorUserId,
    assignedAt: new Date('2026-09-12T11:00:00.000Z'),
    activityCount: 0,
    activityOffset: 2000,
    activityStartAt: new Date('2026-09-15T11:00:00.000Z'),
    latestActivityType: 'call',
    followUp: null,
  };
}

export async function seedDevelopmentWorkQueue(input: DevelopmentWorkQueueSeedInput): Promise<{
  campaigns: Array<{ id: string; name: string }>;
  prospects: SeededProspectSummary[];
}> {
  return input.database.transaction(async (transaction) => {
    await retireLegacyProspectorFixtures(transaction, input.tenantId, input.prospectorUserId);

    const allCampaignFixtures: CampaignFixture[] = [
      ...PROTOTYPE_CAMPAIGNS.map((fixture) => ({
        ...fixture,
        description: PROTOTYPE_CAMPAIGN_DESCRIPTION,
      })),
      LEGACY_CAMPAIGN,
    ];
    const campaignByKey = new Map<string, Awaited<ReturnType<typeof ensureCampaign>>>();

    for (const campaignFixture of allCampaignFixtures) {
      const campaign = await ensureCampaign(
        transaction,
        input.tenantId,
        input.organizationId,
        campaignFixture,
      );

      campaignByKey.set(campaignFixture.key, campaign);
    }

    const summaries: SeededProspectSummary[] = [];
    const fixtures = [...prototypeProspectFixtures(input), managerFixture(input)];

    for (const fixture of fixtures) {
      const campaign = campaignByKey.get(fixture.campaignKey);

      if (!campaign) {
        throw new Error(`Missing seeded campaign: ${fixture.campaignKey}`);
      }

      const establishment = await ensureEstablishment(
        transaction,
        input.tenantId,
        fixture.establishment,
      );
      const prospect = await ensureCampaignProspect(transaction, {
        id: fixture.campaignProspectId,
        tenantId: input.tenantId,
        campaignId: campaign.id,
        establishmentId: establishment.id,
        lifecycleStage: fixture.lifecycleStage,
      });
      const assignment = await ensureCurrentAssignment(transaction, {
        preferredId: fixture.assignmentId,
        tenantId: input.tenantId,
        campaignId: campaign.id,
        campaignProspectId: prospect.id,
        organizationId: input.organizationId,
        teamId: input.teamId,
        assignedUserId: fixture.assignedUserId,
        assignedAt: fixture.assignedAt,
      });

      await ensureHistoricalActivities(transaction, {
        tenantId: input.tenantId,
        campaignId: campaign.id,
        campaignProspectId: prospect.id,
        establishmentId: establishment.id,
        assignmentId: assignment.id,
        userId: fixture.assignedUserId,
        count: fixture.activityCount,
        offset: fixture.activityOffset,
        startAt: fixture.activityStartAt,
        latestType: fixture.latestActivityType,
      });

      if (fixture.followUp) {
        await ensurePendingFollowUp(transaction, {
          id: fixture.followUp.id,
          tenantId: input.tenantId,
          campaignId: campaign.id,
          campaignProspectId: prospect.id,
          establishmentId: establishment.id,
          assignmentId: assignment.id,
          assignedUserId: fixture.followUp.assignedUserId,
          createdBy: fixture.assignedUserId,
          dueAt: fixture.followUp.dueAt,
          category: fixture.followUp.category,
          channel: fixture.followUp.channel,
        });
      }

      summaries.push({
        name: establishment.name,
        campaignId: campaign.id,
        campaignName: campaign.name,
        campaignProspectId: prospect.id,
        assignedUserId: fixture.assignedUserId,
        activityCount: fixture.activityCount,
      });
    }

    return {
      campaigns: PROTOTYPE_CAMPAIGNS.map((fixture) => ({
        id: fixture.id,
        name: fixture.name,
      })),
      prospects: summaries,
    };
  });
}

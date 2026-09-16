import { and, eq, isNull } from 'drizzle-orm';

import type { Database } from '../database.types.js';
import { campaignProspectAssignments } from '../schema/campaign-prospect-assignments.js';
import { campaignProspects } from '../schema/campaign-prospects.js';
import { campaigns } from '../schema/campaigns.js';
import { establishments } from '../schema/establishments.js';
import { prospectActivities, type ProspectActivityType } from '../schema/prospect-activities.js';

const DEMO_CAMPAIGN_ID = '30000000-0000-4000-8000-000000000001';

const activityTypes = [
  'call',
  'email',
  'message',
  'visit',
] as const satisfies readonly ProspectActivityType[];

interface DevelopmentWorkQueueSeedInput {
  database: Database;

  tenantId: string;

  organizationId: string;

  teamId: string;

  prospectorUserId: string;

  otherProspectorUserId: string;
}

interface SeededProspectSummary {
  name: string;

  campaignProspectId: string;

  assignedUserId: string;

  activityCount: number;
}

interface EnsureEstablishmentInput {
  id: string;

  externalReference: string;

  name: string;

  normalizedName: string;

  addressLine1: string;

  postalCode: string;

  city: string;

  countryCode: string;

  phone: string | null;

  website: string | null;
}

interface ProspectFixture {
  establishment: EnsureEstablishmentInput;

  campaignProspectId: string;

  assignmentId: string;

  assignedUserId: string;

  assignedAt: Date;

  activityCount: number;

  activityOffset: number;

  activityStartAt: Date;
}

function seededUuid(prefix: string, index: number): string {
  return `${prefix}000000-0000-4000-8000-` + index.toString().padStart(12, '0');
}

async function ensureCampaign(database: Database, tenantId: string, organizationId: string) {
  await database
    .insert(campaigns)
    .values({
      id: DEMO_CAMPAIGN_ID,

      tenantId,

      organizationId,

      name: 'France Healthcare Outreach',

      description: 'Development campaign for Work Queue and Prospect Detail testing.',

      status: 'active',

      startsAt: null,

      endsAt: null,
    })
    .onConflictDoNothing();

  const [campaign] = await database
    .update(campaigns)
    .set({
      organizationId,

      name: 'France Healthcare Outreach',

      description: 'Development campaign for Work Queue and Prospect Detail testing.',

      status: 'active',

      startsAt: null,

      endsAt: null,

      updatedAt: new Date(),
    })
    .where(and(eq(campaigns.tenantId, tenantId), eq(campaigns.id, DEMO_CAMPAIGN_ID)))
    .returning();

  if (!campaign) {
    throw new Error('Failed to prepare TR-031 development campaign');
  }

  return campaign;
}

async function ensureEstablishment(
  database: Database,
  tenantId: string,
  input: EnsureEstablishmentInput,
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

      latitude: null,

      longitude: null,
    })
    .onConflictDoNothing();

  /*
   * externalReference is the natural development-seed identity.
   *
   * This also handles a previous seed run where PostgreSQL already
   * contains the fixture but its generated/stored UUID differs.
   */
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

      latitude: null,

      longitude: null,

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
  database: Database,
  input: {
    id: string;

    tenantId: string;

    campaignId: string;

    establishmentId: string;
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
    })
    .returning();

  if (!created) {
    throw new Error('Failed to create development campaign prospect');
  }

  return created;
}

async function ensureCurrentAssignment(
  database: Database,
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
    /*
     * These prospects belong exclusively to the development fixture,
     * so rerunning the seed restores their expected owner/workspace.
     */
    const [updated] = await database
      .update(campaignProspectAssignments)
      .set({
        organizationId: input.organizationId,

        teamId: input.teamId,

        assignedUserId: input.assignedUserId,
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

  const [created] = await database
    .insert(campaignProspectAssignments)
    .values({
      id: input.preferredId,

      tenantId: input.tenantId,

      campaignId: input.campaignId,

      campaignProspectId: input.campaignProspectId,

      organizationId: input.organizationId,

      teamId: input.teamId,

      assignedUserId: input.assignedUserId,

      assignedAt: input.assignedAt,

      endedAt: null,
    })
    .onConflictDoNothing()
    .returning();

  if (created) {
    return created;
  }

  /*
   * A historical row may already own the deterministic development
   * UUID. In that unusual case, create a new current assignment
   * using PostgreSQL's normal UUID default instead.
   */
  const [fallback] = await database
    .insert(campaignProspectAssignments)
    .values({
      tenantId: input.tenantId,

      campaignId: input.campaignId,

      campaignProspectId: input.campaignProspectId,

      organizationId: input.organizationId,

      teamId: input.teamId,

      assignedUserId: input.assignedUserId,

      assignedAt: input.assignedAt,

      endedAt: null,
    })
    .returning();

  if (!fallback) {
    throw new Error('Failed to create development assignment');
  }

  return fallback;
}

async function ensureHistoricalActivities(
  database: Database,
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
  },
): Promise<void> {
  if (input.count === 0) {
    return;
  }

  const rows = Array.from(
    {
      length: input.count,
    },
    (_, index) => {
      const sequence = input.offset + index;

      const occurredAt = new Date(input.startAt.getTime() - index * 15 * 60 * 1000);

      return {
        id: seededUuid('34', sequence),

        tenantId: input.tenantId,

        campaignId: input.campaignId,

        campaignProspectId: input.campaignProspectId,

        establishmentId: input.establishmentId,

        assignmentId: input.assignmentId,

        userId: input.userId,

        /*
         * Synthetic development-history identifier.
         *
         * Runtime activity creation still requires a real Redis
         * reservation through ProspectActivityService.
         */
        reservationId: seededUuid('35', sequence),

        type: activityTypes[index % activityTypes.length]!,

        occurredAt,

        createdAt: occurredAt,
      };
    },
  );

  /*
   * Activity IDs are deterministic so repeated db:seed runs
   * do not duplicate timeline history.
   */
  await database.insert(prospectActivities).values(rows).onConflictDoNothing();
}

export async function seedDevelopmentWorkQueue(input: DevelopmentWorkQueueSeedInput): Promise<{
  campaignId: string;

  prospects: SeededProspectSummary[];
}> {
  const campaign = await ensureCampaign(input.database, input.tenantId, input.organizationId);

  const fixtures: ProspectFixture[] = [
    {
      establishment: {
        id: seededUuid('31', 1),

        externalReference: 'dev-tr031-paris-medical-center',

        name: 'Paris Medical Center',

        normalizedName: 'paris medical center',

        addressLine1: '18 Rue de Rivoli',

        postalCode: '75004',

        city: 'Paris',

        countryCode: 'FR',

        phone: '+33 1 84 80 20 01',

        website: 'https://example.com/paris-medical-center',
      },

      campaignProspectId: seededUuid('32', 1),

      assignmentId: seededUuid('33', 1),

      assignedUserId: input.prospectorUserId,

      assignedAt: new Date('2026-09-15T08:00:00.000Z'),

      activityCount: 0,

      activityOffset: 1,

      activityStartAt: new Date('2026-09-15T14:00:00.000Z'),
    },

    {
      establishment: {
        id: seededUuid('31', 2),

        externalReference: 'dev-tr031-lyon-dental-group',

        name: 'Lyon Dental Group',

        normalizedName: 'lyon dental group',

        addressLine1: '24 Rue de la République',

        postalCode: '69002',

        city: 'Lyon',

        countryCode: 'FR',

        phone: '+33 4 72 00 20 02',

        website: 'https://example.com/lyon-dental-group',
      },

      campaignProspectId: seededUuid('32', 2),

      assignmentId: seededUuid('33', 2),

      assignedUserId: input.prospectorUserId,

      assignedAt: new Date('2026-09-14T09:00:00.000Z'),

      activityCount: 4,

      activityOffset: 10,

      activityStartAt: new Date('2026-09-15T13:00:00.000Z'),
    },

    {
      establishment: {
        id: seededUuid('31', 3),

        externalReference: 'dev-tr031-acme-health-france',

        name: 'Acme Health France',

        normalizedName: 'acme health france',

        addressLine1: '42 Avenue des Champs-Élysées',

        postalCode: '75008',

        city: 'Paris',

        countryCode: 'FR',

        phone: '+33 1 84 80 20 03',

        website: 'https://example.com/acme-health-france',
      },

      campaignProspectId: seededUuid('32', 3),

      assignmentId: seededUuid('33', 3),

      assignedUserId: input.prospectorUserId,

      assignedAt: new Date('2026-09-13T10:00:00.000Z'),

      /*
       * 30 rows intentionally exercise TR-031 cursor pagination:
       *
       * initial page = 25
       * Load older activity = remaining 5
       */
      activityCount: 30,

      activityOffset: 100,

      activityStartAt: new Date('2026-09-15T12:00:00.000Z'),
    },

    {
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

      campaignProspectId: seededUuid('32', 4),

      assignmentId: seededUuid('33', 4),

      /*
       * manager@intertrad.test also owns an exact Prospector/team
       * grant, so this gives us a same-team different-user fixture.
       */
      assignedUserId: input.otherProspectorUserId,

      assignedAt: new Date('2026-09-12T11:00:00.000Z'),

      activityCount: 0,

      activityOffset: 200,

      activityStartAt: new Date('2026-09-15T11:00:00.000Z'),
    },
  ];

  const summaries: SeededProspectSummary[] = [];

  for (const fixture of fixtures) {
    const establishment = await ensureEstablishment(
      input.database,
      input.tenantId,
      fixture.establishment,
    );

    const prospect = await ensureCampaignProspect(input.database, {
      id: fixture.campaignProspectId,

      tenantId: input.tenantId,

      campaignId: campaign.id,

      establishmentId: establishment.id,
    });

    const assignment = await ensureCurrentAssignment(input.database, {
      preferredId: fixture.assignmentId,

      tenantId: input.tenantId,

      campaignId: campaign.id,

      campaignProspectId: prospect.id,

      organizationId: input.organizationId,

      teamId: input.teamId,

      assignedUserId: fixture.assignedUserId,

      assignedAt: fixture.assignedAt,
    });

    await ensureHistoricalActivities(input.database, {
      tenantId: input.tenantId,

      campaignId: campaign.id,

      campaignProspectId: prospect.id,

      establishmentId: establishment.id,

      assignmentId: assignment.id,

      userId: fixture.assignedUserId,

      count: fixture.activityCount,

      offset: fixture.activityOffset,

      startAt: fixture.activityStartAt,
    });

    summaries.push({
      name: establishment.name,

      campaignProspectId: prospect.id,

      assignedUserId: fixture.assignedUserId,

      activityCount: fixture.activityCount,
    });
  }

  return {
    campaignId: campaign.id,

    prospects: summaries,
  };
}

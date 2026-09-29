import { describe, expect, it } from 'vitest';
import { OPERATIONS } from './operations';
import { WORKSPACE_MODULES } from './modules';
import { initialValues, operationUrl, serializeFields } from './client';
import { validateFields } from './validation';
import { recordContext } from '@/components/workspace/workspace-module';

describe('workspace contracts', () => {
  it('reserves new teams and territories for tenant administrators', () => {
    for (const id of ['teams', 'territories']) {
      const definition = WORKSPACE_MODULES.find((item) => item.id === id)!;
      expect(definition.actions.find((action) => action.scope === 'collection')?.roles).toEqual([
        'admin',
      ]);
    }
  });
  it('allows observers only evidence export, never business-data mutations', () => {
    for (const definition of WORKSPACE_MODULES.filter((item) => item.id.startsWith('audit-'))) {
      expect(definition.roles).toContain('observer');
      expect(
        definition.actions.every((action) => action.operation === 'POST /audit/evidence-exports'),
      ).toBe(true);
    }
  });
  it('uses registered operations for every page, detail, action and related view', () => {
    for (const definition of WORKSPACE_MODULES) {
      for (const key of [
        definition.read,
        definition.detail,
        ...definition.actions.map((a) => a.operation),
        ...(definition.related ?? []).map((r) => r.operation),
      ].filter(Boolean))
        expect(OPERATIONS[key!], key).toBeDefined();
    }
  });
  it('never substitutes a prospect id for a tag id or invents a relation', () => {
    const definition = WORKSPACE_MODULES.find((m) => m.id === 'prospect-record')!;
    const context = recordContext(
      definition,
      { id: 'establishment' },
      { prospectId: 'establishment' },
    );
    expect(context.tagId).toBeUndefined();
    expect(() => operationUrl('POST /prospects/:prospectId/tags/:tagId', context)).toThrow();
  });
  it('keeps the parent conversation id when a participant row has its own id', () => {
    const definition = WORKSPACE_MODULES.find((m) => m.id === 'conversation-members')!;
    const context = recordContext(
      definition,
      { id: 'participant-row', membershipId: 'member' },
      { id: 'conversation' },
    );
    expect(context.id).toBe('conversation');
    expect(operationUrl('DELETE /conversations/:id/participants/:membershipId', context)).toBe(
      '/api/workspace/conversations/conversation/participants/member',
    );
  });
  it('serializes false, zero, dates and nested DTOs without extra read-only data', () => {
    const fields = OPERATIONS['PATCH /teams/:teamId']!.fields;
    const values = initialValues(fields, {
      name: 'Team',
      capacity: 0,
      id: 'readonly',
      tenantId: 'private',
    });
    expect(serializeFields(fields, values)).toMatchObject({ name: 'Team', capacity: 0 });
    expect(serializeFields(fields, values)).not.toHaveProperty('tenantId');
    const policy = OPERATIONS['PATCH /settings/security']!.fields;
    expect(
      serializeFields(policy, {
        requireMfa: false,
        sso: {
          provider: 'oidc',
          mode: 'configured',
          issuer: 'https://issuer.example',
          clientId: 'client',
          allowedDomains: ['example.com'],
          unknown: 'no',
        },
      }),
    ).toEqual({
      requireMfa: false,
      sso: {
        provider: 'oidc',
        mode: 'configured',
        issuer: 'https://issuer.example',
        clientId: 'client',
        allowedDomains: ['example.com'],
      },
    });
  });
  it('validates nested required values and prevents malformed structured settings', () => {
    const fields = OPERATIONS['POST /assignment-rules']!.fields;
    const errors = validateFields(
      fields,
      { campaignId: 'bad', name: 'Rule', strategy: 'round_robin', targets: [{}] },
      'en',
    );
    expect(errors.campaignId).toBeDefined();
    expect(errors['targets.0.teamId']).toBeDefined();
    expect(
      validateFields([{ name: 'config', type: 'object' }], { config: 'broken' }, 'en').config,
    ).toBeDefined();
  });
});

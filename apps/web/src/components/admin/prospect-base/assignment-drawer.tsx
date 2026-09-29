'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { Drawer } from '@/components/ui/drawer';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { LinkButton } from '@/components/ui/link-button';
import { RecordPicker } from '@/components/workspace/record-picker';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { text } from '@/lib/workspace/copy';
import { browserJson } from '@/lib/api/browser-json';
import { ApiError } from '@/lib/api/api-error';
import { previewCampaignEnrolment, applyCampaignEnrolment } from '@/lib/api/campaign-client';
import { previewAssignment, applyAssignment } from '@/lib/api/assignment-client';
import type {
  AssignmentBatchInput,
  AssignmentBatchResult,
  AssignmentOutcome,
} from '@/lib/api/assignment-types';
import type { CampaignEnrolmentResult } from '@/lib/api/campaign-types';
import type { Prospect } from '@/lib/api/prospect-types';

const REASONS: Record<AssignmentOutcome, [string, string]> = {
  proposed: ['Ready', 'Prêt'],
  already_assigned: ['Already assigned', 'Déjà attribué'],
  inactive_prospect: ['Inactive or excluded', 'Inactif ou exclu'],
  missing_coordinates: ['Missing coordinates', 'Coordonnées manquantes'],
  capacity_exhausted: [
    'Team or member capacity reached',
    'Capacité de l’équipe ou du membre atteinte',
  ],
  ineligible_target: ['Member is no longer eligible', 'Le membre n’est plus éligible'],
  no_skill_match: ['Required skills unavailable', 'Compétences requises indisponibles'],
  no_proximity_match: ['No nearby member', 'Aucun membre à proximité'],
};

type Membership = { id: string; establishmentId: string; status: 'active' | 'excluded' };

/** Explicit enrollment and assignment commits, with a recoverable boundary between them. */
export function ProspectAssignmentDrawer({
  records,
  onClose,
  onAssigned,
}: {
  records: Prospect[];
  onClose: () => void;
  onAssigned: (count: number) => void;
}) {
  const { language } = useTranslation();
  const l = (en: string, fr: string) => text(en, fr, language);
  const [campaign, setCampaign] = useState({ id: '', name: '', organizationId: '' });
  const [team, setTeam] = useState({ id: '', name: '' });
  const [member, setMember] = useState({ id: '', name: '' });
  const [enrollment, setEnrollment] = useState<CampaignEnrolmentResult | null>(null);
  const [preview, setPreview] = useState<AssignmentBatchResult | null>(null);
  const [input, setInput] = useState<AssignmentBatchInput | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [enrolled, setEnrolled] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const enrollmentKey = useRef(crypto.randomUUID());
  const assignmentKey = useRef(crypto.randomUUID());
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (campaign.id && done === null) event.preventDefault();
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [campaign.id, done]);

  const selection = { establishmentIds: records.map((r) => r.id), limit: records.length };
  const reset = () => {
    setEnrollment(null);
    setPreview(null);
    setInput(null);
    setError(null);
    enrollmentKey.current = crypto.randomUUID();
    assignmentKey.current = crypto.randomUUID();
  };
  const close = () => {
    if (pending.current) return;
    if (campaign.id && done === null) setClosing(true);
    else onClose();
  };
  async function run(work: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (caught) {
      if (caught instanceof ApiError && caught.statusCode === 409) setPreview(null);
      if (mounted.current)
        setError(
          caught instanceof ApiError
            ? caught.statusCode === 409
              ? l(
                  'The selection or capacity changed. Refresh the preview before assigning.',
                  'La sélection ou la capacité a changé. Actualisez l’aperçu avant d’attribuer.',
                )
              : caught.statusCode === 403
                ? l(
                    'Your access no longer permits this operation.',
                    'Vos droits ne permettent plus cette opération.',
                  )
                : l(
                    'The result could not be confirmed. Your selection is kept; retry safely.',
                    'Le résultat n’a pas pu être confirmé. Votre sélection est conservée ; vous pouvez réessayer.',
                  ) + (caught.requestId ? ` (${caught.requestId})` : '')
            : caught instanceof Error
              ? caught.message
              : l('Please retry.', 'Veuillez réessayer.'),
        );
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function prepareAssignment() {
    const memberships = await browserJson<Membership[]>(
      `/api/campaigns/${campaign.id}/prospects?establishmentIds=${selection.establishmentIds.join(',')}`,
      { cache: 'no-store' },
    );
    if (memberships.length !== records.length || memberships.some((m) => m.status !== 'active'))
      throw new Error(
        l(
          'Some selected records are inactive or excluded. Enrollment is saved; close this panel and select only eligible records.',
          'Certains établissements sont inactifs ou exclus. L’inscription est enregistrée ; fermez ce panneau et sélectionnez uniquement les établissements éligibles.',
        ),
      );
    const next = {
      campaignId: campaign.id,
      teamId: team.id,
      assignedUserId: member.id,
      prospectIds: memberships.map((m) => m.id),
    };
    setNames(
      Object.fromEntries(
        memberships.map((m) => [
          m.id,
          records.find((r) => r.id === m.establishmentId)?.name ?? m.id,
        ]),
      ),
    );
    setInput(next);
    setPreview(await previewAssignment(next));
    assignmentKey.current = crypto.randomUUID();
  }
  const canConfigure = !enrolled && !input;
  return (
    <Drawer
      open
      title={l('Assign prospects', 'Attribuer des établissements')}
      onClose={close}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          {closing ? (
            <>
              <Button variant="secondary" onClick={() => setClosing(false)}>
                {l('Keep editing', 'Continuer')}
              </Button>
              <Button onClick={onClose}>{l('Close panel', 'Fermer le panneau')}</Button>
            </>
          ) : done !== null ? (
            <Button onClick={onClose}>{l('Done', 'Terminer')}</Button>
          ) : (
            <>
              <Button variant="secondary" disabled={busy} onClick={close}>
                {l('Close', 'Fermer')}
              </Button>
              {!enrollment ? (
                <Button
                  loading={busy}
                  disabled={!campaign.id || !team.id || !member.id}
                  onClick={() =>
                    void run(async () =>
                      setEnrollment(await previewCampaignEnrolment(campaign.id, selection)),
                    )
                  }
                >
                  {l('Preview selection', 'Vérifier la sélection')}
                </Button>
              ) : !input ? (
                <Button
                  loading={busy}
                  disabled={
                    enrollment.selected !== records.length || enrollment.alreadyExcluded > 0
                  }
                  onClick={() =>
                    void run(async () => {
                      if (!enrolled && enrollment.enrollable > 0) {
                        await applyCampaignEnrolment(campaign.id, selection, enrollmentKey.current);
                        setEnrolled(true);
                      }
                      await prepareAssignment();
                    })
                  }
                >
                  {enrollment.enrollable > 0 && !enrolled
                    ? l('Add and preview assignment', 'Inscrire et vérifier l’attribution')
                    : l('Preview assignment', 'Vérifier l’attribution')}
                </Button>
              ) : (
                <Button
                  loading={busy}
                  disabled={!preview?.canApply || !preview.proposed}
                  onClick={() =>
                    void run(async () => {
                      const result = await applyAssignment(input, assignmentKey.current);
                      setDone(result.assigned);
                      onAssigned(result.assigned);
                    })
                  }
                >
                  {l(
                    `Assign ${preview?.proposed ?? records.length} prospects`,
                    `Attribuer ${preview?.proposed ?? records.length} établissements`,
                  )}
                </Button>
              )}
            </>
          )}
        </div>
      }
    >
      <div className="space-y-5">
        {closing && (
          <Alert tone="warning">
            {enrolled
              ? l(
                  'Campaign enrollment is saved. Closing does not undo completed operations. Check the portfolio before starting another assignment.',
                  'L’inscription à la campagne est enregistrée. Fermer n’annule pas les opérations terminées. Vérifiez le portefeuille avant de préparer une autre attribution.',
                )
              : l(
                  'Close and discard this assignment setup?',
                  'Fermer et abandonner cette préparation d’attribution ?',
                )}
          </Alert>
        )}
        {error && <Alert tone="danger">{error}</Alert>}
        {done !== null ? (
          <div className="space-y-3 py-6" role="status">
            <CheckCircle2 className="size-10 text-success" aria-hidden="true" />
            <h3 className="text-xl font-bold text-navy">
              {l(`${done} prospects assigned`, `${done} établissements attribués`)}
            </h3>
            <p>
              {l(
                `They are now in ${member.name}’s portfolio.`,
                `Ils figurent désormais dans le portefeuille de ${member.name}.`,
              )}
            </p>
            <LinkButton href="/manager/assignments/active" variant="secondary">
              {l('View assignments', 'Voir les attributions')}
            </LinkButton>
          </div>
        ) : (
          <>
            <div className="rounded-lg bg-brand-tint p-4">
              <p className="font-semibold text-navy">
                {l(
                  `${records.length} selected establishments`,
                  `${records.length} établissements sélectionnés`,
                )}
              </p>
              <p className="mt-1 text-sm text-ink-soft">
                {l(
                  'Choose a campaign, team and prospector. Review each step before saving.',
                  'Choisissez une campagne, une équipe et un prospecteur. Vérifiez chaque étape avant de valider.',
                )}
              </p>
            </div>
            <ol
              className="flex flex-wrap gap-3 text-sm text-ink-muted"
              aria-label={l('Assignment steps', 'Étapes de l’attribution')}
            >
              <li className={enrollment ? '' : 'font-bold text-brand'}>
                1 · {l('Selection', 'Sélection')}
              </li>
              <li className={enrollment && !input ? 'font-bold text-brand' : ''}>
                2 · {l('Campaign', 'Campagne')}
              </li>
              <li className={input ? 'font-bold text-brand' : ''}>
                3 · {l('Assignment', 'Attribution')}
              </li>
            </ol>
            <RecordPicker
              name="campaignId"
              label={l('Active campaign', 'Campagne active')}
              value={campaign.id}
              disabled={busy || !canConfigure}
              filters={{ status: 'active' }}
              onChange={() => {}}
              onRecordChange={(r) => {
                setCampaign({
                  id: String(r?.id ?? ''),
                  name: String(r?.name ?? ''),
                  organizationId: String(r?.organizationId ?? ''),
                });
                setTeam({ id: '', name: '' });
                setMember({ id: '', name: '' });
                reset();
              }}
            />
            <RecordPicker
              key={`team-${campaign.id}`}
              name="teamId"
              label={l('Team', 'Équipe')}
              value={team.id}
              enabled={!!campaign.organizationId}
              disabled={busy || !canConfigure || !campaign.organizationId}
              filters={{ organizationId: campaign.organizationId, status: 'active' }}
              onChange={() => {}}
              onRecordChange={(r) => {
                setTeam({ id: String(r?.id ?? ''), name: String(r?.name ?? '') });
                setMember({ id: '', name: '' });
                reset();
              }}
            />
            <RecordPicker
              key={`member-${team.id}`}
              name="assignedUserId"
              label={l('Prospector', 'Prospecteur')}
              value={member.id}
              enabled={!!team.id}
              disabled={busy || !canConfigure || !team.id}
              filters={{ teamId: team.id, role: 'prospector', status: 'active' }}
              onChange={() => {}}
              onRecordChange={(r) => {
                setMember({
                  id: String(r?.id ?? ''),
                  name: String(r?.displayName ?? r?.email ?? ''),
                });
                reset();
              }}
            />
            {!campaign.id && (
              <LinkButton href="/manager/campaigns" variant="secondary">
                {l('Manage campaigns', 'Gérer les campagnes')}
              </LinkButton>
            )}
            {enrollment && (
              <Alert
                tone={
                  enrollment.alreadyExcluded > 0 || enrollment.selected !== records.length
                    ? 'warning'
                    : 'info'
                }
              >
                {l(
                  `${enrollment.enrollable} to add · ${enrollment.alreadyActive} already active · ${enrollment.alreadyExcluded} excluded.`,
                  `${enrollment.enrollable} à inscrire · ${enrollment.alreadyActive} déjà actifs · ${enrollment.alreadyExcluded} exclus.`,
                )}{' '}
                {enrollment.alreadyExcluded > 0 &&
                  l(
                    'Excluded records are not reactivated. Close and adjust your selection.',
                    'Les établissements exclus ne sont pas réactivés. Fermez et ajustez la sélection.',
                  )}
              </Alert>
            )}
            {enrolled && (
              <p role="status" className="text-sm font-semibold text-success">
                {l(
                  'Campaign enrollment saved. Assignment still needs confirmation.',
                  'Inscription enregistrée. L’attribution reste à confirmer.',
                )}
              </p>
            )}
            {preview && (
              <section
                className="space-y-3"
                aria-label={l('Assignment review', 'Vérification de l’attribution')}
              >
                <h3 className="text-lg font-bold text-navy">
                  {l(
                    `${preview.proposed} ready · ${preview.conflicts} conflicts`,
                    `${preview.proposed} prêts · ${preview.conflicts} conflits`,
                  )}
                </h3>
                <p className="text-sm">
                  {campaign.name} · {team.name} · {member.name}
                </p>
                {preview.decisions
                  .filter((d) => d.outcome !== 'proposed')
                  .map((d) => (
                    <p key={d.prospectId} className="text-sm text-warning">
                      <strong>{names[d.prospectId]}</strong> —{' '}
                      {l(...(REASONS[d.outcome] ?? ['Unavailable', 'Indisponible']))}
                    </p>
                  ))}
                {!preview.canApply && (
                  <Alert tone="warning">
                    {l(
                      'Nothing will be assigned while conflicts remain. Close to adjust the selection, or refresh after resolving them.',
                      'Aucune attribution tant que des conflits subsistent. Fermez pour ajuster la sélection, ou actualisez après leur résolution.',
                    )}
                  </Alert>
                )}
              </section>
            )}
            {input && (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => void run(prepareAssignment)}
              >
                {l('Refresh preview', 'Actualiser l’aperçu')}
              </Button>
            )}
            <div className="flex gap-2 border-t border-line-soft pt-4 text-sm text-ink-muted">
              <ShieldCheck className="size-5 shrink-0" aria-hidden="true" />
              <p>
                {l(
                  'Existing assignments are preserved. Contact permission and reservations are checked when the prospector starts work.',
                  'Les attributions existantes sont conservées. Les droits de contact et réservations sont vérifiés au démarrage de la prospection.',
                )}
              </p>
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}

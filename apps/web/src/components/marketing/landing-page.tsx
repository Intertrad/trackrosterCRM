'use client';

import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  Check,
  CheckCircle2,
  CircleAlert,
  ChevronDown,
  Clock3,
  FileCheck2,
  Globe2,
  LockKeyhole,
  MapPinned,
  Menu,
  MessageCircle,
  Network,
  Radar,
  ShieldCheck,
  Users,
  X,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { createElement, type ReactNode, useEffect, useRef, useState } from 'react';

import { BrandLockup } from '@/components/ui/brand-mark';

const problemCards = [
  [
    'Fragmented files',
    'One file per region, one little cross-team visibility.',
    'Every team works from a different version.',
  ],
  [
    'Crossed contacts',
    'Two prospectors call or visit the same site without knowing it.',
    'A shared prospect record removes the collision.',
  ],
  [
    'Overwritten history',
    'Follow-ups end up in one file, or replace the previous entry.',
    'The timeline stays immutable and complete.',
  ],
  [
    'Unbalanced workload',
    'A region with 30 sites and one with 292 are treated as equivalent.',
    'Managers see capacity before they assign.',
  ],
  [
    'Late oversight',
    'The manager only discovers the delay after the fact.',
    'Due dates and follow-up reviews keep work moving.',
  ],
  [
    'Unreliable data',
    'Duplicates, missing contact details, inconsistent statuses.',
    'A shared repository makes gaps visible.',
  ],
] as const;

const engineCards = [
  ['01', 'Duplicate detection', 'Same name, address, phone, domain, legal ID and similarity.'],
  ['02', 'Active assignment', 'Know who is already working the prospect, campaign and when.'],
  ['03', 'Planned action', 'See whether a call, visit or email is already planned.'],
  [
    '04',
    'Instant reservation',
    'Prevent a second company from contacting the same prospect right now.',
  ],
  ['05', 'Cooldown period', 'Was the prospect contacted too recently?'],
  ['06', 'Multi-policy page', 'Are the campaign, shared or deferred rules different?'],
] as const;

const roleCards = [
  {
    label: 'Prospector',
    color: 'blue',
    subtitle: 'Their day, in one screen',
    bullets: [
      'My day with priorities and the next useful step',
      'The answer before any contact: may I contact this site?',
      'An action logged in under a minute, on mobile',
    ],
  },
  {
    label: 'Manager',
    color: 'lime',
    subtitle: 'Batches and exceptions, not noise',
    bullets: [
      'Assign by capacity, territory, cities or priority',
      'Approve exceptions with a reason and a duration',
      'Coach on the quality of the summaries',
    ],
  },
  {
    label: 'Director & audit',
    color: 'purple',
    subtitle: 'Read, compare, prove',
    bullets: [
      'Consolidated performance across every company',
      'Company-by-company assignment history',
      'An immutable, hash-chained audit log',
    ],
  },
] as const;

const securityCards = [
  [
    'Tenant isolation',
    'No data crosses companies unless the publisher itself needs a time-boxed, client-approved grant.',
    ShieldCheck,
  ],
  [
    'Role-based access',
    'Permissions follow role, team, company and territory — the same scope drives the engine every export.',
    LockKeyhole,
  ],
  [
    'Immutable history',
    'Once an action or correction is written, the original is never rewritten.',
    FileCheck2,
  ],
  [
    'Hash-chained audit',
    'Assignments, exports, overrides and sensitive changes are logged and verifiable.',
    Network,
  ],
  [
    'MFA and sessions',
    'Enforced multi-factor authentication, password policy, controlled sessions, optional SSO.',
    Users,
  ],
  [
    'European hosting',
    'Hosted in France, tested restores, retention and deletion policies under contract.',
    Globe2,
  ],
] as const;

const faqs = [
  [
    'Is this a CRM?',
    'No. A CRM stores what happened. TrackRoster decides what is allowed to happen next, before the call, and keeps the trace of that decision.',
  ],
  [
    'Can we migrate from Excel?',
    'Yes. The import wizard maps your columns, normalises phones and addresses, flags duplicates above a similarity threshold and lets you fix anomalies before anything enters the active base.',
  ],
  [
    'What is a prospector really has to call a blocked prospect?',
    'They request an override. A manager grants it with a reason and a duration, both prospectors are notified, and the exception is written to the audit log.',
  ],
  [
    'Does it work on the road?',
    'Yes — mobile-first daily work, a fast action form and a map for calls, visits and follow-ups.',
  ],
  [
    'Where is the data hosted?',
    'In France, with tested restores, retention policy control and exports limited by role.',
  ],
] as const;

const pricing = [
  {
    name: 'Team',
    description: 'A single prospecting team',
    price: '€29',
    suffix: 'per user / month',
    featured: false,
    items: [
      'Prospects, contacts and actions',
      'Assignments and follow-ups',
      'Standard anti-collision',
      'Team dashboard',
      'CSV / XLSX exports',
    ],
  },
  {
    name: 'Network',
    description: 'Multi-company networks',
    price: '€49',
    suffix: 'per user / month',
    featured: true,
    items: [
      'Everything in Team',
      'Multi-company permissions',
      'Mapping and route planning',
      'Advanced rules and cooldowns',
      'Multi-team reports',
    ],
  },
  {
    name: 'Group',
    description: 'Multi-brand groups',
    price: 'On request',
    suffix: 'annual contract',
    featured: false,
    items: [
      'Everything in Network',
      'Cross-company coordination matrix',
      'Contact policies per brand',
      'API, SSO and audit exports',
      'White label',
    ],
  },
] as const;

const frenchProblemCards = [
  [
    'Fichiers fragmentés',
    'Un fichier par région, avec peu de visibilité entre les équipes.',
    'Chaque équipe travaille depuis une version différente.',
  ],
  [
    'Contacts croisés',
    'Deux prospecteurs appellent ou visitent le même site sans le savoir.',
    'Une fiche prospect partagée évite le conflit.',
  ],
  [
    'Historique écrasé',
    'Les relances finissent dans un seul fichier ou remplacent l’entrée précédente.',
    'La timeline reste immuable et complète.',
  ],
  [
    'Charge déséquilibrée',
    'Une région avec 30 sites et une autre avec 292 sont traitées de la même façon.',
    'Les managers voient la capacité avant d’affecter.',
  ],
  [
    'Suivi tardif',
    'Le manager ne découvre le retard qu’après coup.',
    'Les échéances et les revues de relance maintiennent le rythme.',
  ],
  [
    'Données peu fiables',
    'Doublons, coordonnées manquantes, statuts incohérents.',
    'Une base partagée rend les lacunes visibles.',
  ],
] as const;

const frenchEngineCards = [
  [
    '01',
    'Détection des doublons',
    'Même nom, adresse, téléphone, domaine, identifiant légal et similarité.',
  ],
  [
    '02',
    'Affectation active',
    'Savoir qui travaille déjà sur le prospect, pour quelle campagne et quand.',
  ],
  ['03', 'Action planifiée', 'Voir si un appel, une visite ou un e-mail est déjà prévu.'],
  [
    '04',
    'Réservation instantanée',
    'Empêcher une autre entreprise de contacter le prospect maintenant.',
  ],
  ['05', 'Période de refroidissement', 'Le prospect a-t-il été contacté trop récemment ?'],
  [
    '06',
    'Page multi-règles',
    'Les règles de campagne, de partage ou de report sont-elles différentes ?',
  ],
] as const;

const frenchRoleCards = [
  {
    label: 'Prospecteur',
    color: 'blue',
    subtitle: 'Sa journée, sur un seul écran',
    bullets: [
      'Ma journée, les priorités et la prochaine étape utile',
      'La réponse avant tout contact : puis-je contacter ce site ?',
      'Une action enregistrée en moins d’une minute sur mobile',
    ],
  },
  {
    label: 'Manager',
    color: 'lime',
    subtitle: 'Lots et exceptions, sans bruit',
    bullets: [
      'Affecter selon la capacité, le territoire, les villes ou la priorité',
      'Approuver les exceptions avec une raison et une durée',
      'Accompagner la qualité des comptes rendus',
    ],
  },
  {
    label: 'Direction et audit',
    color: 'purple',
    subtitle: 'Lire, comparer, prouver',
    bullets: [
      'Une performance consolidée pour chaque entreprise',
      'L’historique des affectations entreprise par entreprise',
      'Un journal d’audit immuable et chaîné par hash',
    ],
  },
] as const;

const frenchSecurityCards = [
  [
    'Isolation des entités',
    'Aucune donnée ne traverse les entreprises, sauf si le diffuseur a besoin d’un accès limité et approuvé par le client.',
    ShieldCheck,
  ],
  [
    'Accès par rôle',
    'Les droits suivent le rôle, l’équipe, l’entreprise et le territoire — le même périmètre pilote chaque export.',
    LockKeyhole,
  ],
  [
    'Historique immuable',
    'Une action ou une correction écrite ne réécrit jamais l’original.',
    FileCheck2,
  ],
  [
    'Audit chaîné par hash',
    'Les affectations, exports, dérogations et changements sensibles sont journalisés et vérifiables.',
    Network,
  ],
  [
    'MFA et sessions',
    'Authentification multifacteur, politique de mot de passe, sessions contrôlées et SSO optionnel.',
    Users,
  ],
  [
    'Hébergement européen',
    'Hébergé en France, avec restaurations testées, rétention et suppression encadrées par contrat.',
    Globe2,
  ],
] as const;

const frenchFaqs = [
  [
    'Est-ce un CRM ?',
    'Non. Un CRM stocke ce qui s’est passé. TrackRoster décide ce qui peut se passer ensuite, avant l’appel, et conserve la trace de la décision.',
  ],
  [
    'Peut-on migrer depuis Excel ?',
    'Oui. L’assistant d’import fait correspondre vos colonnes, normalise les téléphones et adresses, signale les doublons et vous laisse corriger les anomalies avant l’entrée dans la base active.',
  ],
  [
    'Que fait un prospecteur face à un prospect bloqué ?',
    'Il demande une dérogation. Un manager l’accorde avec une raison et une durée, les deux prospecteurs sont prévenus et l’exception est inscrite au journal d’audit.',
  ],
  [
    'Est-ce utilisable sur le terrain ?',
    'Oui : travail quotidien pensé pour le mobile, formulaire d’action rapide et carte pour les appels, visites et relances.',
  ],
  [
    'Où sont hébergées les données ?',
    'En France, avec des restaurations testées, une politique de rétention maîtrisée et des exports limités par rôle.',
  ],
] as const;

const frenchPricing = [
  {
    name: 'Équipe',
    description: 'Une équipe de prospection',
    price: '29 €',
    suffix: 'par utilisateur / mois',
    featured: false,
    items: [
      'Prospects, contacts et actions',
      'Affectations et relances',
      'Anti-collision standard',
      'Tableau de bord équipe',
      'Exports CSV / XLSX',
    ],
  },
  {
    name: 'Réseau',
    description: 'Réseaux multi-entreprises',
    price: '49 €',
    suffix: 'par utilisateur / mois',
    featured: true,
    items: [
      'Tout le contenu Équipe',
      'Droits multi-entreprises',
      'Cartographie et planification des tournées',
      'Règles et délais avancés',
      'Rapports multi-équipes',
    ],
  },
  {
    name: 'Groupe',
    description: 'Groupes multi-marques',
    price: 'Sur demande',
    suffix: 'contrat annuel',
    featured: false,
    items: [
      'Tout le contenu Réseau',
      'Matrice de coordination inter-entreprises',
      'Politiques de contact par marque',
      'Exports API, SSO et audit',
      'Marque blanche',
    ],
  },
] as const;

const navItems = [
  ['Product', '#product'],
  ['Anti-collision', '#engine'],
  ['Roles', '#roles'],
  ['Security', '#security'],
  ['Pricing', '#pricing'],
] as const;

type LandingLanguage = 'en' | 'fr';

const landingText = {
  en: {
    home: 'TrackRoster home',
    statsLabel: 'TrackRoster at a glance',
    product: 'Product',
    antiCollision: 'Anti-collision',
    roles: 'Roles',
    security: 'Security',
    pricing: 'Pricing',
    signIn: 'Sign in',
    bookDemo: 'Book a demo',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    languageLabel: 'Interface language',
    languageHint: 'Change language',
    heroEyebrow: 'Prospecting coordination for multi-company groups',
    heroTitle: 'Every prospect, at the right time, by the right team.',
    heroBody:
      'TrackRoster assigns every prospect, checks for conflicts before any action, keeps a shared history, and gives managers a real-time view of campaigns, teams and territories.',
    seeEngine: 'See the anti-collision engine',
    establishments: '14,237 establishments',
    companies: '5 companies coordinated',
    hosting: 'European hosting',
    alreadyCoordinating: 'Already coordinating',
    problemKicker: 'The problem',
    problemTitle: 'Regional files work… until two teams call the same number',
    problemLead:
      'One file per region, one little cross-team visibility. It works for a while, then it breaks exactly where it costs the most: in front of the prospect.',
    engineKicker: 'What makes it different',
    engineTitle: 'The anti-collision engine',
    engineLead:
      'Seven checks run server-side, inside a transaction, before a call, a visit or a letter is allowed. The interface alone cannot prevent simultaneous clicks — the engine can.',
    blocked: 'BLOCKED',
    blockedDescription: 'An explicit reason, and the next available option.',
    toValidate: 'TO VALIDATE',
    toValidateDescription: 'The request goes to the manager, with the context.',
    allowed: 'ALLOWED',
    allowedDescription: 'A reservation is created atomically for the user.',
    rolesKicker: 'One product, six roles',
    rolesTitle: 'Everyone sees only what they need',
    rolesLead:
      'From the prospector on the road to the auditor with a defined scope, the navigation, the figures and the available actions change with the role.',
    statEstablishments: 'establishments coordinated',
    statCompanies: 'companies on one base',
    statUsers: 'users organised',
    statCollisions: 'collisions avoided last month',
    statActions: 'actions ever overwritten',
    trustKicker: 'Trust',
    trustTitle: 'Security and audit are built in, not added after the pilot',
    trustLead:
      'Tenant isolation, role-based access, an immutable history and European hosting — the four things a judicial-sector client asks about first.',
    pricingKicker: 'Pricing',
    pricingTitle: 'Three tiers, one engine',
    pricingLead:
      'Every plan includes the anti-collision engine, the immutable history and the audit log. What changes is the scale you coordinate.',
    mostChosen: 'Most chosen',
    startPilot: 'Start a pilot',
    talkToUs: 'Talk to us',
    pricingNote:
      'Pilot programme: 2 managers, 8 to 12 prospectors, 2 regions, 3 weeks — then a measured decision.',
    questionsKicker: 'Questions',
    questionsTitle: 'What people ask before the pilot',
    ctaTitle: 'Prospect together. Without ever crossing paths.',
    ctaBody:
      'Three weeks of pilot, two regions, a measured decision. We set up the matrix and the import with you.',
    downloadDossier: 'Download the dossier',
    footerDescription: 'Coordination platform for multi-company prospecting.',
    footerProduct: 'Product',
    footerRoles: 'Roles',
    footerCompany: 'Company',
    about: 'About',
    faq: 'FAQ',
    contact: 'Contact',
    status: 'Status',
    administrator: 'Administrator',
    auditor: 'Auditor',
    footerLegal: 'Privacy · Terms · Sub-processors',
    hostedInFrance: 'hosted in France',
    previewLabel: 'TrackRoster prospect coordination preview',
    contactAllowed: 'Contact allowed',
    noCollision: 'no collision detected',
    lastAction: 'Last action: 05 Oct, 10:48 · 7 days ago',
    start: 'Start',
    call: 'Call',
    visit: 'Visit',
    email: 'E-mail',
    allowedStatus: 'Allowed',
    lockedStatus: 'Locked by Intertrad',
    cooldownStatus: 'Cooldown 6 d',
  },
  fr: {
    home: 'Accueil TrackRoster',
    statsLabel: 'TrackRoster en un coup d’œil',
    product: 'Produit',
    antiCollision: 'Anti-collision',
    roles: 'Rôles',
    security: 'Sécurité',
    pricing: 'Tarifs',
    signIn: 'Se connecter',
    bookDemo: 'Réserver une démo',
    openMenu: 'Ouvrir le menu',
    closeMenu: 'Fermer le menu',
    languageLabel: 'Langue de l’interface',
    languageHint: 'Changer de langue',
    heroEyebrow: 'Coordination de prospection pour les groupes multi-entreprises',
    heroTitle: 'Chaque prospect, au bon moment, par la bonne équipe.',
    heroBody:
      'TrackRoster attribue chaque prospect, vérifie les conflits avant toute action, conserve un historique partagé et offre aux managers une vue en temps réel des campagnes, équipes et territoires.',
    seeEngine: 'Voir le moteur anti-collision',
    establishments: '14 237 établissements',
    companies: '5 entreprises coordonnées',
    hosting: 'Hébergement européen',
    alreadyCoordinating: 'Déjà coordonné par',
    problemKicker: 'Le problème',
    problemTitle:
      'Les fichiers régionaux fonctionnent… jusqu’à ce que deux équipes appellent le même numéro',
    problemLead:
      'Un fichier par région, avec peu de visibilité entre les équipes. Cela fonctionne un temps, puis casse exactement là où le coût est le plus élevé : devant le prospect.',
    engineKicker: 'Ce qui fait la différence',
    engineTitle: 'Le moteur anti-collision',
    engineLead:
      'Sept contrôles s’exécutent côté serveur, dans une transaction, avant d’autoriser un appel, une visite ou un courrier. L’interface seule ne peut pas empêcher deux clics simultanés — le moteur le peut.',
    blocked: 'BLOQUÉ',
    blockedDescription: 'Une raison explicite et la prochaine option disponible.',
    toValidate: 'À VALIDER',
    toValidateDescription: 'La demande est envoyée au manager avec son contexte.',
    allowed: 'AUTORISÉ',
    allowedDescription: 'Une réservation est créée de façon atomique pour l’utilisateur.',
    rolesKicker: 'Un produit, six rôles',
    rolesTitle: 'Chacun voit uniquement ce dont il a besoin',
    rolesLead:
      'Du prospecteur sur le terrain à l’auditeur avec un périmètre défini, la navigation, les indicateurs et les actions disponibles changent selon le rôle.',
    statEstablishments: 'établissements coordonnés',
    statCompanies: 'entreprises sur une base commune',
    statUsers: 'utilisateurs organisés',
    statCollisions: 'collisions évitées le mois dernier',
    statActions: 'actions jamais écrasées',
    trustKicker: 'Confiance',
    trustTitle: 'La sécurité et l’audit sont intégrés dès le départ',
    trustLead:
      'Isolation des entités, accès par rôle, historique immuable et hébergement européen : les quatre sujets qu’un client du secteur judiciaire aborde en premier.',
    pricingKicker: 'Tarifs',
    pricingTitle: 'Trois offres, un seul moteur',
    pricingLead:
      'Chaque offre inclut le moteur anti-collision, l’historique immuable et le journal d’audit. Seule l’échelle que vous coordonnez change.',
    mostChosen: 'Le plus choisi',
    startPilot: 'Démarrer un pilote',
    talkToUs: 'Parlons-en',
    pricingNote:
      'Programme pilote : 2 managers, 8 à 12 prospecteurs, 2 régions, 3 semaines — puis une décision mesurée.',
    questionsKicker: 'Questions',
    questionsTitle: 'Les questions avant le pilote',
    ctaTitle: 'Prospecter ensemble. Sans jamais se croiser.',
    ctaBody:
      'Trois semaines de pilote, deux régions, une décision mesurée. Nous configurons la matrice et l’import avec vous.',
    downloadDossier: 'Télécharger le dossier',
    footerDescription: 'Plateforme de coordination de la prospection multi-entreprises.',
    footerProduct: 'Produit',
    footerRoles: 'Rôles',
    footerCompany: 'Entreprise',
    about: 'À propos',
    faq: 'FAQ',
    contact: 'Contact',
    status: 'Statut',
    administrator: 'Administrateur',
    auditor: 'Auditeur',
    footerLegal: 'Confidentialité · Conditions · Sous-traitants',
    hostedInFrance: 'hébergé en France',
    previewLabel: 'Aperçu de la coordination des prospects TrackRoster',
    contactAllowed: 'Contact autorisé',
    noCollision: 'aucun conflit détecté',
    lastAction: 'Dernière action : 5 oct., 10:48 · il y a 7 jours',
    start: 'Démarrer',
    call: 'Appel',
    visit: 'Visite',
    email: 'E-mail',
    allowedStatus: 'Autorisé',
    lockedStatus: 'Verrouillé par Intertrad',
    cooldownStatus: 'Délai 6 j',
  },
} as const;

function SectionKicker({ children }: { children: ReactNode }) {
  return <p className="marketing-kicker">{children}</p>;
}

function AnimatedNumber({ value, duration = 1100 }: { value: number; duration?: number }) {
  const numberRef = useRef<HTMLSpanElement>(null);
  // Render the real value on the first paint so the stat never flashes a
  // misleading zero while the section is waiting to enter the viewport.
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    const target = numberRef.current;
    if (!target) return;

    let frame = 0;
    let observer: IntersectionObserver | null = null;
    let started = false;

    const animate = () => {
      if (started) return;
      started = true;

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setDisplayValue(value);
        return;
      }

      setDisplayValue(0);
      const startedAt = performance.now();
      const tick = (now: number) => {
        const progress = Math.min((now - startedAt) / duration, 1);
        const easedProgress = 1 - (1 - progress) ** 3;
        setDisplayValue(Math.round(value * easedProgress));
        if (progress < 1) frame = window.requestAnimationFrame(tick);
      };

      frame = window.requestAnimationFrame(tick);
    };

    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) {
            animate();
            observer?.disconnect();
          }
        },
        { threshold: 0.35 },
      );
      observer.observe(target);
    } else {
      animate();
    }

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [duration, value]);

  return (
    <>
      <span ref={numberRef} className="marketing-stat-number" aria-hidden="true">
        {displayValue.toLocaleString('en-US')}
      </span>
      <span className="sr-only">{value.toLocaleString('en-US')}</span>
    </>
  );
}

function HeroPreview({ language }: { language: LandingLanguage }) {
  const copy = landingText[language];
  const prospects = [
    [
      language === 'fr' ? 'Commissariat central de Nancy' : 'Nancy central police station',
      language === 'fr' ? 'Appel · 4 oct. · 10:00' : 'Call · 04 Oct · 10:00',
      copy.allowedStatus,
      'success',
    ],
    [
      language === 'fr' ? 'Tribunal judiciaire de Metz' : 'Metz judicial court',
      language === 'fr' ? 'Visite · 4 oct. · 14:30' : 'Visit · 04 Oct · 14:30',
      copy.lockedStatus,
      'danger',
    ],
    [
      language === 'fr' ? 'Gendarmerie de Colmar' : 'Colmar gendarmerie',
      language === 'fr' ? 'Appel · 5 oct. · 09:30' : 'Call · 05 Oct · 09:30',
      copy.cooldownStatus,
      'warning',
    ],
    [
      'CH Verdun',
      language === 'fr' ? 'E-mail · 5 oct. · 11:30' : 'E-mail · 05 Oct · 11:30',
      copy.allowedStatus,
      'success',
    ],
  ] as const;

  return (
    <div className="marketing-preview" aria-label={copy.previewLabel}>
      <div className="marketing-preview-alert">
        <span className="marketing-preview-check">
          <Check aria-hidden="true" />
        </span>
        <span>
          <strong>{copy.contactAllowed}</strong> — {copy.noCollision}
          <small>{copy.lastAction}</small>
        </span>
        <span className="marketing-preview-start">{copy.start}</span>
      </div>
      <div className="marketing-preview-list">
        {prospects.map(([name, meta, status, tone]) => (
          <div className="marketing-preview-row" key={name}>
            <div>
              <strong>{name}</strong>
              <small>{meta}</small>
            </div>
            <span className={`marketing-status marketing-status-${tone}`}>{status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [language, setLanguage] = useState<LandingLanguage>('fr');
  const copy = landingText[language];
  const localizedProblemCards = language === 'fr' ? frenchProblemCards : problemCards;
  const localizedEngineCards = language === 'fr' ? frenchEngineCards : engineCards;
  const localizedRoleCards = language === 'fr' ? frenchRoleCards : roleCards;
  const localizedSecurityCards = language === 'fr' ? frenchSecurityCards : securityCards;
  const localizedFaqs = language === 'fr' ? frenchFaqs : faqs;
  const localizedPricing = language === 'fr' ? frenchPricing : pricing;

  useEffect(() => {
    const storedLanguage = window.localStorage.getItem('trackroster-landing-language');
    if (storedLanguage === 'en' || storedLanguage === 'fr') {
      setLanguage(storedLanguage);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem('trackroster-landing-language', language);
    document.documentElement.lang = language;
  }, [language]);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <main className="marketing-page">
      <section className="marketing-hero" id="product">
        <header className="marketing-header">
          <div className="marketing-container marketing-header-inner">
            <Link href="/" className="marketing-brand" aria-label={copy.home} onClick={closeMenu}>
              <BrandLockup />
            </Link>
            <nav className={`marketing-nav ${menuOpen ? 'is-open' : ''}`} aria-label={copy.product}>
              {navItems.map(([, href], index) => {
                const labels = [
                  copy.product,
                  copy.antiCollision,
                  copy.roles,
                  copy.security,
                  copy.pricing,
                ];
                return (
                  <a href={href} key={href} onClick={closeMenu}>
                    {labels[index]}
                  </a>
                );
              })}
              <div className="marketing-nav-actions marketing-nav-actions-mobile">
                <label className="marketing-language-picker">
                  <span className="sr-only">{copy.languageLabel}</span>
                  <Globe2 aria-hidden="true" />
                  <select
                    aria-label={copy.languageHint}
                    value={language}
                    onChange={(event) => setLanguage(event.target.value as LandingLanguage)}
                  >
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                  </select>
                </label>
                <Link
                  href="/login"
                  className="marketing-button marketing-button-ghost"
                  onClick={closeMenu}
                >
                  {copy.signIn}
                </Link>
                <a
                  href="#demo"
                  className="marketing-button marketing-button-primary"
                  onClick={closeMenu}
                >
                  {copy.bookDemo}
                </a>
              </div>
            </nav>
            <div className="marketing-nav-actions marketing-nav-actions-desktop">
              <label className="marketing-language-picker">
                <span className="sr-only">{copy.languageLabel}</span>
                <Globe2 aria-hidden="true" />
                <select
                  aria-label={copy.languageHint}
                  value={language}
                  onChange={(event) => setLanguage(event.target.value as LandingLanguage)}
                >
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                </select>
              </label>
              <Link href="/login" className="marketing-button marketing-button-ghost">
                {copy.signIn}
              </Link>
              <a href="#demo" className="marketing-button marketing-button-primary">
                {copy.bookDemo}
              </a>
            </div>
            <button
              type="button"
              className="marketing-menu-toggle"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? copy.closeMenu : copy.openMenu}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            </button>
          </div>
        </header>

        <div className="marketing-container marketing-hero-grid">
          <div className="marketing-hero-copy">
            <span className="marketing-eyebrow marketing-eyebrow-dark">
              <Radar aria-hidden="true" /> {copy.heroEyebrow}
            </span>
            <h1>{copy.heroTitle}</h1>
            <p>{copy.heroBody}</p>
            <div className="marketing-hero-actions">
              <a
                href="#demo"
                className="marketing-button marketing-button-primary marketing-button-large"
              >
                {copy.bookDemo} <ArrowRight aria-hidden="true" />
              </a>
              <a
                href="#engine"
                className="marketing-button marketing-button-outline-dark marketing-button-large"
              >
                {copy.seeEngine}
              </a>
            </div>
            <div className="marketing-hero-proof">
              <span>
                <Check aria-hidden="true" /> {copy.establishments}
              </span>
              <span>
                <Check aria-hidden="true" /> {copy.companies}
              </span>
              <span>
                <Check aria-hidden="true" /> {copy.hosting}
              </span>
            </div>
          </div>
          <HeroPreview language={language} />
        </div>
      </section>

      <div className="marketing-trust-strip">
        <div className="marketing-container marketing-trust-inner">
          <span>{copy.alreadyCoordinating}</span>
          <span>GFTIJ</span>
          <span>INTERTRAD</span>
          <span>OFTI</span>
          <span>SDI</span>
          <span>AFTIJ</span>
          <strong>{copy.establishments}</strong>
        </div>
      </div>

      <section className="marketing-section marketing-section-white" id="problem">
        <div className="marketing-container">
          <SectionKicker>{copy.problemKicker}</SectionKicker>
          <h2>{copy.problemTitle}</h2>
          <p className="marketing-section-lead">{copy.problemLead}</p>
          <div className="marketing-card-grid marketing-card-grid-six">
            {localizedProblemCards.map(([title, description, detail]) => (
              <article className="marketing-outline-card marketing-problem-card" key={title}>
                <span className="marketing-alert-icon">
                  <CircleAlert aria-hidden="true" />
                </span>
                <h3>{title}</h3>
                <p>{description}</p>
                <small>{detail}</small>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="marketing-section marketing-section-tint" id="engine">
        <div className="marketing-container">
          <SectionKicker>{copy.engineKicker}</SectionKicker>
          <h2>{copy.engineTitle}</h2>
          <p className="marketing-section-lead">{copy.engineLead}</p>
          <div className="marketing-card-grid marketing-card-grid-six marketing-engine-grid">
            {localizedEngineCards.map(([number, title, description]) => (
              <article className="marketing-outline-card marketing-engine-card" key={number}>
                <span className="marketing-number-badge">{number}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
          <div className="marketing-decision-row">
            <div className="marketing-decision marketing-decision-blocked">
              <strong>{copy.blocked}</strong>
              <span>{copy.blockedDescription}</span>
            </div>
            <div className="marketing-decision marketing-decision-validate">
              <strong>{copy.toValidate}</strong>
              <span>{copy.toValidateDescription}</span>
            </div>
            <div className="marketing-decision marketing-decision-allowed">
              <strong>{copy.allowed}</strong>
              <span>{copy.allowedDescription}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="marketing-section marketing-section-white" id="roles">
        <div className="marketing-container">
          <SectionKicker>{copy.rolesKicker}</SectionKicker>
          <h2>{copy.rolesTitle}</h2>
          <p className="marketing-section-lead">{copy.rolesLead}</p>
          <div className="marketing-card-grid marketing-card-grid-three">
            {localizedRoleCards.map(({ label, color, subtitle, bullets }) => (
              <article className={`marketing-role-card marketing-role-${color}`} key={label}>
                <div className="marketing-role-bar" />
                <h3>{label}</h3>
                <p className="marketing-role-subtitle">{subtitle}</p>
                <ul>
                  {bullets.map((bullet) => (
                    <li key={bullet}>
                      <CheckCircle2 aria-hidden="true" />
                      {bullet}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="marketing-stat-band" aria-label={copy.statsLabel}>
        <div className="marketing-container marketing-stat-grid">
          <div>
            <strong>
              <AnimatedNumber value={14237} />
            </strong>
            <span className="marketing-stat-label">{copy.statEstablishments}</span>
          </div>
          <div>
            <strong>
              <AnimatedNumber value={5} />
            </strong>
            <span className="marketing-stat-label">{copy.statCompanies}</span>
          </div>
          <div>
            <strong>
              <AnimatedNumber value={86} />
            </strong>
            <span className="marketing-stat-label">{copy.statUsers}</span>
          </div>
          <div>
            <strong>
              <AnimatedNumber value={41} />
            </strong>
            <span className="marketing-stat-label">{copy.statCollisions}</span>
          </div>
          <div>
            <strong>
              <AnimatedNumber value={0} />
            </strong>
            <span className="marketing-stat-label">{copy.statActions}</span>
          </div>
        </div>
      </section>

      <section className="marketing-section marketing-section-tint" id="security">
        <div className="marketing-container">
          <SectionKicker>{copy.trustKicker}</SectionKicker>
          <h2>{copy.trustTitle}</h2>
          <p className="marketing-section-lead">{copy.trustLead}</p>
          <div className="marketing-card-grid marketing-card-grid-six marketing-security-grid">
            {localizedSecurityCards.map(([title, description, icon]) => (
              <article className="marketing-outline-card marketing-security-card" key={title}>
                <span className="marketing-security-icon">
                  {createElement(icon, { 'aria-hidden': true })}
                </span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="marketing-section marketing-section-white" id="pricing">
        <div className="marketing-container">
          <SectionKicker>{copy.pricingKicker}</SectionKicker>
          <h2>{copy.pricingTitle}</h2>
          <p className="marketing-section-lead">{copy.pricingLead}</p>
          <div className="marketing-pricing-grid">
            {localizedPricing.map((plan) => (
              <article
                className={`marketing-pricing-card ${plan.featured ? 'is-featured' : ''}`}
                key={plan.name}
              >
                {plan.featured && (
                  <span className="marketing-pricing-badge">{copy.mostChosen}</span>
                )}
                <h3>{plan.name}</h3>
                <p>{plan.description}</p>
                <div className="marketing-price">
                  {plan.price}
                  <small>{plan.suffix}</small>
                </div>
                <ul>
                  {plan.items.map((item) => (
                    <li key={item}>
                      <Check aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
                <a
                  href="#demo"
                  className={`marketing-button ${plan.featured ? 'marketing-button-primary' : 'marketing-button-outline'}`}
                >
                  {plan.name === 'Group' || plan.name === 'Groupe'
                    ? copy.talkToUs
                    : copy.startPilot}{' '}
                  <ArrowUpRight aria-hidden="true" />
                </a>
              </article>
            ))}
          </div>
          <p className="marketing-pricing-note">{copy.pricingNote}</p>
        </div>
      </section>

      <section className="marketing-section marketing-section-tint marketing-faq-section" id="faq">
        <div className="marketing-container marketing-faq-container">
          <SectionKicker>{copy.questionsKicker}</SectionKicker>
          <h2>{copy.questionsTitle}</h2>
          <div className="marketing-faq-list">
            {localizedFaqs.map(([question, answer], index) => (
              <div
                className={`marketing-faq-item ${openFaq === index ? 'is-open' : ''}`}
                key={question}
              >
                <button
                  type="button"
                  aria-expanded={openFaq === index}
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                >
                  <span>{question}</span>
                  <ChevronDown aria-hidden="true" />
                </button>
                {openFaq === index && <p>{answer}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="marketing-cta" id="demo">
        <div className="marketing-container marketing-cta-inner">
          <h2>{copy.ctaTitle}</h2>
          <p>{copy.ctaBody}</p>
          <div className="marketing-cta-actions">
            <a
              href="mailto:hello@trackroster.com?subject=TrackRoster%20pilot"
              className="marketing-button marketing-button-lime"
            >
              {copy.bookDemo} <ArrowRight aria-hidden="true" />
            </a>
            <a href="#problem" className="marketing-button marketing-button-outline-light">
              {copy.downloadDossier}
            </a>
          </div>
        </div>
      </section>

      <footer className="marketing-footer">
        <div className="marketing-container marketing-footer-grid">
          <div className="marketing-footer-brand">
            <BrandLockup />
            <p>{copy.footerDescription}</p>
          </div>
          <div>
            <strong>{copy.footerProduct}</strong>
            <a href="#engine">{copy.antiCollision}</a>
            <a href="#roles">{copy.roles}</a>
            <a href="#security">{copy.security}</a>
            <a href="#pricing">{copy.pricing}</a>
          </div>
          <div>
            <strong>{copy.footerRoles}</strong>
            <a href="#roles">{language === 'fr' ? 'Prospecteur' : 'Prospector'}</a>
            <a href="#roles">Manager</a>
            <a href="#roles">{language === 'fr' ? 'Direction' : 'Director'}</a>
            <a href="#security">{copy.administrator}</a>
            <a href="#security">{copy.auditor}</a>
          </div>
          <div>
            <strong>{copy.footerCompany}</strong>
            <a href="#product">{copy.about}</a>
            <a href="#demo">{copy.bookDemo}</a>
            <a href="#faq">{copy.faq}</a>
            <a href="mailto:hello@trackroster.com">{copy.contact}</a>
            <a href="#security">{copy.status}</a>
          </div>
        </div>
        <div className="marketing-container marketing-footer-bottom">
          <span>© 2026 TrackRoster — {copy.hostedInFrance}</span>
          <span>{copy.footerLegal}</span>
        </div>
      </footer>
    </main>
  );
}

export function MarketingFeatureIcon({
  type,
}: {
  type: 'building' | 'map' | 'clock' | 'message' | 'zap';
}) {
  const icons = {
    building: Building2,
    map: MapPinned,
    clock: Clock3,
    message: MessageCircle,
    zap: Zap,
  };
  const Icon = icons[type];
  return <Icon aria-hidden="true" />;
}

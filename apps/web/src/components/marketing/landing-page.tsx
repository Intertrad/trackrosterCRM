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
import { createElement, type ReactNode, useState } from 'react';

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

const navItems = [
  ['Product', '#product'],
  ['Anti-collision', '#engine'],
  ['Roles', '#roles'],
  ['Security', '#security'],
  ['Pricing', '#pricing'],
] as const;

function SectionKicker({ children }: { children: ReactNode }) {
  return <p className="marketing-kicker">{children}</p>;
}

function HeroPreview() {
  const prospects = [
    ['Nancy central police station', 'Call · 04 Oct · 10:00', 'Allowed', 'success'],
    ['Metz judicial court', 'Visit · 04 Oct · 14:30', 'Locked by Intertrad', 'danger'],
    ['Colmar gendarmerie', 'Call · 05 Oct · 09:30', 'Cooldown 6 d', 'warning'],
    ['CH Verdun', 'E-mail · 05 Oct · 11:30', 'Allowed', 'success'],
  ] as const;

  return (
    <div className="marketing-preview" aria-label="TrackRoster prospect coordination preview">
      <div className="marketing-preview-alert">
        <span className="marketing-preview-check">
          <Check aria-hidden="true" />
        </span>
        <span>
          <strong>Contact allowed</strong> — no collision detected
          <small>Last action: 05 Oct, 10:48 · 7 days ago</small>
        </span>
        <span className="marketing-preview-start">Start</span>
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

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <main className="marketing-page">
      <section className="marketing-hero" id="product">
        <header className="marketing-header">
          <div className="marketing-container marketing-header-inner">
            <Link
              href="/"
              className="marketing-brand"
              aria-label="TrackRoster home"
              onClick={closeMenu}
            >
              <BrandLockup />
            </Link>
            <nav
              className={`marketing-nav ${menuOpen ? 'is-open' : ''}`}
              aria-label="Main navigation"
            >
              {navItems.map(([label, href]) => (
                <a href={href} key={href} onClick={closeMenu}>
                  {label}
                </a>
              ))}
              <div className="marketing-nav-actions marketing-nav-actions-mobile">
                <Link
                  href="/login"
                  className="marketing-button marketing-button-ghost"
                  onClick={closeMenu}
                >
                  Sign in
                </Link>
                <a
                  href="#demo"
                  className="marketing-button marketing-button-primary"
                  onClick={closeMenu}
                >
                  Book a demo
                </a>
              </div>
            </nav>
            <div className="marketing-nav-actions marketing-nav-actions-desktop">
              <Link href="/login" className="marketing-button marketing-button-ghost">
                Sign in
              </Link>
              <a href="#demo" className="marketing-button marketing-button-primary">
                Book a demo
              </a>
            </div>
            <button
              type="button"
              className="marketing-menu-toggle"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            </button>
          </div>
        </header>

        <div className="marketing-container marketing-hero-grid">
          <div className="marketing-hero-copy">
            <span className="marketing-eyebrow marketing-eyebrow-dark">
              <Radar aria-hidden="true" /> Prospecting coordination for multi-company groups
            </span>
            <h1>Every prospect, at the right time, by the right team.</h1>
            <p>
              TrackRoster assigns every prospect, checks for conflicts before any action, keeps a
              shared history, and gives managers a real-time view of campaigns, teams and
              territories.
            </p>
            <div className="marketing-hero-actions">
              <a
                href="#demo"
                className="marketing-button marketing-button-primary marketing-button-large"
              >
                Book a demo <ArrowRight aria-hidden="true" />
              </a>
              <a
                href="#engine"
                className="marketing-button marketing-button-outline-dark marketing-button-large"
              >
                See the anti-collision engine
              </a>
            </div>
            <div className="marketing-hero-proof">
              <span>
                <Check aria-hidden="true" /> 14,237 establishments
              </span>
              <span>
                <Check aria-hidden="true" /> 5 companies coordinated
              </span>
              <span>
                <Check aria-hidden="true" /> European hosting
              </span>
            </div>
          </div>
          <HeroPreview />
        </div>
      </section>

      <div className="marketing-trust-strip">
        <div className="marketing-container marketing-trust-inner">
          <span>Already coordinating</span>
          <span>GFTIJ</span>
          <span>INTERTRAD</span>
          <span>OFTI</span>
          <span>SDI</span>
          <span>AFTIJ</span>
          <strong>14,237 establishments</strong>
        </div>
      </div>

      <section className="marketing-section marketing-section-white" id="problem">
        <div className="marketing-container">
          <SectionKicker>The problem</SectionKicker>
          <h2>Regional files work… until two teams call the same number</h2>
          <p className="marketing-section-lead">
            One file per region, one little cross-team visibility. It works for a while, then it
            breaks exactly where it costs the most: in front of the prospect.
          </p>
          <div className="marketing-card-grid marketing-card-grid-six">
            {problemCards.map(([title, description, detail]) => (
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
          <SectionKicker>What makes it different</SectionKicker>
          <h2>The anti-collision engine</h2>
          <p className="marketing-section-lead">
            Seven checks run server-side, inside a transaction, before a call, a visit or a letter
            is allowed. The interface alone cannot prevent simultaneous clicks — the engine can.
          </p>
          <div className="marketing-card-grid marketing-card-grid-six marketing-engine-grid">
            {engineCards.map(([number, title, description]) => (
              <article className="marketing-outline-card marketing-engine-card" key={number}>
                <span className="marketing-number-badge">{number}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
          <div className="marketing-decision-row">
            <div className="marketing-decision marketing-decision-blocked">
              <strong>BLOCKED</strong>
              <span>An explicit reason, and the next available option.</span>
            </div>
            <div className="marketing-decision marketing-decision-validate">
              <strong>TO VALIDATE</strong>
              <span>The request goes to the manager, with the context.</span>
            </div>
            <div className="marketing-decision marketing-decision-allowed">
              <strong>ALLOWED</strong>
              <span>A reservation is created atomically for the user.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="marketing-section marketing-section-white" id="roles">
        <div className="marketing-container">
          <SectionKicker>One product, six roles</SectionKicker>
          <h2>Everyone sees only what they need</h2>
          <p className="marketing-section-lead">
            From the prospector on the road to the auditor with a defined scope, the navigation, the
            figures and the available actions change with the role.
          </p>
          <div className="marketing-card-grid marketing-card-grid-three">
            {roleCards.map(({ label, color, subtitle, bullets }) => (
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

      <section className="marketing-stat-band" aria-label="TrackRoster at a glance">
        <div className="marketing-container marketing-stat-grid">
          <div>
            <strong>14,237</strong>
            <span>establishments coordinated</span>
          </div>
          <div>
            <strong>5</strong>
            <span>companies on one base</span>
          </div>
          <div>
            <strong>86</strong>
            <span>users organised</span>
          </div>
          <div>
            <strong>41</strong>
            <span>collisions avoided last month</span>
          </div>
          <div>
            <strong>0</strong>
            <span>actions ever overwritten</span>
          </div>
        </div>
      </section>

      <section className="marketing-section marketing-section-tint" id="security">
        <div className="marketing-container">
          <SectionKicker>Trust</SectionKicker>
          <h2>Security and audit are built in, not added after the pilot</h2>
          <p className="marketing-section-lead">
            Tenant isolation, role-based access, an immutable history and European hosting — the
            four things a judicial-sector client asks about first.
          </p>
          <div className="marketing-card-grid marketing-card-grid-six marketing-security-grid">
            {securityCards.map(([title, description, icon]) => (
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
          <SectionKicker>Pricing</SectionKicker>
          <h2>Three tiers, one engine</h2>
          <p className="marketing-section-lead">
            Every plan includes the anti-collision engine, the immutable history and the audit log.
            What changes is the scale you coordinate.
          </p>
          <div className="marketing-pricing-grid">
            {pricing.map((plan) => (
              <article
                className={`marketing-pricing-card ${plan.featured ? 'is-featured' : ''}`}
                key={plan.name}
              >
                {plan.featured && <span className="marketing-pricing-badge">Most chosen</span>}
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
                  {plan.name === 'Group' ? 'Talk to us' : 'Start a pilot'}{' '}
                  <ArrowUpRight aria-hidden="true" />
                </a>
              </article>
            ))}
          </div>
          <p className="marketing-pricing-note">
            Pilot programme: 2 managers, 8 to 12 prospectors, 2 regions, 3 weeks — then a measured
            decision.
          </p>
        </div>
      </section>

      <section className="marketing-section marketing-section-tint marketing-faq-section" id="faq">
        <div className="marketing-container marketing-faq-container">
          <SectionKicker>Questions</SectionKicker>
          <h2>What people ask before the pilot</h2>
          <div className="marketing-faq-list">
            {faqs.map(([question, answer], index) => (
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
          <h2>Prospect together. Without ever crossing paths.</h2>
          <p>
            Three weeks of pilot, two regions, a measured decision. We set up the matrix and the
            import with you.
          </p>
          <div className="marketing-cta-actions">
            <a
              href="mailto:hello@trackroster.com?subject=TrackRoster%20pilot"
              className="marketing-button marketing-button-lime"
            >
              Book a demo <ArrowRight aria-hidden="true" />
            </a>
            <a href="#problem" className="marketing-button marketing-button-outline-light">
              Download the dossier
            </a>
          </div>
        </div>
      </section>

      <footer className="marketing-footer">
        <div className="marketing-container marketing-footer-grid">
          <div className="marketing-footer-brand">
            <BrandLockup />
            <p>Coordination platform for multi-company prospecting.</p>
          </div>
          <div>
            <strong>Product</strong>
            <a href="#engine">Anti-collision</a>
            <a href="#roles">Roles</a>
            <a href="#security">Security</a>
            <a href="#pricing">Pricing</a>
          </div>
          <div>
            <strong>Roles</strong>
            <a href="#roles">Prospector</a>
            <a href="#roles">Manager</a>
            <a href="#roles">Director</a>
            <a href="#security">Administrator</a>
            <a href="#security">Auditor</a>
          </div>
          <div>
            <strong>Company</strong>
            <a href="#product">About</a>
            <a href="#demo">Book a demo</a>
            <a href="#faq">FAQ</a>
            <a href="mailto:hello@trackroster.com">Contact</a>
            <a href="#security">Status</a>
          </div>
        </div>
        <div className="marketing-container marketing-footer-bottom">
          <span>© 2026 TrackRoster — hosted in France</span>
          <span>Privacy · Terms · Sub-processors</span>
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

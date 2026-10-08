# TrackRoster web application

The web app contains the authenticated TrackRoster workspace and the public
marketing landing page. It uses Next.js App Router, React, TypeScript, the shared
TrackRoster brand tokens and a same-origin API proxy for authenticated workspace
operations.

## Public landing page

- `/landing` always renders the public product introduction.
- Anonymous `/` renders the same page through the app shell.
- Authenticated `/` redirects to the signed-in user's role home.

The landing page is static by design: its preview rows and pricing examples are
illustrative, and the demo CTA currently opens the configured `mailto:` handoff. It
does not use tenant data or require an API session. See
[`docs/design/MARKETING_LANDING_PAGE.md`](../../docs/design/MARKETING_LANDING_PAGE.md)
for the responsive and motion approach.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser. Use
`http://localhost:3000/landing` to inspect the public page directly.

The authenticated workspace is composed from route groups under `src/app` and
feature components under `src/components`. The anonymous root behavior is owned by
`src/components/layout/app-shell.tsx`.

## Checks

From `apps/web`:

```bash
pnpm dev
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

The landing-page visual QA record is maintained in
[`design-qa.md`](../../design-qa.md).

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

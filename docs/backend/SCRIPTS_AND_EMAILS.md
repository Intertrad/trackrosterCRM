# Client Admin scripts and emails

The Client Admin navigation item **Scripts and emails** is backed by the tenant-scoped `/scripts` resource. A script is a reusable call, visit, or email template. Every record carries the tenant id, creator, updater, optional organization scope, optional sector scope, and an explicit enabled flag. PostgreSQL row-level security is enabled and forced for this table.

## Endpoints

All endpoints require an authenticated `client_admin` membership in the active tenant. The web application calls them through the same-origin `/api/scripts` proxy.

| Method | Endpoint                                    | Purpose                                                                                         |
| ------ | ------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| GET    | `/scripts?channel=&organizationId=&sector=` | List templates, optionally filtered by channel, organization, or sector.                        |
| GET    | `/scripts/{scriptId}`                       | Read one template.                                                                              |
| POST   | `/scripts`                                  | Create a template. `channel` is `call`, `visit`, or `email`; email templates require `subject`. |
| PATCH  | `/scripts/{scriptId}`                       | Update any template fields.                                                                     |
| DELETE | `/scripts/{scriptId}`                       | Delete a template and record an audit event.                                                    |
| POST   | `/scripts/{scriptId}/preview`               | Render `{{variable}}` placeholders from a values object and return missing variables.           |
| POST   | `/scripts/{scriptId}/test`                  | Queue a rendered email test through the configured local Mailpit or Brevo adapter.              |

Example create body:

```json
{
  "name": "First outreach",
  "channel": "email",
  "sector": "sante",
  "subject": "Bonjour {{first_name}}",
  "body": "Bonjour {{first_name}},\\n\\nJe vous contacte au sujet de {{organization_name}}.",
  "variables": ["first_name", "organization_name"],
  "enabled": true
}
```

The frontend inserts variables as chips and renders a preview using safe placeholder values. Test email delivery is queued in the API outbox; it uses Mailpit when `MAILPIT_URL` is configured and Brevo otherwise. No provider credential is stored in a script record. Delivery failures remain in the existing outbox retry path.

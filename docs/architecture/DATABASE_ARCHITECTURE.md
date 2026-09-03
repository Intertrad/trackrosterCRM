# TrackRoster Database Architecture

**Status:** Draft

## Primary Database

TrackRoster uses PostgreSQL as the authoritative transactional data store.

PostGIS provides geospatial functionality.

## Core Domains

### Organization

```text
tenants
organizations
teams
users
```

import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import * as schema from './schema/index.js';

export type Database = NodePgDatabase<typeof schema>;

export type DatabaseTransaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export type DatabaseExecutor = Database | DatabaseTransaction;

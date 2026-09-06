import { User } from '../database/schema/users.js';

export type ManagedUser = Omit<User, 'passwordHash'>;

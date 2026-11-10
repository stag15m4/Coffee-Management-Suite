import { describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

describe('Postgres identifier escaping', () => {
  it('keeps quotes and SQL-looking text inside a single identifier', () => {
    const dialect = new PgDialect();
    const query = dialect.sqlToQuery(sql`select ${sql.identifier('name"; DROP TABLE tenants; --')}`);
    expect(query.sql).toBe('select "name""; DROP TABLE tenants; --"');
    expect(query.params).toEqual([]);
  });
});

// Supabase/Postgres returns snake_case column names; our TypeScript types
// use camelCase. This converts query results recursively (including nested
// joined objects/arrays from `.select("foo, bar(*)")` queries) so every page
// can trust `data` matches its declared type instead of silently getting
// `undefined` for every field.

function snakeToCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, char) => char.toUpperCase());
}

export function camelCaseKeys<T = unknown>(value: unknown): T {
  if (Array.isArray(value)) {
    return value.map((item) => camelCaseKeys(item)) as unknown as T;
  }
  if (value !== null && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, val]) => [
        snakeToCamel(key),
        camelCaseKeys(val),
      ])
    ) as T;
  }
  return value as T;
}

'use strict';

export const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

export const toPositiveLineNumber = (value: unknown): number | undefined => {
  const line = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(line) || line < 1) {
    return undefined;
  }
  return line;
};

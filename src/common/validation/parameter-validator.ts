import { BadRequestException } from '@nestjs/common';
import type { ParametersSchema, ParameterSpec } from '../types/report.types';

/**
 * Validates and coerces user-supplied report parameters against a template's
 * parameter schema. Returns a clean object with defaults applied and values
 * coerced to their declared types. Throws BadRequestException on any violation.
 *
 * IMPORTANT: the coerced, validated values are what get bound as SQL parameters
 * ($1, $2, …) — they are never string-interpolated into the query.
 */
export function validateParameters(
  schema: ParametersSchema,
  input: Record<string, unknown>,
): Record<string, unknown> {
  const errors: string[] = [];
  const out: Record<string, unknown> = {};

  for (const [key, specRaw] of Object.entries(schema ?? {})) {
    const spec = specRaw as ParameterSpec;
    const provided = input?.[key];

    let value: unknown = provided;
    if (value === undefined || value === null || value === '') {
      if (spec.default !== undefined) {
        value = spec.default;
      } else if (spec.required) {
        errors.push(`"${key}" is required`);
        continue;
      } else {
        out[key] = null;
        continue;
      }
    }

    const coerced = coerce(spec.type, value);
    if (coerced.error) {
      errors.push(`"${key}" ${coerced.error}`);
      continue;
    }

    if (spec.enum && spec.enum.length > 0 && !spec.enum.includes(coerced.value)) {
      errors.push(`"${key}" must be one of: ${spec.enum.join(', ')}`);
      continue;
    }

    out[key] = coerced.value;
  }

  if (errors.length) {
    throw new BadRequestException({ message: 'Parameter validation failed', errors });
  }
  return out;
}

function coerce(
  type: ParameterSpec['type'],
  value: unknown,
): { value?: unknown; error?: string } {
  switch (type) {
    case 'string':
      return { value: String(value) };
    case 'number': {
      const n = Number(value);
      return Number.isFinite(n) ? { value: n } : { error: 'must be a number' };
    }
    case 'boolean': {
      if (typeof value === 'boolean') return { value };
      if (value === 'true' || value === '1') return { value: true };
      if (value === 'false' || value === '0') return { value: false };
      return { error: 'must be a boolean' };
    }
    case 'date': {
      const d = new Date(value as string);
      if (Number.isNaN(d.getTime())) return { error: 'must be a valid date' };
      // Bind as a Date; pg driver handles the type.
      return { value: d };
    }
    default:
      return { value };
  }
}

/**
 * Produces representative sample parameter values from a schema, used by the
 * template preview endpoint.
 */
export function sampleParameters(schema: ParametersSchema): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, spec] of Object.entries(schema ?? {})) {
    if (spec.default !== undefined) {
      out[key] = spec.default;
      continue;
    }
    if (spec.enum && spec.enum.length) {
      out[key] = spec.enum[0];
      continue;
    }
    switch (spec.type) {
      case 'date':
        out[key] =
          key.includes('from') || key.includes('start')
            ? new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)
            : new Date().toISOString().slice(0, 10);
        break;
      case 'number':
        out[key] = 0;
        break;
      case 'boolean':
        out[key] = false;
        break;
      default:
        out[key] = 'sample';
    }
  }
  return out;
}

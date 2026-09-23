import { BadRequestException } from '@nestjs/common';
export interface FieldShape {
  dataType: string;
  validation: { required?: boolean; min?: number; max?: number; options?: string[] };
}
export function validateFieldDefinition(f: FieldShape) {
  const v = f.validation;
  if (v.min !== undefined && v.max !== undefined && v.min > v.max)
    throw new BadRequestException('Field minimum must not exceed maximum');
  if (
    ['select', 'multi_select'].includes(f.dataType) &&
    (!v.options?.length || v.options.some((x) => !x.trim()))
  )
    throw new BadRequestException('Select fields require nonempty options');
  if (v.options && !['select', 'multi_select'].includes(f.dataType))
    throw new BadRequestException('Options are only valid for select fields');
  if (
    (v.min !== undefined || v.max !== undefined) &&
    !['text', 'number', 'multi_select'].includes(f.dataType)
  )
    throw new BadRequestException('Bounds are unsupported for this field type');
  if (
    f.dataType !== 'number' &&
    [v.min, v.max].some((x) => x !== undefined && (!Number.isInteger(x) || x < 0))
  )
    throw new BadRequestException('Length bounds must be nonnegative integers');
}
export function validateFieldValue(f: FieldShape, value: unknown) {
  if (value === null) {
    if (f.validation.required) throw new BadRequestException('Required fields cannot be cleared');
    return;
  }
  let size: number | undefined;
  switch (f.dataType) {
    case 'text':
      if (typeof value !== 'string' || value.length > 10000)
        throw new BadRequestException('Text field requires at most 10000 characters');
      size = value.length;
      break;
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value))
        throw new BadRequestException('Number field requires a finite number');
      size = value;
      break;
    case 'boolean':
      if (typeof value !== 'boolean')
        throw new BadRequestException('Boolean field requires true or false');
      break;
    case 'date':
      if (
        typeof value !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        !Number.isFinite(Date.parse(value)) ||
        new Date(value).toISOString().slice(0, 10) !== value
      )
        throw new BadRequestException('Date field requires a valid YYYY-MM-DD date');
      break;
    case 'select':
      if (typeof value !== 'string' || !f.validation.options?.includes(value))
        throw new BadRequestException('Invalid select option');
      break;
    case 'multi_select':
      if (
        !Array.isArray(value) ||
        value.length > 100 ||
        new Set(value).size !== value.length ||
        value.some((x) => typeof x !== 'string' || !f.validation.options?.includes(x))
      )
        throw new BadRequestException('Invalid multi-select options');
      size = value.length;
      break;
    case 'json':
      if (!value || typeof value !== 'object' || JSON.stringify(value).length > 10000)
        throw new BadRequestException(
          'JSON field requires an object or array up to 10000 characters',
        );
      break;
    default:
      throw new BadRequestException('Unsupported field type');
  }
  if (
    size !== undefined &&
    ((f.validation.min !== undefined && size < f.validation.min) ||
      (f.validation.max !== undefined && size > f.validation.max))
  )
    throw new BadRequestException('Field value is outside configured bounds');
  if (f.validation.required && typeof value === 'string' && !value.trim())
    throw new BadRequestException('Required fields cannot be blank');
}

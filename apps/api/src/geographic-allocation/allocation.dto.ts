import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';
export class GeographicAllocationDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique((v) => (typeof v === 'string' ? v.toLowerCase() : v))
  @IsUUID('all', { each: true })
  prospectIds!: string[];
}

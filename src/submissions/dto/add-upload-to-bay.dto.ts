import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsUUID } from 'class-validator';

export class AddUploadToBayDto {
  @ApiPropertyOptional({ description: 'Existing bay ID (UUID). If omitted, a new bay is created.' })
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? undefined : value,
  )
  @IsOptional()
  @IsUUID(4)
  bayId?: string;
}


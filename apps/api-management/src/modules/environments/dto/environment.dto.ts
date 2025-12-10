import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsEnum,
  MinLength,
  MaxLength,
  Matches,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { EnvironmentType } from '@prisma/client';

export class CreateEnvironmentDto {
  @ApiProperty({
    description: 'Environment name',
    example: 'qa',
    minLength: 2,
    maxLength: 50,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-z][a-z0-9_-]*$/, {
    message: 'Name must start with lowercase letter and contain only lowercase letters, numbers, hyphens, and underscores',
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Environment type',
    enum: EnvironmentType,
    default: EnvironmentType.CUSTOM,
  })
  @IsEnum(EnvironmentType)
  @IsOptional()
  type?: EnvironmentType;

  @ApiPropertyOptional({
    description: 'Environment description',
    example: 'Quality assurance environment',
    maxLength: 255,
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({
    description: 'Color for UI display (hex)',
    example: '#6366F1',
  })
  @IsString()
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'Color must be a valid hex color (e.g., #6366F1)',
  })
  color?: string;

  @ApiPropertyOptional({
    description: 'Sort order for display',
    example: 3,
    minimum: 0,
  })
  @IsInt()
  @IsOptional()
  @Min(0)
  sortOrder?: number;
}

export class UpdateEnvironmentDto extends PartialType(CreateEnvironmentDto) {
  @ApiPropertyOptional({
    description: 'Whether the environment is active',
  })
  @IsBoolean()
  @IsOptional()
  active?: boolean;
}

export class EnvironmentResponseDto {
  @ApiProperty({ description: 'Environment ID' })
  id: string;

  @ApiProperty({ description: 'Project ID' })
  projectId: string;

  @ApiProperty({ description: 'Environment name' })
  name: string;

  @ApiProperty({ description: 'Environment type', enum: EnvironmentType })
  type: EnvironmentType;

  @ApiPropertyOptional({ description: 'Environment description' })
  description?: string;

  @ApiProperty({ description: 'Whether the environment is active' })
  active: boolean;

  @ApiPropertyOptional({ description: 'Color for UI display' })
  color?: string;

  @ApiProperty({ description: 'Sort order' })
  sortOrder: number;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class EnvironmentWithApiKeyDto extends EnvironmentResponseDto {
  @ApiProperty({ description: 'API key (only shown once on creation or rotation)' })
  apiKey: string;
}

export class EnvironmentWithStatsDto extends EnvironmentResponseDto {
  @ApiProperty({ description: 'Number of flags in this environment' })
  flagCount: number;

  @ApiProperty({ description: 'Number of enabled flags' })
  enabledFlagCount: number;
}

export class RotateApiKeyResponseDto {
  @ApiProperty({ description: 'New API key (save it securely, shown only once)' })
  apiKey: string;

  @ApiProperty({ description: 'Message' })
  message: string;
}

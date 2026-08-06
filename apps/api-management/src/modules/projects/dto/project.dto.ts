import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
  IsNotEmpty,
} from 'class-validator';

export class CreateProjectDto {
  @ApiProperty({
    description: 'Project name',
    example: 'My Awesome App',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    description: 'Project description',
    example: 'Feature flags for my awesome application',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'URL-friendly slug (auto-generated if not provided)',
    example: 'my-awesome-app',
    minLength: 2,
    maxLength: 50,
  })
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, {
    message: 'Slug must be lowercase alphanumeric with hyphens',
  })
  slug?: string;
}

export class UpdateProjectDto extends PartialType(CreateProjectDto) {}

export class ProjectResponseDto {
  @ApiProperty({ description: 'Project ID' })
  id: string;

  @ApiProperty({ description: 'Project name' })
  name: string;

  @ApiPropertyOptional({ description: 'Project description' })
  description?: string;

  @ApiProperty({ description: 'URL-friendly slug' })
  slug: string;

  @ApiProperty({ description: 'Owner user ID' })
  ownerId: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class ProjectWithDetailsDto extends ProjectResponseDto {
  @ApiProperty({ description: 'Project owner details' })
  owner: {
    id: string;
    email: string;
    name?: string;
  };

  @ApiProperty({ description: 'Number of environments' })
  environmentCount: number;

  @ApiProperty({ description: 'Number of flags' })
  flagCount: number;

  @ApiProperty({ description: 'Number of team members' })
  memberCount: number;
}

export class ProjectSummaryDto {
  @ApiProperty({ description: 'Project ID' })
  id: string;

  @ApiProperty({ description: 'Project name' })
  name: string;

  @ApiProperty({ description: 'URL-friendly slug' })
  slug: string;

  @ApiProperty({ description: 'User role in this project' })
  role: string;

  @ApiPropertyOptional({ description: 'Number of flags' })
  flagCount?: number;

  @ApiPropertyOptional({ description: 'Number of environments' })
  environmentCount?: number;
}

/* eslint-disable import/order */
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  MinLength,
  MaxLength,
  Matches,
  ArrayMaxSize,
  ValidateNested,
  IsEnum,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { RuleOperator, RulePriority } from '@repo/shared';

// =============================================================================
// RULE DTOS
// =============================================================================

export class AttributeConditionDto {
  @ApiProperty({ description: 'Attribute name', example: 'country' })
  @IsString()
  attribute: string;

  @ApiProperty({ description: 'Comparison operator', enum: RuleOperator })
  @IsEnum(RuleOperator)
  operator: RuleOperator;

  @ApiPropertyOptional({ description: 'Single value for comparison' })
  @IsOptional()
  value?: unknown;

  @ApiPropertyOptional({ description: 'Multiple values for IN/NOT_IN operators' })
  @IsArray()
  @IsOptional()
  values?: unknown[];
}

export class AttributeMatchRuleDto {
  @ApiProperty({ description: 'Rule ID' })
  @IsString()
  id: string;

  @ApiPropertyOptional({ description: 'Rule name', example: 'French Pro Users' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'List of conditions', type: [AttributeConditionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttributeConditionDto)
  conditions: AttributeConditionDto[];

  @ApiProperty({ description: 'Match type', enum: ['ALL', 'ANY'], default: 'ALL' })
  @IsString()
  matchType: 'ALL' | 'ANY';

  @ApiProperty({ description: 'Whether rule is enabled', default: true })
  @IsBoolean()
  enabled: boolean;

  @ApiPropertyOptional({ description: 'Variant to return if matched' })
  @IsString()
  @IsOptional()
  variant?: string;
}

export class EntityListRuleDto {
  @ApiProperty({ description: 'Whitelisted entity IDs', type: [String] })
  @IsArray()
  @IsString({ each: true })
  whitelist: string[];

  @ApiProperty({ description: 'Blacklisted entity IDs', type: [String] })
  @IsArray()
  @IsString({ each: true })
  blacklist: string[];
}

export class PercentageRuleDto {
  @ApiProperty({ description: 'Salt for hashing (flag key if not specified)' })
  @IsString()
  salt: string;

  @ApiProperty({ description: 'Rollout percentage (0-100)', minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  rollout: number;

  @ApiPropertyOptional({ description: 'Attribute to use for stickiness' })
  @IsString()
  @IsOptional()
  stickiness?: string;
}

export class RuleSetDto {
  @ApiProperty({ description: 'Rule set version', default: 1 })
  @IsNumber()
  version: number;

  @ApiProperty({
    description: 'Rule evaluation priority',
    type: [String],
    example: ['entityList', 'attributeMatch', 'percentage', 'default'],
  })
  @IsArray()
  @IsString({ each: true })
  priority: RulePriority[];

  @ApiPropertyOptional({ description: 'Entity whitelist/blacklist rules' })
  @ValidateNested()
  @Type(() => EntityListRuleDto)
  @IsOptional()
  entityList?: EntityListRuleDto;

  @ApiPropertyOptional({ description: 'Attribute matching rules', type: [AttributeMatchRuleDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttributeMatchRuleDto)
  @IsOptional()
  attributeMatch?: AttributeMatchRuleDto[];

  @ApiPropertyOptional({ description: 'Percentage rollout rule' })
  @ValidateNested()
  @Type(() => PercentageRuleDto)
  @IsOptional()
  percentage?: PercentageRuleDto;
}

// =============================================================================
// FLAG DTOS
// =============================================================================

export class CreateFlagDto {
  @ApiProperty({
    description: 'Flag key (unique within project)',
    example: 'enable_dark_mode',
    minLength: 3,
    maxLength: 128,
  })
  @IsString()
  @MinLength(3)
  @MaxLength(128)
  @Matches(/^[a-z][a-z0-9_]*$/, {
    message: 'Key must start with lowercase letter and contain only lowercase letters, numbers, and underscores',
  })
  key: string;

  @ApiProperty({
    description: 'Flag display name',
    example: 'Enable Dark Mode',
    minLength: 2,
    maxLength: 256,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(256)
  name: string;

  @ApiPropertyOptional({
    description: 'Flag description',
    example: 'Enables the dark mode theme for users',
    maxLength: 1000,
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({
    description: 'Tags for categorization',
    type: [String],
    example: ['ui', 'theme'],
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Default state for all environments',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  defaultState?: boolean;
}

export class UpdateFlagDto extends PartialType(CreateFlagDto) {
  @ApiPropertyOptional({ description: 'Whether the flag is archived' })
  @IsBoolean()
  @IsOptional()
  archived?: boolean;
}

export class UpdateFlagStateDto {
  @ApiProperty({ description: 'Default state (enabled/disabled)' })
  @IsBoolean()
  defaultState: boolean;
}

export class UpdateFlagRulesDto {
  @ApiProperty({ description: 'Targeting rules', type: RuleSetDto })
  @ValidateNested()
  @Type(() => RuleSetDto)
  rules: RuleSetDto;
}

export class AddToWhitelistDto {
  @ApiProperty({ description: 'Entity IDs to whitelist', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10000)
  entityIds: string[];
}

export class AddToBlacklistDto {
  @ApiProperty({ description: 'Entity IDs to blacklist', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10000)
  entityIds: string[];
}

export class CopyFlagConfigDto {
  @ApiProperty({ description: 'Source environment ID' })
  @IsString()
  sourceEnvId: string;

  @ApiProperty({ description: 'Target environment ID' })
  @IsString()
  targetEnvId: string;
}

export class RollbackFlagDto {
  @ApiProperty({ description: 'Version to rollback to' })
  @IsNumber()
  @Min(1)
  targetVersion: number;
}

// =============================================================================
// RESPONSE DTOS
// =============================================================================

export class FlagResponseDto {
  @ApiProperty({ description: 'Flag ID' })
  id: string;

  @ApiProperty({ description: 'Project ID' })
  projectId: string;

  @ApiProperty({ description: 'Flag key' })
  key: string;

  @ApiProperty({ description: 'Flag name' })
  name: string;

  @ApiPropertyOptional({ description: 'Flag description' })
  description?: string;

  @ApiProperty({ description: 'Tags', type: [String] })
  tags: string[];

  @ApiProperty({ description: 'Whether flag is archived' })
  archived: boolean;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class FlagStateResponseDto {
  @ApiProperty({ description: 'State ID' })
  id: string;

  @ApiProperty({ description: 'Flag ID' })
  flagId: string;

  @ApiProperty({ description: 'Environment ID' })
  envId: string;

  @ApiProperty({ description: 'Default state' })
  defaultState: boolean;

  @ApiProperty({ description: 'Targeting rules' })
  rules: RuleSetDto;

  @ApiProperty({ description: 'Configuration version' })
  version: number;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class FlagWithStatesDto extends FlagResponseDto {
  @ApiProperty({ description: 'Environment states', type: [FlagStateResponseDto] })
  environmentStates: FlagStateResponseDto[];
}

export class FlagHistoryDto {
  @ApiProperty({ description: 'History entry ID' })
  id: string;

  @ApiProperty({ description: 'Version number' })
  version: number;

  @ApiProperty({ description: 'Default state at this version' })
  defaultState: boolean;

  @ApiProperty({ description: 'Rules at this version' })
  rules: RuleSetDto;

  @ApiProperty({ description: 'User who made the change' })
  changedBy: string;

  @ApiPropertyOptional({ description: 'Reason for change' })
  changeReason?: string;

  @ApiProperty({ description: 'Timestamp of change' })
  createdAt: Date;
}

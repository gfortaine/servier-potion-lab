import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min
} from "class-validator";

export class IngredientDto {
  @ApiProperty({ type: String, example: "noix-de-coco" })
  readonly id!: string;

  @ApiProperty({ type: String, example: "Noix de coco" })
  readonly name!: string;
}

export class InventoryItemDto {
  @ApiProperty({ type: String, example: "noix-de-coco" })
  readonly ingredientId!: string;

  @ApiProperty({ type: String, example: "Noix de coco" })
  readonly name!: string;

  @ApiProperty({ type: Number, minimum: 0, example: 3 })
  readonly quantity!: number;
}

export class RecipeDto {
  @ApiProperty({ type: String, example: "invisibilite" })
  readonly id!: string;

  @ApiProperty({ type: String, example: "Potion d'invisibilité" })
  readonly name!: string;

  @ApiProperty({
    type: [String],
    minItems: 3,
    maxItems: 3,
    example: ["noix-de-coco", "yttrium", "mandragore"]
  })
  readonly ingredientIds!: readonly string[];

  @ApiProperty({ type: Boolean, example: false })
  readonly discovered!: boolean;
}

export class PotionDto {
  @ApiProperty({ type: String, format: "uuid", example: "4a8d4d42-2c47-4a3a-9e28-9639dc7c5f52" })
  readonly id!: string;

  @ApiProperty({ type: String, example: "invisibilite" })
  readonly recipeId!: string;

  @ApiProperty({ type: String, example: "Potion d'invisibilité" })
  readonly name!: string;

  @ApiProperty({
    type: [String],
    minItems: 3,
    maxItems: 3,
    example: ["noix-de-coco", "yttrium", "mandragore"]
  })
  readonly ingredientIds!: readonly string[];

  @ApiProperty({ type: String, format: "date-time", example: "2026-06-21T00:00:00.000Z" })
  readonly createdAt!: string;
}

export class InventoryQuantityDto {
  @ApiProperty({ type: Number, minimum: 0, example: 3 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  readonly quantity!: number;
}

export class RechargeInventoryDto {
  @ApiPropertyOptional({ type: Number, minimum: 0, default: 1, example: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  readonly amount?: number;
}

export class RandomizeInventoryDto {
  @ApiPropertyOptional({ type: Number, minimum: 0, default: 1, example: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  readonly minimum?: number;

  @ApiPropertyOptional({ type: Number, minimum: 0, default: 5, example: 5 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  readonly maximum?: number;
}

export class CreatePotionDto {
  @ApiProperty({
    type: [String],
    minItems: 3,
    maxItems: 3,
    example: ["noix-de-coco", "yttrium", "mandragore"]
  })
  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(3)
  @IsString({ each: true })
  readonly ingredientIds!: readonly string[];
}

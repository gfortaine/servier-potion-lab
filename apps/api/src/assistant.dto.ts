import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class AssistantChatRequestDto {
  @ApiProperty({ type: String, minLength: 1, maxLength: 600, example: "Prépare une potion d'invisibilité" })
  @IsString()
  @MinLength(1)
  @MaxLength(600)
  readonly message!: string;

  @ApiPropertyOptional({ enum: ["fr", "en"], default: "fr", example: "fr" })
  @IsOptional()
  @IsIn(["fr", "en"])
  readonly locale?: "fr" | "en";
}

export class AssistantChatStreamRequestDto {
  @ApiProperty({
    type: Object,
    isArray: true,
    description: "AI SDK UI messages sent by useChat."
  })
  @IsArray()
  readonly messages!: readonly unknown[];

  @ApiPropertyOptional({ enum: ["fr", "en"], default: "fr", example: "fr" })
  @IsOptional()
  @IsIn(["fr", "en"])
  readonly locale?: "fr" | "en";
}

export class AssistantToolUiDto {
  @ApiProperty({ type: String, example: "potion-created-card" })
  readonly type!: string;
}

export class AssistantToolCallDto {
  @ApiProperty({ type: String, example: "create_potion" })
  readonly name!: string;

  @ApiProperty({ enum: ["success", "error"], example: "success" })
  readonly status!: "success" | "error";

  @ApiProperty({ type: Boolean, example: true })
  readonly stateChanged!: boolean;

  @ApiProperty({ type: String, example: "Potion d'invisibilité validée et ajoutée au registre." })
  readonly message!: string;

  @ApiProperty({
    type: Object,
    additionalProperties: true,
    example: {
      potion: {
        recipeId: "invisibilite",
        name: "Potion d'invisibilité"
      }
    }
  })
  readonly data!: unknown;

  @ApiProperty({ type: AssistantToolUiDto })
  readonly ui!: AssistantToolUiDto;
}

export class AssistantChatResponseDto {
  @ApiProperty({ type: String, example: "Potion d'invisibilité validée et ajoutée au registre." })
  readonly answer!: string;

  @ApiProperty({ type: String, example: "create_potion" })
  readonly intent!: string;

  @ApiProperty({ type: AssistantToolCallDto, isArray: true })
  readonly toolCalls!: readonly AssistantToolCallDto[];

  @ApiProperty({ type: Boolean, example: true })
  readonly liveProviderUsed!: boolean;
}

import { Body, Controller, Get, HttpCode, Param, Post, Put } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags
} from "@nestjs/swagger";
import { PotionLabService } from "./potion-lab.service.js";
import type {
  InventoryView,
  PotionView,
  RecipeView
} from "./potion-lab.service.js";
import type { Ingredient } from "@servier-potion-lab/domain";
import {
  CreatePotionDto,
  IngredientDto,
  InventoryItemDto,
  InventoryQuantityDto,
  PotionDto,
  RandomizeInventoryDto,
  RecipeDto,
  RechargeInventoryDto
} from "./potion-lab.dto.js";

@ApiTags("Potion Lab")
@Controller()
export class PotionLabController {
  constructor(private readonly potionLab: PotionLabService) {}

  @Get("ingredients")
  @ApiOperation({ summary: "List the 14 SERVIER ingredients." })
  @ApiOkResponse({ description: "All available ingredients.", type: IngredientDto, isArray: true })
  listIngredients(): readonly Ingredient[] {
    return this.potionLab.listIngredients();
  }

  @Get("inventory")
  @ApiOperation({ summary: "List inventory quantities for all ingredients." })
  @ApiOkResponse({ description: "The current inventory.", type: InventoryItemDto, isArray: true })
  async listInventory(): Promise<readonly InventoryView[]> {
    return await this.potionLab.listInventory();
  }

  @Put("inventory/:ingredientId")
  @ApiOperation({ summary: "Set an ingredient inventory quantity." })
  @ApiBody({
    schema: {
      type: "object",
      required: ["quantity"],
      properties: { quantity: { type: "integer", minimum: 0 } }
    }
  })
  @ApiOkResponse({ description: "The updated inventory item.", type: InventoryItemDto })
  @ApiBadRequestResponse({ description: "Invalid quantity." })
  @ApiNotFoundResponse({ description: "Unknown ingredient." })
  async setInventoryQuantity(
    @Param("ingredientId") ingredientId: string,
    @Body() body: InventoryQuantityDto
  ): Promise<InventoryView> {
    return await this.potionLab.setInventoryQuantity(ingredientId, body.quantity);
  }

  @Post("inventory/:ingredientId/recharge")
  @HttpCode(200)
  @ApiOperation({ summary: "Increase one ingredient quantity." })
  @ApiBody({
    schema: {
      type: "object",
      properties: { amount: { type: "integer", minimum: 0, default: 1 } }
    },
    required: false
  })
  @ApiOkResponse({ description: "The recharged inventory item.", type: InventoryItemDto })
  @ApiBadRequestResponse({ description: "Invalid recharge amount." })
  @ApiNotFoundResponse({ description: "Unknown ingredient." })
  async recharge(
    @Param("ingredientId") ingredientId: string,
    @Body() body: RechargeInventoryDto = {}
  ): Promise<InventoryView> {
    return await this.potionLab.recharge(ingredientId, body.amount ?? 1);
  }

  @Post("inventory/randomize")
  @HttpCode(200)
  @ApiOperation({ summary: "Randomize inventory quantities for game replay." })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        minimum: { type: "integer", minimum: 0, default: 1 },
        maximum: { type: "integer", minimum: 0, default: 5 }
      }
    },
    required: false
  })
  @ApiOkResponse({ description: "The randomized inventory.", type: InventoryItemDto, isArray: true })
  @ApiBadRequestResponse({ description: "Invalid randomization bounds." })
  async randomizeInventory(
    @Body() body: RandomizeInventoryDto = {}
  ): Promise<readonly InventoryView[]> {
    return await this.potionLab.randomizeInventory(body.minimum ?? 1, body.maximum ?? 5);
  }

  @Get("recipes")
  @ApiOperation({ summary: "List the 9 recipes and discovery state." })
  @ApiOkResponse({ description: "All recipes.", type: RecipeDto, isArray: true })
  async listRecipes(): Promise<readonly RecipeView[]> {
    return await this.potionLab.listRecipes();
  }

  @Get("potions")
  @ApiOperation({ summary: "List created potion history." })
  @ApiOkResponse({ description: "Potion creation history.", type: PotionDto, isArray: true })
  async listPotions(): Promise<readonly PotionView[]> {
    return await this.potionLab.listPotions();
  }

  @Post("potions")
  @ApiOperation({ summary: "Create a potion from exactly three ingredient IDs." })
  @ApiBody({
    schema: {
      type: "object",
      required: ["ingredientIds"],
      properties: {
        ingredientIds: {
          type: "array",
          minItems: 3,
          maxItems: 3,
          items: { type: "string" }
        }
      }
    }
  })
  @ApiCreatedResponse({ description: "The created potion.", type: PotionDto })
  @ApiBadRequestResponse({
    description: "Invalid selection, missing recipe, or insufficient stock."
  })
  async createPotion(@Body() body: CreatePotionDto): Promise<PotionView> {
    return await this.potionLab.createPotion(body.ingredientIds);
  }
}

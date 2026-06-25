import { Body, Controller, HttpCode, Post, Res } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags
} from "@nestjs/swagger";
import { pipeUIMessageStreamToResponse } from "ai";
import type { UIMessage } from "ai";
import type { Response } from "express";
import { AssistantService } from "./assistant.service.js";
import type { AssistantResponse } from "./assistant.service.js";
import type { ChatToolResponse } from "@servier-potion-lab/potion-tools";
import { CodexChatService } from "./codex-chat.service.js";
import {
  AssistantChatRequestDto,
  AssistantChatResponseDto,
  AssistantChatStreamRequestDto
} from "./assistant.dto.js";

@ApiTags("LangGraph Assistant")
@Controller("assistant")
export class AssistantController {
  constructor(
    private readonly assistant: AssistantService,
    private readonly codex: CodexChatService
  ) {}

  @Post("ask")
  @HttpCode(200)
  @ApiOperation({
    summary: "Ask the env-gated LangGraph local RAG assistant."
  })
  @ApiBody({
    schema: {
      type: "object",
      required: ["question"],
      properties: {
        question: { type: "string", minLength: 1, maxLength: 600 },
        inventorySummary: { type: "string", maxLength: 600 }
      }
    }
  })
  @ApiOkResponse({ description: "A deterministic local RAG answer." })
  @ApiBadRequestResponse({ description: "Invalid assistant request." })
  @ApiNotFoundResponse({ description: "Assistant is disabled by environment." })
  async ask(@Body() body: unknown): Promise<AssistantResponse> {
    return await this.assistant.answer(body);
  }

  @Post("chat")
  @HttpCode(200)
  @ApiOperation({
    summary: "Create potions through the real-model SERVIER Codex chat."
  })
  @ApiBody({ type: AssistantChatRequestDto })
  @ApiOkResponse({ description: "A structured create_potion tool-backed chat response.", type: AssistantChatResponseDto })
  @ApiBadRequestResponse({ description: "Invalid chat request." })
  async chat(@Body() body: AssistantChatRequestDto): Promise<ChatToolResponse> {
    return await this.codex.answer(body.message, body.locale ?? "fr");
  }

  @Post("chat/stream")
  @HttpCode(200)
  @ApiOperation({
    summary: "Stream a real conversational Codex chat response with AI SDK UI messages."
  })
  @ApiBody({ type: AssistantChatStreamRequestDto })
  @ApiOkResponse({ description: "An AI SDK UI message stream." })
  @ApiBadRequestResponse({ description: "Invalid chat stream request." })
  async streamChat(
    @Body() body: AssistantChatStreamRequestDto,
    @Res() response: Response
  ): Promise<void> {
    const stream = await this.codex.stream(body.messages as UIMessage[], body.locale ?? "fr");
    pipeUIMessageStreamToResponse({ response, stream });
  }
}

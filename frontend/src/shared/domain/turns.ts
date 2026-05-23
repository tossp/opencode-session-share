import { categorizeTool, type CategorizedTool } from './categorize';
import type { MessageInfo, RawPartData, ToolCallPart, ToolPart } from './types';
import type { NormalizedShareData } from './normalize';

export interface ShareTurn {
  id: string;
  user: TurnMessage;
  assistants: TurnMessage[];
  messages: TurnMessage[];
  messageIDs: string[];
  categorizedTools: CategorizedTool[];
  messageStartIndex: number;
  messageEndIndex: number;
}

export interface TurnMessage {
  message: MessageInfo;
  parts: RawPartData[];
  categorizedTools: CategorizedTool[];
  messageIndex: number;
}

export function buildTurns(normalized: Pick<NormalizedShareData, 'messages' | 'partsByMessageID'>): ShareTurn[] {
  const turns: ShareTurn[] = [];
  let currentTurn: ShareTurn | undefined;

  normalized.messages.forEach((message, messageIndex) => {
    const turnMessage = buildTurnMessage(message, normalized.partsByMessageID, messageIndex);

    if (message.role === 'user') {
      currentTurn = createTurn(turnMessage, turns.length);
      turns.push(currentTurn);
      return;
    }

    if (currentTurn === undefined) {
      return;
    }

    currentTurn.assistants.push(turnMessage);
    currentTurn.messages.push(turnMessage);
    currentTurn.messageIDs.push(messageID(message));
    currentTurn.categorizedTools.push(...turnMessage.categorizedTools);
    currentTurn.messageEndIndex = messageIndex;
  });

  return turns;
}

function createTurn(user: TurnMessage, index: number): ShareTurn {
  return {
    id: messageID(user.message) || `turn:${index}`,
    user,
    assistants: [],
    messages: [user],
    messageIDs: [messageID(user.message)],
    categorizedTools: [...user.categorizedTools],
    messageStartIndex: user.messageIndex,
    messageEndIndex: user.messageIndex,
  };
}

function buildTurnMessage(
  message: MessageInfo,
  partsByMessageID: Record<string, RawPartData[]>,
  messageIndex: number,
): TurnMessage {
  const parts = partsByMessageID[messageID(message)] ?? [];

  return {
    message,
    parts,
    categorizedTools: parts.filter(isToolPart).map((part) => categorizeTool(part)),
    messageIndex,
  };
}

function isToolPart(part: RawPartData): part is ToolPart | ToolCallPart {
  return part.type === 'tool' || part.type === 'tool-call';
}

function messageID(message: MessageInfo): string {
  return message.id ?? '';
}

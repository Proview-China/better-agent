export interface PromptMessagePart {
  role: "system" | "developer" | "user";
  content: string;
}

type ChatMessageContent =
  | string
  | Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  >;

function isPromptMessagePart(value: unknown): value is PromptMessagePart {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    (record.role === "system" || record.role === "developer" || record.role === "user")
    && typeof record.content === "string"
  );
}

export function readPromptMessagesMetadata(value: unknown): PromptMessagePart[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const messages = value.filter(isPromptMessagePart);
  return messages.length > 0 ? messages : undefined;
}

function appendImagesToLastUserMessage(
  messages: PromptMessagePart[],
  inputImageUrls: string[],
): Array<{ role: PromptMessagePart["role"]; content: ChatMessageContent }> {
  const mapped = messages.map((message) => ({
    role: message.role,
    content: message.content as ChatMessageContent,
  }));
  if (inputImageUrls.length === 0) {
    return mapped;
  }
  const lastUserIndex = [...mapped]
    .map((entry, index) => ({ entry, index }))
    .reverse()
    .find(({ entry }) => entry.role === "user")?.index;

  const imageParts = inputImageUrls.map((imageUrl) => ({
    type: "image_url" as const,
    image_url: { url: imageUrl },
  }));

  if (lastUserIndex === undefined) {
    mapped.push({
      role: "user",
      content: imageParts,
    });
    return mapped;
  }

  const lastUser = mapped[lastUserIndex]!;
  const currentContent = lastUser.content;
  const textParts = typeof currentContent === "string"
    ? [{ type: "text" as const, text: currentContent }]
    : Array.isArray(currentContent)
      ? currentContent
      : [];
  mapped[lastUserIndex] = {
    ...lastUser,
    content: [
      ...textParts,
      ...imageParts,
    ],
  };
  return mapped;
}

export function buildChatCompletionMessagesFromPromptParts(input: {
  instructionText: string;
  promptMessages?: PromptMessagePart[];
  inputImageUrls?: string[];
}): Array<{ role: string; content: ChatMessageContent }> {
  if (!input.promptMessages || input.promptMessages.length === 0) {
    return [
      {
        role: "user",
        content: input.inputImageUrls?.length
          ? [
            { type: "text", text: input.instructionText },
            ...input.inputImageUrls.map((imageUrl) => ({
              type: "image_url" as const,
              image_url: { url: imageUrl },
            })),
          ]
          : input.instructionText,
      },
    ];
  }

  return appendImagesToLastUserMessage(
    input.promptMessages,
    input.inputImageUrls ?? [],
  );
}

export function buildResponsesInputFromPromptParts(input: {
  instructionText: string;
  promptMessages?: PromptMessagePart[];
  inputImageUrls?: string[];
}): string | Array<Record<string, unknown>> {
  if (!input.promptMessages || input.promptMessages.length === 0) {
    if (!input.inputImageUrls?.length) {
      return input.instructionText;
    }
    return [
      {
        role: "user",
        content: [
          { type: "input_text" as const, text: input.instructionText },
          ...input.inputImageUrls.map((imageUrl) => ({
            type: "input_image" as const,
            image_url: imageUrl,
          })),
        ],
      },
    ];
  }

  return appendImagesToLastUserMessage(
    input.promptMessages,
    input.inputImageUrls ?? [],
  ).map((message) => {
    const content = message.content;
    if (typeof content === "string") {
      return {
        role: message.role,
        content: [{ type: "input_text" as const, text: content }],
      };
    }
    return {
      role: message.role,
      content: content.map((part) => {
        if (part.type === "text") {
          return { type: "input_text" as const, text: part.text };
        }
        return {
          type: "input_image" as const,
          image_url: part.image_url.url,
        };
      }),
    };
  });
}

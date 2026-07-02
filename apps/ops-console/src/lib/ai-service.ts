import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }
  return client;
}

export async function askAI(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 2048
): Promise<string> {
  const anthropic = getClient();
  const msg = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });
  const block = msg.content[0];
  return block.type === "text" ? block.text : "";
}

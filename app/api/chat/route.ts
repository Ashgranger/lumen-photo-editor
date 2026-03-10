import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { messages, context } = await req.json();
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 400,
      system: `You are LUMEN AI, an expert creative assistant for photo and video editing. Be concise (2-3 sentences), enthusiastic, and expert. Context: ${context || "No media loaded."}`,
      messages,
    });
    const text = response.content[0].type === "text" ? response.content[0].text : "";
    return Response.json({ reply: text });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

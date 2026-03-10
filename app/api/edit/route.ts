import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { prompt, currentAdjustments } = await req.json();
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 600,
      system: `You are an expert photo retoucher. Given an editing instruction, respond ONLY with a valid JSON object (no markdown) with this exact shape:
{
  "adjustments": {
    "exposure": <-100 to 100>,
    "contrast": <-100 to 100>,
    "highlights": <-100 to 100>,
    "shadows": <-100 to 100>,
    "whites": <-100 to 100>,
    "blacks": <-100 to 100>,
    "temp": <-100 to 100>,
    "tint": <-100 to 100>,
    "saturation": <-100 to 100>,
    "vibrance": <-100 to 100>,
    "clarity": <-100 to 100>,
    "dehaze": <0 to 100>,
    "sharpness": <0 to 100>,
    "vignette": <-100 to 0>
  },
  "name": "<short preset name>",
  "description": "<one sentence>"
}`,
      messages: [{ role: "user", content: `Edit: "${prompt}"\nCurrent: ${JSON.stringify(currentAdjustments)}` }],
    });
    const text = response.content[0].type === "text" ? response.content[0].text : "{}";
    return Response.json(JSON.parse(text.replace(/```json|```/g, "").trim()));
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

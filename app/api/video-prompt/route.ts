import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { prompt, style, duration, aspect } = await req.json();

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1200,
      system: `You are a professional video director and AI video generation expert. Generate detailed video storyboards and prompts optimized for AI video generators like Sora, Runway, and Pika. Respond ONLY with valid JSON, no markdown.`,
      messages: [{
        role: "user",
        content: `Create a detailed AI video generation plan for:
Prompt: "${prompt}"
Style: ${style || "cinematic"}
Duration: ${duration || 10} seconds
Aspect ratio: ${aspect || "16:9"}

Respond with JSON:
{
  "title": "<video title>",
  "enhanced_prompt": "<detailed optimized prompt for AI video generation, 100-150 words>",
  "negative_prompt": "<things to avoid>",
  "scenes": [
    {
      "time": "<0s-Xs>",
      "description": "<what happens>",
      "camera": "<camera movement>",
      "mood": "<mood/lighting>",
      "color_palette": ["#hex1","#hex2","#hex3"]
    }
  ],
  "technical": {
    "fps": <24|30|60>,
    "motion_style": "<slow-motion|normal|timelapse>",
    "lighting": "<natural|studio|dramatic|golden-hour|neon>",
    "color_grade": "<description>"
  },
  "sora_prompt": "<optimized for Sora>",
  "runway_prompt": "<optimized for Runway Gen-3>",
  "pika_prompt": "<optimized for Pika>",
  "tips": ["<tip1>","<tip2>","<tip3>"]
}`
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "{}";
    return Response.json(JSON.parse(text.replace(/```json|```/g, "").trim()));
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

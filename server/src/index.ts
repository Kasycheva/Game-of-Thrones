import "dotenv/config";
import cors from "cors";
import express from "express";
import type { Request, Response } from "express";
import morgan from "morgan";
// --- ИЗМЕНЕНИЕ 1: Импорт официального SDK Gemini ---
import { GoogleGenAI } from "@google/genai";
// --------------------------------------------------
import { z } from "zod";
import { Character, HistoryEntry, House, StoryNode } from "./shared/types";
import {
  GAME_CONFIG,
  HOUSE_NPCS,
  INITIAL_SYSTEM_PROMPT,
} from "./shared/constants";

// --- ИЗМЕНЕНИЕ 2: Инициализация SDK. Ключ API берется из Vercel автоматически. ---
const ai = new GoogleGenAI({});
// ----------------------------------------------------------------------------------

// const GEMINI_API_KEY = process.env.GEMINI_API_KEY; // УДАЛЕНО
// if (!GEMINI_API_KEY) { // УДАЛЕНО
//   throw new Error("Missing GEMINI_API_KEY in environment variables"); // УДАЛЕНО
// } // УДАЛЕНО

// >>> ИСПРАВЛЕНИЕ: Заменяем устаревшие имена моделей на актуальные <<<
// 1. Для текста: gemini-2.5-flash
// 2. Для изображений: gemini-2.5-flash (поскольку imagen не работал)
const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL ?? "gemini-2.5-flash";
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL ?? "gemini-2.5-flash";
// >>> КОНЕЦ ИСПРАВЛЕНИЯ <<<

const PORT = Number(process.env.PORT ?? 4000);
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(
  cors({
    origin: ALLOWED_ORIGINS?.includes("*")
      ? true
      : ALLOWED_ORIGINS && ALLOWED_ORIGINS.length > 0
      ? ALLOWED_ORIGINS
      : true,
  })
);
app.use(morgan("tiny"));

// ... (остальной код, до функции callGeminiText остается без изменений) ...

const characterSchema = z.object({
  name: z.string().min(1),
  house: z.nativeEnum(House),
  bio: z.string().min(1),
  health: z.number(),
  influence: z.number(),
});

const historyEntrySchema = z.object({
  type: z.enum(["narrative", "dialogue", "choice"]),
  text: z.string(),
  speaker: z.string().optional(),
});

const startBodySchema = z.object({
  character: characterSchema,
});

const turnBodySchema = z.object({
  character: characterSchema,
  history: z.array(historyEntrySchema),
  lastChoice: z.string().min(1),
  turnCount: z.number().int().nonnegative(),
  maxTurns: z.number().int().positive().default(GAME_CONFIG.MAX_TURNS),
});

const sceneBodySchema = z.object({
  visualDescription: z.string().min(1),
});

const portraitBodySchema = z.object({
  name: z.string().min(1),
});

app.get("/healthz", (_req: Request, res: Response) => {
  res.json({ status: "ok", textModel: TEXT_MODEL, imageModel: IMAGE_MODEL });
});

app.post("/api/story/start", async (req: Request, res: Response) => {
  try {
    const { character } = startBodySchema.parse(req.body);
    const node = await generateStartNode(character);
    res.json(node);
  } catch (error) {
    handleRequestError(error, res, "Failed to generate starting scene");
  }
});

app.post("/api/story/turn", async (req: Request, res: Response) => {
  try {
    const { character, history, lastChoice, turnCount, maxTurns } =
      turnBodySchema.parse(req.body);
    const node = await generateNextTurn(
      history,
      character,
      lastChoice,
      turnCount,
      maxTurns
    );
    res.json(node);
  } catch (error) {
    handleRequestError(error, res, "Failed to generate next scene");
  }
});

app.post("/api/images/scene", async (req: Request, res: Response) => {
  try {
    const { visualDescription } = sceneBodySchema.parse(req.body);
    try {
      const image = await generateSceneImage(visualDescription);
      res.json({ image: image }); // ИЗМЕНЕНО: image: null на image: image
    } catch (innerError) {
      console.error("Image generation failed (non-fatal):", innerError);
      res.json({ image: null });
    }
  } catch (error) {
    handleRequestError(error, res, "Failed to generate scene image");
  }
});

app.post("/api/images/portrait", async (req: Request, res: Response) => {
  try {
    const { name } = portraitBodySchema.parse(req.body);
    try {
      const image = await generatePortrait(name);
      res.json({ image: image }); // ИЗМЕНЕНО: image: null на image: image
    } catch (innerError) {
      console.error("Portrait generation failed (non-fatal):", innerError);
      res.json({ image: null });
    }
  } catch (error) {
    handleRequestError(error, res, "Failed to generate portrait");
  }
});

app.listen(PORT, () => {
  console.log(`Game of Thrones AI server listening on port ${PORT}`);
});

function handleRequestError(
  error: unknown,
  res: Response,
  defaultMessage: string
) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(defaultMessage, error);
  if (message.includes("Invalid") || message.includes("Missing")) {
    res.status(400).json({ error: message });
    return;
  }
  res.status(500).json({ error: defaultMessage });
}

async function generateStartNode(character: Character): Promise<StoryNode> {
  const availableNPCs = HOUSE_NPCS[character.house].join(", ");
  const prompt = `
${INITIAL_SYSTEM_PROMPT}

Ти — рушій сюжету. Відповідай СТРОГО JSON.

{
  "narrative": "...",
  "visual_description": "...",
  "options": [{"id":"1","text":"..."}],
  "health_change": 0,
  "influence_change": 0,
  "is_game_over": false
}

ПОЧАТОК ГРИ (Акт I)
Персонаж: ${character.name}, Дім: ${character.house}
Біографія: ${character.bio}

Введи одного NPC у сцену: ${availableNPCs}
Створи інтригу та першу сцену.
`;
  return fetchStoryNode(prompt);
}

async function generateNextTurn(
  history: HistoryEntry[],
  character: Character,
  lastChoice: string,
  turnCount: number,
  maxTurns: number
): Promise<StoryNode> {
  let pacingInstruction = "";
  let act = "Акт I";

  if (turnCount <= GAME_CONFIG.ACTS.ACT_1_END) {
    act = "Акт I (Зав'язка)";
    pacingInstruction = "Будуй інтригу.";
  } else if (turnCount <= GAME_CONFIG.ACTS.ACT_2_END) {
    act = "Акт II (Конфлікт)";
    pacingInstruction = "Піднімай ставки.";
  } else {
    act = "Акт III (Кульмінація)";
    pacingInstruction = "Веди до кульмінації.";
  }

  if (turnCount >= maxTurns - 1) {
    pacingInstruction +=
      " Це останній хід. Заверши історію та встанови is_game_over=true.";
  }

  const historyLines = history
    .map((entry) => {
      if (entry.type === "dialogue")
        return `${entry.speaker ?? "NPC"}: "${entry.text}"`;
      if (entry.type === "choice") return `> Гравець: ${entry.text}`;
      return entry.text;
    })
    .slice(-12)
    .join("\n");

  const prompt = `
${INITIAL_SYSTEM_PROMPT}

Формат відповіді СТРОГО JSON.

ІСТОРІЯ ДО ЦЬОГО:
${historyLines}

Хід: ${turnCount} з ${maxTurns}
Персонаж: ${character.name} (${character.house})
Останній вибір: ${lastChoice}

${pacingInstruction}
`;

  return fetchStoryNode(prompt);
}

async function fetchStoryNode(prompt: string): Promise<StoryNode> {
  try {
    const text = await callGeminiText(prompt);
    return JSON.parse(text) as StoryNode;
  } catch (error) {
    console.error("Story generation error", error);
    return fallbackNode();
  }
}

// --- ИЗМЕНЕНИЕ 3: Использование SDK для текста ---
async function callGeminiText(prompt: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });

  let text = response.text;

  if (!text) {
    throw new Error("Empty response from Gemini text API");
  }

  // >>> ОЧИЩАЕМ ОТВЕТ ОТ БЛОКОВ КОДА MARKDOWN (Оставляем, как было) <<<
  text = text.trim();
  // Удаляем '```json' в начале, если он есть
  if (text.startsWith("```json")) {
    text = text.substring(7).trim();
  }
  // Удаляем '```' в конце, если он есть
  if (text.endsWith("```")) {
    text = text.substring(0, text.length - 3).trim();
  }
  // >>> КОНЕЦ ОЧИЩЕНИЯ <<<

  return text;
}
// ----------------------------------------------------------------------

async function generateSceneImage(
  visualDescription: string
): Promise<string | null> {
  return callGeminiImage(
    `Cinematic dark fantasy scene, Game of Thrones style. No text. ${visualDescription}`
  );
}

async function generatePortrait(name: string): Promise<string | null> {
  return callGeminiImage(
    `Portrait of ${name}, Game of Thrones universe, dramatic lighting, fantasy oil painting. No text.`
  );
}

// --- ИЗМЕНЕНИЕ 4: Использование SDK для изображений ---
async function callGeminiImage(prompt: string): Promise<string | null> {
  try {
    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const parts = response.candidates?.[0]?.content?.parts;

    if (!parts) return null;

    for (const part of parts) {
      if (part.inlineData?.data) {
        return `data:${part.inlineData.mimeType ?? "image/png"};base64,${
          part.inlineData.data
        }`;
      }
    }
  } catch (error) {
    // Не вызывать throw, так как это non-fatal
    console.error("SDK Image generation attempt failed:", error);
    return null;
  }

  return null;
}
// ----------------------------------------------------------------------

function fallbackNode(): StoryNode {
  return {
    narrative:
      "Туман війни занадто густий... Магія Валірії дала збій (API Error). Спробуйте ще раз.",
    visual_description: "Foggy battlefield",
    speaker: null,
    dialogue: null,
    options: [{ id: "retry", text: "Спробувати ще раз" }],
    health_change: 0,
    influence_change: 0,
    is_game_over: false,
  };
}
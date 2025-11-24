// =====================================
// Gemini REST API for Browser (Vite)
// =====================================

import { Character, StoryNode, HistoryEntry } from "../types";
import { INITIAL_SYSTEM_PROMPT, HOUSE_NPCS, GAME_CONFIG } from "../constants";

// API key from .env (VITE_GEMINI_API_KEY=)
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Models
const TEXT_MODEL = "gemini-2.0-pro";     // or "gemini-2.5-flash" if you prefer
const IMAGE_MODEL = "gemini-1.5-flash";  // browser-compatible model

// -------------------------
// TEXT GENERATION (REST)
// -------------------------
async function callGeminiText(prompt: string): Promise<string> {
  const body = {
    contents: [{ parts: [{ text: prompt }] }]
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    console.error("Text API error:", await res.text());
    throw new Error("Gemini text generation failed");
  }

  const json = await res.json();
  return json?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// -------------------------
// IMAGE GENERATION (REST)
// -------------------------
async function callGeminiImage(prompt: string): Promise<string | null> {
  const body = {
    contents: [{ parts: [{ text: prompt }] }]
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    console.error("Image API error:", await res.text());
    return null;
  }

  const json = await res.json();
  const parts = json?.candidates?.[0]?.content?.parts;

  if (!parts) return null;

  for (const part of parts) {
    if (part.inlineData?.data) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }

  return null;
}

// =====================================
// STORY LOGIC
// =====================================

export const generateStartNode = async (character: Character): Promise<StoryNode> => {
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

  return await fetchStoryNode([], prompt);
};


export const generateNextTurn = async (
  history: HistoryEntry[],
  character: Character,
  lastChoice: string,
  turnCount: number,
  maxTurns: number
): Promise<StoryNode> => {

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
    pacingInstruction += " Це останній хід. Заверши історію, встанови is_game_over=true.";
  }

  const prompt = `
${INITIAL_SYSTEM_PROMPT}

Формат відповіді СТРОГО JSON.

ІСТОРІЯ ДО ЦЬОГО:
${history.map(h => h.text).join("\n")}

Хід: ${turnCount} з ${maxTurns}
Персонаж: ${character.name} (${character.house})
Останній вибір: ${lastChoice}

${pacingInstruction}
`;

  return await fetchStoryNode(history, prompt);
};


// ----------------------------
// MAIN STORY PARSER
// ----------------------------
async function fetchStoryNode(history: HistoryEntry[], prompt: string): Promise<StoryNode> {
  try {
    const text = await callGeminiText(prompt);

    const data = JSON.parse(text) as StoryNode;
    return data;

  } catch (error) {
    console.error("Story generation error:", error);

    return {
      narrative: "Туман війни занадто густий... Магія Валірії дала збій (API Error). Спробуйте ще раз.",
      visual_description: "Foggy battlefield",
      speaker: null,
      dialogue: null,
      options: [{ id: "retry", text: "Спробувати ще раз" }],
      health_change: 0,
      influence_change: 0,
      is_game_over: false,
    };
  }
}


// ----------------------------
// IMAGE GENERATION EXPORTS
// ----------------------------
export const generateSceneImage = async (visualDescription: string) =>
  await callGeminiImage(
    `Cinematic dark fantasy scene, Game of Thrones style. No text. ${visualDescription}`
  );

export const generatePortrait = async (name: string) =>
  await callGeminiImage(
    `Portrait of ${name}, Game of Thrones universe, dramatic lighting, fantasy oil painting. No text.`
  );

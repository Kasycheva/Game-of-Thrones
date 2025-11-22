
import { GoogleGenAI, Type } from "@google/genai";
import { Character, StoryNode, HistoryEntry } from "../types";
import { INITIAL_SYSTEM_PROMPT, HOUSE_NPCS, GAME_CONFIG } from "../constants";

// Initialize Gemini Client
// Ensure GEMINI_API_KEY is available in your environment variables
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY || '' });

// Model Definitions
const TEXT_MODEL = 'gemini-2.5-flash';
const IMAGE_MODEL = 'gemini-2.5-flash-image';

export const generateStartNode = async (character: Character): Promise<StoryNode> => {
  const availableNPCs = HOUSE_NPCS[character.house].join(", ");
  
  const prompt = `
    ПОЧАТОК ГРИ (Акт I).
    Персонаж: ${character.name}, Дім: ${character.house}.
    Біографія: ${character.bio}.
    
    Введи в історію одного з цих персонажів для діалогу або взаємодії: ${availableNPCs}.
    
    Почни історію з моменту прибуття персонажа у важливу локацію або отримання важливого листа. 
    Створи інтригу.
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
    pacingInstruction = "Ми ще на початку. Будуй світ і інтриги.";
  } else if (turnCount <= GAME_CONFIG.ACTS.ACT_2_END) {
    act = "Акт II (Конфлікт)";
    pacingInstruction = "Піднімай ставки. Ситуація стає небезпечною.";
  } else {
    act = "Акт III (Кульмінація)";
    pacingInstruction = "Ми наближаємося до фіналу. Веди до розв'язки. Це вирішальні моменти.";
  }

  if (turnCount >= maxTurns - 1) {
    pacingInstruction += " ЦЕ ОСТАННІЙ ХІД. Заверши історію логічним фіналом (успіх або трагедія) на основі вибору гравця. Встанови is_game_over = true.";
  }

  const prompt = `
    ХІД: ${turnCount} з ${maxTurns}. ЕТАП: ${act}.
    Персонаж: ${character.name} (${character.house}).
    Здоров'я: ${character.health}, Вплив: ${character.influence}.
    Гравець щойно вибрав: "${lastChoice}".
    
    ${pacingInstruction}
    
    Продовжуй історію, враховуючи наслідки.
  `;

  return await fetchStoryNode(history, prompt);
};

const fetchStoryNode = async (history: HistoryEntry[], currentPrompt: string): Promise<StoryNode> => {
  try {
    // Construct context from history
    // Convert HistoryEntry objects into a script-like format for the AI
    const context = history.map(entry => {
      if (entry.type === 'dialogue') return `${entry.speaker}: "${entry.text}"`;
      if (entry.type === 'choice') return `> Гравець: ${entry.text}`;
      return `(Опис): ${entry.text}`;
    }).slice(-12).join("\n\n"); // Keep last 12 entries for context
    
    const finalPrompt = `
      ІСТОРІЯ (Контекст):
      ${context}
      
      ---
      ЗАВДАННЯ:
      ${currentPrompt}
    `;

    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: finalPrompt,
      config: {
        systemInstruction: INITIAL_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            narrative: { type: Type.STRING },
            speaker: { type: Type.STRING, nullable: true },
            dialogue: { type: Type.STRING, nullable: true },
            visual_description: { type: Type.STRING },
            options: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  text: { type: Type.STRING },
                },
                required: ["id", "text"]
              }
            },
            health_change: { type: Type.INTEGER },
            influence_change: { type: Type.INTEGER },
            is_game_over: { type: Type.BOOLEAN },
            game_over_reason: { type: Type.STRING, nullable: true }
          },
          required: ["narrative", "visual_description", "options", "health_change", "influence_change", "is_game_over"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No text returned from Gemini");

    const data = JSON.parse(text) as StoryNode;
    return data;

  } catch (error) {
    console.error("Story generation error:", error);
    // Fallback node to prevent crash
    return {
      narrative: "Туман війни занадто густий... Магія стародавньої Валірії дала збій (API Error). Спробуйте ще раз.",
      visual_description: "Heavy fog in a dark forest",
      speaker: null,
      dialogue: null,
      options: [{ id: "retry", text: "Спробувати знову" }],
      health_change: 0,
      influence_change: 0,
      is_game_over: false
    };
  }
};

export const generateSceneImage = async (visualDescription: string): Promise<string | null> => {
  try {
    const prompt = `Cinematic shot, Game of Thrones style, dark fantasy, realistic, 8k, detailed textures. No text. Scene description: ${visualDescription}`;
    
    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: {
        parts: [
          { text: prompt }
        ]
      },
    });

    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
           return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error("Image generation error:", error);
    return null;
  }
};

export const generatePortrait = async (name: string): Promise<string | null> => {
  try {
    // Prompt specifically for a character portrait
    const prompt = `Character portrait of ${name} from Game of Thrones universe. Close-up face shot, oil painting style, dark fantasy, detailed, neutral background, dramatic lighting. No text.`;

    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: { parts: [{ text: prompt }] },
    });

    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
           return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        }
      }
    }
    return null;
  } catch (error) {
    console.error("Portrait generation error:", error);
    return null;
  }
};

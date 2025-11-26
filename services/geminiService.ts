import { Character, StoryNode, HistoryEntry } from "../shared/types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

async function postJSON<T>(path: string, payload: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`API ${path} error:`, errorText);
    throw new Error(`API request failed for ${path}`);
  }

  return response.json() as Promise<T>;
}

export const generateStartNode = async (character: Character): Promise<StoryNode> => {
  return postJSON<StoryNode>("/api/story/start", { character });
};

export const generateNextTurn = async (
  history: HistoryEntry[],
  character: Character,
  lastChoice: string,
  turnCount: number,
  maxTurns: number
): Promise<StoryNode> => {
  return postJSON<StoryNode>("/api/story/turn", {
    history,
    character,
    lastChoice,
    turnCount,
    maxTurns,
  });
};

export const generateSceneImage = async (visualDescription: string): Promise<string | null> => {
  const { image } = await postJSON<{ image: string | null }>("/api/images/scene", { visualDescription });
  return image ?? null;
};

export const generatePortrait = async (name: string): Promise<string | null> => {
  const { image } = await postJSON<{ image: string | null }>("/api/images/portrait", { name });
  return image ?? null;
};

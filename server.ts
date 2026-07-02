import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "5mb" }));

// Lazy initialize Gemini client to avoid crashes if API key is missing at load time
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required but missing");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// 1. API: Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// 2. API: Server-Side AI Chat Assistant
app.post("/api/gemini/chat", async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message) {
      res.status(400).json({ error: "Message is required" });
      return;
    }

    const ai = getGeminiClient();

    // Map conversation history to the format required by the Google GenAI SDK
    // [{ role: "user", parts: [{ text: "Hello" }] }]
    const formattedContents: any[] = [];
    
    if (Array.isArray(history)) {
      history.forEach((msg: any) => {
        if (msg.role === "user" || msg.role === "model") {
          formattedContents.push({
            role: msg.role,
            parts: [{ text: msg.text || "" }],
          });
        }
      });
    }

    // Append the new message
    formattedContents.push({
      role: "user",
      parts: [{ text: message }],
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: formattedContents,
      config: {
        systemInstruction: `You are Linky, an advanced, super friendly, and helpful AI Chatbot integrated into the Geochat Link messaging platform. 
Keep your responses relatively concise, engaging, and friendly. Use emojis where appropriate.
You are chatting with a developer or social app user testing the standout "People Around Me" chat system.`,
        temperature: 0.7,
      },
    });

    res.json({ text: response.text || "I'm sorry, I couldn't formulate a response." });
  } catch (error: any) {
    console.error("Gemini Chat API Error:", error);
    res.status(500).json({ error: error.message || "Failed to generate AI response" });
  }
});

// 3. API: Instant Message Translator
app.post("/api/gemini/translate", async (req, res) => {
  try {
    const { text, targetLanguage } = req.body;
    if (!text || !targetLanguage) {
      res.status(400).json({ error: "Text and targetLanguage are required" });
      return;
    }

    const ai = getGeminiClient();

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Translate the following text into the language: ${targetLanguage}. 
Return ONLY the final translated text. No introductions, explanations, or surrounding quotes.

Text to translate:
"${text}"`,
      config: {
        temperature: 0.3,
      },
    });

    res.json({ translation: (response.text || "").trim() });
  } catch (error: any) {
    console.error("Gemini Translate API Error:", error);
    res.status(500).json({ error: error.message || "Failed to translate text" });
  }
});

// 4. API: Conversation Summarizer via Gemini AI
app.post("/api/gemini/summarize", async (req, res) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "Messages array is required" });
      return;
    }

    const ai = getGeminiClient();

    // Format the messages for summarization
    const conversationTranscript = messages
      .map((msg: any) => `${msg.senderName}: ${msg.text}`)
      .join("\n");

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `You are an AI conversation summarizer. Analyze the recent chat logs provided below and generate a brief, friendly, 2-3 sentence overview highlighting the key topics discussed, any plans made, and the general mood. Keep it concise, professional, and do not reference internal technical names or IDs. Use bullet points if appropriate.

Chat Log transcript:
${conversationTranscript}`,
      config: {
        temperature: 0.5,
      },
    });

    res.json({ summary: (response.text || "No summary could be generated.").trim() });
  } catch (error: any) {
    console.error("Gemini Summarize API Error:", error);
    res.status(500).json({ error: error.message || "Failed to summarize conversation" });
  }
});

// 5. API: Smart Reply Suggester via Gemini AI
app.post("/api/gemini/smart-reply", async (req, res) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "Messages array is required" });
      return;
    }

    const ai = getGeminiClient();

    // Format conversation history for context
    const conversationTranscript = messages
      .slice(-5) // Use the last 5 messages for quick context
      .map((msg: any) => `${msg.senderName}: ${msg.text}`)
      .join("\n");

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `You are a conversation assistant. Analyze the recent messages and generate 2 to 3 short, relevant, and extremely friendly direct-reply suggestions that the user can send with a single tap. 
Keep each suggestion short (1 to 4 words), and naturally fitting the flow. Feel free to use appropriate emojis.
Return ONLY a raw JSON string array containing 2 to 3 suggestions (e.g. ["Sounds great! 👍", "I'm down!", "What time?"]).

Recent Chat Logs:
${conversationTranscript}`,
      config: {
        responseMimeType: "application/json",
      },
    });

    let replies = ["Got it!", "Awesome!", "Thanks!"];
    try {
      const parsed = JSON.parse((response.text || "").trim());
      if (Array.isArray(parsed)) {
        replies = parsed.slice(0, 3);
      }
    } catch (parseErr) {
      console.warn("Failed to parse smart replies JSON, using fallback replies", response.text);
    }

    res.json({ replies });
  } catch (error: any) {
    console.error("Gemini Smart Reply API Error:", error);
    res.status(500).json({ error: error.message || "Failed to suggest smart replies" });
  }
});

// 6. API: GIPHY & Tenor GIF/Sticker Unified Proxy Search
app.get("/api/giphy-tenor/search", async (req, res) => {
  try {
    const { q, type } = req.query;
    const searchQuery = typeof q === "string" ? q.trim() : "";
    const isStickers = type === "stickers";

    const results: { id: string; url: string; title: string }[] = [];

    // GIPHY Search Integration with standard demo public beta key as safe fallback
    const giphyApiKey = process.env.GIPHY_API_KEY || "dc6zaTOxFJmzC";
    const giphyEndpoint = isStickers ? "stickers" : "gifs";
    const giphyUrl = searchQuery 
      ? `https://api.giphy.com/v1/${giphyEndpoint}/search?api_key=${giphyApiKey}&q=${encodeURIComponent(searchQuery)}&limit=8`
      : `https://api.giphy.com/v1/${giphyEndpoint}/trending?api_key=${giphyApiKey}&limit=8`;

    try {
      const giphyRes = await fetch(giphyUrl);
      if (giphyRes.ok) {
        const giphyData = await giphyRes.json();
        if (giphyData && Array.isArray(giphyData.data)) {
          giphyData.data.forEach((item: any) => {
            if (item.images?.fixed_height?.url) {
              results.push({
                id: `giphy-${item.id}`,
                url: item.images.fixed_height.url,
                title: item.title || "GIPHY animation",
              });
            }
          });
        }
      }
    } catch (err) {
      console.error("Error fetching from GIPHY:", err);
    }

    // Tenor Search Integration (supports fallback key for demo mode)
    // Note: Tenor uses different search endpoints for trending / search
    const tenorApiKey = process.env.TENOR_API_KEY || "LIVDSRZULELA";
    const tenorUrl = searchQuery
      ? `https://tenor.googleapis.com/v2/posts?key=${tenorApiKey}&q=${encodeURIComponent(searchQuery)}&limit=8&client_key=geochat_link`
      : `https://tenor.googleapis.com/v2/featured?key=${tenorApiKey}&limit=8&client_key=geochat_link`;

    try {
      const tenorRes = await fetch(tenorUrl);
      if (tenorRes.ok) {
        const tenorData = await tenorRes.json();
        if (tenorData && Array.isArray(tenorData.results)) {
          tenorData.results.forEach((item: any) => {
            const media = item.media_formats?.tinygif || item.media_formats?.nanogif || item.media_formats?.gif;
            if (media?.url) {
              results.push({
                id: `tenor-${item.id}`,
                url: media.url,
                title: item.title || "Tenor animation",
              });
            }
          });
        }
      }
    } catch (err) {
      console.error("Error fetching from Tenor:", err);
    }

    // Fallback Mock results if both API requests are rate limited or fail
    if (results.length === 0) {
      const presets = [
        { id: "preset-1", url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdWZ2NW04dDByMnAwZHN3MnEzdDV0MWVzZzBqNDR2eDFoY2c4dHY3YiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/t372vR7pS6Zf6g0X73/giphy.gif", title: "Wave Hello" },
        { id: "preset-2", url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3g1ZnpnNmdvdThubHB3bndvZmYyejVub25rYThnbm9ocmNkaDFrOCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/9Y6n9TR7AbS1i/giphy.gif", title: "Thumbs Up" },
        { id: "preset-3", url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMzlqbnA4bDB6cGZidWpsdjRpdXBtYW0zdXpsaGdteDBnaDlzYWNoMyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/du3J3cHyTE56U/giphy.gif", title: "Dance Party" },
        { id: "preset-4", url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMWN2YW9md2M1amtzMmE5bndrbGNhdGtlZTh4NXU1NTRpdnUzaHh1ZyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/HCLbhUDRzDxoFC31Sl/giphy.gif", title: "Excited!" },
        { id: "preset-5", url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNmt0bXp6Z3A0dzhvdDNmd251ZjY4bm9rMmxidGFncmU3djA3djBpaSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/6A08v7fG0v6uAnzPwC/giphy.gif", title: "High Five" },
        { id: "preset-6", url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbDVqbmZka2t2ZnA5MzhodGN4djg3a3o3eWFoYzgxZ2Jmd2M2cXZ6ayZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/9PxJYX3TC7STK/giphy.gif", title: "Laughing Cat" }
      ];
      res.json({ results: presets });
    } else {
      res.json({ results });
    }
  } catch (error: any) {
    console.error("Giphy/Tenor Search Route Error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch animation results" });
  }
});

// Vite middleware / Static Asset Setup
async function setupViteOrStatic() {
  const isProduction = process.env.NODE_ENV === "production" || __filename.endsWith("server.cjs");

  if (!isProduction) {
    console.log("Setting up Vite middleware for development...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Serving static production assets from dist...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

setupViteOrStatic().catch((err) => {
  console.error("Failed to start server:", err);
});

import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

const MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Helper to get AI client with the correct key
const getAiClient = () => {
  const key = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!key || key === "MY_GEMINI_API_KEY") {
    throw new Error("Gemini API Key is missing or invalid. Please check your AI Studio secrets.");
  }
  return new GoogleGenAI({ apiKey: key });
};

// API Routes
app.post("/api/generate-tour", async (req, res) => {
  try {
    const { category, location, duration, latLng } = req.body;
    console.log(`Generating ${duration}min ${category} tour for ${location}`);

    const ai = getAiClient();
    const prompt = `Create a detailed walking tour itinerary for a "${category}" tour starting from "${location}". 
    The total duration should be approximately ${duration} minutes.
    
    Use real, existing places. Ensure coordinates are accurate for the specified location.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tourName: { type: Type.STRING },
            summary: { type: Type.STRING },
            totalDistance: { type: Type.STRING },
            stops: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  timeToSpend: { type: Type.STRING },
                  lat: { type: Type.NUMBER },
                  lng: { type: Type.NUMBER }
                },
                required: ["name", "description", "timeToSpend", "lat", "lng"]
              }
            },
            directions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  from: { type: Type.STRING },
                  to: { type: Type.STRING },
                  instructions: { type: Type.STRING },
                  fromLatLng: {
                    type: Type.OBJECT,
                    properties: {
                      lat: { type: Type.NUMBER },
                      lng: { type: Type.NUMBER }
                    },
                    required: ["lat", "lng"]
                  },
                  toLatLng: {
                    type: Type.OBJECT,
                    properties: {
                      lat: { type: Type.NUMBER },
                      lng: { type: Type.NUMBER }
                    },
                    required: ["lat", "lng"]
                  }
                },
                required: ["from", "to", "instructions", "fromLatLng", "toLatLng"]
              }
            }
          },
          required: ["tourName", "summary", "totalDistance", "stops", "directions"]
        }
      },
    });

    const rawText = response.text || "";
    console.log("Raw AI Response length:", rawText.length);
    
    try {
      const tour = JSON.parse(rawText);
      
      // Validation & Defaults
      if (!tour.stops) tour.stops = [];
      if (!tour.directions) tour.directions = [];

      // Enrich with Google Maps URLs if key is available
      if (MAPS_KEY && MAPS_KEY.trim() !== "") {
        tour.stops = tour.stops.map((stop: any) => ({
          ...stop,
          imageUrl: stop.lat && stop.lng ? 
            `https://maps.googleapis.com/maps/api/staticmap?center=${stop.lat},${stop.lng}&zoom=17&size=800x450&markers=color:red%7C${stop.lat},${stop.lng}&key=${MAPS_KEY}` : 
            undefined
        }));

        tour.directions = tour.directions.map((dir: any) => ({
          ...dir,
          mapUrl: dir.fromLatLng && dir.toLatLng ? 
            `https://maps.googleapis.com/maps/api/staticmap?size=800x450&path=color:0x0000ff%7Cweight:5%7C${dir.fromLatLng.lat},${dir.fromLatLng.lng}%7C${dir.toLatLng.lat},${dir.toLatLng.lng}&markers=color:blue%7Clabel:A%7C${dir.fromLatLng.lat},${dir.fromLatLng.lng}&markers=color:green%7Clabel:B%7C${dir.toLatLng.lat},${dir.toLatLng.lng}&key=${MAPS_KEY}` : 
            undefined
        }));
      }

      res.json(tour);
    } catch (parseError) {
      console.error("JSON Parse Error. Raw text:", rawText);
      throw new Error("Failed to parse AI response as JSON");
    }
  } catch (error: any) {
    console.error("Error generating tour:", error.message);
    res.status(500).json({ error: error.message || "Failed to generate tour" });
  }
});

// Vite middleware for development
if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static("dist"));
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

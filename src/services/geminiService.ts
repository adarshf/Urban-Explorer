import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface TourRequest {
  category: string;
  location: string;
  duration: number;
  latLng?: { latitude: number; longitude: number };
}

export async function generateWalkingTour(request: TourRequest) {
  const { category, location, duration, latLng } = request;

  const prompt = `Create a sequential walking tour itinerary for a "${category}" tour starting from "${location}". 
  The total duration should be approximately ${duration} minutes.
  
  For each of the 3-5 main stops in the tour, you MUST:
  1. Use the Google Maps tool to find the specific location.
  2. List the stop with its official name, a brief description, estimated time, and walking directions.
  
  CRITICAL: Only use the Google Maps tool for the main stops of the tour. Do not ground the starting location if it's a general area, and do not ground other places mentioned in the descriptions.
  
  The output should be a clear, step-by-step itinerary.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      tools: [{ googleMaps: {} }],
      toolConfig: {
        retrievalConfig: {
          latLng: latLng
        }
      }
    },
  });

  return {
    text: response.text || "Sorry, I couldn't generate a tour at this time.",
    groundingChunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
  };
}

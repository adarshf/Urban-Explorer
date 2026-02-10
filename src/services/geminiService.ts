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

  let categorySpecificInstructions = "";
  if (category === "Food tour") {
    categorySpecificInstructions = `
    Provide a food tour that includes destinations within a walkable distance from the start point. Select destinations that are unique to the area, such as food stops with historical significance, menu items that include dishes or ingredients unique to the local area or region, or are otherwise highly unique and can only be found in the local area. These destinations should be high quality with a Google maps rating of at least 4 stars. And you should be able to visit each destination and partake in the suggested dish within the requested time.

    For each destination, suggest a menu item that is a must try and describe why it is highly recommended. Be fun, interesting, and detailed in your description.`;
  }

  const prompt = `Create a sequential walking tour itinerary for a "${category}" tour starting from "${location}". 
  The total duration should be approximately ${duration} minutes.
  ${categorySpecificInstructions}
  
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

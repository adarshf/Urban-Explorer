/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  Clock, 
  Utensils, 
  Trees, 
  Landmark, 
  History, 
  Navigation, 
  Loader2, 
  ArrowLeft,
  ExternalLink,
  Compass
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { generateWalkingTour, TourRequest } from './services/geminiService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Step = 'category' | 'location' | 'duration' | 'loading' | 'result';

interface Category {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const CATEGORIES: Category[] = [
  { 
    id: 'Food tour', 
    title: 'Food Tour', 
    description: 'Unique local restaurants, snacks, and beverages.', 
    icon: <Utensils className="w-6 h-6" />,
    color: 'bg-orange-100 text-orange-700 border-orange-200'
  },
  { 
    id: 'Nature walk', 
    title: 'Nature Walk', 
    description: 'Parks, lakes, gardens, and scenic viewpoints.', 
    icon: <Trees className="w-6 h-6" />,
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200'
  },
  { 
    id: 'Points of interest', 
    title: 'Points of Interest', 
    description: 'The most popular landmarks and attractions.', 
    icon: <Landmark className="w-6 h-6" />,
    color: 'bg-blue-100 text-blue-700 border-blue-200'
  },
  { 
    id: 'Historical', 
    title: 'Historical', 
    description: 'Deep dive into the area\'s rich history.', 
    icon: <History className="w-6 h-6" />,
    color: 'bg-amber-100 text-amber-700 border-amber-200'
  },
];

const DURATIONS = [30, 60, 90, 120];

export default function App() {
  const [step, setStep] = useState<Step>('category');
  const [selection, setSelection] = useState<Partial<TourRequest>>({});
  const [itinerary, setItinerary] = useState<{ text: string; groundingChunks: any[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const handleCategorySelect = (categoryId: string) => {
    setSelection({ ...selection, category: categoryId });
    setStep('location');
  };

  const handleLocationSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const location = formData.get('location') as string;
    if (location.trim()) {
      setSelection({ ...selection, location });
      setStep('duration');
    }
  };

  const useCurrentLocation = () => {
    setIsLocating(true);
    setError(null);
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setSelection({ 
          ...selection, 
          location: 'My Current Location', 
          latLng: { latitude, longitude } 
        });
        setIsLocating(false);
        setStep('duration');
      },
      (err) => {
        setError("Unable to retrieve your location. Please enter it manually.");
        setIsLocating(false);
      }
    );
  };

  const handleDurationSelect = async (duration: number) => {
    const finalRequest = { ...selection, duration } as TourRequest;
    setSelection(finalRequest);
    setStep('loading');
    
    try {
      const result = await generateWalkingTour(finalRequest);
      setItinerary(result);
      setStep('result');
    } catch (err) {
      console.error(err);
      setError("Something went wrong while generating your tour. Please try again.");
      setStep('duration');
    }
  };

  const reset = () => {
    setStep('category');
    setSelection({});
    setItinerary(null);
    setError(null);
  };

  const getFullRouteUrl = () => {
    if (!itinerary || !itinerary.groundingChunks) return null;
    
    // Extract unique map titles in order
    const places = Array.from(new Set(
      itinerary.groundingChunks
        .filter(chunk => chunk.maps && chunk.maps.title)
        .map(chunk => chunk.maps.title)
    ));

    if (places.length < 2) {
      if (places.length === 1) {
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(places[0] as string)}`;
      }
      return null;
    }

    const origin = encodeURIComponent(places[0] as string);
    const destination = encodeURIComponent(places[places.length - 1] as string);
    const waypoints = places.length > 2 
      ? places.slice(1, -1).map(p => encodeURIComponent(p as string)).join('|')
      : '';

    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints ? `&waypoints=${waypoints}` : ''}&travelmode=walking`;
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-4 md:p-8 max-w-3xl mx-auto">
      <header className="w-full mb-12 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Compass className="w-8 h-8 text-stone-800" />
          <h1 className="text-3xl font-display font-bold tracking-tight">Urban Explorer</h1>
        </div>
        <p className="text-stone-500 italic">Your personal walking tour architect</p>
      </header>

      <main className="w-full flex-1">
        <AnimatePresence mode="wait">
          {step === 'category' && (
            <motion.div
              key="category"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <h2 className="text-2xl font-display font-bold text-center mb-8">What kind of walking tour would you like?</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => handleCategorySelect(cat.id)}
                    className={cn(
                      "flex flex-col items-start p-6 rounded-2xl border-2 transition-all text-left hover:scale-[1.02] active:scale-[0.98]",
                      cat.color,
                      "hover:shadow-lg"
                    )}
                  >
                    <div className="mb-4 p-2 bg-white/50 rounded-lg">
                      {cat.icon}
                    </div>
                    <h3 className="text-lg font-bold mb-1">{cat.title}</h3>
                    <p className="text-sm opacity-80">{cat.description}</p>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 'location' && (
            <motion.div
              key="location"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <button 
                onClick={() => setStep('category')}
                className="flex items-center gap-2 text-stone-500 hover:text-stone-800 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back to categories
              </button>
              
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-display font-bold">What is the start location?</h2>
                <p className="text-stone-500">Enter a city, landmark, or specific address.</p>
              </div>

              <form onSubmit={handleLocationSubmit} className="space-y-4">
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 w-5 h-5" />
                  <input
                    name="location"
                    autoFocus
                    placeholder="e.g. Central Park, New York"
                    className="w-full pl-12 pr-4 py-4 bg-white border-2 border-stone-200 rounded-2xl focus:border-stone-800 focus:outline-none transition-all shadow-sm"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold hover:bg-stone-800 transition-all shadow-md"
                >
                  Continue
                </button>
              </form>

              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-stone-200"></div></div>
                <div className="relative flex justify-center text-xs uppercase tracking-widest text-stone-400 bg-stone-50 px-4">Or</div>
              </div>

              <button
                onClick={useCurrentLocation}
                disabled={isLocating}
                className="w-full py-4 flex items-center justify-center gap-3 border-2 border-stone-200 rounded-2xl font-bold hover:bg-stone-100 transition-all disabled:opacity-50"
              >
                {isLocating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Navigation className="w-5 h-5" />}
                {isLocating ? 'Locating...' : 'Use my current location'}
              </button>
              
              {error && <p className="text-red-500 text-center text-sm">{error}</p>}
            </motion.div>
          )}

          {step === 'duration' && (
            <motion.div
              key="duration"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <button 
                onClick={() => setStep('location')}
                className="flex items-center gap-2 text-stone-500 hover:text-stone-800 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back to location
              </button>

              <div className="text-center space-y-2">
                <h2 className="text-2xl font-display font-bold">How much time do you have?</h2>
                <p className="text-stone-500">We'll tailor the route to fit your schedule.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => handleDurationSelect(d)}
                    className="flex flex-col items-center justify-center p-8 bg-white border-2 border-stone-200 rounded-2xl hover:border-stone-800 hover:shadow-lg transition-all group"
                  >
                    <Clock className="w-8 h-8 mb-3 text-stone-400 group-hover:text-stone-800 transition-colors" />
                    <span className="text-xl font-bold">{d} min</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20 space-y-6"
            >
              <div className="relative">
                <div className="w-20 h-20 border-4 border-stone-200 border-t-stone-800 rounded-full animate-spin"></div>
                <Compass className="absolute inset-0 m-auto w-8 h-8 text-stone-800 animate-pulse" />
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-xl font-display font-bold">Crafting your itinerary...</h2>
                <p className="text-stone-500 animate-pulse">Consulting local maps and history</p>
              </div>
            </motion.div>
          )}

          {step === 'result' && itinerary && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8 pb-12"
            >
              <div className="flex items-center justify-between">
                <button 
                  onClick={reset}
                  className="flex items-center gap-2 text-stone-500 hover:text-stone-800 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Start Over
                </button>
                <div className="flex gap-2">
                  <span className="px-3 py-1 bg-stone-100 rounded-full text-xs font-bold uppercase tracking-wider text-stone-600">
                    {selection.category}
                  </span>
                  <span className="px-3 py-1 bg-stone-100 rounded-full text-xs font-bold uppercase tracking-wider text-stone-600">
                    {selection.duration} min
                  </span>
                </div>
              </div>

              <div className="bg-white p-6 md:p-10 rounded-3xl shadow-xl border border-stone-100 relative overflow-hidden">
                <div className="markdown-body">
                  <ReactMarkdown>{itinerary.text}</ReactMarkdown>
                </div>
                
                {getFullRouteUrl() && (
                  <div className="mt-10 pt-8 border-t border-stone-100 flex justify-center">
                    <a
                      href={getFullRouteUrl()!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-8 py-4 bg-stone-900 text-white rounded-2xl font-bold hover:bg-stone-800 transition-all shadow-xl hover:scale-105 active:scale-95 group"
                    >
                      <Navigation className="w-5 h-5 group-hover:rotate-45 transition-transform" />
                      Start Tour
                      <ExternalLink className="w-4 h-4 opacity-50" />
                    </a>
                  </div>
                )}
              </div>

              {itinerary.groundingChunks.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-display font-bold flex items-center gap-2">
                    <MapPin className="w-5 h-5" /> Explore on Google Maps
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {itinerary.groundingChunks.map((chunk, idx) => (
                      chunk.maps && (
                        <a
                          key={idx}
                          href={chunk.maps.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-4 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors group"
                        >
                          <span className="font-medium text-sm truncate pr-4">{chunk.maps.title}</span>
                          <ExternalLink className="w-4 h-4 text-stone-400 group-hover:text-stone-800" />
                        </a>
                      )
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="w-full py-8 border-t border-stone-200 mt-12 text-center text-xs text-stone-400 uppercase tracking-widest">
        Powered by Gemini & Google Maps
      </footer>
    </div>
  );
}

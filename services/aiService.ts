/**
 * AI Food Analysis Service
 *
 * Uses OpenAI GPT-4o Vision API to analyze food images and classify sugar content.
 */

import * as FileSystem from 'expo-file-system/legacy';
import Constants from 'expo-constants';

// Get API key from environment variable (set via EAS secrets)
// Must use EXPO_PUBLIC_ prefix for client-side visibility in Expo
// Fallback to Constants.expoConfig.extra for EAS builds where process.env may not work
const OPENAI_API_KEY =
  process.env.EXPO_PUBLIC_OPENAI_API_KEY ||
  Constants.expoConfig?.extra?.openaiApiKey;

// Debug: Log key presence and prefix (safe - doesn't expose full key)
const getKeyDebugInfo = () => {
  if (!OPENAI_API_KEY) return 'UNDEFINED';
  if (OPENAI_API_KEY.startsWith('%')) return 'INTERPOLATION_FAILED: ' + OPENAI_API_KEY.substring(0, 20);
  return `${OPENAI_API_KEY.substring(0, 12)}...${OPENAI_API_KEY.substring(OPENAI_API_KEY.length - 4)} (len: ${OPENAI_API_KEY.length})`;
};

// Export for debugging in UI
export const API_KEY_DEBUG = getKeyDebugInfo();

export type SugarLevel = 'safe' | 'natural' | 'avoid';

export interface FoodAnalysisResult {
  name: string;
  sugarLevel: SugarLevel;
  sugarContent: string;
  verdict: string;
  confidence: number;
  source: string;
}

export interface AIAnalysisError {
  error: true;
  message: string;
}

const FOOD_ANALYSIS_PROMPT = `You are Sugar Guard, an AI assistant for a sugar addiction recovery app called Unsweet.

Analyze this food image and provide a JSON response with:
1. "name": The food item name (be specific)
2. "sugarLevel": One of "safe", "natural", or "avoid"
3. "sugarContent": Estimated sugar content (e.g., "0g", "5g per serving", "High")
4. "verdict": A brief 1-2 sentence explanation for the classification

Classification Rules:
- SAFE (green): Meat, fish, eggs, vegetables, nuts, cheese, water, unsweetened beverages
- NATURAL (yellow): Fresh fruits, dairy with natural sugars, whole grains, honey in moderation
- AVOID (red): Candy, soda, pastries, ice cream, processed snacks, sweetened beverages, desserts, anything with added sugars

If the image is NOT food or is unclear, respond with:
{"name": "Not Food", "sugarLevel": "safe", "sugarContent": "N/A", "verdict": "This doesn't appear to be food. Please take a clear photo of the food item you want to analyze."}

Respond ONLY with valid JSON, no markdown or explanation.`;

/**
 * Analyzes a food image using GPT-4o Vision API
 * @param imageUri - Local file URI of the image to analyze
 * @returns FoodAnalysisResult or AIAnalysisError
 */
// API request timeout in milliseconds (30 seconds)
const API_TIMEOUT_MS = 30000;

export async function analyzeFoodImage(
  imageUri: string
): Promise<FoodAnalysisResult | AIAnalysisError> {
  // Validate API key is available
  if (!OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is not configured');
    return {
      error: true,
      message: 'AI service is not configured. Please contact support.',
    };
  }

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    // Read image as base64
    const base64Image = await FileSystem.readAsStringAsync(imageUri, {
      encoding: 'base64',
    });

    // Determine image type from URI
    const imageType = imageUri.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';

    // Call OpenAI API with timeout
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: FOOD_ANALYSIS_PROMPT,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/${imageType};base64,${base64Image}`,
                  detail: 'low', // Use low detail to reduce costs and speed up response
                },
              },
            ],
          },
        ],
        max_tokens: 300,
        temperature: 0.3, // Lower temperature for more consistent results
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenAI API Error:', response.status, errorData);
      // Include debug info for 401 errors to help diagnose key issues
      const debugHint = response.status === 401 ? ` [Key: ${API_KEY_DEBUG}]` : '';
      return {
        error: true,
        message: `API Error: ${response.status}.${debugHint} Please try again.`,
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return {
        error: true,
        message: 'No response from AI. Please try again.',
      };
    }

    // Parse JSON response
    try {
      // Clean the response in case it has markdown code blocks
      const cleanContent = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const parsed = JSON.parse(cleanContent);

      // Validate required fields
      if (!parsed.name || !parsed.sugarLevel || !parsed.verdict) {
        throw new Error('Invalid response format');
      }

      // Normalize sugarLevel
      const normalizedLevel = parsed.sugarLevel.toLowerCase();
      if (!['safe', 'natural', 'avoid'].includes(normalizedLevel)) {
        parsed.sugarLevel = 'natural'; // Default to natural if unclear
      } else {
        parsed.sugarLevel = normalizedLevel;
      }

      return {
        name: parsed.name,
        sugarLevel: parsed.sugarLevel as SugarLevel,
        sugarContent: parsed.sugarContent || 'Unknown',
        verdict: parsed.verdict,
        confidence: 95, // AI confidence
        source: 'GPT-4o Vision',
      };
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      return {
        error: true,
        message: 'Failed to understand AI response. Please try again.',
      };
    }
  } catch (error) {
    // Handle timeout/abort errors with user-friendly message
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        error: true,
        message: 'Request timed out. Please check your connection and try again.',
      };
    }
    console.error('Food analysis error:', error);
    return {
      error: true,
      message: error instanceof Error ? error.message : 'Analysis failed. Please try again.',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Analyzes a food image captured from camera
 * Takes the photo, saves it temporarily, and analyzes it
 */
export async function analyzeFromCamera(
  cameraRef: any
): Promise<FoodAnalysisResult | AIAnalysisError> {
  try {
    if (!cameraRef?.current) {
      return { error: true, message: 'Camera not ready' };
    }

    const photo = await cameraRef.current.takePictureAsync({
      quality: 0.7,
      base64: false,
    });

    if (!photo?.uri) {
      return { error: true, message: 'Failed to capture photo' };
    }

    return analyzeFoodImage(photo.uri);
  } catch (error) {
    console.error('Camera capture error:', error);
    return {
      error: true,
      message: 'Failed to capture photo. Please try again.',
    };
  }
}

// ============================================================================
// NUTRITION LABEL ANALYSIS
// ============================================================================

const LABEL_ANALYSIS_PROMPT = `You are an expert Nutrition Label Analyzer for a sugar addiction recovery app called Unsweet.

Analyze this image of a Nutrition Facts table or Ingredients list.
Extract the sugar data and determine the health verdict.

**Classification Rules:**
1. If "Added Sugars" is found and > 0g → Verdict: AVOID (red)
2. If "Total Sugars" > 5g per 100g (and not from natural fruit/dairy) → Verdict: AVOID (red)
3. If sugar is 1-5g per 100g or from natural sources only → Verdict: NATURAL (yellow)
4. If sugar is 0g or <1g per 100g → Verdict: SAFE (green)
5. Look for hidden sugar names in ingredients: high fructose corn syrup, sucrose, dextrose, maltose, cane sugar, etc.

**Response Format (strict JSON only):**
{
  "name": "Product name if visible, otherwise 'Scanned Product'",
  "sugarPer100g": <number>,
  "sugarLevel": "safe" | "natural" | "avoid",
  "sugarContent": "Xg per serving" or "Xg per 100g",
  "verdict": "Brief explanation (e.g., 'Contains 12g added sugar per serving', 'Safe - no sugar detected')"
}

If the image is NOT a nutrition label or is unclear, respond with:
{"name": "Not a Label", "sugarPer100g": 0, "sugarLevel": "natural", "sugarContent": "N/A", "verdict": "This doesn't appear to be a nutrition label. Please take a clear photo of the Nutrition Facts or ingredients list."}

Respond ONLY with valid JSON, no markdown or explanation.`;

export interface LabelAnalysisResult {
  name: string;
  sugarLevel: SugarLevel;
  sugarContent: string;
  sugarPer100g: number;
  verdict: string;
  confidence: number;
  source: string;
}

/**
 * Analyzes a nutrition label image using GPT-4o Vision API
 * @param imageUri - Local file URI of the label image to analyze
 * @returns LabelAnalysisResult or AIAnalysisError
 */
export async function analyzeLabelImage(
  imageUri: string
): Promise<LabelAnalysisResult | AIAnalysisError> {
  // Validate API key is available
  if (!OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is not configured');
    return {
      error: true,
      message: 'AI service is not configured. Please contact support.',
    };
  }

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    // Read image as base64
    const base64Image = await FileSystem.readAsStringAsync(imageUri, {
      encoding: 'base64',
    });

    // Determine image type from URI
    const imageType = imageUri.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';

    // Call OpenAI API with higher detail for reading text
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: LABEL_ANALYSIS_PROMPT,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/${imageType};base64,${base64Image}`,
                  detail: 'high', // Use high detail for reading nutrition labels
                },
              },
            ],
          },
        ],
        max_tokens: 400,
        temperature: 0.2, // Lower temperature for more accurate label reading
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenAI API Error (Label):', response.status, errorData);
      return {
        error: true,
        message: `API Error: ${response.status}. Please try again.`,
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return {
        error: true,
        message: 'No response from AI. Please try again.',
      };
    }

    // Parse JSON response
    try {
      // Clean the response in case it has markdown code blocks
      const cleanContent = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const parsed = JSON.parse(cleanContent);

      // Validate required fields
      if (!parsed.name || !parsed.sugarLevel || !parsed.verdict) {
        throw new Error('Invalid response format');
      }

      // Normalize sugarLevel
      const normalizedLevel = parsed.sugarLevel.toLowerCase();
      if (!['safe', 'natural', 'avoid'].includes(normalizedLevel)) {
        parsed.sugarLevel = 'natural'; // Default to natural if unclear
      } else {
        parsed.sugarLevel = normalizedLevel;
      }

      return {
        name: parsed.name || 'Scanned Product',
        sugarLevel: parsed.sugarLevel as SugarLevel,
        sugarContent: parsed.sugarContent || 'Unknown',
        sugarPer100g: typeof parsed.sugarPer100g === 'number' ? parsed.sugarPer100g : 0,
        verdict: parsed.verdict,
        confidence: 90, // Label reading confidence
        source: 'GPT-4o Vision (Label OCR)',
      };
    } catch (parseError) {
      console.error('Failed to parse AI response (Label):', content);
      return {
        error: true,
        message: 'Failed to read the nutrition label. Please try again with a clearer photo.',
      };
    }
  } catch (error) {
    // Handle timeout/abort errors with user-friendly message
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        error: true,
        message: 'Request timed out. Please check your connection and try again.',
      };
    }
    console.error('Label analysis error:', error);
    return {
      error: true,
      message: error instanceof Error ? error.message : 'Label analysis failed. Please try again.',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

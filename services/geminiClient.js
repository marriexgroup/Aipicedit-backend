const { GoogleGenAI } = require("@google/genai");
const Configs = require("../models/configs.model");

/**
 * Dynamically resolves and selects the active Gemini API key set by the admin.
 * Falls back to environment variables and alternative keys if selection is empty.
 * 
 * @returns {Promise<string>} The selected Gemini API key.
 */
async function getGeminiApiKey() {
  let key1 = process.env.GEMINI_API_KEY || '';
  let key2 = process.env.GEMINI_API_KEY_2 || '';
  let activeKeySelection = 'key1';

  try {
    const config = await Configs.findOne({});
    if (config && config.activeGeminiKey) {
      activeKeySelection = config.activeGeminiKey;
    }
  } catch (err) {
    console.error("Error fetching Gemini config setting from DB:", err);
  }

  key1 = key1.trim();
  key2 = key2.trim();

  let selectedKey = '';
  if (activeKeySelection === 'key2') {
    selectedKey = key2 || key1; // Fallback to key1
  } else {
    selectedKey = key1 || key2; // Fallback to key2
  }

  if (!selectedKey) {
    throw new Error("No GEMINI_API_KEY or GEMINI_API_KEY_2 set in environment variables");
  }

  return selectedKey;
}

/**
 * Dynamically constructs and returns a new GoogleGenAI client with the resolved API key.
 * 
 * @returns {Promise<GoogleGenAI>}
 */
async function getGeminiClient() {
  const apiKey = await getGeminiApiKey();
  return new GoogleGenAI({ apiKey });
}

module.exports = {
  getGeminiApiKey,
  getGeminiClient
};

const retryHelper = require('./retryHelper');
const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function generatePrompts(basePrompt, numberOfFacts, highlightCount) {

  const response = await retryHelper(async () => {
    const modifiedPrompt = createPrompt(basePrompt, numberOfFacts);
    const textResponse = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: modifiedPrompt,
    });
    return textResponse;
  });
  if (!response.candidates?.[0]?.content) {
    throw new Error("No content returned from Gemini");
  }
  console.log('GoogleGenAI generation success ✅');
  const contentArr = parseFacts(response.text, highlightCount);

  console.log(`content Array created with ${contentArr.length} items! ✅`);
  return contentArr;
}

function createPrompt(prompt, numberOfFacts) {
  return `Generate ${numberOfFacts} factual items about ${prompt}. For each fact, provide:\n1. **Fact:** [Clear statement (15-20 words)]\n2. **Description:** [100-word engaging description]\n3. **Highlights:** [3-5 key words from the fact]\nRequirements: \n- Fact must be 15-20 words\n- Description should be ~100 words\n- Maintain this exact format\n- Highlight key words\nExample:\n1. Fact: The Earth's atmosphere is 78% nitrogen...\nDescription: Nitrogen is crucial for plant growth but inert for humans...\nHighlights: [Nitrogen, plants, humans]`;
}

function parseFacts(text, highlightCount) {
  const entries = text.split(/\n(?=\d+\.\s+\*\*Fact:\*\*)/);
  return entries.map(entry => {
    const factMatch = entry.match(/\*\*Fact:\*\*(.*?)\*\*Description:\*\*/s);
    const descriptionMatch = entry.match(/\*\*Description:\*\*(.*?)\*\*Highlights:\*\*/s);
    const highlightsMatch = entry.match(/\*\*Highlights:\*\*\s*\[(.*?)\]/s);

    const fact = factMatch?.[1]?.trim()?.replace(/\*/g, '') || '';
    const description = descriptionMatch?.[1]?.trim()?.replace(/\*/g, '') || '';
    const highlights = highlightsMatch?.[1]?.trim()?.split(/,\s*/)?.map(h => h.replace(/\*/g, '')) || [];

    return {
      fact,
      description,
      highlights: highlights.length ? highlights : getRandomWords(fact, highlightCount)
    };
  }).filter(obj => obj.fact.trim());
}

function getRandomWords(text, count) {
  const words = text.replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length >= 4);
  const unique = [...new Set(words)];
  if (unique.length <= count) return unique;
  const selected = new Set();
  while (selected.size < count) {
    selected.add(unique[Math.floor(Math.random() * unique.length)]);
  }
  return [...selected];
}

module.exports = { generatePrompts };

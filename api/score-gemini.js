const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const { getSheet } = require('./_lib/sheets');

// Load prompt template at cold start
const geminiPromptTemplate = fs.readFileSync(
  path.join(process.cwd(), 'gemini_prompt.md'),
  'utf-8'
);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { answerSheetData, transcript, candidateName, position, assessorName } = req.body;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Gemini API key not configured. Set GEMINI_API_KEY in environment variables.' });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const answerSheetFormatted = JSON.stringify(answerSheetData, null, 2);
    let prompt = geminiPromptTemplate
      .replace('[PASTE ANSWER SHEET DATA HERE]', answerSheetFormatted)
      .replace('[PASTE ZOOM TRANSCRIPT HERE]', transcript || 'No transcript provided. Score based on answer sheet data only.');

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    let jsonResult = null;
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try { jsonResult = JSON.parse(jsonMatch[1]); } catch (e) {}
    }
    if (!jsonResult) {
      try { jsonResult = JSON.parse(text); } catch (e) {}
    }

    // Update Gemini score in Google Sheets
    if (jsonResult?.final_score) {
      try {
        const doc = await getSheet();
        if (doc) {
          const sheet = doc.sheetsByTitle['Candidates'];
          const rows = await sheet.getRows();
          const email = answerSheetData?.candidateEmail;
          const row = rows.find(r => r.get('Email') === email);
          if (row) {
            row.set('Gemini Score', jsonResult.final_score);
            row.set('Status', 'Complete');
            await row.save();
          }
        }
      } catch (e) {
        console.error('Failed to update Sheets:', e.message);
      }
    }

    res.json({ success: true, geminiReport: jsonResult, rawResponse: text });
  } catch (error) {
    console.error('Gemini API error:', error);
    res.status(500).json({ error: 'Gemini API call failed', details: error.message });
  }
};

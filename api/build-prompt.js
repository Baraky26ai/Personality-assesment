const fs = require('fs');
const path = require('path');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { answerSheetData, transcript } = req.body;
  const templatePath = path.join(process.cwd(), 'gemini_prompt.md');
  const template = fs.readFileSync(templatePath, 'utf-8');

  const answerSheetFormatted = JSON.stringify(answerSheetData, null, 2);
  const prompt = template
    .replace('[PASTE ANSWER SHEET DATA HERE]', answerSheetFormatted)
    .replace('[PASTE ZOOM TRANSCRIPT HERE]', transcript || 'No transcript provided.');

  res.json({ success: true, prompt });
};

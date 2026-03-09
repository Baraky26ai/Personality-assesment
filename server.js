require('dotenv').config();
const express = require('express');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 4567;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Load the Gemini prompt template
const geminiPromptTemplate = fs.readFileSync(
  path.join(__dirname, 'gemini_prompt.md'),
  'utf-8'
);

// ============================================================
// GOOGLE SHEETS SETUP
// ============================================================

let sheetsDoc = null;

async function initGoogleSheets() {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;

  if (!sheetId || !email || !key) {
    console.log('⚠  Google Sheets not configured. Set GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, and GOOGLE_PRIVATE_KEY in .env');
    return;
  }

  try {
    const serviceAccountAuth = new JWT({
      email,
      key: key.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    sheetsDoc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);
    await sheetsDoc.loadInfo();
    console.log(`✓  Connected to Google Sheet: "${sheetsDoc.title}"`);

    // Ensure the "Candidates" sheet exists with headers
    let sheet = sheetsDoc.sheetsByTitle['Candidates'];
    if (!sheet) {
      sheet = await sheetsDoc.addSheet({
        title: 'Candidates',
        headerValues: [
          'Date', 'Candidate Name', 'Email', 'Position',
          'Assessor', 'Final Score', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6',
          'Gemini Score', 'Status'
        ],
      });
      console.log('✓  Created "Candidates" sheet with headers');
    }
  } catch (err) {
    console.error('✗  Google Sheets connection failed:', err.message);
    sheetsDoc = null;
  }
}

// ============================================================
// SCORING KEYS (algorithmic — no LLM needed for FC & SJT)
// ============================================================

const FC_KEY = {
  1: { target: 'A', facet: 'C1' }, 2: { target: 'B', facet: 'C1' },
  3: { target: 'A', facet: 'C2' }, 4: { target: 'C', facet: 'C2' },
  5: { target: 'A', facet: 'C3' }, 6: { target: 'B', facet: 'C3' },
  7: { target: 'B', facet: 'C4' }, 8: { target: 'C', facet: 'C4' },
  9: { target: 'A', facet: 'C5' }, 10: { target: 'B', facet: 'C5' },
  11: { target: 'B', facet: 'C6' }, 12: { target: 'A', facet: 'C6' },
};

const FC_NORMALIZE = { 0: 0, 1: 25, 2: 50, 3: 75, 4: 100 };

const SJT_KEY = {
  1: { A: 0, B: 3, C: 2, D: 1 },
  2: { A: 0, B: 1, C: 3, D: 1 },
  3: { A: 1, B: 2, C: 3, D: 1 },
  4: { A: 1, B: 3, C: 0, D: 2 },
  5: { A: 0, B: 3, C: 2, D: 1 },
  6: { A: 0, B: 3, C: 2, D: 1 },
  7: { A: 2, B: 3, C: 0, D: 1 },
  8: { A: 0, B: 3, C: 1, D: 2 },
};

const BARS_CONVERT = { 1: 10, 2: 30, 3: 50, 4: 75, 5: 95 };

const PROCESS_POINTS = {
  P1: { yes: 2, no: -3, na: 0 },
  P2: { yes: 1, no: -1, na: 0 },
  P3: { yes: 2, no: 0, na: 0 },
  P4: { yes: 2, no: -2, na: 0 },
  P5: { yes: 1, no: -1, na: 0 },
  P6: { yes: 2, no: -1, na: 0 },
  P7: { yes: 1, no: -1, na: 0 },
  P8: { yes: 1, no: -2, na: 0 },
};

// ============================================================
// SCORING FUNCTIONS
// ============================================================

function scoreFC(fcData) {
  const facetRaw = { C1: 0, C2: 0, C3: 0, C4: 0, C5: 0, C6: 0 };
  for (let block = 1; block <= 12; block++) {
    const { target, facet } = FC_KEY[block];
    const rank = fcData[block]?.[target];
    if (rank) {
      facetRaw[facet] += ({ 1: 2, 2: 1, 3: 0 })[rank] || 0;
    }
  }
  const facetScores = {};
  for (const [facet, raw] of Object.entries(facetRaw)) {
    facetScores[facet] = FC_NORMALIZE[raw] ?? 50;
  }
  return { facetScores, facetRaw };
}

function scoreSJT(sjtData) {
  const scenarioPoints = {};
  for (let s = 1; s <= 8; s++) {
    const choice = sjtData[s];
    scenarioPoints[s] = SJT_KEY[s]?.[choice] ?? 0;
  }

  const facetScores = {
    C1: Math.round(((scenarioPoints[6] || 0) / 3) * 10000) / 100,
    C2: Math.round(((scenarioPoints[1] || 0) / 3) * 10000) / 100,
    C3: Math.round((((scenarioPoints[2] || 0) + (scenarioPoints[7] || 0)) / 6) * 10000) / 100,
    C4: Math.round((((scenarioPoints[3] || 0) + (scenarioPoints[8] || 0)) / 6) * 10000) / 100,
    C5: Math.round((((scenarioPoints[4] || 0) + (scenarioPoints[7] || 0)) / 6) * 10000) / 100,
    C6: Math.round((((scenarioPoints[5] || 0) + (scenarioPoints[8] || 0)) / 6) * 10000) / 100,
  };

  return { facetScores, scenarioPoints };
}

function scoreProcess(processData) {
  let raw = 0;
  for (const [item, response] of Object.entries(processData)) {
    const pts = PROCESS_POINTS[item];
    if (pts) raw += pts[response] ?? 0;
  }
  const bonus = Math.round(((raw + 11) / 23 * 20 - 10) * 100) / 100;
  return { bonus, raw };
}

function blendScores(fc, sjt, interview) {
  const blended = {};
  for (const facet of ['C1', 'C2', 'C3', 'C4', 'C5', 'C6']) {
    blended[facet] = Math.round(
      (fc[facet] * 0.25 + sjt[facet] * 0.35 + interview[facet] * 0.40) * 100
    ) / 100;
  }
  return blended;
}

// ============================================================
// API ROUTES
// ============================================================

// Score locally (FC + SJT + Process — algorithmic)
app.post('/api/score-local', (req, res) => {
  const { fc, sjt, interview, process } = req.body;

  const fcResult = scoreFC(fc);
  const sjtResult = scoreSJT(sjt);
  const intScores = {};
  for (const [facet, bars] of Object.entries(interview)) {
    intScores[facet] = BARS_CONVERT[bars] ?? 50;
  }
  const processResult = scoreProcess(process);
  const blended = blendScores(fcResult.facetScores, sjtResult.facetScores, intScores);

  const rawComposite = Math.round(
    Object.values(blended).reduce((a, b) => a + b, 0) / 6 * 100
  ) / 100;
  const finalScore = Math.max(0, Math.min(100, Math.round(rawComposite + processResult.bonus)));

  // Consistency alerts
  const alerts = [];
  for (const facet of ['C1', 'C2', 'C3', 'C4', 'C5', 'C6']) {
    const scores = [fcResult.facetScores[facet], sjtResult.facetScores[facet], intScores[facet]];
    const spread = Math.max(...scores) - Math.min(...scores);
    if (spread > 30) {
      alerts.push({ facet, fc: fcResult.facetScores[facet], sjt: sjtResult.facetScores[facet], interview: intScores[facet], spread });
    }
  }

  res.json({
    fc: fcResult,
    sjt: sjtResult,
    interview: intScores,
    process: processResult,
    blended,
    rawComposite,
    finalScore,
    alerts,
  });
});

// Score with Gemini (full analysis including transcript)
app.post('/api/score-gemini', async (req, res) => {
  const { answerSheetData, transcript, candidateName, position, assessorName } = req.body;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Gemini API key not configured on server. Set GEMINI_API_KEY in .env file.' });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const answerSheetFormatted = JSON.stringify(answerSheetData, null, 2);

    let prompt = geminiPromptTemplate
      .replace('[PASTE ANSWER SHEET DATA HERE]', answerSheetFormatted)
      .replace('[PASTE ZOOM TRANSCRIPT HERE]', transcript || 'No transcript provided. Score based on answer sheet data only.');

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Try to extract JSON from the response
    let jsonResult = null;
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        jsonResult = JSON.parse(jsonMatch[1]);
      } catch (e) {
        // JSON parsing failed, return raw text
      }
    }

    if (!jsonResult) {
      try {
        jsonResult = JSON.parse(text);
      } catch (e) {
        // Not pure JSON
      }
    }

    // Update Google Sheets with Gemini score if available
    if (jsonResult?.final_score && sheetsDoc) {
      try {
        const sheet = sheetsDoc.sheetsByTitle['Candidates'];
        const rows = await sheet.getRows();
        const email = answerSheetData?.candidateEmail;
        const row = rows.find(r => r.get('Email') === email);
        if (row) {
          row.set('Gemini Score', jsonResult.final_score);
          row.set('Status', 'Complete');
          await row.save();
        }
      } catch (e) {
        console.error('Failed to update Gemini score in Sheets:', e.message);
      }
    }

    res.json({
      success: true,
      geminiReport: jsonResult,
      rawResponse: text,
    });
  } catch (error) {
    console.error('Gemini API error:', error);
    res.status(500).json({
      error: 'Gemini API call failed',
      details: error.message,
    });
  }
});

// ============================================================
// GOOGLE SHEETS ROUTES
// ============================================================

// Save a candidate assessment result
app.post('/api/save-candidate', async (req, res) => {
  if (!sheetsDoc) {
    return res.json({ success: false, error: 'Google Sheets not configured' });
  }

  try {
    const { candidateName, candidateEmail, position, assessorName, finalScore, facetScores, date } = req.body;
    const sheet = sheetsDoc.sheetsByTitle['Candidates'];

    await sheet.addRow({
      'Date': new Date(date).toLocaleDateString('he-IL'),
      'Candidate Name': candidateName,
      'Email': candidateEmail,
      'Position': position,
      'Assessor': assessorName,
      'Final Score': finalScore,
      'C1': facetScores?.C1 ?? '',
      'C2': facetScores?.C2 ?? '',
      'C3': facetScores?.C3 ?? '',
      'C4': facetScores?.C4 ?? '',
      'C5': facetScores?.C5 ?? '',
      'C6': facetScores?.C6 ?? '',
      'Gemini Score': '',
      'Status': 'Pending Gemini',
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Failed to save to Sheets:', err.message);
    res.json({ success: false, error: err.message });
  }
});

// Get all candidates from Google Sheets
app.get('/api/candidates', async (req, res) => {
  if (!sheetsDoc) {
    return res.json({ success: false, error: 'Google Sheets not configured', candidates: [] });
  }

  try {
    const sheet = sheetsDoc.sheetsByTitle['Candidates'];
    const rows = await sheet.getRows();

    const candidates = rows.map(row => ({
      date: row.get('Date'),
      name: row.get('Candidate Name'),
      email: row.get('Email'),
      position: row.get('Position'),
      assessor: row.get('Assessor'),
      finalScore: row.get('Final Score'),
      geminiScore: row.get('Gemini Score'),
      status: row.get('Status'),
    }));

    res.json({ success: true, candidates });
  } catch (err) {
    console.error('Failed to read Sheets:', err.message);
    res.json({ success: false, error: err.message, candidates: [] });
  }
});

// ============================================================
// START SERVER
// ============================================================

async function start() {
  await initGoogleSheets();

  app.listen(PORT, () => {
    console.log(`\n╔════════════════════════════════════════════════════╗`);
    console.log(`║   Personality Assessment Server                    ║`);
    console.log(`║   Running at: http://localhost:${PORT}               ║`);
    console.log(`║   Dashboard:  http://localhost:${PORT}/dashboard.html ║`);
    console.log(`╚════════════════════════════════════════════════════╝\n`);
  });
}

start();

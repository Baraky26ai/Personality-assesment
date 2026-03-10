const { getSheet } = require('./_lib/sheets');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const doc = await getSheet();
    if (!doc) return res.json({ success: false, error: 'Google Sheets not configured', candidates: [] });

    const sheet = doc.sheetsByTitle['Candidates'];
    const rows = await sheet.getRows();

    const candidates = rows.map(row => {
      let answerData = null;
      try { answerData = JSON.parse(row.get('AnswerData') || 'null'); } catch (e) {}
      return {
        date: row.get('Date'),
        name: row.get('Candidate Name'),
        email: row.get('Email'),
        position: row.get('Position'),
        assessor: row.get('Assessor'),
        finalScore: row.get('Final Score'),
        geminiScore: row.get('Gemini Score'),
        status: row.get('Status'),
        type: row.get('Type') || 'Full',
        answerData,
      };
    });

    res.json({ success: true, candidates });
  } catch (err) {
    console.error('Failed to read:', err.message);
    res.json({ success: false, error: err.message, candidates: [] });
  }
};

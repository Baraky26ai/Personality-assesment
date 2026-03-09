const { getSheet } = require('./_lib/sheets');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const doc = await getSheet();
    if (!doc) return res.json({ success: false, error: 'Google Sheets not configured' });

    const { candidateName, candidateEmail, position, assessorName, finalScore, facetScores, date } = req.body;
    const sheet = doc.sheetsByTitle['Candidates'];

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
    console.error('Failed to save:', err.message);
    res.json({ success: false, error: err.message });
  }
};

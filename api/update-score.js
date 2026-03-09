const { getSheet } = require('./_lib/sheets');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, score } = req.body;
  if (!email || score == null) return res.json({ success: false, error: 'Missing email or score' });

  try {
    const doc = await getSheet();
    if (!doc) return res.json({ success: false, error: 'Google Sheets not configured' });

    const sheet = doc.sheetsByTitle['Candidates'];
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('Email') === email);
    if (!row) return res.json({ success: false, error: 'Candidate not found' });

    row.set('Gemini Score', score);
    row.set('Status', 'Complete');
    await row.save();
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
};

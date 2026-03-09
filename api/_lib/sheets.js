// Shared Google Sheets helper
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

let sheetsDoc = null;

async function getSheet() {
  if (sheetsDoc) return sheetsDoc;

  const sheetId = process.env.GOOGLE_SHEET_ID;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;

  if (!sheetId || !email || !key) return null;

  const auth = new JWT({
    email,
    key: key.includes('\\n') ? key.replace(/\\n/g, '\n') : key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  sheetsDoc = new GoogleSpreadsheet(sheetId, auth);
  await sheetsDoc.loadInfo();

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
  }

  return sheetsDoc;
}

module.exports = { getSheet };

module.exports = async function handler(req, res) {
  const env = {
    hasSheetId: !!process.env.GOOGLE_SHEET_ID,
    hasEmail: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    hasKey: !!process.env.GOOGLE_PRIVATE_KEY,
    keyStart: (process.env.GOOGLE_PRIVATE_KEY || '').substring(0, 30),
    keyHasRealNewlines: (process.env.GOOGLE_PRIVATE_KEY || '').includes('\n'),
    keyHasEscapedNewlines: (process.env.GOOGLE_PRIVATE_KEY || '').includes('\\n'),
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    sheetId: process.env.GOOGLE_SHEET_ID,
  };

  try {
    const { getSheet } = require('./_lib/sheets');
    const doc = await getSheet();
    env.sheetsConnected = !!doc;
    env.sheetTitle = doc ? doc.title : null;
  } catch (e) {
    env.sheetsError = e.message;
  }

  res.json(env);
};

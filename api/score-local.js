const { scoreFC, scoreSJT, scoreProcess, blendScores, BARS_CONVERT } = require('./_lib/scoring');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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

  const alerts = [];
  for (const facet of ['C1', 'C2', 'C3', 'C4', 'C5', 'C6']) {
    const scores = [fcResult.facetScores[facet], sjtResult.facetScores[facet], intScores[facet]];
    const spread = Math.max(...scores) - Math.min(...scores);
    if (spread > 30) {
      alerts.push({ facet, fc: fcResult.facetScores[facet], sjt: sjtResult.facetScores[facet], interview: intScores[facet], spread });
    }
  }

  res.json({ fc: fcResult, sjt: sjtResult, interview: intScores, process: processResult, blended, rawComposite, finalScore, alerts });
};

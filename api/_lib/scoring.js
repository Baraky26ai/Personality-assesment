// Shared scoring logic used by all API functions

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

module.exports = {
  FC_KEY, FC_NORMALIZE, SJT_KEY, BARS_CONVERT, PROCESS_POINTS,
  scoreFC, scoreSJT, scoreProcess, blendScores,
};

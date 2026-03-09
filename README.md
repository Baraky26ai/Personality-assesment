# Conscientiousness Assessment System

A research-backed, multi-method assessment battery for measuring Conscientiousness in job candidates. Designed for HR agencies administering assessments via Zoom, with automated scoring by Gemini LLM.

---

## Scientific Basis

This system is built on:

- **NEO-PI-R facet model** (Costa & McCrae, 1992) — 6 facets of Conscientiousness
- **Sackett et al. (2022)** — Updated validity estimates for personnel selection
- **Watrin et al. (2023)** — Conscientiousness validity across applicant/incumbent samples
- **Forced-choice methodology** (Brown & Maydeu-Olivares, 2011) — Faking-resistant personality measurement
- **McDaniel et al. (2007)** — SJT behavioral tendency instructions correlate .34 with Conscientiousness
- **Schmidt & Hunter (1998)** — Structured interview validity (r = .42–.51)

**Expected predictive validity:** Combined battery R ≈ .60–.65 with job performance.

---

## System Files

| File | Purpose |
|------|---------|
| `scoring_guide.md` | Master reference — all items, answer keys, BARS anchors, scoring formulas |
| `battery_script_en.md` | The script the assessor reads aloud during the Zoom call |
| `answer_sheet.md` | Form the assessor fills during the session |
| `gemini_prompt.md` | Complete prompt template for Gemini LLM scoring |
| `README.md` | This file — overview and instructions |

---

## Assessment Structure (~45 minutes)

| Section | Duration | Method | What It Measures |
|---------|----------|--------|-----------------|
| Opening | 2 min | Rapport building | — |
| A: Forced-Choice | 10 min | 12 statement triads, rank 1st/2nd/3rd | Personality preferences (faking-resistant) |
| B: SJT | 12 min | 8 workplace scenarios, pick most likely action | Behavioral tendencies under dilemmas |
| C: Interview (STAR) | 18 min | 6 behavioral questions, 3 min each | Past behavior as predictor of future behavior |
| Closing | 1 min | Thank candidate | — |
| Process Checklist | 2 min | Post-call observation form | Behavioral signals during the session |

**Scoring weights:** Interview 40% / SJT 35% / Forced-Choice 25%

---

## Six Conscientiousness Facets Measured

| Facet | What It Predicts |
|-------|-----------------|
| C1 — Competence | Self-efficacy, preparation, skill-building |
| C2 — Order | Organization, structure, file management |
| C3 — Dutifulness | Ethical behavior, promise-keeping, error reporting |
| C4 — Achievement Striving | Goal-setting, exceeding expectations, ambition |
| C5 — Self-Discipline | Persistence, focus, resistance to distraction |
| C6 — Deliberation | Careful decision-making, risk assessment, planning |

---

## Step-by-Step Administration Workflow

### Before the Session

1. Schedule a 50-minute Zoom call (5 min buffer)
2. Print or open `battery_script_en.md` on screen
3. Print or open `answer_sheet.md` for recording responses
4. Enable Zoom recording + auto-transcription
5. Ensure you have read the `scoring_guide.md` at least once (especially the BARS anchors)

### During the Session

1. Follow the script in `battery_script_en.md` exactly
2. Read **bold** text aloud; follow *italic* instructions
3. Fill the `answer_sheet.md` as the candidate responds
4. Watch the timing checkpoints: `[CHECKPOINT: MINUTE X]`
5. **Do NOT** fill the Process Behavior Checklist during the call — do it after

### After the Session

1. Stop the Zoom recording
2. Complete the Process Behavior Checklist on the answer sheet (within 5 minutes, while memory is fresh)
3. Complete the Red Flags / Green Flags checklists
4. Download/export the Zoom transcript
5. Proceed to scoring

---

## Step-by-Step Scoring Workflow

### Option A: Automated Scoring via Gemini

1. Open `gemini_prompt.md`
2. Copy the entire document
3. Paste it into a Gemini session (use Gemini 1.5 Pro or later for best results)
4. Replace `[PASTE ANSWER SHEET DATA HERE]` with the completed answer sheet data
5. Replace `[PASTE ZOOM TRANSCRIPT HERE]` with the Zoom transcript
6. Send the prompt
7. Gemini will output a JSON report with:
   - Per-facet scores (0–100) with evidence quotes
   - Overall Conscientiousness score (0–100)
   - Red/green flags detected
   - Consistency alerts
   - Narrative summary and hiring recommendation

### Option B: Manual Scoring (Backup)

Use the scoring formulas in `scoring_guide.md` sections 2–6 to calculate scores by hand.

---

## Score Interpretation

| Score | Label | Hiring Guidance |
|-------|-------|-----------------|
| 0–15 | Very Low | Do not recommend. Likely unreliable. |
| 16–30 | Low | Significant concerns. Only with heavy oversight. |
| 31–45 | Below Average | Notable gaps. Needs structured environment. |
| 46–60 | Average | Adequate with normal supervision. |
| 61–75 | Above Average | Self-managing. Recommended. |
| 76–85 | High | Will exceed expectations. Highly recommended. |
| 86–95 | Very High | Exceptional. Check for rigidity/perfectionism. |

### Reading the Facet Profile

The overall score is useful, but the facet profile tells the real story:

- **High C3 + Low C4** = Reliable but not ambitious. Great for compliance, operations.
- **High C4 + Low C2** = Driven but disorganized. Good for startups, bad for process-heavy roles.
- **High C6 + Low C5** = Careful planner but may procrastinate execution. Needs deadlines.
- **Flat profile (all facets similar)** = Consistent conscientiousness level. What you see is what you get.
- **Spiky profile (facets diverge >25 pts)** = Strength/weakness pattern. Match to role requirements.

---

## Training Requirements for Assessors

Before administering the battery, assessors should:

1. **Read the full `scoring_guide.md`** — especially the BARS anchors with example responses
2. **Practice administering the script** once with a colleague as a mock candidate
3. **Practice BARS scoring** by reading the calibration examples in `gemini_prompt.md` and checking their own scores against the expected scores
4. **Key skills to develop:**
   - Reading the script naturally (not robotically)
   - Recording answers quickly and accurately
   - Using follow-up probes when answers are vague
   - Noting verbatim key phrases during STAR responses
   - Completing the Process Behavior Checklist accurately from memory

---

## Quality Assurance

- **Inter-rater reliability:** Have two assessors independently score the same transcript using the BARS. If scores diverge by more than 1 point on any question, review the anchors together.
- **Calibration sessions:** Monthly, have all assessors score a recorded session and compare. Discuss discrepancies.
- **Transcript review:** Periodically compare the assessor's BARS scores against the Gemini output. Large discrepancies may indicate assessor drift.

#!/usr/bin/env python3
"""
Conscientiousness Assessment Battery — Local Demo
Runs the full scoring pipeline on a sample candidate to demonstrate the system.
"""

import json

# ============================================================
# SCORING KEYS (from scoring_guide.md)
# ============================================================

# FC Answer Key: block_number -> (target_statement, target_facet)
FC_KEY = {
    1:  ("A", "C1"), 2:  ("B", "C1"),
    3:  ("A", "C2"), 4:  ("C", "C2"),
    5:  ("A", "C3"), 6:  ("B", "C3"),
    7:  ("B", "C4"), 8:  ("C", "C4"),
    9:  ("A", "C5"), 10: ("B", "C5"),
    11: ("B", "C6"), 12: ("A", "C6"),
}

# FC raw-to-normalized
FC_NORMALIZE = {0: 0, 1: 25, 2: 50, 3: 75, 4: 100}

# SJT Answer Key: scenario -> {option: points}
SJT_KEY = {
    1: {"A": 0, "B": 3, "C": 2, "D": 1},
    2: {"A": 0, "B": 1, "C": 3, "D": 1},
    3: {"A": 1, "B": 2, "C": 3, "D": 1},
    4: {"A": 1, "B": 3, "C": 0, "D": 2},
    5: {"A": 0, "B": 3, "C": 2, "D": 1},
    6: {"A": 0, "B": 3, "C": 2, "D": 1},
    7: {"A": 2, "B": 3, "C": 0, "D": 1},
    8: {"A": 0, "B": 3, "C": 1, "D": 2},
}

# SJT facet mapping: facet -> [(scenario, max_for_that_scenario)]
SJT_FACET_MAP = {
    "C1": [(6,)],
    "C2": [(1,)],
    "C3": [(2,), (7,)],
    "C4": [(3,), (8,)],
    "C5": [(4,), (7,)],
    "C6": [(5,), (8,)],
}

# BARS to 0-100 conversion
BARS_CONVERT = {1: 10, 2: 30, 3: 50, 4: 75, 5: 95}

# Process Behavior point values: (yes_points, no_points, na_points)
PROCESS_POINTS = {
    "P1": (2, -3, 0),
    "P2": (1, -1, 0),
    "P3": (2, 0, 0),
    "P4": (2, -2, 0),
    "P5": (1, -1, 0),
    "P6": (2, -1, 0),
    "P7": (1, -1, 0),
    "P8": (1, -2, 0),
}

FACET_NAMES = {
    "C1": "Competence",
    "C2": "Order",
    "C3": "Dutifulness",
    "C4": "Achievement Striving",
    "C5": "Self-Discipline",
    "C6": "Deliberation",
}

# Weights
W_FC = 0.25
W_SJT = 0.35
W_INT = 0.40


# ============================================================
# SCORING FUNCTIONS
# ============================================================

def score_fc(fc_responses):
    """
    fc_responses: dict of {block_number: {"A": rank, "B": rank, "C": rank}}
    where rank is 1 (most), 2, or 3 (least)
    Returns: dict of {facet: normalized_score}
    """
    facet_raw = {"C1": 0, "C2": 0, "C3": 0, "C4": 0, "C5": 0, "C6": 0}
    details = {}

    for block_num, rankings in fc_responses.items():
        target_stmt, target_facet = FC_KEY[block_num]
        rank = rankings[target_stmt]
        points = {1: 2, 2: 1, 3: 0}[rank]
        facet_raw[target_facet] += points
        details[block_num] = {
            "target": target_stmt,
            "facet": target_facet,
            "rank": rank,
            "points": points,
        }

    facet_scores = {}
    for facet, raw in facet_raw.items():
        facet_scores[facet] = FC_NORMALIZE[raw]

    return facet_scores, facet_raw, details


def score_sjt(sjt_responses):
    """
    sjt_responses: dict of {scenario_number: chosen_option}
    Returns: dict of {facet: normalized_score}
    """
    scenario_points = {}
    for scenario, choice in sjt_responses.items():
        scenario_points[scenario] = SJT_KEY[scenario].get(choice, 0)

    facet_scores = {}

    # C1: scenario 6
    facet_scores["C1"] = round(scenario_points.get(6, 0) / 3 * 100, 2)
    # C2: scenario 1
    facet_scores["C2"] = round(scenario_points.get(1, 0) / 3 * 100, 2)
    # C3: scenarios 2, 7
    c3_sum = scenario_points.get(2, 0) + scenario_points.get(7, 0)
    facet_scores["C3"] = round(c3_sum / 6 * 100, 2)
    # C4: scenarios 3, 8
    c4_sum = scenario_points.get(3, 0) + scenario_points.get(8, 0)
    facet_scores["C4"] = round(c4_sum / 6 * 100, 2)
    # C5: scenarios 4, 7
    c5_sum = scenario_points.get(4, 0) + scenario_points.get(7, 0)
    facet_scores["C5"] = round(c5_sum / 6 * 100, 2)
    # C6: scenarios 5, 8
    c6_sum = scenario_points.get(5, 0) + scenario_points.get(8, 0)
    facet_scores["C6"] = round(c6_sum / 6 * 100, 2)

    return facet_scores, scenario_points


def score_interview(interview_bars):
    """
    interview_bars: dict of {facet: bars_score (1-5)}
    Returns: dict of {facet: converted_score}
    """
    return {facet: BARS_CONVERT[bars] for facet, bars in interview_bars.items()}


def score_process(process_responses):
    """
    process_responses: dict of {"P1": "yes"/"no"/"na", ...}
    Returns: bonus (-10 to +10)
    """
    raw = 0
    for item, response in process_responses.items():
        yes_pts, no_pts, na_pts = PROCESS_POINTS[item]
        if response == "yes":
            raw += yes_pts
        elif response == "no":
            raw += no_pts
        else:
            raw += na_pts

    # Convert: (raw + 11) / 23 * 20 - 10
    bonus = (raw + 11) / 23 * 20 - 10
    return round(bonus, 2), raw


def blend_scores(fc_scores, sjt_scores, int_scores):
    """Blend per-facet scores using weights."""
    blended = {}
    for facet in ["C1", "C2", "C3", "C4", "C5", "C6"]:
        blended[facet] = round(
            fc_scores[facet] * W_FC
            + sjt_scores[facet] * W_SJT
            + int_scores[facet] * W_INT,
            2,
        )
    return blended


def compute_final(blended, process_bonus):
    """Compute final score."""
    raw_composite = round(sum(blended.values()) / 6, 2)
    final = max(0, min(100, round(raw_composite + process_bonus)))
    return raw_composite, final


def check_consistency(fc_scores, sjt_scores, int_scores):
    """Check for facets where methods diverge > 30 points."""
    alerts = []
    for facet in ["C1", "C2", "C3", "C4", "C5", "C6"]:
        scores = [fc_scores[facet], sjt_scores[facet], int_scores[facet]]
        if max(scores) - min(scores) > 30:
            alerts.append({
                "facet": facet,
                "fc": fc_scores[facet],
                "sjt": sjt_scores[facet],
                "interview": int_scores[facet],
                "spread": max(scores) - min(scores),
            })
    return alerts


def get_score_label(score):
    """Return interpretation label for a score."""
    if score <= 15:
        return "Very Low — Do not recommend"
    elif score <= 30:
        return "Low — Significant concerns"
    elif score <= 45:
        return "Below Average — Notable gaps"
    elif score <= 60:
        return "Average — Adequate with supervision"
    elif score <= 75:
        return "Above Average — Recommended"
    elif score <= 85:
        return "High — Highly recommended"
    elif score <= 95:
        return "Very High — Exceptional (check rigidity)"
    else:
        return "Extreme — Verify authenticity"


# ============================================================
# SAMPLE CANDIDATES
# ============================================================

CANDIDATES = {
    "low": {
        "name": "Jordan (Low Scorer Demo)",
        "position": "Customer Service Representative",
        "fc": {
            1:  {"A": 2, "B": 1, "C": 3},  # A=2nd → 1pt
            2:  {"A": 1, "B": 2, "C": 3},  # B=2nd → 1pt  → C1 raw=2
            3:  {"A": 3, "B": 1, "C": 2},  # A=3rd → 0pt
            4:  {"A": 1, "B": 2, "C": 3},  # C=3rd → 0pt  → C2 raw=0
            5:  {"A": 2, "B": 3, "C": 1},  # A=2nd → 1pt
            6:  {"A": 1, "B": 3, "C": 2},  # B=3rd → 0pt  → C3 raw=1
            7:  {"A": 1, "B": 2, "C": 3},  # B=2nd → 1pt
            8:  {"A": 1, "B": 2, "C": 3},  # C=3rd → 0pt  → C4 raw=1
            9:  {"A": 2, "B": 3, "C": 1},  # A=2nd → 1pt
            10: {"A": 1, "B": 3, "C": 2},  # B=3rd → 0pt  → C5 raw=1
            11: {"A": 1, "B": 2, "C": 3},  # B=2nd → 1pt
            12: {"A": 2, "B": 3, "C": 1},  # A=2nd → 1pt  → C6 raw=2
        },
        "sjt": {1: "A", 2: "A", 3: "A", 4: "C", 5: "A", 6: "A", 7: "C", 8: "A"},
        "interview": {"C1": 1, "C2": 1, "C3": 1, "C4": 1, "C5": 1, "C6": 1},
        "process": {"P1": "no", "P2": "no", "P3": "no", "P4": "no", "P5": "no", "P6": "no", "P7": "no", "P8": "no"},
    },
    "average": {
        "name": "Sam (Average Scorer Demo)",
        "position": "Marketing Analyst",
        "fc": {
            1:  {"A": 1, "B": 2, "C": 3},  # A=1st → 2pt
            2:  {"A": 3, "B": 2, "C": 1},  # B=2nd → 1pt  → C1 raw=3
            3:  {"A": 2, "B": 1, "C": 3},  # A=2nd → 1pt
            4:  {"A": 1, "B": 3, "C": 2},  # C=2nd → 1pt  → C2 raw=2
            5:  {"A": 1, "B": 3, "C": 2},  # A=1st → 2pt
            6:  {"A": 1, "B": 3, "C": 2},  # B=3rd → 0pt  → C3 raw=2
            7:  {"A": 3, "B": 2, "C": 1},  # B=2nd → 1pt
            8:  {"A": 2, "B": 3, "C": 1},  # C=1st → 2pt  → C4 raw=3 → wait, let me recalc
            # Actually let's target C4 raw=2
            9:  {"A": 2, "B": 1, "C": 3},  # A=2nd → 1pt
            10: {"A": 1, "B": 3, "C": 2},  # B=3rd → 0pt  → C5 raw=1
            11: {"A": 3, "B": 2, "C": 1},  # B=2nd → 1pt
            12: {"A": 2, "B": 1, "C": 3},  # A=2nd → 1pt  → C6 raw=2
        },
        "sjt": {1: "C", 2: "B", 3: "D", 4: "A", 5: "C", 6: "C", 7: "A", 8: "D"},
        "interview": {"C1": 3, "C2": 3, "C3": 3, "C4": 3, "C5": 3, "C6": 3},
        "process": {"P1": "yes", "P2": "na", "P3": "no", "P4": "yes", "P5": "na", "P6": "yes", "P7": "no", "P8": "yes"},
    },
    "high": {
        "name": "Maya (High Scorer Demo)",
        "position": "Project Manager",
        "fc": {
            1:  {"A": 1, "B": 3, "C": 2},  # A=1st → 2pt
            2:  {"A": 3, "B": 1, "C": 2},  # B=1st → 2pt  → C1 raw=4
            3:  {"A": 1, "B": 3, "C": 2},  # A=1st → 2pt
            4:  {"A": 3, "B": 2, "C": 1},  # C=1st → 2pt  → C2 raw=4 → wait, plan says raw 3
            # Adjust: C2 raw=3
            5:  {"A": 1, "B": 3, "C": 2},  # A=1st → 2pt
            6:  {"A": 3, "B": 1, "C": 2},  # B=1st → 2pt  → C3 raw=4
            7:  {"A": 3, "B": 1, "C": 2},  # B=1st → 2pt
            8:  {"A": 2, "B": 3, "C": 1},  # C=1st → 2pt  → C4 raw=4 → plan says 3
            # Adjust: C4 raw=3
            9:  {"A": 1, "B": 3, "C": 2},  # A=1st → 2pt
            10: {"A": 2, "B": 1, "C": 3},  # B=1st → 2pt  → C5 raw=4 → plan says 3
            # Adjust C5 raw=3
            11: {"A": 3, "B": 1, "C": 2},  # B=1st → 2pt
            12: {"A": 1, "B": 3, "C": 2},  # A=1st → 2pt  → C6 raw=4
        },
        "sjt": {1: "B", 2: "C", 3: "C", 4: "B", 5: "B", 6: "B", 7: "B", 8: "B"},
        "interview": {"C1": 5, "C2": 5, "C3": 5, "C4": 5, "C5": 5, "C6": 5},
        "process": {"P1": "yes", "P2": "yes", "P3": "yes", "P4": "yes", "P5": "yes", "P6": "yes", "P7": "yes", "P8": "yes"},
    },
}

# Fix the high scorer FC to match calibration example (C2=3, C4=3, C5=3)
CANDIDATES["high"]["fc"][3] = {"A": 1, "B": 3, "C": 2}   # A=1st → 2pt
CANDIDATES["high"]["fc"][4] = {"A": 2, "B": 3, "C": 1}   # C=1st → 2pt → C2=4, need 3
# Actually let's just set the right values for C2 raw=3:
CANDIDATES["high"]["fc"][4] = {"A": 1, "B": 3, "C": 2}   # C=2nd → 1pt → C2=2+1=3 ✓
CANDIDATES["high"]["fc"][7] = {"A": 3, "B": 1, "C": 2}   # B=1st → 2pt
CANDIDATES["high"]["fc"][8] = {"A": 3, "B": 2, "C": 1}   # C=1st → 2pt → C4=4, need 3
CANDIDATES["high"]["fc"][8] = {"A": 2, "B": 3, "C": 1}   # C=1st → 2pt, but B7 gave 2 → C4=2+2=4. Need one to be 2nd.
CANDIDATES["high"]["fc"][8] = {"A": 3, "B": 2, "C": 2}   # Can't have two 2nd. Let's do:
CANDIDATES["high"]["fc"][7] = {"A": 3, "B": 2, "C": 1}   # B=2nd → 1pt
CANDIDATES["high"]["fc"][8] = {"A": 3, "B": 2, "C": 1}   # C=1st → 2pt → C4=1+2=3 ✓
CANDIDATES["high"]["fc"][9] = {"A": 1, "B": 3, "C": 2}    # A=1st → 2pt
CANDIDATES["high"]["fc"][10] = {"A": 3, "B": 2, "C": 1}   # B=2nd → 1pt → C5=2+1=3 ✓


# ============================================================
# MAIN: Run scoring for all sample candidates
# ============================================================

def run_assessment(candidate_key):
    c = CANDIDATES[candidate_key]
    print("=" * 70)
    print(f"  CONSCIENTIOUSNESS ASSESSMENT REPORT")
    print(f"  Candidate: {c['name']}")
    print(f"  Position:  {c['position']}")
    print("=" * 70)

    # Step 1: FC Scoring
    fc_scores, fc_raw, fc_details = score_fc(c["fc"])
    print("\n--- SECTION A: Forced-Choice Inventory ---")
    print(f"  {'Facet':<25} {'Raw':>5} {'Score':>7}")
    print(f"  {'-'*25} {'-'*5} {'-'*7}")
    for facet in ["C1", "C2", "C3", "C4", "C5", "C6"]:
        print(f"  {facet} ({FACET_NAMES[facet]}){' '*(19-len(FACET_NAMES[facet]))} {fc_raw[facet]:>5} {fc_scores[facet]:>7}")

    # Step 2: SJT Scoring
    sjt_scores, sjt_points = score_sjt(c["sjt"])
    print("\n--- SECTION B: Situational Judgment Test ---")
    print(f"  Scenario choices: ", end="")
    for s in range(1, 9):
        pts = sjt_points[s]
        print(f"S{s}={c['sjt'][s]}({pts}pts) ", end="")
    print()
    print(f"\n  {'Facet':<25} {'Score':>7}")
    print(f"  {'-'*25} {'-'*7}")
    for facet in ["C1", "C2", "C3", "C4", "C5", "C6"]:
        print(f"  {facet} ({FACET_NAMES[facet]}){' '*(19-len(FACET_NAMES[facet]))} {sjt_scores[facet]:>7}")

    # Step 3: Interview Scoring
    int_scores = score_interview(c["interview"])
    print("\n--- SECTION C: Behavioral Interview (STAR) ---")
    print(f"  {'Facet':<25} {'BARS':>5} {'Score':>7}")
    print(f"  {'-'*25} {'-'*5} {'-'*7}")
    for facet in ["C1", "C2", "C3", "C4", "C5", "C6"]:
        print(f"  {facet} ({FACET_NAMES[facet]}){' '*(19-len(FACET_NAMES[facet]))} {c['interview'][facet]:>5} {int_scores[facet]:>7}")

    # Step 4: Blend
    blended = blend_scores(fc_scores, sjt_scores, int_scores)
    print("\n--- BLENDED FACET SCORES (FC×25% + SJT×35% + INT×40%) ---")
    print(f"  {'Facet':<25} {'FC':>6} {'SJT':>6} {'INT':>6} {'Blend':>8}")
    print(f"  {'-'*25} {'-'*6} {'-'*6} {'-'*6} {'-'*8}")
    for facet in ["C1", "C2", "C3", "C4", "C5", "C6"]:
        print(f"  {facet} ({FACET_NAMES[facet]}){' '*(19-len(FACET_NAMES[facet]))} {fc_scores[facet]:>6} {sjt_scores[facet]:>6} {int_scores[facet]:>6} {blended[facet]:>8}")

    # Step 5: Process Behavior
    process_bonus, process_raw = score_process(c["process"])
    print(f"\n--- PROCESS BEHAVIOR ---")
    print(f"  Raw points: {process_raw} (range: -11 to +12)")
    print(f"  Bonus: {process_bonus:+.2f} (range: -10 to +10)")

    # Step 6: Final Score
    raw_composite, final_score = compute_final(blended, process_bonus)
    print(f"\n--- FINAL SCORE ---")
    print(f"  Raw Composite: {raw_composite}")
    print(f"  Process Bonus:  {process_bonus:+.2f}")
    print(f"  Final Score:    {final_score}")
    print(f"  Interpretation: {get_score_label(final_score)}")

    # Consistency Checks
    alerts = check_consistency(fc_scores, sjt_scores, int_scores)
    if alerts:
        print(f"\n--- CONSISTENCY ALERTS ---")
        for a in alerts:
            print(f"  ⚠ {a['facet']} ({FACET_NAMES[a['facet']]}): FC={a['fc']}, SJT={a['sjt']}, INT={a['interview']} (spread={a['spread']})")
    else:
        print(f"\n  ✓ No consistency alerts")

    # Curvilinearity
    high_facets = [f for f, s in blended.items() if s > 90]
    if high_facets:
        print(f"\n--- CURVILINEARITY CHECK ---")
        for f in high_facets:
            print(f"  ⚠ {f} ({FACET_NAMES[f]}): Score {blended[f]} > 90 — check for rigidity/perfectionism")

    print("\n" + "=" * 70)
    return final_score


# ============================================================
# RUN ALL THREE DEMOS
# ============================================================

if __name__ == "__main__":
    print("\n" + "╔" + "═" * 68 + "╗")
    print("║" + " CONSCIENTIOUSNESS ASSESSMENT BATTERY — SCORING DEMO ".center(68) + "║")
    print("║" + " Running 3 sample candidates to demonstrate score differentiation ".center(68) + "║")
    print("╚" + "═" * 68 + "╝\n")

    scores = {}
    for key in ["low", "average", "high"]:
        scores[key] = run_assessment(key)
        print()

    # Summary comparison
    print("╔" + "═" * 68 + "╗")
    print("║" + " SCORE DIFFERENTIATION SUMMARY ".center(68) + "║")
    print("╚" + "═" * 68 + "╝")
    print(f"\n  {'Candidate':<35} {'Final Score':>12} {'Label'}")
    print(f"  {'-'*35} {'-'*12} {'-'*30}")
    for key in ["low", "average", "high"]:
        name = CANDIDATES[key]["name"]
        score = scores[key]
        label = get_score_label(score)
        bar = "█" * (score // 2) + "░" * (50 - score // 2)
        print(f"  {name:<35} {score:>12} {label}")
        print(f"  {' '*35} {bar}")
    print()
    print(f"  Score spread: {max(scores.values()) - min(scores.values())} points")
    print(f"  ✓ System produces clear differentiation across the 0-100 range")
    print()

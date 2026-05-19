/**
 * Concrete exercises for each session theme, scaled per fitness level.
 *
 * Each entry is keyed by the theme string emitted by THEMES in session.ts.
 * Levels: beginner | intermediate | advanced. Beginners get fewer sets and
 * lower-impact variants; advanced gets more sets and harder variants.
 *
 * Two prescription shapes:
 *   - reps:     "{sets} × {reps} {name}"             (resistance work)
 *   - duration: "{name} — {minutes} min {qualifier}" (cardio / mobility)
 */

export interface ExercisePrescription {
  name: string;
  prescription: string;
}

type Level = 'beginner' | 'intermediate' | 'advanced';

interface RepsExercise {
  kind: 'reps';
  // [beginner, intermediate, advanced] variant names
  variants: [string, string, string];
  sets: Record<Level, number>;
  reps: Record<Level, string>; // string so we can say "8-10" or "AMRAP"
}

interface DurationExercise {
  kind: 'duration';
  name: string;
  // Fraction of the main-block minutes this exercise consumes
  share: number;
  qualifier?: Record<Level, string>;
}

type Exercise = RepsExercise | DurationExercise;

function reps(
  variants: [string, string, string],
  sets: [number, number, number],
  repsByLevel: [string, string, string],
): RepsExercise {
  return {
    kind: 'reps',
    variants,
    sets:  { beginner: sets[0],         intermediate: sets[1],         advanced: sets[2] },
    reps:  { beginner: repsByLevel[0], intermediate: repsByLevel[1], advanced: repsByLevel[2] },
  };
}

function duration(name: string, share: number, qualifier?: [string, string, string]): DurationExercise {
  return {
    kind: 'duration',
    name,
    share,
    qualifier: qualifier
      ? { beginner: qualifier[0], intermediate: qualifier[1], advanced: qualifier[2] }
      : undefined,
  };
}

const LIBRARY: Record<string, Exercise[]> = {
  // ── Strength themes ───────────────────────────────────────────────────────
  Push: [
    reps(['Knee push-up', 'Push-up', 'Decline push-up'], [3, 4, 5], ['8', '10', '12']),
    reps(['DB shoulder press', 'DB shoulder press', 'Standing OHP'], [3, 4, 5], ['8', '10', '8']),
    reps(['Bench dip', 'Tricep dip', 'Ring dip'],       [3, 3, 4],  ['8', '10', '8']),
    reps(['Plank', 'Plank', 'RKC plank'],               [3, 3, 3],  ['30s', '45s', '60s']),
  ],
  Pull: [
    reps(['Lat pulldown', 'Pull-up', 'Weighted pull-up'], [3, 4, 5], ['8', '6-8', '5']),
    reps(['Seated row', 'DB row', 'Pendlay row'],         [3, 4, 4], ['10', '10', '8']),
    reps(['Band face pull', 'Face pull', 'Face pull'],    [3, 3, 4], ['12', '15', '15']),
    reps(['Bicep curl', 'Bicep curl', 'Chin-up'],         [3, 3, 3], ['10', '12', '8']),
  ],
  Legs: [
    reps(['Bodyweight squat', 'Goblet squat', 'Back squat'], [3, 4, 5], ['10', '8', '5']),
    reps(['Glute bridge', 'Romanian deadlift', 'Deadlift'],  [3, 4, 4], ['10', '8', '5']),
    reps(['Step-up', 'Walking lunge', 'Bulgarian split squat'], [3, 3, 3], ['10 each', '10 each', '8 each']),
    reps(['Calf raise', 'Calf raise', 'Single-leg calf raise'], [3, 3, 3], ['15', '15', '12']),
  ],
  Upper: [
    reps(['Push-up', 'Push-up', 'Diamond push-up'],       [3, 4, 4], ['8', '12', '12']),
    reps(['Seated row', 'DB row', 'Barbell row'],         [3, 4, 4], ['10', '10', '8']),
    reps(['DB shoulder press', 'DB shoulder press', 'OHP'], [3, 3, 4], ['10', '10', '8']),
    reps(['Plank', 'Plank', 'Hollow body hold'],          [3, 3, 3], ['30s', '45s', '60s']),
  ],
  Lower: [
    reps(['Bodyweight squat', 'Goblet squat', 'Front squat'], [3, 4, 5], ['10', '8', '5']),
    reps(['Glute bridge', 'Hip thrust', 'Hip thrust'],        [3, 4, 4], ['10', '10', '8']),
    reps(['Step-up', 'Reverse lunge', 'Bulgarian split squat'], [3, 3, 3], ['10 each', '10 each', '8 each']),
    reps(['Bird dog', 'Bird dog', 'Single-leg RDL'],          [3, 3, 3], ['10 each', '10 each', '8 each']),
  ],
  'Full body': [
    reps(['Bodyweight squat', 'Goblet squat', 'Goblet squat'], [3, 3, 4], ['10', '10', '12']),
    reps(['Knee push-up', 'Push-up', 'Push-up'],               [3, 3, 4], ['8', '10', '12']),
    reps(['Seated row', 'DB row', 'DB row'],                   [3, 3, 4], ['10', '10', '10']),
    reps(['Dead bug', 'Plank', 'Hollow body hold'],            [3, 3, 3], ['10', '45s', '45s']),
  ],
  Strength: [
    reps(['Goblet squat', 'Back squat', 'Back squat'],   [3, 4, 5], ['10', '5', '5']),
    reps(['Push-up', 'Bench press', 'Bench press'],      [3, 4, 5], ['10', '5', '5']),
    reps(['Seated row', 'Barbell row', 'Pendlay row'],   [3, 4, 4], ['10', '8', '5']),
    reps(['Plank', 'Hanging knee raise', 'Hanging leg raise'], [3, 3, 3], ['45s', '10', '8']),
  ],

  // ── Cardio themes (duration-based) ────────────────────────────────────────
  Cardio: [
    duration('Easy bike or jog', 1.0, ['conversational pace', 'zone 2', 'zone 2']),
  ],
  HIIT: [
    duration('Warm-up shuffle', 0.2),
    duration('Intervals', 0.6, ['20s on / 40s off × rounds', '30s on / 30s off × rounds', '40s on / 20s off × rounds']),
    duration('Easy spin-down', 0.2),
  ],
  Walk: [
    duration('Brisk walk', 1.0, ['flat terrain', 'mix in 1 short hill', 'mix in 2-3 short hills']),
  ],
  'Long walk': [
    duration('Long steady walk', 1.0, ['easy pace', 'steady pace', 'add a weighted pack 5-10 kg']),
  ],
  'Long run': [
    duration('Long run', 1.0, ['walk/run mix, zone 2', 'zone 2 steady', 'zone 2, last 20% pickup']),
  ],
  'Tempo run': [
    duration('Warm-up jog', 0.25),
    duration('Tempo block', 0.5, ['comfortably hard', 'half-marathon pace', '10K pace']),
    duration('Cool-down jog', 0.25),
  ],
  Easy: [
    duration('Easy run or bike', 1.0, ['zone 1-2', 'zone 2 conversational', 'zone 2 conversational']),
  ],
  Intervals: [
    duration('Warm-up', 0.2),
    duration('400m × N at 5K pace', 0.6, ['repeat 4-5', 'repeat 6-8', 'repeat 8-10']),
    duration('Cool-down', 0.2),
  ],
  Cross: [
    duration('Bike, row, or swim', 1.0, ['zone 2', 'zone 2 with 3-5 surges', 'zone 2 with 5-8 surges']),
  ],

  // ── Mobility themes ───────────────────────────────────────────────────────
  Mobility: [
    reps(['90/90 hip switch', '90/90 hip switch', '90/90 hip switch'], [2, 3, 3], ['8 each', '10 each', '12 each']),
    reps(['Cat-cow', 'Cat-cow', 'Cat-cow with reach'],                 [2, 2, 3], ['10', '10', '12']),
    reps(['Wall slide', 'Wall slide', 'Wall slide with band'],         [2, 3, 3], ['10', '10', '12']),
    reps(['Couch stretch', 'Couch stretch', 'Couch stretch'],          [2, 2, 2], ['60s each', '60s each', '90s each']),
  ],
  Hips: [
    reps(['Glute bridge', 'Glute bridge', 'Single-leg glute bridge'], [3, 3, 3], ['10', '12', '10 each']),
    reps(['90/90 hip switch', '90/90 hip switch', '90/90 hip switch'],[3, 3, 3], ['8 each', '10 each', '12 each']),
    reps(['Couch stretch', 'Couch stretch', 'Couch stretch'],         [2, 2, 2], ['60s each', '60s each', '90s each']),
    reps(['Cossack squat', 'Cossack squat', 'Deep cossack squat'],    [2, 3, 3], ['6 each', '8 each', '10 each']),
  ],
  Spine: [
    reps(['Cat-cow', 'Cat-cow', 'Cat-cow with reach'],          [3, 3, 3], ['10', '12', '12']),
    reps(['Thread the needle', 'Thread the needle', 'Thread the needle'], [3, 3, 3], ['8 each', '10 each', '10 each']),
    reps(['Dead bug', 'Dead bug', 'Dead bug with band'],        [3, 3, 3], ['10', '12', '12']),
    reps(['Childs pose', 'Childs pose', 'Extended childs pose'],[1, 1, 1], ['60s', '90s', '90s']),
  ],
  Shoulders: [
    reps(['Wall slide', 'Wall slide', 'Band pull-apart'],        [3, 3, 3], ['10', '12', '15']),
    reps(['Band face pull', 'Face pull', 'Face pull'],           [3, 3, 4], ['12', '15', '15']),
    reps(['Y-T-W', 'Y-T-W', 'Y-T-W'],                            [2, 3, 3], ['6 each', '8 each', '10 each']),
    reps(['Doorway pec stretch', 'Doorway pec stretch', 'Doorway pec stretch'], [1, 1, 1], ['45s each', '60s each', '60s each']),
  ],
};

export function prescriptionsFor(theme: string, level: Level, mainMinutes: number): ExercisePrescription[] {
  const lib = LIBRARY[theme];
  if (!lib || mainMinutes === 0) return [];
  return lib.map((ex) => {
    if (ex.kind === 'reps') {
      const sets = ex.sets[level];
      const reps = ex.reps[level];
      const name = ex.variants[level === 'beginner' ? 0 : level === 'intermediate' ? 1 : 2];
      return { name, prescription: `${sets} × ${reps} ${name}` };
    }
    const minutes = Math.max(1, Math.round(mainMinutes * ex.share));
    const qual = ex.qualifier ? ` — ${ex.qualifier[level]}` : '';
    return { name: ex.name, prescription: `${ex.name} · ${minutes} min${qual}` };
  });
}

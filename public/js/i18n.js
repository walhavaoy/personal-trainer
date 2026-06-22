/* Personal Trainer — minimal i18n.
 *
 * Loaded before pt.js. Exposes a global `i18n` with:
 *   - t(key, vars)              resolve key + format params
 *   - setLocale(loc)            change current locale, re-render DOM
 *   - currentLocale()           the active locale code
 *   - SUPPORTED                 list of locales the catalog covers
 *
 * String catalog covers UI chrome and the coach/trainer message keys the
 * backend emits in summary.weekCoachKey / today.trainerNoteKey.
 *
 * Convention: keys are dotted, params are {placeholder}-style. Missing keys
 * fall back to the en catalog; missing in both renders the key as-is so the
 * gap is visible during development.
 */

(function () {
  const STRINGS = {
    en: {
      // App chrome
      'app.greeting': 'Hello,',
      'app.athlete': 'athlete',
      'tab.home': 'Home',
      'tab.cardio': 'Cardio',
      'tab.gym': 'Gym',
      'tab.me': 'Me',

      // Dashboard
      'dashboard.onboarding.heading': 'Welcome to your trainer.',
      'dashboard.onboarding.body': "Pick what you want to do: walks, runs, cycling, or a gym session. I'll keep track and show your progress here.",
      'dashboard.onboarding.cta.run': 'Plan a run',
      'dashboard.onboarding.cta.gym': 'Start gym session',
      'dashboard.hero.thisWeek': 'This week',
      'dashboard.hero.streak': 'Streak',
      'dashboard.hero.days': 'days',
      'dashboard.hero.day': 'day',
      'dashboard.hero.sessions': 'Sessions',
      'dashboard.hero.vsLast': 'vs {n} last',
      'dashboard.hero.best': 'Best week so far · {parts} over your previous high',
      'dashboard.quickActions': 'Quick actions',
      'dashboard.quick.walk': 'Walk',
      'dashboard.quick.run': 'Run',
      'dashboard.quick.cycle': 'Cycle',
      'dashboard.quick.gym': 'Gym',
      'dashboard.upcoming': 'Upcoming',
      'dashboard.trend': 'Weekly trend',
      'dashboard.trend.caption': 'Last 8 weeks',
      'dashboard.trend.thisWeek': 'this week',
      'dashboard.recent': 'Recent',
      'dashboard.recent.empty': 'Nothing yet — pick a quick action above to start.',
      'dashboard.lifetime': 'Lifetime · {minutes} min · {sessions} {sessionsLabel}',
      'dashboard.lifetime.session': 'session',
      'dashboard.lifetime.sessions': 'sessions',

      // Activity item / labels
      'kind.walk': 'Walk',
      'kind.run': 'Run',
      'kind.cycle': 'Cycle',
      'kind.gym': 'Gym',
      'kind.rest': 'Rest',
      'kind.mobility': 'Mobility',
      'kind.cardio': 'Cardio',
      'kind.other': 'Activity',
      'activity.planned': 'Planned',
      'activity.markDone': 'Mark done',
      'activity.edit': 'Edit',
      'activity.delete': 'Delete',
      'activity.repeat': 'Repeat',
      'activity.confirm.delete': 'Delete {kind} from {date}?',

      // Cardio view
      'cardio.title': 'Cardio',
      'cardio.plan': '+ Plan',
      'cardio.filter.all': 'All',
      'cardio.filter.walk': '🚶 Walk',
      'cardio.filter.run': '🏃 Run',
      'cardio.filter.cycle': '🚴 Cycle',
      'cardio.planned': 'Planned',
      'cardio.history': 'History',
      'cardio.history.empty': 'No cardio yet. Tap + Plan to schedule a walk, run, or ride.',

      // Gym view
      'gym.title': 'Gym',
      'gym.new': '+ New',
      'gym.subtitle': 'Log sets, reps, and weight. Templates copy your last session.',
      'gym.sessions': 'Sessions',
      'gym.empty': 'No gym sessions yet. Tap + New to log your first lift.',
      'gym.sessionLine': '{date} · {count} exercises · {sets} sets',
      'gym.shortLine': '{count} exercises · {sets} sets',
      'gym.confirm.delete': 'Delete "{name}" from {date}?',

      // Cardio sheet
      'sheet.cardio.title': 'Plan cardio',
      'sheet.cardio.title.edit': 'Edit cardio',
      'sheet.cardio.when': 'When',
      'sheet.cardio.distance': 'Distance (km)',
      'sheet.cardio.duration': 'Duration (min)',
      'sheet.cardio.notes': 'Notes (optional)',
      'sheet.cardio.notes.placeholder': 'How did it feel?',
      'sheet.cardio.distance.placeholder': 'e.g. 5.0',
      'sheet.cardio.duration.placeholder': 'e.g. 30',
      'sheet.mode.logged': 'Log it (done)',
      'sheet.mode.planned': 'Plan for later',
      'sheet.cancel': 'Cancel',
      'sheet.save': 'Save',
      'sheet.saving': 'Saving…',
      'sheet.saved': 'Saved.',
      'sheet.error': 'Error: {msg}',

      // Gym sheet
      'sheet.gym.title.new': 'New gym session',
      'sheet.gym.title.edit': 'Edit gym session',
      'sheet.gym.name': 'Name',
      'sheet.gym.name.placeholder': 'e.g. Push day',
      'sheet.gym.date': 'Date',
      'sheet.gym.notes': 'Notes (optional)',
      'sheet.gym.notes.placeholder': 'How did it feel?',
      'sheet.gym.addExercise': '+ Add exercise',
      'sheet.gym.exercise.placeholder': 'Exercise name',
      'sheet.gym.addSet': '+ Add set',
      'sheet.gym.reps.placeholder': 'reps',
      'sheet.gym.weight.placeholder': 'kg',

      // Profile
      'me.profile': 'Profile',
      'me.displayName': 'Display name',
      'me.displayName.placeholder': '(your full name)',
      'me.goal': 'Goal',
      'me.goal.general_fitness': 'General fitness',
      'me.goal.strength': 'Strength',
      'me.goal.endurance': 'Endurance',
      'me.goal.weight_loss': 'Weight loss',
      'me.goal.mobility': 'Mobility',
      'me.fitnessLevel': 'Fitness level',
      'me.level.beginner': 'Beginner',
      'me.level.intermediate': 'Intermediate',
      'me.level.advanced': 'Advanced',
      'me.weekly': 'Weekly target (minutes)',
      'me.timezone': 'Timezone',
      'me.language': 'Language',
      'me.lang.en': 'English',
      'me.lang.fi': 'Suomi',
      'me.save': 'Save',
      'me.resetDefaults': 'Reset defaults',
      'me.resetting': 'Resetting…',
      'me.reset': 'Reset.',
      'me.saved': 'Saved.',
      'me.resetConfirm': 'Reset profile to defaults (general fitness, beginner, 150 min/week)? Timezone and language are kept.',
      'me.data': 'Data',
      'me.dataNote': 'Take it with you, or wipe it clean.',
      'me.export': 'Export CSV',
      'me.deleteAll': 'Delete all activity',
      'me.deleteConfirmWord': 'DELETE',
      'me.deletePrompt': 'Type {word} to wipe every activity you have logged. This cannot be undone.',
      'me.deleted': 'Deleted {n} activities.',
      'me.deleting': 'Deleting…',

      // Coach (matches summary.ts keys)
      'coach.new.zero': 'Fresh start this week — anything beats zero. Pick the smallest session and finish it.',
      'coach.new.nonzero': "First week tracking — let's see what a full seven days looks like.",
      'coach.flat': 'Steady — same volume as last week. Stability is its own win.',
      'coach.up.from_zero': "Logged {thisWeek} min this week vs nothing last week. That's the hard step.",
      'coach.up': '+{delta} min vs last week ({pct}%). Keep stacking it.',
      'coach.down.zero': 'No minutes yet this week ({lastWeek} last week). Pick the smallest session and start.',
      'coach.down': "{pct}% of last week ({delta} min). Don't let the slip become a habit.",

      // Trainer (matches session.ts keys)
      'trainer.rest': 'Rest day — protect tomorrow by actually resting today.',
      'trainer.first_session_back': 'First session back — keep it doable so you stack a second tomorrow.',
      'trainer.streak.ride': 'Streak of {streakDays} day(s). Ride it.',
      'trainer.yesterday_short': 'Yesterday came up short — easing today so you finish it.',
      'trainer.progression': 'Streak of {streakDays} and you closed yesterday — small bump today.',
      'trainer.streak.five_plus': 'Five-plus day streak — keep the form clean.',
      'trainer.steady': 'Steady session. Show up, finish strong.',

      // Relative dates
      'date.today': 'Today',
      'date.yesterday': 'Yesterday',
      'date.tomorrow': 'Tomorrow',

      // Errors / loading
      'error.failed': 'Failed: {msg}',
      'error.deleteFailed': 'Delete failed: {msg}',
      'error.loadFailed': 'Could not load: {msg}',
      'error.notSignedIn': 'Not signed in',
    },

    fi: {
      'app.greeting': 'Hei,',
      'app.athlete': 'urheilija',
      'tab.home': 'Koti',
      'tab.cardio': 'Kestävyys',
      'tab.gym': 'Sali',
      'tab.me': 'Minä',

      'dashboard.onboarding.heading': 'Tervetuloa valmentajallesi.',
      'dashboard.onboarding.body': 'Valitse mitä haluat tehdä: kävely, juoksu, pyöräily tai salitreeni. Pidän kirjaa ja näytän edistymisesi täällä.',
      'dashboard.onboarding.cta.run': 'Suunnittele juoksu',
      'dashboard.onboarding.cta.gym': 'Aloita salitreeni',
      'dashboard.hero.thisWeek': 'Tällä viikolla',
      'dashboard.hero.streak': 'Putki',
      'dashboard.hero.days': 'päivää',
      'dashboard.hero.day': 'päivä',
      'dashboard.hero.sessions': 'Treenejä',
      'dashboard.hero.vsLast': 'vs. {n} viime',
      'dashboard.hero.best': 'Paras viikko tähän mennessä · {parts} edellistä huippua enemmän',
      'dashboard.quickActions': 'Pikatoiminnot',
      'dashboard.quick.walk': 'Kävely',
      'dashboard.quick.run': 'Juoksu',
      'dashboard.quick.cycle': 'Pyöräily',
      'dashboard.quick.gym': 'Sali',
      'dashboard.upcoming': 'Tulossa',
      'dashboard.trend': 'Viikkotrendi',
      'dashboard.trend.caption': 'Viimeiset 8 viikkoa',
      'dashboard.trend.thisWeek': 'tämä viikko',
      'dashboard.recent': 'Viimeisimmät',
      'dashboard.recent.empty': 'Ei vielä mitään — valitse pikatoiminto aloittaaksesi.',
      'dashboard.lifetime': 'Yhteensä · {minutes} min · {sessions} {sessionsLabel}',
      'dashboard.lifetime.session': 'treeni',
      'dashboard.lifetime.sessions': 'treeniä',

      'kind.walk': 'Kävely',
      'kind.run': 'Juoksu',
      'kind.cycle': 'Pyöräily',
      'kind.gym': 'Sali',
      'kind.rest': 'Lepo',
      'kind.mobility': 'Liikkuvuus',
      'kind.cardio': 'Kestävyys',
      'kind.other': 'Suoritus',
      'activity.planned': 'Suunniteltu',
      'activity.markDone': 'Merkkaa tehdyksi',
      'activity.edit': 'Muokkaa',
      'activity.delete': 'Poista',
      'activity.repeat': 'Toista',
      'activity.confirm.delete': 'Poista {kind} päivältä {date}?',

      'cardio.title': 'Kestävyys',
      'cardio.plan': '+ Suunnittele',
      'cardio.filter.all': 'Kaikki',
      'cardio.filter.walk': '🚶 Kävely',
      'cardio.filter.run': '🏃 Juoksu',
      'cardio.filter.cycle': '🚴 Pyöräily',
      'cardio.planned': 'Suunnitellut',
      'cardio.history': 'Historia',
      'cardio.history.empty': 'Ei kestävyyssuorituksia vielä. Suunnittele kävely, juoksu tai pyöräily.',

      'gym.title': 'Sali',
      'gym.new': '+ Uusi',
      'gym.subtitle': 'Tallenna sarjat, toistot ja painot. Mallit kopioivat edellisen treenin.',
      'gym.sessions': 'Treenit',
      'gym.empty': 'Ei salitreenejä vielä. Tallenna ensimmäinen treeni.',
      'gym.sessionLine': '{date} · {count} liikettä · {sets} sarjaa',
      'gym.shortLine': '{count} liikettä · {sets} sarjaa',
      'gym.confirm.delete': 'Poista "{name}" päivältä {date}?',

      'sheet.cardio.title': 'Suunnittele suoritus',
      'sheet.cardio.title.edit': 'Muokkaa suoritusta',
      'sheet.cardio.when': 'Milloin',
      'sheet.cardio.distance': 'Matka (km)',
      'sheet.cardio.duration': 'Kesto (min)',
      'sheet.cardio.notes': 'Muistiinpanot (valinnainen)',
      'sheet.cardio.notes.placeholder': 'Miltä tuntui?',
      'sheet.cardio.distance.placeholder': 'esim. 5.0',
      'sheet.cardio.duration.placeholder': 'esim. 30',
      'sheet.mode.logged': 'Kirjaa (tehty)',
      'sheet.mode.planned': 'Suunnittele myöhemmäksi',
      'sheet.cancel': 'Peruuta',
      'sheet.save': 'Tallenna',
      'sheet.saving': 'Tallennetaan…',
      'sheet.saved': 'Tallennettu.',
      'sheet.error': 'Virhe: {msg}',

      'sheet.gym.title.new': 'Uusi salitreeni',
      'sheet.gym.title.edit': 'Muokkaa salitreeniä',
      'sheet.gym.name': 'Nimi',
      'sheet.gym.name.placeholder': 'esim. Pushtreeni',
      'sheet.gym.date': 'Päivämäärä',
      'sheet.gym.notes': 'Muistiinpanot (valinnainen)',
      'sheet.gym.notes.placeholder': 'Miltä tuntui?',
      'sheet.gym.addExercise': '+ Lisää liike',
      'sheet.gym.exercise.placeholder': 'Liikkeen nimi',
      'sheet.gym.addSet': '+ Lisää sarja',
      'sheet.gym.reps.placeholder': 'toistot',
      'sheet.gym.weight.placeholder': 'kg',

      'me.profile': 'Profiili',
      'me.displayName': 'Näyttönimi',
      'me.displayName.placeholder': '(koko nimesi)',
      'me.goal': 'Tavoite',
      'me.goal.general_fitness': 'Yleiskunto',
      'me.goal.strength': 'Voima',
      'me.goal.endurance': 'Kestävyys',
      'me.goal.weight_loss': 'Painonpudotus',
      'me.goal.mobility': 'Liikkuvuus',
      'me.fitnessLevel': 'Kuntotaso',
      'me.level.beginner': 'Aloittelija',
      'me.level.intermediate': 'Keskitaso',
      'me.level.advanced': 'Edistynyt',
      'me.weekly': 'Viikkotavoite (minuuttia)',
      'me.timezone': 'Aikavyöhyke',
      'me.language': 'Kieli',
      'me.lang.en': 'English',
      'me.lang.fi': 'Suomi',
      'me.save': 'Tallenna',
      'me.resetDefaults': 'Palauta oletukset',
      'me.resetting': 'Palautetaan…',
      'me.reset': 'Palautettu.',
      'me.saved': 'Tallennettu.',
      'me.resetConfirm': 'Palautetaanko profiili oletuksiin (yleiskunto, aloittelija, 150 min/vk)? Aikavyöhyke ja kieli säilyvät.',
      'me.data': 'Tiedot',
      'me.dataNote': 'Ota mukaasi tai pyyhi pois.',
      'me.export': 'Vie CSV',
      'me.deleteAll': 'Poista kaikki tiedot',
      'me.deleteConfirmWord': 'POISTA',
      'me.deletePrompt': 'Kirjoita {word} poistaaksesi kaikki tallennetut suoritukset. Tätä ei voi peruuttaa.',
      'me.deleted': 'Poistettu {n} suoritusta.',
      'me.deleting': 'Poistetaan…',

      'coach.new.zero': 'Uusi alku tällä viikolla — mikä tahansa voittaa nollan. Valitse pienin treeni ja tee se loppuun.',
      'coach.new.nonzero': 'Ensimmäinen seurantaviikko — katsotaan miltä täysi viikko näyttää.',
      'coach.flat': 'Tasaista — sama määrä kuin viime viikolla. Pysyvyys on oma voittonsa.',
      'coach.up.from_zero': 'Tällä viikolla {thisWeek} min vs. ei mitään viime viikolla. Vaikein askel on otettu.',
      'coach.up': '+{delta} min vs. viime viikko ({pct}%). Pidä tahti yllä.',
      'coach.down.zero': 'Ei minuutteja vielä tällä viikolla ({lastWeek} viime viikolla). Valitse pienin treeni ja aloita.',
      'coach.down': '{pct}% viime viikosta ({delta} min). Älä anna lipsumisen muodostua tavaksi.',

      'trainer.rest': 'Lepopäivä — suojaa huominen lepäämällä tänään.',
      'trainer.first_session_back': 'Ensimmäinen treeni tauon jälkeen — pidä se sopivana, jotta saat toisenkin huomenna.',
      'trainer.streak.ride': '{streakDays} päivän putki. Pidä yllä.',
      'trainer.yesterday_short': 'Eilen jäi vajaaksi — kevennetään tänään jotta tulee tehtyä.',
      'trainer.progression': '{streakDays} päivän putki ja eilen täydet — pieni korotus tänään.',
      'trainer.streak.five_plus': 'Yli viiden päivän putki — pidä tekniikka kunnossa.',
      'trainer.steady': 'Tasainen treeni. Tule paikalle, vie loppuun.',

      'date.today': 'Tänään',
      'date.yesterday': 'Eilen',
      'date.tomorrow': 'Huomenna',

      // Virheet / lataus
      'error.failed': 'Epäonnistui: {msg}',
      'error.deleteFailed': 'Poisto epäonnistui: {msg}',
      'error.loadFailed': 'Lataus epäonnistui: {msg}',
      'error.notSignedIn': 'Et ole kirjautunut',
    },
  };

  const SUPPORTED = Object.keys(STRINGS);
  const FALLBACK = 'en';

  let current = FALLBACK;

  function pickInitialLocale(stored) {
    if (stored && STRINGS[stored]) return stored;
    const nav = (navigator.language || '').toLowerCase().split('-')[0];
    if (STRINGS[nav]) return nav;
    return FALLBACK;
  }

  function t(key, vars) {
    const fromCurrent = STRINGS[current] && STRINGS[current][key];
    const fromFallback = STRINGS[FALLBACK][key];
    let s = fromCurrent != null ? fromCurrent : (fromFallback != null ? fromFallback : key);
    if (vars) {
      s = String(s).replace(/\{(\w+)\}/g, function (_, k) {
        return vars[k] != null ? String(vars[k]) : '';
      });
    }
    return s;
  }

  // Apply current locale to any element marked with data-i18n / data-i18n-*.
  // Static text nodes use textContent; placeholders / titles / aria-labels
  // are kept separate so a single element can localize multiple attributes.
  function applyDom(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    scope.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
    scope.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
    });
    scope.querySelectorAll('[data-i18n-aria-label]').forEach(function (el) {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria-label')));
    });
  }

  function setLocale(loc) {
    current = STRINGS[loc] ? loc : FALLBACK;
    document.documentElement.lang = current;
    applyDom();
    document.dispatchEvent(new CustomEvent('i18n:change', { detail: { locale: current } }));
  }

  window.i18n = {
    t: t,
    setLocale: setLocale,
    currentLocale: function () { return current; },
    pickInitialLocale: pickInitialLocale,
    applyDom: applyDom,
    SUPPORTED: SUPPORTED,
  };
})();

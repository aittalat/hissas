/* جسر داخل صفحة النموذج الأولي: يحوّل بين حالته الداخلية S وصيغة SchoolData،
   ويستدعي دواله كما هي (metrics, conflictSet, quality, diagnose, tMax, forcedLone, generate, advise).
   يُحقن بعد تحميل reference/prototype.html؛ لا يغيّر أي منطق في النموذج الأولي. */
/* global S:writable, SUB, NOCAP, DEFCFG, emptyData, seed, unitsOf, persons, clsSubj, hrsOf, lvlRank,
   metrics, conflictSet, quality, diagnose, tMax, forcedLone, generate, advise */
(() => {
  // نسخة من كتالوج المواد الأصلي لإرجاعه قبل seed()
  const BASE_SUB = JSON.parse(JSON.stringify(SUB));
  const BASE_NOCAP = [...NOCAP];
  const toSlot = (k) => k.split('-').map(Number);
  const toKey = ([d, p]) => `${d}-${p}`;
  const bySlot = (a, b) => a[0] - b[0] || a[1] - b[1];
  const uniqSlots = (keys) => [...new Set(keys)].map(toSlot).sort(bySlot);

  function exportSchool(name) {
    const subjects = Object.entries(SUB).map(([key, v]) => ({
      key,
      name: v.n,
      short: v.sh,
      default_hours: v.h,
      hue: v.hue,
      no_daily_cap: NOCAP.includes(key),
      hard: !!v.hard,
      prefer_double: !!v.dbl,
    }));
    const classes = S.classes.map((c) => ({
      id: c.id,
      name: c.n,
      level_rank: lvlRank(c.n),
      subjects: [...clsSubj(c)],
    }));
    // نفس منطق unitsOf: أول سجل يدرّس المادة في القسم هو صاحبها.
    const assigned = new Map();
    for (const c of S.classes)
      for (const s of clsSubj(c)) {
        const t = S.teachers.find((t) => t.s === s && t.cls.includes(c.id));
        if (!t) continue;
        if (!assigned.has(t.id)) assigned.set(t.id, []);
        assigned.get(t.id).push({ class_id: c.id, hours: hrsOf(t, c.id) });
      }
    const teachers = S.teachers.map((t) => ({
      id: t.id,
      person_id: t.pid || t.id,
      subject: t.s,
      classes: assigned.get(t.id) || [],
    }));
    const people = Object.values(persons()).map((x) => ({
      id: x.id,
      full_name: x.rep.n,
      present: x.present,
      shared: x.recs.some((t) => t.shared),
      unavailable: uniqSlots(x.recs.flatMap((t) => t.unav)),
      other_school: uniqSlots(x.recs.flatMap((t) => t.ext)),
    }));
    const c = S.cfg;
    return {
      version: 1,
      name: name || S.school,
      config: {
        period_minutes: c.dur,
        am_start: c.amStart,
        am_count: c.amN,
        pm_start: c.pmStart,
        pm_count: c.pmN,
        break_after_2nd_minutes: c.brk,
        pairing_mode: c.block === 1 ? 1 : 2,
        days: [...c.days],
      },
      subjects,
      classes,
      persons: people,
      teachers,
      locked_classes: [...S.locked],
    };
  }

  function loadSchool(data) {
    for (const k of Object.keys(SUB)) delete SUB[k];
    NOCAP.length = 0;
    for (const s of data.subjects) {
      SUB[s.key] = { n: s.name, sh: s.short, h: s.default_hours, hue: s.hue };
      if (s.hard) SUB[s.key].hard = 1;
      if (s.prefer_double) SUB[s.key].dbl = 1;
      if (s.no_daily_cap) NOCAP.push(s.key);
    }
    const next = emptyData(data.name);
    const c = data.config;
    next.cfg = {
      ...JSON.parse(JSON.stringify(DEFCFG)),
      dur: c.period_minutes,
      amStart: c.am_start,
      amN: c.am_count,
      pmStart: c.pm_start,
      pmN: c.pm_count,
      brk: c.break_after_2nd_minutes,
      block: c.pairing_mode,
      days: [...c.days],
    };
    next.classes = data.classes.map((k) => ({ id: k.id, n: k.name, subj: [...k.subjects] }));
    const P = new Map(data.persons.map((p) => [p.id, p]));
    next.teachers = data.teachers.map((t) => {
      const p = P.get(t.person_id);
      return {
        id: t.id,
        pid: t.person_id,
        n: p.full_name,
        s: t.subject,
        cls: t.classes.map((x) => x.class_id),
        hrs: Object.fromEntries(t.classes.map((x) => [x.class_id, x.hours])),
        present: p.present,
        shared: p.shared,
        unav: p.unavailable.map(toKey),
        ext: p.other_school.map(toKey),
      };
    });
    next.locked = [...data.locked_classes];
    next.dirty = false;
    S = next;
  }

  const unitIndex = (u) => Number(u.id.slice(u.id.lastIndexOf('_h') + 2));

  function placements() {
    const { U } = unitsOf();
    const out = [];
    for (const u of U) {
      const x = S.place[u.id];
      if (x) out.push({ class_id: u.c, subject: u.s, index: unitIndex(u), day: x.d, period: x.p });
    }
    return out.sort(
      (a, b) =>
        a.class_id.localeCompare(b.class_id) ||
        a.subject.localeCompare(b.subject) ||
        a.index - b.index,
    );
  }

  function setPlacements(list) {
    const { U } = unitsOf();
    const byKey = new Map(U.map((u) => [`${u.c}|${u.s}|${unitIndex(u)}`, u.id]));
    S.place = {};
    for (const x of list) {
      const id = byKey.get(`${x.class_id}|${x.subject}|${x.index}`);
      if (!id) throw new Error(`ساعة غير موجودة: ${x.class_id}|${x.subject}|${x.index}`);
      S.place[id] = { d: x.day, p: x.period };
    }
  }

  function measure() {
    const { U } = unitsOf();
    const m = metrics(S.place, U);
    const conflicts = conflictSet(U).size;
    return { metrics: m, conflicts, quality: quality(m, conflicts) };
  }

  function tMaxAll() {
    const { U } = unitsOf();
    return Object.values(persons()).map((x) => {
      const r = tMax(x, U);
      return { person_id: x.id, need: r.need, max: r.mx };
    });
  }

  function forcedLoneAll() {
    return Object.values(persons())
      .filter((x) => !x.present && forcedLone(x.rep))
      .map((x) => x.id);
  }

  const text = (html) => {
    const el = document.createElement('div');
    el.innerHTML = html;
    return el.textContent;
  };

  window.__oracle = {
    seedDemo: () => {
      for (const k of Object.keys(SUB)) delete SUB[k];
      Object.assign(SUB, JSON.parse(JSON.stringify(BASE_SUB)));
      NOCAP.splice(0, NOCAP.length, ...BASE_NOCAP);
      S = seed();
    },
    exportSchool,
    loadSchool,
    placements,
    setPlacements,
    measure,
    diagnose: () => diagnose(unitsOf().U),
    tMax: tMaxAll,
    forcedLone: forcedLoneAll,
    generate: (budget) => generate(budget),
    adviseTitles: () => advise().map((a) => text(a.title)),
  };
})();

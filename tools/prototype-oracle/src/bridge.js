/* جسر داخل صفحة النموذج الأولي: يحوّل بين حالته الداخلية S وصيغة SchoolData،
   ويستدعي دواله كما هي (metrics, conflictSet, quality, diagnose, tMax, forcedLone, generate, advise).
   يُحقن بعد تحميل reference/prototype.html؛ لا يغيّر أي منطق في النموذج الأولي. */
/* global S:writable, SUB, NOCAP, DEFCFG, emptyData, seed, unitsOf, persons, clsSubj, hrsOf, lvlRank,
   metrics, conflictSet, quality, diagnose, tMax, forcedLone, generate, advise, occFrom, fits,
   tmap, diffPlans, buildOcc, rowGroups, targetsFor, activeDays, loneList, proposals */
/* global UI:writable, analyze, approve, darijaFor, optLabel, saveNewTeacher, buildImport, sortClasses,
   distAOA, freeAOA, ttMatrix, ttTitle, exportTargets, printableHTML, workbook, XLSX,
   absStats, stuPoints, listData, LISTS, slotLabel, inkOn, applyBrand, meta, slugify, ROOT:writable,
   logoHTML, hueOf, initials, attestationHTML, tableHTML, viewParent, stuList */
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

  const keyOf = (u) => `${u.c}|${u.s}|${unitIndex(u)}`;

  /** مفاتيح الوحدات المخالفة (conflictSet)، والخانات التي تقبل كل وحدة مطلوبة (fits). */
  function inspect(unitKeys) {
    const { U } = unitsOf();
    const byKey = new Map(U.map((u) => [keyOf(u), u]));
    const conflicts = [...conflictSet(U)].map((id) => keyOf(U.find((u) => u.id === id))).sort();
    const TM = tmap();
    const targets = {};
    for (const k of unitKeys) {
      const u = byKey.get(k);
      const o = occFrom(S.place, U, new Set([u.id]));
      const out = [];
      for (let d = 0; d < 6; d++)
        for (let p = 0; p < S.cfg.amN + S.cfg.pmN; p++)
          if (fits(o, u, d, p, TM[u.t])) out.push([d, p]);
      targets[k] = out;
    }
    return { conflicts, targets };
  }

  /** diffPlans بين (مدرسة، جدول) و(مدرسة، جدول)، بخانات [يوم، حصة]. */
  function diff(school0, pls0, school1, pls1) {
    loadSchool(school0);
    setPlacements(pls0);
    const U0 = unitsOf().U;
    const pl0 = { ...S.place };
    loadSchool(school1);
    setPlacements(pls1);
    const U1 = unitsOf().U;
    const slot = (v) => (v == null ? null : [Math.floor(v / 100), v % 100]);
    return diffPlans(pl0, U0, S.place, U1).map((x) => {
      const r = { class_id: x.c, subject: x.s, from: slot(x.from), to: slot(x.to) };
      if (x.from == null) r.add = !!x.add;
      if (x.to == null) r.del = !!x.del;
      return r;
    });
  }

  const unitMaps = () => {
    const { U } = unitsOf();
    const UM = {};
    for (const u of U) UM[u.id] = u;
    const toKey = (id) => keyOf(UM[id]);
    const byKey = new Map(U.map((u) => [keyOf(u), u.id]));
    return { U, UM, toKey, toId: (k) => byKey.get(k) };
  };

  /** rowGroups لكل قسم ولكل شخص في كل يوم نشط. */
  function groups() {
    const { U, UM, toKey } = unitMaps();
    const o = buildOcc(U);
    const map = (kind, id) =>
      activeDays().flatMap((d) =>
        rowGroups(o, UM, kind, id, d).map((g) => ({
          day: d,
          period: g.p,
          units: g.ids.map(toKey),
        })),
      );
    const classes = {};
    for (const c of S.classes) classes[c.id] = map('c', c.id);
    const people = {};
    for (const id of Object.keys(persons())) people[id] = map('t', id);
    return { classes, persons: people };
  }

  /** targetsFor لاختيار حصة (مفاتيح وحداتها). */
  function targets(keys) {
    const { U, toKey, toId } = unitMaps();
    const tg = targetsFor(keys.map(toId), U);
    const out = {};
    for (const [k, v] of Object.entries(tg))
      out[k] =
        v === 'move' ? { kind: 'move' } : { kind: 'swap', with: v.slice(5).split(',').map(toKey) };
    return out;
  }

  /** أيام الساعة الواحدة وحلولها الصغيرة (loneList + proposals). */
  function lone() {
    const { U, toKey } = unitMaps();
    return loneList(S.place, U).map((ln) => ({
      person_id: ln.pk,
      day: ln.d,
      unit: toKey(ln.uid),
      proposals: proposals(ln, 3).map((c) => ({
        moves: c.mv.map((m) => ({ unit: toKey(m.id), day: m.d, period: m.p })),
        after: c.m,
        score: c.sc,
      })),
    }));
  }

  const flags = (op) => ({
    run: typeof op.run === 'function',
    regen: !!op.regen,
    fix: !!op.fix,
    deep: !!op.deep,
    goto: op.goto || null,
    teacher: op.tid || null,
  });

  /** advise(): النصوص (بدون HTML) ونوع كل خيار. */
  function adviseAll() {
    return advise().map((a) => ({
      title: text(a.title),
      detail: text(a.detail),
      options: a.opts.map((op) => ({
        label: text(op.label),
        effects: op.eff.map(text).filter(Boolean),
        flags: flags(op),
      })),
    }));
  }

  /** تشغيل run() لخيار (i, j) ثم إرجاع الحالة الناتجة، دون تغيير الحالة الأصلية. */
  function applyAdvice(i, j) {
    const snap = JSON.stringify(S);
    const ui = JSON.stringify(UI);
    const op = advise()[i].opts[j];
    op.run();
    const out = { school: exportSchool(), placements: placements() };
    S = JSON.parse(snap);
    Object.assign(UI, JSON.parse(ui));
    return out;
  }

  /** analyze + approve لغياب سجل أستاذ في يوم، بعد تعويضات سابقة (ctx). */
  function absence(teacherId, day, ctx, choices) {
    const snap = JSON.stringify(S);
    const ui = JSON.stringify(UI);
    const { UM, toKey, toId } = unitMaps();
    const TM = tmap();
    S.absences = ctx.absences.map((a) => ({ id: a.id, tid: a.teacher_id, d: a.day, r: a.reason }));
    S.subs = ctx.substitutions.map((x) => ({
      abs: x.absence_id,
      d: x.day,
      p: x.period,
      len: x.len,
      cls: x.class_id,
      uid: toId(x.units[0]),
      ids: x.units.map(toId),
      type: x.type,
      sub: x.substitute_teacher_id,
      v: x.swap_unit ? toId(x.swap_unit) : null,
      q: x.swap_period,
    }));
    S.ledger = {};
    S.notes = [];
    UI.absT = teacherId;
    UI.absD = day;
    UI.absR = 'مرض';
    const rows = analyze(teacherId, day);
    const lessons = rows.map((r) => ({
      period: r.p,
      len: r.u.len,
      units: r.ids.map(toKey),
      class_id: r.u.c,
      subject: r.u.s,
      teacher_id: r.u.t,
      options: r.opts.map((o) =>
        o.type === 'swap'
          ? { type: 'swap', unit: toKey(o.v), period: o.q }
          : o.type === 'cancel'
            ? { type: 'cancel' }
            : { type: o.type, teacher_id: o.t },
      ),
      texts: r.opts.map((o) => ({
        label: text(optLabel(o, TM, UM)),
        darija: darijaFor(r, o, TM, UM),
      })),
    }));
    rows.forEach((r, i) => (r.choice = choices[i] ?? 0));
    UI.absRows = rows;
    approve();
    const aid = S.absences[S.absences.length - 1].id;
    const approved = S.subs
      .filter((x) => x.abs === aid)
      .map((x) => ({
        day: x.d,
        period: x.p,
        len: x.len,
        class_id: x.cls,
        units: x.ids.map(toKey),
        type: x.type,
        substitute_teacher_id: x.sub,
        swap_unit: x.v ? toKey(x.v) : null,
        swap_period: x.q,
      }));
    const notices = [...S.notes]
      .reverse()
      .map((n) => ({ class_id: n.cls, title: n.title, text: n.text, darija: n.darija }));
    const ledger = S.ledger;
    S = JSON.parse(snap);
    Object.assign(UI, JSON.parse(ui));
    return { lessons, approved, notices, ledger };
  }

  const click = (act, data = {}) => {
    const el = document.createElement('button');
    el.dataset.act = act;
    Object.assign(el.dataset, data);
    document.body.appendChild(el);
    el.click();
    el.remove();
  };
  const change = ({ id, dataset, value, checked }) => {
    const el = document.createElement('input');
    if (checked !== undefined) {
      el.type = 'checkbox';
      el.checked = checked;
    }
    if (id) el.id = id;
    if (dataset) Object.assign(el.dataset, dataset);
    if (value !== undefined) el.value = value;
    document.body.appendChild(el);
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.remove();
  };

  /** تعديل بيانات عبر معالجات الأحداث الحقيقية لشاشة "الأساتذة والأقسام". */
  function edit(op) {
    const toast = document.getElementById('toast');
    toast.textContent = '';
    const before = new Set(S.teachers.map((t) => t.id));
    // save() يعيد اسم المدرسة إلى اسم المنصة ('oracle')؛ نحتفظ بالاسم الأصلي
    const name = S.school;
    if (op.teacher) UI.dataT = op.teacher;
    switch (op.kind) {
      case 'hours':
        click('ed-h', { c: op.class, v: String(op.delta) });
        break;
      case 'add_teacher':
        UI.newT = {
          n: op.input.name,
          s: op.input.subject,
          cls: { ...op.input.classes },
          present: op.input.present,
          free: op.input.free.map(([d, p]) => d + '-' + p),
          done: null,
        };
        saveNewTeacher();
        break;
      case 'rename':
        change({ id: 'ed-n', value: op.name });
        break;
      case 'subject':
        change({ id: 'ed-s', value: op.subject });
        break;
      case 'present':
        change({ id: 'ed-pr', checked: op.on });
        break;
      case 'shared':
        change({ id: 'ed-sh', checked: op.on });
        break;
      case 'avail_slot':
        change({ dataset: { av: op.day + '-' + op.period, scope: 'edit' }, checked: op.on });
        break;
      case 'avail_day':
        change({ dataset: { avday: String(op.day), scope: 'edit' }, checked: op.on });
        break;
      case 'avail_col':
        change({ dataset: { avcol: String(op.period), scope: 'edit' }, checked: op.on });
        break;
      case 'quick':
        click('av-quick', { scope: 'edit', v: op.mode });
        break;
      case 'delete_teacher':
        click('del-ok');
        break;
      case 'add_class':
        UI.addC = { n: op.name, from: op.from || '' };
        click('cls-add');
        break;
      case 'toggle_subject':
        click('cls-subj', { c: op.class, s: op.subject });
        break;
      case 'delete_class':
        click('cls-del-ok', { id: op.class });
        break;
    }
    const added = S.teachers.find((t) => !before.has(t.id));
    return {
      school: exportSchool(name),
      placements: placements(),
      toast: toast.textContent,
      newTeacherId: added ? added.id : null,
    };
  }

  const slotsOf = (keys) => keys.map(toSlot);

  /** buildImport بصيغة ImportResult. */
  function importBuild(sheets) {
    const R = buildImport(sheets);
    if (R.error) return { ok: false, error: R.error };
    return {
      ok: true,
      classes: R.classes.map((c) => ({ id: c.id, name: c.n, subjects: [...c.subj] })),
      teachers: R.teachers.map((t) => ({
        id: t.id,
        person_id: t.pid || t.id,
        name: t.n,
        subject: t.s,
        classes: t.cls.map((c) => ({ class_id: c, hours: t.hrs[c] })),
        present: t.present,
        shared: t.shared,
        unavailable: slotsOf(t.unav),
        other_school: slotsOf(t.ext),
      })),
      custom: Object.entries(R.custom).map(([key, v]) => ({
        key,
        name: v.n,
        short: v.sh,
        default_hours: v.h,
        hue: v.hue,
        no_daily_cap: false,
        hard: false,
        prefer_double: false,
      })),
      warnings: R.warn,
      persons: R.persons,
      with_free: R.withFree,
    };
  }

  /** applyImport دون generate() (الجدول يُفرغ). */
  function importApply(sheets) {
    const name = S.school;
    const R = buildImport(sheets);
    if (R.error) return null;
    S.classes = R.classes;
    S.teachers = R.teachers;
    S.subx = R.custom;
    for (const [k, v] of Object.entries(R.custom)) SUB[k] = v;
    sortClasses();
    S.place = {};
    S.locked = [];
    return exportSchool(name);
  }

  const which = (w) => (w === 'classes' ? 'c' : w === 'teachers' ? 't' : 'all');

  /** مصفوفات وعناوين كل الجداول المصدَّرة، وورقتا التوزيع وأوقات الفراغ. */
  function exportsAll(w) {
    const mats = exportTargets(which(w)).map(([mode, id]) => {
      const M = ttMatrix(mode, id);
      return {
        mode: mode === 'c' ? 'class' : 'teacher',
        id,
        title: ttTitle(mode, id),
        rows: M.rows.map((r) => ({
          day: r.d,
          cells: r.cells.map((c) => ({ period: c.p, len: c.len, subject: c.s, who: c.who || '' })),
        })),
        hours: M.hours,
      };
    });
    return { dist: distAOA(), free: freeAOA(), mats, html: printableHTML(which(w)) };
  }

  /** ملف Excel كما يكتبه النموذج الأولي، مقروءا من جديد: الأوراق بأسمائها وخلاياها ودمجها. */
  function workbookSheets(w) {
    const wb = XLSX.read(workbook(which(w)), { type: 'array' });
    return wb.SheetNames.map((n) => {
      const ws = wb.Sheets[n];
      return {
        name: n,
        rows: XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' }),
        merges: (ws['!merges'] || []).map((m) => ({ s: m.s, e: m.e })),
      };
    });
  }

  // ───── الحياة المدرسية: تحويل بين صيغة SchoolLife وحالة النموذج الأولي ─────
  const REL = { father: 'الأب', mother: 'الأم', guardian: 'الولي' };
  const toProtoStudent = (x) => ({
    id: x.id,
    fn: x.first_name,
    ln: x.last_name,
    g: x.gender,
    cls: x.class_id,
    mat: x.matricule,
    birth: x.birth_date,
    pid: x.parent_id,
    status: x.status,
    health: x.health_note,
    photoOk: x.photo_consent,
    since: x.is_new ? 'جديد' : 'قديم',
  });
  const fromProtoStudent = (x) => ({
    id: x.id,
    class_id: x.cls,
    first_name: x.fn,
    last_name: x.ln,
    gender: x.g,
    birth_date: x.birth,
    matricule: x.mat,
    massar_code: null,
    parent_id: x.pid,
    status: x.status,
    health_note: x.health || '',
    photo_consent: x.photoOk,
    is_new: x.since === 'جديد',
  });
  const fromProtoParent = (p) => ({
    id: p.id,
    full_name: p.name,
    phone: p.phone,
    relation: Object.keys(REL).find((k) => REL[k] === p.rel) || 'father',
  });
  const fromProtoAtt = (a) => ({
    id: a.id,
    student_id: a.sid,
    date: a.date,
    period: a.p,
    type: a.type,
    late_minutes: a.mins,
    justified: a.just,
    reason: a.reason,
    comment: a.com,
    parent_message_status: a.msg,
  });
  const fromProtoIncident = (i) => ({
    id: i.id,
    student_id: i.sid,
    date: i.date,
    time: i.time,
    title: i.title,
    type: i.type === 'pos' ? 'positive' : 'negative',
    gravity: i.grav,
    measure: i.measure,
    description: i.desc,
    visible_to_parent: !!i.pub,
    recorded_by: i.by,
  });

  function setLife(L) {
    S.students = L.students.map(toProtoStudent);
    S.parents = L.parents.map((p) => ({
      id: p.id,
      ln: '',
      name: p.full_name,
      phone: p.phone,
      rel: REL[p.relation],
    }));
    S.att = L.attendance.map((a) => ({
      id: a.id,
      sid: a.student_id,
      date: a.date,
      p: a.period,
      type: a.type,
      mins: a.late_minutes,
      just: a.justified,
      reason: a.reason,
      msg: a.parent_message_status,
      com: a.comment,
    }));
    S.incidents = L.incidents.map((i) => ({
      id: i.id,
      sid: i.student_id,
      date: i.date,
      time: i.time,
      title: i.title,
      type: i.type === 'positive' ? 'pos' : 'neg',
      grav: i.gravity,
      measure: i.measure,
      pub: i.visible_to_parent,
      desc: i.description,
      by: i.recorded_by,
    }));
    S.meetings = [];
    S.msgs = [];
    S.docs = [];
    S.notes = [];
    S.rules = { absAlert: L.rules.monthly_absence_alert, late: L.rules.late_threshold_minutes };
  }

  const lifeOut = () => ({
    students: S.students.map(fromProtoStudent),
    parents: S.parents.map(fromProtoParent),
    attendance: S.att.map(fromProtoAtt),
    incidents: S.incidents.map(fromProtoIncident),
    meetings: S.meetings.map((m) => ({
      id: m.id,
      student_id: m.sid,
      date: m.date,
      reason: m.reason,
      requested_by: m.by,
      school_attendees: m.school,
      family_attendees: m.family,
      discussed_points: m.points,
      agreed_measures: m.measures,
    })),
    messages: [...S.msgs]
      .reverse()
      .map((m) => ({ student_id: m.sid, text: m.text, darija: m.darija })),
  });

  /** absStats، stuPoints، listData (القوائم التسع)، slotLabel لعينة، والوثائق. */
  function lifeQuery(L, slots) {
    setLife(L);
    const absS = {};
    const pts = {};
    for (const x of S.students) {
      absS[x.id] = absStats(x.id);
      pts[x.id] = stuPoints(x.id);
    }
    const lists = {};
    for (const [k] of LISTS) lists[k] = listData(k);
    const labels = slots.map(([c, date, p]) => slotLabel(c, date, p));
    const docs = {
      attestation: S.students[0] ? attestationHTML(S.students[0]) : null,
      table: tableHTML(
        'عنوان',
        ['أ', 'ب'],
        [
          ['1', '<x>'],
          ['2', '&'],
        ],
      ),
    };
    return { abs: absS, points: pts, lists, labels, docs };
  }

  const withInputs = (values, fn) => {
    const els = Object.entries(values).map(([id, v]) => {
      const el = document.createElement('input');
      el.id = id;
      if (typeof v === 'boolean') {
        el.type = 'checkbox';
        el.checked = v;
      } else el.value = String(v);
      document.body.appendChild(el);
      return el;
    });
    try {
      fn();
    } finally {
      els.forEach((e) => e.remove());
    }
  };

  /** أفعال الحارس العام عبر معالجات الأحداث الحقيقية. */
  function lifeAction(L, op) {
    setLife(L);
    const toast = document.getElementById('toast');
    toast.textContent = '';
    const beforeS = new Set(S.students.map((x) => x.id));
    const beforeP = new Set(S.parents.map((x) => x.id));
    switch (op.kind) {
      case 'mark':
        UI.mk = { cls: op.class_id, date: op.date, p: op.period, marks: {}, mins: {} };
        for (const m of op.marks) {
          UI.mk.marks[m.student_id] = m.type;
          if (m.minutes !== undefined) UI.mk.mins[m.student_id] = m.minutes;
        }
        withInputs({ 'mk-cls': op.class_id, 'mk-date': op.date, 'mk-p': op.period }, () =>
          click('mk-save'),
        );
        break;
      case 'incident':
        withInputs(
          {
            'in-title': op.input.title,
            'in-type': op.input.type === 'positive' ? 'pos' : 'neg',
            'in-grav': op.input.gravity,
            'in-measure': op.input.measure,
            'in-date': op.input.date,
            'in-desc': op.input.description,
            'in-pub': op.input.visible_to_parent,
          },
          () => click('in-save', { sid: op.input.student_id }),
        );
        break;
      case 'student':
        withInputs(
          {
            'sn-fn': op.input.first_name,
            'sn-ln': op.input.last_name,
            'sn-cls': op.input.class_id,
            'sn-g': op.input.gender,
            'sn-birth': op.input.birth_date,
            'sn-pn': op.input.parent_name,
            'sn-pp': op.input.parent_phone,
          },
          () => click('stu-new-save'),
        );
        break;
      case 'reason':
        change({ dataset: { reason: op.id }, value: op.value });
        break;
      case 'just':
        change({ dataset: { just: op.id }, checked: op.value });
        break;
      case 'meeting':
        UI.stuOpen = op.input.student_id;
        withInputs(
          {
            'mt-reason': op.input.reason,
            'mt-date': op.input.date,
            'mt-by': op.input.requested_by,
            'mt-school': op.input.school_attendees,
            'mt-family': op.input.family_attendees,
            'mt-points': op.input.discussed_points,
            'mt-measures': op.input.agreed_measures,
          },
          () => click('mt-save'),
        );
        break;
      case 'broadcast':
        withInputs({ 'cm-to': op.to, 'cm-title': op.title, 'cm-text': op.text, 'cm-dar': '' }, () =>
          click('cm-send'),
        );
        break;
    }
    return {
      ...lifeOut(),
      toast: toast.textContent,
      newStudent: (S.students.find((x) => !beforeS.has(x.id)) || {}).id || null,
      newParent: (S.parents.find((x) => !beforeP.has(x.id)) || {}).id || null,
    };
  }

  /** مساعدات الهوية. */
  function brand(colors, names, taken) {
    const out = { ink: {}, css: {}, slug: {}, initial: {}, hue: {}, initials: {} };
    const color0 = meta().color;
    for (const c of colors) {
      out.ink[c] = inkOn(c);
      meta().color = c;
      applyBrand();
      out.css[c] = document.getElementById('brandcss').textContent;
    }
    const keep = ROOT.schools;
    ROOT.schools = taken.map((slug, i) => ({ id: 'x' + i, slug }));
    for (const n of names) {
      out.slug[n] = slugify(n);
      const el = document.createElement('div');
      el.innerHTML = logoHTML({ name: n, color: '#1D5A48', logo: null });
      out.initial[n] = el.textContent;
      out.hue[n] = hueOf(n);
      out.initials[n] = initials(n);
    }
    ROOT.schools = keep;
    meta().color = color0;
    applyBrand();
    return out;
  }

  /** الخط الزمني في تطبيق الولي (viewParent) لقسم ويوم، بعد تعويضات: [الوقت، النص]. */
  function parentDay(L, classId, day, subs) {
    setLife(L);
    const { toId } = unitMaps();
    S.subs = subs.map((x) => ({
      abs: x.absence_id,
      d: x.day,
      p: x.period,
      len: x.len,
      cls: x.class_id,
      uid: toId(x.units[0]),
      ids: x.units.map(toId),
      type: x.type,
      sub: x.substitute_teacher_id,
      v: x.swap_unit ? toId(x.swap_unit) : null,
      q: x.swap_period,
    }));
    const i = stuList().findIndex((st) => st.c === classId);
    if (i < 0) return null;
    UI.stu = i;
    UI.pday = day;
    const el = document.createElement('div');
    el.innerHTML = viewParent();
    return [...el.querySelectorAll('.tl-it')].map((it) => [
      it.querySelector('time').textContent,
      [...it.children]
        .slice(1)
        .map((c) => c.textContent)
        .join(''),
    ]);
  }

  window.__oracle = {
    parentDay,
    lifeQuery,
    lifeAction,
    brand,
    importBuild,
    importApply,
    exportsAll,
    workbookSheets,
    edit,
    absence,
    adviseAll,
    applyAdvice,
    lone,
    groups,
    targets,
    inspect,
    diff,
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

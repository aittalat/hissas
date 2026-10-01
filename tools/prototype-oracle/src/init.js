/* يُحقن قبل تحميل النموذج الأولي:
   - Math.random قابل للتكرار (mulberry32) مع window.__seedRandom(seed)
   - مدرسة فارغة في localStorage كي لا يولّد النموذج الأولي جدولا عند الإقلاع */
(() => {
  let a = 1;
  Math.random = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  window.__seedRandom = (seed) => {
    a = seed | 0;
  };
  const cfg = {
    dur: 60,
    amStart: '08:00',
    amN: 4,
    pmStart: '14:00',
    pmN: 4,
    brk: 0,
    block: 2,
    days: ['full', 'full', 'full', 'full', 'full', 'off'],
  };
  const empty = {
    v: 1,
    school: 'oracle',
    cfg,
    classes: [],
    teachers: [],
    place: {},
    locked: [],
    dirty: false,
    subs: [],
    absences: [],
    notes: [],
    ledger: {},
    netLog: [],
    split: [],
    subx: {},
    m2ac: true,
    meco: true,
    mphi: true,
    eng2: true,
  };
  localStorage.setItem(
    'hissas-platform-v1',
    JSON.stringify({
      v: 1,
      cur: 'oracle',
      schools: [{ id: 'oracle', name: 'oracle', slug: 'oracle', color: '#1D5A48', logo: null }],
      data: { oracle: empty },
    }),
  );
})();

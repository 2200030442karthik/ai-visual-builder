/* AI Visual Builder 10.5 - understanding before visualizing. Loaded after gallery.js; no AI model, no network.
   1. contentQuality(text): meaningless input (random letters, keyboard mashing) is rejected before any suggestion is
      built or any Napkin request is made. Acronyms, technical terms, product names, code, formulas, numbers, tables,
      other scripts and minor spelling mistakes pass: a word only counts against the text when it is unpronounceable
      (no vowel, long consonant runs, letter pairs English never uses), never just because it is unfamiliar.
      server.py reads QUALITY_BIGRAMS and QUALITY_WORDS from this file and runs the same check before Napkin.
   2. statementModel(text): one short factual statement -> its entities, their roles and the one relation the text
      states. "Claude is an AI model developed by Anthropic." -> Anthropic (developer) developed Claude (AI model).
      Nothing is added: no steps, no extra objects, no second relation.
   3. Layouts for such statements (relationship, fact card, icon pair, key statement), all native shapes. */

/* ===================== 1. Content quality ===================== */
const QUALITY_MSG = 'The content could not be understood. Please enter meaningful text.';
// The ~250 most frequent English letter pairs. Keyboard mashing ("cvjbk", "fbhdfbfd") is made of pairs outside this set.
const QUALITY_BIGRAMS = 'th he in er an re on at en nd ti es or te of ed is it al ar st to nt ng se ha as ou io le ve co me de hi ri ro ic ne ea ra ce li ch ll be ma si om ur ca el ta la ns di fo ho pe ec pr no ct us ac ot il tr ly nc et ut ss so rs un lo wa ge ie wh ee wi em ad ol rt po we na ul ni ts mo ow pa im mi ai sh ir su id os iv ia am fi ci vi pl ig tu ev ld ry mp fe bl ab gh ty op wo sa ay ex ke fr oo av ag if ap gr od bo sp rd do uc bu ei ov by rm ep tt oc fa ef cu rn sc gi da yo cr cl du ga qu ue ff ba ey ls va um pp ua up lu go ht ru ug ds lt pi rc rr eg au ck ew mu br bi pt ak pu ui rg ib tl ny ki rk ys ob mm fu ph og ms ye ud mb ip ub oi rl gu dr hr cc tw ft wn nu af hu nn eo vo rv nf xp gn sm fl iz ok nl my gl aw ju oa eq sy sl ps jo lf nv je nk kn gs dy hy ze ks xt bs ik dd cy rp sk xi oe oy ws';
// Common English and course words: any one of them shows the text is language, not noise.
const QUALITY_WORDS = 'a an the be to of and in that have i it for not on with he as you do at this but his by from they we say her she or will my one all would there their what so up out if about who get which go me when make can like time no just him know take people into year your good some could them see other than then now look only come its over think also back after use two how our work first well way even new want because any these give day most us is are was were been has had did does said made may must should shall might being am its per via vs ' +
  'data model system process learning machine training information business project team management user customer service product value report analysis design development developed develop software application network security cloud database server computer technology digital online web code test testing quality cost price market sales growth plan step stage phase goal result performance support tool platform company organization research science health care medical finance financial bank student course education teacher school learn lesson example problem solution change risk number rate total amount level type key main important high low large small second third final next last before after during between each every many more most less better best different same such own part group form area point case fact world life place week month today language image text content video audio file document page map line chart table list order record field input output feature function method approach strategy framework structure intelligence artificial deep neural natural create build built provide include help improve increase reduce collect clean prepare evaluate evaluation predict prediction deploy deployment monitor review verify check ensure confirm validate validation define definition identify select compare analyze analyse analytics measure developer engineer manager leader customer client employee team member';
const BIGRAM_SET = new Set(QUALITY_BIGRAMS.split(' ')), WORD_SET = new Set(QUALITY_WORDS.split(' '));

/* A word that could be language: has a vowel, no long consonant run, no triple letter, and most of its letter pairs are
   ordinary ones. Proper nouns (capitalised) get a lower bar: names like "Kafka" or "Zscaler" are allowed to be unusual. */
function plausibleWord(w, proper) {
  if (!/[aeiouy]/.test(w) || /[bcdfghjklmnpqrstvwxz]{6,}/.test(w) || /(.)\1\1/.test(w)) return false;
  if (w.length < 4) return BIGRAM_SET.has(w.slice(0, 2)) || BIGRAM_SET.has(w.slice(1, 3));
  let hit = 0;
  for (let i = 0; i < w.length - 1; i++) if (BIGRAM_SET.has(w.substr(i, 2))) hit++;
  return hit / (w.length - 1) >= (proper ? 0.25 : 0.6);
}
function wordKind(w) {
  if (/^[A-Z][A-Z0-9&]{1,6}s?$/.test(w)) return 'known';                                   // AI, API, SQL, KPIs
  const lw = w.toLowerCase().replace(/['’]s$/, '');
  if (WORD_SET.has(lw) || WORD_SET.has(lw.replace(/(?:es|s|ed|ing|ly|er|ers)$/, ''))) return 'known';
  if (lw.length < 3) return 'short';                                                         // too short to judge
  // CamelCase names are judged part by part (PowerPoint, JavaScript, iPhone)
  const parts = w.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().replace(/[^a-zà-ɏ ]/g, '').split(' ').filter(p => p.length >= 2);
  return parts.length && parts.every(p => plausibleWord(p, /^[A-Z]/.test(w))) ? 'word' : 'junk';
}
/* { ok, why, ratio, unclear } - ok false means: no suggestions, no Napkin request. */
function contentQuality(text) {
  const t = String(text || '').trim(), no = extra => Object.assign({ ok: false, message: QUALITY_MSG }, extra);
  if (!t) return no({ why: 'empty' });
  const letters = (t.match(/\p{L}/gu) || []).length, latin = (t.match(/[A-Za-zÀ-ɏ]/g) || []).length, digits = (t.match(/\d/g) || []).length;
  // Structure that is meaningful by itself, whatever its words are
  if (letters && latin < letters * 0.5) return { ok: true, why: 'another script (not judged)' };
  if (t.split('\n').filter(l => (l.match(/\|/g) || []).length >= 2).length >= 2) return { ok: true, why: 'table' };
  if (digits >= 2 && digits >= letters * 0.2) return { ok: true, why: 'numbers' };
  if (/[=(){}\[\]]/.test(t) && /(?:^|[\s(])[A-Za-z_][\w.]*\s*(?:\(|=|:=|\[)/m.test(t)) return { ok: true, why: 'code or formula' };
  let known = 0, good = 0, junk = 0;
  const unclear = [];
  for (const w of t.match(/[A-Za-zÀ-ɏ]+(?:['’][A-Za-z]+)*/g) || []) {
    const k = wordKind(w);
    if (k === 'short') continue;
    if (k === 'junk') { junk += w.length; if (unclear.length < 12 && !unclear.includes(w)) unclear.push(w); continue; }
    good += w.length;
    if (k === 'known') known++;
  }
  const ratio = good + junk ? good / (good + junk) : 0;
  if (known ? ratio >= 0.6 : ratio >= 0.8 && good >= 5) return { ok: true, why: 'text', ratio, unclear };
  return no({ why: 'unreadable', ratio, unclear });
}
/* Step 2 after a rejection: nothing to show, nothing to insert. */
function rejectContent(q) {
  state.sections = []; state.sec = null; state.runText = '';
  ['step3', 'gallery', 'result', 'issues', 'sections'].forEach(id => { $(id).hidden = true; });
  $('analyseInfo').textContent = QUALITY_MSG;
  $('analyse').textContent = 'Analyze content';
  setStatus(QUALITY_MSG, true);
  updateButtons();
}

/* ===================== 2. Statements: entities and the stated relation ===================== */
// Who did it, named by what the text says they did ("developed by Anthropic" -> Anthropic: Developer).
const AGENT_ROLE = { developed: 'Developer', created: 'Creator', built: 'Builder', designed: 'Designer', founded: 'Founder', invented: 'Inventor',
  manufactured: 'Manufacturer', produced: 'Producer', published: 'Publisher', owned: 'Owner', maintained: 'Maintainer', operated: 'Operator',
  written: 'Author', wrote: 'Author', acquired: 'Acquirer' };
const VERB_FORMS = ('develop develops developed|create creates created|build builds built|design designs designed|found founds founded|invent invents invented|' +
  'manufacture manufactures manufactured|produce produces produced|publish publishes published|own owns owned|maintain maintains maintained|' +
  'operate operates operated|write writes written wrote|acquire acquires acquired|release releases released|launch launches launched|' +
  'introduce introduces introduced|offer offers offered|provide provides provided|sell sells sold|make makes made|train trains trained|fund funds funded|' +
  'host hosts hosted|run runs ran|use uses used|power powers powered|support supports supported|replace replaces replaced|enable enables enabled|' +
  'require requires required|contain contains contained|cause causes caused|manage manages managed|lead leads led|teach teaches taught|serve serves served')
  .split('|').map(g => g.split(' '));
const PARTICIPLE = {};                                       // any form -> past participle ("develops" -> "developed")
VERB_FORMS.forEach(g => g.forEach(f => { PARTICIPLE[f] = g[2]; }));
const ACTIVE_RE = VERB_FORMS.flatMap(g => [g[1], g[2]].concat(g[3] ? [g[3]] : [])).join('|');
const PASSIVE_RE = [...new Set(VERB_FORMS.map(g => g[2]))].join('|');
const LINK_RE = 'is part of|are part of|depends on|depend on|leads to|lead to|belongs to|belong to|connects to|connect to|runs on|run on|is based on|are based on|' +
  'is built on|are built on|competes with|compete with|integrates with|integrate with|works with|reports to|report to|feeds into|feed into|results in|result in|' +
  'is a subset of|are a subset of|is a type of|are a type of|is a kind of|is a part of';
const PRONOUN = /^(?:it|this|that|these|those|they|he|she|we|you|i|there|here)$/i;
// An entity: 1-6 words, no clause words (so "training data to make predictions" is not mistaken for one).
const ENTITY = "((?:[\\w&+#.'’-]+\\s){0,5}[\\w&+#.'’-]+)";
const CLAUSE_WORD = /\b(?:to|for|that|which|who|when|where|while|with|because|so|if|than|into|from|in|on|at|of)\b/i;
const stripArticle = s => s.replace(/^(?:a|an|the)\s+/i, '').trim();
const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);

/* The single sentence of a short text (with an optional title line), or null. */
function singleSentence(text) {
  const lines = String(text || '').split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length || lines.length > 2 || String(text).length > 260) return null;
  let title = '', body = lines[0];
  if (lines.length === 2) {
    if (lines[0].length > 70 || /[.!?:]$/.test(lines[0])) return null;
    title = lines[0]; body = lines[1];
  }
  if (/^\s*(?:[-*•]|\d+[.)])\s/.test(body) || /[|→]|->|=>/.test(body)) return null;
  const sents = body.split(/(?<=[.!?])\s+(?=["'(\[]?[A-Z0-9])/).filter(Boolean);
  if (sents.length !== 1 || body.split(/\s+/).length < 3) return null;
  return { title, sentence: body.replace(/\s+/g, ' ').trim() };
}

/* "X is a/an Y developed by Z", "X, developed by Z, is a Y", "X was developed by Z", "Z developed X(, a Y)",
   "X depends on Y", "X is a Y". Returns { kind, a, b, verb } with a = the doer/first entity. */
function readRelation(sentence) {
  const s = sentence.replace(/[.!]+$/, '').trim();
  const ent = v => { const e = stripArticle(v || ''); return e && !PRONOUN.test(e.split(' ')[0]) && !CLAUSE_WORD.test(e) && e.split(/\s+/).length <= 6 ? e : null; };
  const cat = v => { const c = stripArticle(v || ''); return c && c.split(/\s+/).length <= 10 && !/[,;]/.test(c) ? c : null; };
  const agent = (doer, verb, thing, category) => {
    const A = ent(doer), B = ent(thing), part = PARTICIPLE[verb.toLowerCase()] || verb.toLowerCase();
    if (!A || !B || A.toLowerCase() === B.toLowerCase()) return null;
    return { kind: 'relation', a: { label: cap1(A), role: AGENT_ROLE[part] || '' }, b: { label: cap1(B), role: category ? cap1(category) : '' }, verb: verb.toLowerCase(), agentNoun: !!AGENT_ROLE[part] };
  };
  let m;
  if ((m = new RegExp(`^${ENTITY}\\s+(?:is|was|are|were)\\s+(?:an?|the)\\s+(.+?)\\s+(?:(?:that|which|who)\\s+(?:is|was|are|were|has been|have been)\\s+)?(${PASSIVE_RE})\\s+by\\s+${ENTITY}$`, 'i').exec(s)) && cat(m[2]))
    return agent(m[4], m[3], m[1], cat(m[2]));
  if ((m = new RegExp(`^${ENTITY},\\s*(${PASSIVE_RE})\\s+by\\s+${ENTITY},\\s*(?:is|was|are|were)\\s+(?:an?|the)\\s+(.+)$`, 'i').exec(s)) && cat(m[4]))
    return agent(m[3], m[2], m[1], cat(m[4]));
  if ((m = new RegExp(`^${ENTITY}\\s+(?:is|was|are|were|has been|have been)\\s+(${PASSIVE_RE})\\s+by\\s+${ENTITY}$`, 'i').exec(s)))
    return agent(m[3], m[2], m[1], '');
  if ((m = new RegExp(`^${ENTITY}\\s+(${ACTIVE_RE})\\s+${ENTITY}(?:,\\s*(?:an?|the)\\s+(.+))?$`, 'i').exec(s)) && (!m[4] || cat(m[4])))
    return agent(m[1], m[2], m[3], m[4] ? cat(m[4]) : '');
  if ((m = new RegExp(`^${ENTITY}\\s+(${LINK_RE})\\s+${ENTITY}$`, 'i').exec(s))) {
    const A = ent(m[1]), B = ent(m[3]);
    if (A && B && A.toLowerCase() !== B.toLowerCase()) return { kind: 'relation', a: { label: cap1(A), role: '' }, b: { label: cap1(B), role: '' }, verb: m[2].toLowerCase(), agentNoun: false };
  }
  if ((m = new RegExp(`^${ENTITY}\\s+(?:is|are|was|were)\\s+(?:an?|the)\\s+(.+)$`, 'i').exec(s)) && ent(m[1]) && cat(m[2]))
    return { kind: 'definition', a: { label: cap1(ent(m[1])), role: cap1(cat(m[2])) }, verb: '' };
  return null;
}

/* Components joined by stated links in one sentence ("An application communicates with an API gateway, which routes
   requests to backend services connected to a database."): a chain of the catalog's system objects, each link labeled
   with the text's own words. Only when every gap between two components is a short linking phrase. */
const SYSTEM_KEYS = new Set(['app', 'gateway', 'server', 'database', 'cloud', 'dataset', 'window', 'monitor', 'person', 'team', 'org', 'document', 'lock', 'shield']);
function readChain(sentence) {
  const hits = [];
  CATALOG.filter(c => SYSTEM_KEYS.has(c.key)).forEach(c => c.terms.forEach(t => {
    const re = new RegExp(t.re.source, 'gi');
    let m;
    while ((m = re.exec(sentence))) { const lead = m[0].length - m[0].replace(/^[^\w]/, '').length; hits.push({ start: m.index + lead, end: m.index + m[0].length, text: m[0].slice(lead), key: c.key }); }
  }));
  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  const ms = [];
  hits.forEach(h => { if (!ms.length || h.start >= ms[ms.length - 1].end) ms.push(h); });
  if (ms.length < 3 || ms.length > 8) return null;
  const links = [];
  for (let i = 1; i < ms.length; i++) {
    const gap = sentence.slice(ms[i - 1].end, ms[i].start).replace(/^[\s,]+|\s+$/g, '').replace(/^(?:which|that|and)\s+/i, '').replace(/\s+(?:an?|the)$/i, '').trim();
    const words = gap.split(/\s+/).filter(Boolean);
    if (!words.length || words.length > 5 || /[.;:]/.test(gap) || !/\w(?:s|ed|es)\b|\b(?:to|with|into|via|through)\b/i.test(gap)) return null;
    links.push(gap);
  }
  return { nodes: ms.map((h, i) => ({ id: 'c' + (i + 1), label: cap1(h.text), detail: '', group: '' })), links };
}

const STATEMENT_BASE = { reason: '', confidence: 'high', source: 'rules', topic: '', subtopic: '', objectives: [], groups: [], chart: [], ordered: false,
  brief: { subject: '', objects: [], setting: '', composition: '' } };
/* Scene fields for a one-statement model (called by sceneOf): the entities to show and their accurate objects. */
function statementScene(sc, m) {
  const r = m.relation;
  sc.mode = m.type; sc.rel = r; sc.sentence = m.sentence;
  sc.items = m.type === 'relation' ? [r.a, r.b].map((e, i) => ({ id: 'e' + i, label: e.label, detail: '' }))
    : [{ id: 'e0', label: m.type === 'definition' ? r.a.label : m.sentence, detail: '' }];
  sc.n = sc.items.length;
  sc.icons = m.type === 'relation' ? [iconOf(r.a.role || r.a.label), iconOf(r.b.role || r.b.label)] : [];
  // the subject's object: the thing in a relation, the defined term's category, or a clear match for a plain statement
  const strong = conceptScores(m.sentence, '')[0];
  sc.mainIcon = m.type === 'relation' ? iconOf(r.b.role) || iconOf(r.b.label) : m.type === 'definition' ? iconOf(r.a.role)
    : strong && strong.score >= 9 ? { key: strong.key, name: strong.name, matched: true } : null;
  sc.iconsOK = false; sc.domainIcon = null;
  return sc;
}

/* The model for a one-statement text, or null (then the usual reading applies). */
function statementModel(text) {
  const one = singleSentence(text);
  if (!one || inlineList(text)) return null;
  const { sentence, title } = one, base = Object.assign({}, STATEMENT_BASE, { title, topic: title, sentence });
  const rel = readRelation(sentence);
  if (rel && rel.kind === 'relation') {
    const nodes = [{ id: 'a', label: rel.a.label, detail: '', group: '' }, { id: 'b', label: rel.b.label, detail: rel.b.role, group: '' }];
    return Object.assign(base, { type: 'relation', relation: Object.assign(rel, { sentence }), nodes, edges: [{ from: 'a', to: 'b', label: rel.verb }],
      concepts: [rel.a.label, rel.b.label], reason: `One statement: ${rel.a.label} ${rel.verb} ${rel.b.label}${rel.b.role ? ' (' + rel.b.role + ')' : ''}. Only this relation is shown.` });
  }
  const chain = readChain(sentence);
  if (chain) {
    const edges = chain.nodes.slice(1).map((n, i) => ({ from: chain.nodes[i].id, to: n.id, label: chain.links[i] }));
    return Object.assign(base, { type: 'architecture_diagram', nodes: chain.nodes, edges, ordered: true, concepts: chain.nodes.map(n => n.label),
      reason: `${chain.nodes.length} components linked in the order the sentence states.` });
  }
  if (rel && rel.kind === 'definition')
    return Object.assign(base, { type: 'definition', relation: Object.assign(rel, { sentence }), nodes: [{ id: 'a', label: rel.a.label, detail: rel.a.role, group: '' }], edges: [],
      concepts: [rel.a.label], reason: `A definition: ${rel.a.label} is ${rel.a.role.toLowerCase()}.` });
  return Object.assign(base, { type: 'statement', nodes: [{ id: 's', label: sentence, detail: '', group: '' }], edges: [], concepts: keyTerms(sentence).slice(0, 4),
    reason: 'One statement: shown as one clear message, without invented parts.' });
}

/* ===================== 3. Layouts for statements (native shapes) ===================== */
const LIGHT_PANEL = '#F2F2F2';
/* A solid card: the name, and its role underneath when the text gives one. */
function entityCard(x, y, w, h, E, col) {
  const out = [box('rect', x, y, w, h, { fill: col })];
  if (E.role) {
    const nh = h * 0.55;
    out.push(txt(x + 12, y + 8, w - 24, nh - 8, E.label, 44, { bold: true, valign: 'bottom' }), txt(x + 12, y + nh + 4, w - 24, h - nh - 14, E.role, 28, { valign: 'top' }));
  } else out.push(txt(x + 12, y + 8, w - 24, h - 16, E.label, 44, { bold: true }));
  return out;
}
/* Doer and thing joined by one arrow labeled with the text's verb; orient 'h' (side by side) or 'v' (doer on top). */
function buildRelation(R, rel, orient) {
  const out = [], A = rel.a, B = rel.b, ca = accent(0), cb = accent(1);
  if (orient === 'v') {
    const cw = Math.min(520, R.w * 0.5), ah = 96, ch = (R.h - ah) / 2, x = R.x + (R.w - cw) / 2;
    out.push(...entityCard(x, R.y, cw, ch, A, ca), ...entityCard(x, R.y + ch + ah, cw, ch, B, cb));
    out.push(box('downArrow', x + cw / 2 - 24, R.y + ch + 10, 48, ah - 20, { fill: TEMPLATE.line }));
    out.push(txt(x + cw / 2 + 36, R.y + ch + 6, Math.min(300, R.x + R.w - x - cw / 2 - 36), ah - 12, rel.verb, 28, { bold: true, align: 'left' }));
    return out;
  }
  const aw = 230, gap = 24, cw = Math.min(400, (R.w - aw - 2 * gap) / 2), ch = Math.min(R.h, 250), y = R.y + (R.h - ch) / 2;
  const x1 = R.x + (R.w - 2 * cw - aw - 2 * gap) / 2, ax = x1 + cw + gap, x2 = ax + aw + gap;
  out.push(...entityCard(x1, y, cw, ch, A, ca), ...entityCard(x2, y, cw, ch, B, cb));
  out.push(txt(ax, y + ch / 2 - 74, aw, 60, rel.verb, 30, { bold: true }), box('rightArrow', ax, y + ch / 2 - 10, aw, 44, { fill: TEMPLATE.line }));
  return out;
}
const REL = sc => sc.mode === 'relation';
const ONE = sc => /^(?:relation|definition|statement)$/.test(sc.mode);
const when = (test, why) => Object.assign(sc => test(sc), { reason: () => why });
const iconOf = label => { const i = label ? iconsFor([{ label }])[0] : null; return i && i.matched ? i : null; };
reg({ key: 'r-vertical', name: 'Relationship (top to bottom)', engine: 'A', family: 'r-vertical', fits: when(REL, 'only for one stated relation'),
  why: 'The doer on top, the arrow with the text\'s verb, the thing below.', build: (R, sc) => buildRelation(R, sc.rel, 'v') });
reg({ key: 'r-icons', name: 'Icon relationship', engine: 'A', family: 'r-icons',
  fits: when(sc => REL(sc) && sc.icons.length === 2 && sc.icons.every(Boolean) && sc.icons[0].key !== sc.icons[1].key, 'needs a different, accurate object for each entity'),
  why: 'An accurate object for each entity, joined by the stated relation (neutral symbols, no logos).',
  build: (R, sc) => {
    const out = [], D = Math.min(190, R.h * 0.5), aw = 220, slot = D + 160, x1 = R.x + (R.w - 2 * slot - aw) / 2, cy = R.y + D / 2 + 10;
    [[sc.rel.a, sc.icons[0], x1], [sc.rel.b, sc.icons[1], x1 + slot + aw]].forEach(([E, ic, x], i) => {
      const cx = x + slot / 2;
      out.push(box('ellipse', cx - D / 2, cy - D / 2, D, D, { fill: LIGHT_PANEL }), ...comp(ic.key, cx - D * 0.36, cy - D * 0.36, D * 0.72, accent(i)));
      out.push(txt(x, cy + D / 2 + 8, slot, 54, E.label, 36, { bold: true }));
      if (E.role) out.push(txt(x, cy + D / 2 + 64, slot, R.y + R.h - (cy + D / 2 + 64), E.role, 26, { valign: 'top' }));
    });
    const ax = x1 + slot;
    out.push(txt(ax, cy - 74, aw, 56, sc.rel.verb, 28, { bold: true }), box('rightArrow', ax + 10, cy - 18, aw - 20, 36, { fill: TEMPLATE.line }));
    return out;
  } });
reg({ key: 'r-profile', name: 'Fact card', engine: 'A', family: 'r-profile', fits: when(REL, 'only for one stated relation'),
  why: 'One card about the subject with the facts the sentence gives, nothing more.',
  build: (R, sc) => {
    // "Claude / Type: AI model / Developer: Anthropic"; for other links the subject is the doer: "Microservices / Depend on: Service discovery"
    const ag = sc.rel.agentNoun, A = ag ? sc.rel.b : sc.rel.a, rows = [];
    if (A.role) rows.push(['Type', A.role]);
    rows.push(ag ? [sc.rel.a.role, sc.rel.a.label] : [cap1(sc.rel.verb), sc.rel.b.label]);
    const w = Math.min(760, R.w), x = R.x + (R.w - w) / 2, hh = 110, rh = Math.min(100, (R.h - hh - 12) / rows.length), y0 = R.y + (R.h - hh - rows.length * rh - 12) / 2;
    const out = [box('rect', x, y0, w, hh, { fill: accent(0) }), txt(x + 16, y0 + 6, w - 32, hh - 12, A.label, 48, { bold: true })];
    rows.forEach(([k, v], i) => {
      const y = y0 + hh + 12 + i * rh;
      out.push(box('rect', x, y, w, rh - 8, { fill: LIGHT_PANEL }), txt(x + 16, y, w * 0.34, rh - 8, k, 28, { bold: true, align: 'left' }), txt(x + w * 0.36, y, w * 0.62, rh - 8, v, 30, { align: 'left' }));
    });
    return out;
  } });
reg({ key: 's-key', name: 'Key statement', engine: 'A', family: 's-key', fits: when(ONE, 'only for a single statement'),
  why: 'The statement exactly as written, as one clear message.', build: (R, sc) => buildStatement(R, { sentence: sc.sentence, nodes: [] }) });
reg({ key: 's-banner', name: 'Statement banner', engine: 'A', family: 's-banner', fits: when(sc => sc.mode === 'definition' || sc.mode === 'statement', 'only for a definition or statement'),
  why: 'The statement on one solid band.',
  build: (R, sc) => { const h = Math.min(R.h, 260), y = R.y + (R.h - h) / 2; return [box('rect', R.x, y, R.w, h, { fill: accent(0) }), txt(R.x + 40, y + 20, R.w - 80, h - 40, sc.sentence, 44, { bold: true })]; } });
reg({ key: 's-icon', name: 'Statement with icon', engine: 'A', family: 's-icon', fits: when(sc => ONE(sc) && !!sc.mainIcon, 'no accurate object for the subject'),
  why: 'An accurate object for the subject beside the statement.',
  build: (R, sc) => {
    const D = Math.min(R.h, 260), y = R.y + (R.h - D) / 2;
    return [box('ellipse', R.x, y, D, D, { fill: LIGHT_PANEL }), ...comp(sc.mainIcon.key, R.x + D * 0.16, y + D * 0.16, D * 0.68, accent(0)),
      txt(R.x + D + 40, R.y, R.w - D - 40, R.h, sc.sentence, 40, { bold: true, align: 'left' })];
  } });
reg({ key: 'd-card', name: 'Definition card', engine: 'A', family: 'd-card', fits: when(sc => sc.mode === 'definition', 'only for a definition'),
  why: 'The term and what the text says it is.',
  build: (R, sc) => { const w = Math.min(820, R.w), h = Math.min(R.h, 300); return entityCard(R.x + (R.w - w) / 2, R.y + (R.h - h) / 2, w, h, sc.rel.a, accent(0)); } });

/* ===================== 4. Explanatory prose: the ideas it states, not its sentences ===================== */
/* A paragraph ("Education-focused content is content that is created by educators to engage, inspire and inform their
   students. ...") is not a list of points: drawing each sentence as a point makes labels that fit no layout, and checking a
   Napkin result against key words of it reports descriptive words ("Education-focused") as missing. conceptModel reads
   the ideas the text states, in its own words, through grammatical patterns (never topic word lists):
     - a question or title line names the topic ("What is Educational Content?" -> Educational Content)
     - a definition sentence ("X is ...") is kept whole as the definition
     - "created/developed/... by N" -> "Created by educators"
     - an infinitive list "to engage, inspire and inform ..." -> "Engage, inspire and inform"
     - a list of qualities after is/are/can be ("creative and personalized") -> one idea, as stated together
     - "helps (you) achieve/improve ... X" -> "Achieve learning goals"
     - background or contrast ("Gone are the days ...") stays context.
   Every idea keeps the sentence it came from (`source`), so nothing is lost: it is checked and sent with its wording.
   Returns { topic, definition, concepts: [{ label, detail, source, members }], context } or null (fewer than 2 ideas). */
const AUX_WORD = /^(?:should|must|can|could|will|would|may|might|shall|be|is|are|was|were|has|have|had|do|does|did|not|also|then|that|which|who)$/i;
const NP_STOP = /^(?:to|for|that|which|who|with|in|on|at|of|from|into|and|or|but|because|so|when|while|as|by)$/i;
const BACKGROUND = /^(?:gone are the days|in the past|traditionally|historically|previously|unlike|instead of|no longer|long ago|once upon)/i;
const POSSESSIVE = /^(?:your|their|our|its|his|her|my|the|a|an|each|every)$/i;
function cleanNP(words, max) {
  const out = [];
  for (const w of words) { const b = w.replace(/[.,;:!?)]+$/, ''); if (!b || NP_STOP.test(b) || AUX_WORD.test(b)) break; out.push(b); if (/[.,;:!?)]$/.test(w)) break; }
  return out.filter(w => !POSSESSIVE.test(w) && !/['’]s$/i.test(w)).slice(-(max || 3)).join(' ');
}
const listWords = s => s.split(/\s*,\s*(?:and\s+|or\s+)?|\s+(?:and|or)\s+/).map(x => x.trim()).filter(Boolean);
const joinList = ws => ws.length <= 1 ? ws.join('') : ws.slice(0, -1).join(', ') + ' and ' + ws[ws.length - 1];
function conceptModel(text, heading) {
  const lines = String(text || '').split('\n').map(l => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').replace(/ /g, ' ').trim()).filter(Boolean);
  if (!lines.length) return null;
  let topic = '', definition = '';
  const concepts = [], context = [], body = [];
  lines.forEach(l => {
    const q = /^(?:what|who)\s+(?:is|are)\s+(?:an?\s+|the\s+)?(.{2,60}?)\s*\?$/i.exec(l);
    if (q) { topic = topic || cap1(q[1]); return; }
    if (/\?$/.test(l) || (wordCount(l) <= 6 && !/[.!]$/.test(l))) { context.push(l); return; }      // other questions and title lines frame the text
    body.push(...l.split(/(?<=[.!?])\s+(?=["'(\[]?[A-Z0-9])/).filter(Boolean));
  });
  const add = (label, source, members) => {
    label = cap1(label.replace(/\s+/g, ' ').trim());
    if (!label || wordCount(label) > 6 || concepts.some(c => c.label.toLowerCase() === label.toLowerCase())) return;
    concepts.push({ label, detail: '', source, members: members || [] });
  };
  body.forEach((sent, si) => {
    const before = concepts.length, s = sent.replace(/[.!]+$/, '');
    if (BACKGROUND.test(s)) { context.push(sent); return; }
    // the first "X is ..." sentence about the topic is its definition (kept whole)
    const d = /^(.{2,60}?)\s+(?:is|are|refers to|means)\s+(.{8,})$/i.exec(s);
    if (!definition && d && si === 0) { definition = sent; topic = topic || cap1(stripArticle(d[1])); }
    let m;
    const by = /\b(created|developed|designed|written|made|built|produced|delivered|taught|curated|prepared|provided|led|maintained)\s+by\s+(.+)$/i.exec(s);
    if (by && (m = cleanNP(by[2].split(/\s+/), 3))) add(`${by[1].toLowerCase()} by ${m}`, sent);
    const inf = /\bto\s+([a-z]+(?:\s*,\s*[a-z]+)*,?\s+(?:and|or)\s+[a-z]+)\b/i.exec(s);
    if (inf) { const vs = listWords(inf[1]); if (vs.length >= 2 && vs.every(v => !AUX_WORD.test(v) && !NP_STOP.test(v))) add(joinList(vs), sent, vs); }
    // qualities stated together after a linking verb; an auxiliary ends the list ("informational, and should be created")
    const re = /\b(?:is|are|was|were|be|becomes?|remains?|seems?)\s+((?:[a-z-]+\s*,\s*)*[a-z-]+,?\s+(?:and|or)\s+[a-z-]+)/gi;
    while ((m = re.exec(s))) {
      const ws = [];
      for (const w of listWords(m[1])) { if (AUX_WORD.test(w) || NP_STOP.test(w) || /\s/.test(w)) break; ws.push(w.toLowerCase()); }
      if (ws.length >= 2) add(joinList(ws), sent, ws);
    }
    const help = /\b(?:helps?|helping|enables?|allows?|lets?)\s+(?:(?:you|them|us|him|her|people|students|learners|users|teams|everyone)\s+)?(?:to\s+)?([a-z]+)\s+(.+)$/i.exec(s);
    if (help && !AUX_WORD.test(help[1]) && (m = cleanNP(help[2].split(/\s+/), 3))) add(`${help[1].toLowerCase()} ${m}`, sent);
    if (concepts.length === before && sent !== definition) context.push(sent);
  });
  // 10.21.1: sentences about kinds of one thing ("Supervised learning ...", "In unsupervised learning, ...", "Reinforcement
  // learning ...") - their subjects share a head noun. Each kind is an idea with its whole sentence (nothing reworded); a
  // first sentence about the general term ("Machine learning lets ...") is the topic.
  const subj = sent => { const s = sent.replace(/[.!]+$/, '');
    const pre = /^(?:in|with|for|during|under)\s+([^,]{3,60}),\s/i.exec(s); if (pre) return stripArticle(pre[1]);
    const m = /^(.{3,60}?)\s+(?:is|are|was|were|lets?|finds?|trains?|uses?|helps?|allows?|enables?|learns?|groups?|predicts?|works?|refers?|means|involves?|focuses?|relies?|requires?|creates?|builds?|provides?|gives?|makes?|takes?|stores?|runs?|has|have|can|stands?|describes?|measures?|protects?|connects?|automates?|manages?)\b/i.exec(s);
    return m && wordCount(m[1]) <= 4 && !PRONOUN.test(m[1]) ? stripArticle(m[1]) : ''; };
  const subs = body.map(subj), headOf = x => x.toLowerCase().split(/\s+/).pop(), byHead = {};
  subs.forEach((x, i) => { if (x && wordCount(x) >= 2) (byHead[headOf(x)] = byHead[headOf(x)] || []).push(i); });
  // kinds differ in what comes before the shared noun, and not only in its form ("Educational content" and
  // "Education-focused content" are one thing said twice, not two kinds); the topic itself is not one of its kinds
  const mod = x => x.toLowerCase().split(/\s+/).slice(0, -1).join(' ').replace(/[^a-z]/g, '').slice(0, 5);
  const isTopic = x => topic && x.toLowerCase().replace(/[^a-z]/g, '') === topic.toLowerCase().replace(/[^a-z]/g, '');
  let kinds = Object.values(byHead).map(ix => ix.filter(i => !isTopic(subs[i])))
    .filter(ix => ix.length >= 2 && new Set(ix.map(i => mod(subs[i]))).size === ix.length).sort((a, b) => b.length - a.length)[0] || [];
  if (kinds[0] === 0 && kinds.length >= 3) { topic = topic || cap1(subs[0]); kinds = kinds.slice(1); }
  if (kinds.length >= 2) {
    const keep = new Set(kinds);
    concepts.length = 0;
    kinds.forEach(i => concepts.push({ label: cap1(subs[i]), detail: '', source: body[i], members: [], kind: true }));
    context.length = 0; body.forEach((b, i) => { if (!keep.has(i) && b !== definition) context.push(b); });
    if (!definition && body[0] && !keep.has(0)) definition = body[0];
  }
  topic = topic || (heading && wordCount(heading) <= 6 ? heading : '');
  if (concepts.length < 2) return null;
  return { topic, definition, concepts, context };
}

/* ===================== 5. Records: labelled values, kept exactly ===================== */
/* "Project ID: V10_TEST_2026", "Formula:" with the formula on the next line, "Validation requirements:" with bullets
   under it: a record of fields (exact values, never rewritten) and lists. Returns { title, fields: [{ label, value }],
   lists: [{ label, items }] } or null when any line is something else (then the usual reading applies). The same record
   feeds the built-in layouts, the Napkin check (each value must appear exactly) and the Napkin rebuild. */
function recordModel(text) {
  const lines = String(text || '').split('\n').map(l => l.replace(/ /g, ' ').trim());
  const bullet = l => /^(?:[-*•]|\d+[.)])\s+(\S.*)$/.exec(l), rec = { title: '', fields: [], lists: [] };
  let list = null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l) { list = null; continue; }
    const b = bullet(l);
    if (b) { if (!list) return null; list.items.push(b[1].trim()); continue; }
    list = null;
    const kv = /^([^:]{1,40}?):\s+(\S.*)$/.exec(l), head = /^([^:]{1,40}):$/.exec(l);
    if (kv && wordCount(kv[1]) <= 4) { rec.fields.push({ label: kv[1].trim(), value: kv[2].trim() }); continue; }
    if (head && wordCount(head[1]) <= 4) {
      let j = i + 1;
      while (j < lines.length && !lines[j]) j++;
      if (j >= lines.length) return null;
      if (bullet(lines[j])) { list = { label: head[1].trim(), items: [] }; rec.lists.push(list); }
      else { rec.fields.push({ label: head[1].trim(), value: lines[j] }); i = j; }
      continue;
    }
    if (rec.title && l === rec.title) continue;                                       // the heading repeated as the first line
    if (!rec.title && !rec.fields.length && wordCount(l) <= 8 && !/[.!?]$/.test(l)) { rec.title = l; continue; }
    return null;
  }
  // 10.24: a record holds data ("Project ID: V10_TEST_2026", "Owner: Priya", "Price: ₹5,499.50"); points with their
  // descriptions ("Data collection: gather raw data from sources") are a list of concepts, drawn by every layout
  // 10.27: a phrase of four or more words is a description even with a figure in it ("Generate 10 risks across ...",
  // "Align to PMBOK 7 and ISO 31000"): the RCTFC prompt is a list of points, not a record of values
  const data = f => /[=_\\]/.test(f.value) || wordCount(f.value) <= 2 || (wordCount(f.value) <= 3 && /[\d@#$%₹€£()/]/.test(f.value));
  return rec.fields.length >= 3 && rec.fields.filter(data).length * 2 >= rec.fields.length ? rec : null;
}
/* A record drawn natively in R: 'pairs' (a coloured key beside its value, two columns), 'table' (one row per field) or
   'cards' (a card per field); lists as a band of cards under it (or beside a table). Every value exactly as written,
   22 pt; null when it does not fit (the caller tries another arrangement). colors: { label: colour } (Napkin's). */
function recordPrims(R, rec, kind, colors, head) {
  const MIN = TEMPLATE.minBody, lh = MIN * 1.2, out = [], col = (f, i) => (colors && colors[f.label]) || TEMPLATE.accents[i % TEMPLATE.accents.length];
  const hText = (s, w) => linesAt(s, w, MIN) * lh + 16, wordFits = (s, w) => !String(s).split(/\s+/).some(x => x.length * MIN * 0.55 > w - 14.4);
  const F = rec.fields, L = rec.lists.flatMap(l => l.items.map(t => ({ list: l.label, text: t }))), gap = 10;
  let y = R.y;
  if (head) { out.push(box('roundRect', R.x + R.w * 0.25, y, R.w * 0.5, 50, { fill: TEMPLATE.line, text: head, size: fit(head, R.w * 0.5, 50, 28, MIN), bold: true, color: readableOn(TEMPLATE.line), align: 'center', valign: 'middle' })); y += 62; }
  const listBand = (x, y0, w) => {        // the lists as one row of cards, their label first
    if (!L.length) return { prims: [], h: 0 };
    const lab = rec.lists.map(l => l.label).join(' / '), kw = Math.min(240, Math.max(...lab.split(/\s+/).map(t => t.length)) * MIN * 0.56 + 40), cw = (w - kw - gap * L.length) / L.length;
    if (cw < 120 || !L.every(t => wordFits(t.text, cw)) || !wordFits(lab, kw)) return null;
    const h = Math.max(hText(lab, kw), ...L.map(t => hText(t.text, cw)));
    return { h, prims: [box('roundRect', x, y0, kw, h, { fill: TEMPLATE.line, text: lab, size: MIN, bold: true, color: readableOn(TEMPLATE.line), align: 'center', valign: 'middle' })]
      .concat(L.map((t, i) => box('roundRect', x + kw + gap + i * (cw + gap), y0, cw, h, { fill: '#F2F2F2', text: t.text, size: MIN, color: BRAND.ink, align: 'left', valign: 'middle' }))) };
  };
  if (kind === 'pairs' || kind === 'cards') {
    const cols = kind === 'cards' ? Math.min(4, Math.ceil(F.length / 2)) : F.length >= 4 ? 2 : 1, rows = Math.ceil(F.length / cols), cw = (R.w - gap * 2 * (cols - 1)) / cols;
    const kw = kind === 'pairs' ? Math.min(cw * 0.42, Math.max(...F.map(f => Math.max(...f.label.split(/\s+/).map(x => x.length)))) * MIN * 0.56 + 40) : cw, vw = kind === 'pairs' ? cw - kw - 6 : cw;
    if (!F.every(f => wordFits(f.value, vw) && wordFits(f.label, kw))) return null;
    const rh = [];
    for (let r = 0; r < rows; r++) {
      const fs = F.slice(r * cols, r * cols + cols);
      rh.push(kind === 'pairs' ? Math.max(48, ...fs.map(f => Math.max(hText(f.label, kw), hText(f.value, vw))))
        : Math.max(...fs.map(f => hText(f.label, cw))) + Math.max(...fs.map(f => hText(f.value, cw))));
    }
    const band = listBand(R.x, 0, R.w);
    if (band === null) return null;
    const total = rh.reduce((a, b) => a + b, 0) + gap * (rows - 1) + (band.h ? gap * 2 + band.h : 0);
    if (y - R.y + total > R.h) return null;
    y += (R.h - (y - R.y) - total) / 2;
    F.forEach((f, i) => {
      const r = Math.floor(i / cols), c = i % cols, x = R.x + c * (cw + gap * 2), yy = y + rh.slice(0, r).reduce((a, b) => a + b + gap, 0), k = col(f, i);
      if (kind === 'pairs') out.push(box('roundRect', x, yy, kw, rh[r], { fill: k, text: f.label, size: MIN, bold: true, color: readableOn(k), align: 'center', valign: 'middle' }),
        box('roundRect', x + kw + 6, yy, vw, rh[r], { fill: tint(k, 0.8), text: f.value, size: MIN, color: BRAND.ink, align: 'left', valign: 'middle' }));
      else {
        const th = Math.max(...F.slice(r * cols, r * cols + cols).map(g => hText(g.label, cw)));
        out.push(box('roundRect', x, yy, cw, th, { fill: k, text: f.label, size: MIN, bold: true, color: readableOn(k), align: 'center', valign: 'middle' }),
          box('rect', x, yy + th, cw, rh[r] - th, { fill: tint(k, 0.8), text: f.value, size: MIN, color: BRAND.ink, align: 'center', valign: 'middle' }));
      }
    });
    if (band.h) out.push(...listBand(R.x, y + total - band.h, R.w).prims);
    return out;
  }
  // table: one row per field; the lists beside it as stacked cards
  const tw = L.length ? R.w * 0.62 : R.w, kw = Math.min(tw * 0.36, Math.max(...F.map(f => Math.max(...f.label.split(/\s+/).map(x => x.length)))) * MIN * 0.56 + 40), vw = tw - kw - 4;
  if (!F.every(f => wordFits(f.value, vw) && wordFits(f.label, kw))) return null;
  const rh = F.map(f => Math.max(hText(f.label, kw), hText(f.value, vw), 40)), total = rh.reduce((a, b) => a + b + 4, -4);
  const lw = R.w - tw - 24, lt = L.length ? rec.lists.reduce((a, l) => a + hText(l.label, lw) + 6 + l.items.reduce((s, t) => s + hText(t, lw) + 6, 0), 0) : 0;
  if (L.length && (lw < 200 || !L.every(t => wordFits(t.text, lw)))) return null;
  if (y - R.y + Math.max(total, lt) > R.h) return null;
  y += (R.h - (y - R.y) - Math.max(total, lt)) / 2;
  let yy = y;
  F.forEach((f, i) => {
    const k = col(f, i);
    out.push(box('rect', R.x, yy, kw, rh[i], { fill: k, text: f.label, size: MIN, bold: true, color: readableOn(k), align: 'left', valign: 'middle' }),
      box('rect', R.x + kw + 4, yy, vw, rh[i], { fill: i % 2 ? '#FFFFFF' : '#F2F2F2', text: f.value, size: MIN, color: BRAND.ink, align: 'left', valign: 'middle' }));
    yy += rh[i] + 4;
  });
  let ly = y;
  rec.lists.forEach(l => {
    const h = hText(l.label, lw);
    out.push(box('roundRect', R.x + tw + 24, ly, lw, h, { fill: TEMPLATE.line, text: l.label, size: MIN, bold: true, color: readableOn(TEMPLATE.line), align: 'center', valign: 'middle' }));
    ly += h + 6;
    l.items.forEach(t => { const ih = hText(t, lw); out.push(box('roundRect', R.x + tw + 24, ly, lw, ih, { fill: '#F2F2F2', text: t, size: MIN, color: BRAND.ink, align: 'left', valign: 'middle' })); ly += ih + 6; });
  });
  return out;
}
const RECORD = when(sc => !!sc.record, 'needs labelled values (Label: value)');
reg({ key: 'k-pairs', name: 'Key-value pairs', engine: 'A', family: 'k-pairs', fits: RECORD, why: 'Each label beside its exact value; lists underneath.',
  build: (R, sc) => recordPrims(R, sc.record, 'pairs') || [] });
reg({ key: 'k-table', name: 'Field table', engine: 'A', family: 'k-table', fits: RECORD, why: 'One row per field, values exactly as written; lists beside it.',
  build: (R, sc) => recordPrims(R, sc.record, 'table') || [] });
reg({ key: 'k-cards', name: 'Field cards', engine: 'A', family: 'k-cards', fits: RECORD, why: 'A card per field with its exact value.',
  build: (R, sc) => recordPrims(R, sc.record, 'cards') || [] });

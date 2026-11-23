/* AI Visual Builder 10.15 - content with labelled sections ("What you learn: ...", "Best for: ...").
   Course and topic summaries are often written as a title and two or three labelled lists. Read as a plain list they
   lost a whole section (only the last list was kept) or became two cards holding full sentences. Here they are read as
   what they are: a title, a short name for the topic, and named sections whose items are the list's own entries:
     "Artificial Intelligence and Machine Learning (AI & ML)
      What you learn: Neural networks, data mining, predictive modeling, and working with tools like ChatGPT or Python.
      Best for: Building smart apps, data analysis, and high-demand tech careers."
     -> title "Artificial Intelligence and Machine Learning", short "AI & ML",
        What you learn: Neural networks | Data mining | Predictive modeling | ChatGPT or Python
        Best for: Building smart apps | Data analysis | High-demand tech careers
   Nothing is invented: every item is the text's own words (a lead-in such as "working with tools like" is dropped, an
   example list after "like" becomes the item's description, an acronym in brackets becomes the label with the full
   name as its description). Labels glued to the previous line ("Social Media GrowthWhat you learn:") are separated.
   Loaded after gallery.js and plan.js helpers are defined (uses planIcons and planSemantics at run time only). */

// Section labels that are known for sure (a glued label is separated only when it is one of these).
const SECTION_KINDS = [
  ['learn', /^(?:what (?:you(?:'ll|’ll| will)?|students?|learners?|participants?) (?:will )?(?:learn|gain|cover|study|master)|you(?:'ll|’ll| will) learn|key (?:topics|skills|concepts|areas|takeaways)|topics(?: covered)?|skills(?: you(?:'ll| will)? (?:gain|build|learn))?|skills gained|curriculum|modules|syllabus|learning (?:objectives|outcomes)|what(?:'s| is) (?:covered|included)|course content|highlights|core concepts)$/i],
  ['fit', /^(?:best for|ideal for|great for|perfect for|good for|suited (?:for|to)|suitable for|recommended for|designed for|who (?:it'?s|this is|this course is|should (?:take|join|attend|enrol+)(?: it| this)?) (?:for)?|who it is for|for whom|target audience|audience|who should (?:take|join|attend) (?:it|this))$/i],
  ['outcome', /^(?:outcomes?|career (?:paths?|options|opportunities|roles|outcomes)|job roles|roles|you can become|benefits|results|why (?:learn (?:it|this)|it matters)|what you(?:'ll| will) (?:achieve|be able to do)|opportunities)$/i],
  ['tools', /^(?:tools(?: (?:covered|used|you(?:'ll| will) use))?|technologies|tech stack|platforms|languages|software)$/i],
  ['prereq', /^(?:prerequisites?|requirements|before you start|you need|eligibility)$/i],
  ['format', /^(?:duration|format|delivery|mode|certification|level|schedule)$/i],
];
const SECTION_KNOWN_RE = /(What (?:you(?:'ll|’ll| will)?|students?|learners?|participants?) (?:will )?(?:learn|gain|cover|study|master)|You(?:'ll|’ll| will) learn|Key (?:topics|skills|concepts|areas|takeaways)|Topics(?: covered)?|Skills(?: gained)?|Curriculum|Learning (?:objectives|outcomes)|Best for|Ideal for|Great for|Perfect for|Suited (?:for|to)|Suitable for|Recommended for|Who (?:it'?s|this is) for|Who should (?:take|join|attend)(?: it| this)?|Target audience|Outcomes?|Career (?:paths?|options|opportunities|roles|outcomes)|Job roles|Benefits|Tools(?: covered| used)?|Technologies|Tech stack|Prerequisites?|Requirements|Duration|Certification)\s*:/;
const sectionKind = name => (SECTION_KINDS.find(([, re]) => re.test(String(name).trim())) || ['other'])[0];

/* The text with known labels on their own lines: "...GrowthWhat you learn: x" and "... Growth What you learn: x" both
   become "...Growth\nWhat you learn: x". Nothing else changes. */
function sectionsFix(text) {
  // the labels are matched with their capital letter and colon, so "this is best for beginners" is never split
  const re = new RegExp('([^\\n\\s])[ \\t]*(?=' + SECTION_KNOWN_RE.source + ')', 'g');
  return String(text || '').replace(re, '$1\n');
}

const SEC_LINE = /^\s*(?:[-•*▪●◦–]\s*)?([A-Z][A-Za-z'’&/ -]{1,40}?)\s*:\s*(.*)$/;
const secCap = t => t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
// commas, semicolons and bullets at the top level (not inside brackets)
function secSplitTop(t) {
  const out = []; let depth = 0, cur = '';
  for (const ch of t) {
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
    if (!depth && (ch === ',' || ch === ';' || ch === '•')) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map(x => x.trim()).filter(Boolean);
}
const SEC_EXAMPLE = /\s+(?:like|such as|including|e\.g\.,?|for example)\s+/i;
const SEC_GENERIC = /^(?:(?:working|work|hands-on|getting started|practice) with |using |use of |applying )?(?:popular |modern |leading |key |common |industry )?(?:tools?|platforms?|software|languages?|frameworks?|technologies|apps?|applications?)$/i;
/* One list entry -> { label, detail } in the text's words. */
function secItem(raw) {
  let t = String(raw).replace(/^\s*(?:and|or|plus|as well as)\s+/i, '').replace(/[.;:]+$/, '').trim();
  if (!t) return null;
  let detail = '';
  const ex = SEC_EXAMPLE.exec(t);
  if (ex) {
    const head = t.slice(0, ex.index).trim(), tail = t.slice(ex.index + ex[0].length).trim();
    if (SEC_GENERIC.test(head)) t = tail;                                   // "working with tools like ChatGPT or Python" -> "ChatGPT or Python"
    else { t = head.replace(/\s+(?:on|in|with|across|using|via|through)\s+(?:platforms?|tools?|channels?|apps?|sites?)$/i, ''); detail = tail; }   // "audience building on platforms like TikTok and LinkedIn"
  }
  const ac = /^(.{8,}?)\s*\(([A-Z][A-Za-z0-9&/.+-]{1,9})\)$/.exec(t);        // "Search Engine Optimization (SEO)"
  if (ac && ac[1].split(/\s+/).length >= 2) { detail = detail || ac[1].trim(); t = ac[2]; }
  return { label: secCap(t.trim()), detail: secCap(detail) };
}
/* A section's body -> its items: bullet lines, or a comma list ("A, B, and C" / "A, B or C"). */
function secItems(body) {
  const lines = String(body).split('\n').map(l => l.replace(/^\s*(?:[-•*▪●◦–]|\d{1,2}[.)])\s*/, '').trim()).filter(Boolean);
  let parts = lines.length >= 2 ? lines : secSplitTop(lines.join(' ').replace(/\.\s*$/, ''));
  if (parts.length === 1) {
    // "A and B" / "A or B" as a two-item list only when both are short and nothing like "like ..." precedes
    const m = /^([^,]{2,40}?)\s+(?:and|or)\s+([^,]{2,40})$/i.exec(parts[0]);
    if (m && !SEC_EXAMPLE.test(parts[0]) && m[1].split(/\s+/).length <= 4 && m[2].split(/\s+/).length <= 4 && !/\b(?:on|in|with|of|for)\b/i.test(m[1])) parts = [m[1], m[2]];
  }
  return parts.map(secItem).filter(Boolean);
}
/* The topic's short name: an acronym in brackets ("AI & ML"), else a short title, else its first part. */
function secShort(title) {
  const m = /\(([^()]{2,14})\)\s*$/.exec(title);
  if (m) return m[1].trim();
  // 10.21.1: never the first words of a longer name ("The Agile sprint cycle" is not "The Agile"): a leading article goes,
  // up to four words stay, a longer name is cut only where it divides ("X and Y", "X for Y"), else kept whole
  const t = title.replace(/\s*\([^)]*\)\s*$/, '').trim().replace(/^(?:the|a|an)\s+/i, ''), w = t.split(/\s+/);
  if (w.length <= 4) return t;
  const head = t.split(/\s+(?:and|&|for|with|in|of)\s+/i)[0];
  return head.split(/\s+/).length <= 4 && head.split(/\s+/).length >= 2 ? head : t;
}
/* { title, short, intro, sections: [{ name, kind, items: [{label, detail}] }] } or null when the text is not written
   as labelled sections (at least two labelled lists, or one known label with three or more entries). */
function sectionsRead(text) {
  const lines = sectionsFix(text).replace(/\r\n?/g, '\n').split('\n');
  const secs = [], before = [];
  let cur = null;
  for (const raw of lines) {
    const l = raw.trim();
    if (!l) continue;
    const m = SEC_LINE.exec(l), known = m && sectionKind(m[1]) !== 'other';
    if (m && (known || m[1].split(/\s+/).length <= 4) && (m[2].trim() || known)) {
      cur = { name: m[1].trim(), kind: sectionKind(m[1]), body: m[2].trim(), known };
      secs.push(cur);
    } else if (cur) cur.body += '\n' + l;
    else before.push(l);
  }
  if (!secs.length) return null;
  // 10.23: an outcome written as one sentence ("Outcome: Gain insights into needs, priorities, and assumptions") is one
  // statement, not a list of its commas
  const sentence = s => /^(?:outcomes?|results?|impact|goals?|purpose)$/i.test(s.name.trim()) && !/\n/.test(s.body.trim()) && s.body.split(/[,;]/)[0].trim().split(/\s+/).length >= 4;
  secs.forEach(s => { s.items = sentence(s) ? [{ label: secCap(s.body.trim().replace(/[.;:]+$/, '')), detail: '' }] : secItems(s.body); });
  const usable = secs.filter(s => s.items.length >= 1);
  const ok = usable.length >= 2 && usable.filter(s => s.known).length >= 1 && usable.every(s => s.items.length <= 8) ||
    usable.length === 1 && usable[0].known && usable[0].items.length >= 3 && usable[0].items.length <= 8;
  if (!ok || usable.length > 4 || before.length > 2 || before.some(l => l.length > 160)) return null;
  if (usable.reduce((a, s) => a + s.items.length, 0) > 12) return null;
  const head = (before[0] || '').replace(/^#+\s*/, '').replace(/[:.]\s*$/, '').trim();
  const title = head.replace(/\s*\([^)]*\)\s*$/, '').trim() || head;
  return { title: head ? title : '', full: head, short: head ? secShort(head) : '', intro: before.slice(1).join(' '),
    sections: usable.map(s => ({ name: s.name.replace(/\s+/g, ' '), kind: s.kind, items: s.items })) };
}
/* The sections as the panel's preparation (what Napkin and Claude are sent, and what a result must show). */
function sectionsPrep(SX, text) {
  const points = [], parts = [SX.full || SX.title].filter(Boolean);
  if (SX.intro) parts.push(SX.intro);
  SX.sections.forEach(s => {
    parts.push(s.name + (s.note ? ` (${s.note})` : '') + ':\n' + s.items.map(it => '- ' + it.label + (it.detail ? ': ' + it.detail : '')).join('\n'));
    s.items.forEach(it => points.push({ label: it.label, detail: it.detail, group: s.name }));
  });
  const concepts = [...new Set(points.map(p => p.label))];
  const context = (SX.title ? `Topic: ${SX.title}. ` : '') + `Show ${SX.sections.length > 1 ? 'these ' + SX.sections.length + ' named sections' : 'this named section'}, each with its items under its own heading: ` +
    SX.sections.map(s => `${s.name} (${s.items.map(i => i.label).join('; ')})`).join('; ') + '. Show the whole content in one visual, as a modern, engaging educational infographic' +
    ' with an object for each item. Use the wording of the text; do not add facts, figures or items.';
  const st = SX.statement, ctx2 = st ? `One statement about ${st.subject}: show ${st.subject} as the hero` + (st.verbs.length ? `, what it does (${st.verbs.join(', ')})` : '') +
    ` and ${st.object ? 'the ' + st.object : 'its examples'} as ${SX.sections[0].items.length} items with an object each: ${SX.sections[0].items.map(i => i.label).join('; ')}. A modern, engaging educational infographic; ` +
    'use the wording of the text; do not add facts, figures or items, and do not repeat the sentence as a block of text.' : '';
  return { content: st ? st.text : parts.join('\n\n'), concepts, ordered: false, list: true, points, headings: SX.sections.map(s => s.name).filter(Boolean), source: text, context: (ctx2 || context).slice(0, 900),
    record: null, title: SX.title, short: SX.short, sections: SX.sections, statement: st || null, paragraph: !!SX.paragraph, lead: SX.lead || '', intro: SX.intro || '' };
}
/* The plan of sectioned content: one group per section (its name drawn as the group's heading), every item in it. */
function sectionsPlan(SX) {
  const sc = t => typeof sentenceCase === 'function' ? sentenceCase(t) : t;     // 10.19: LVC sentence case (brand.js)
  const groups = SX.sections.map((s, i) => ({ id: 's' + i, name: sc(s.name), role: 'category', kind: s.kind }));
  const items = [];
  SX.sections.forEach((s, i) => s.items.forEach(it => items.push({ id: 'p' + items.length, label: sc(planClean(it.label)), detail: planClean(it.detail || ''), group: 's' + i })));
  planIcons(items);
  const st = SX.statement || null;
  // 10.21.1: two named sides the text compares (Pros / Cons, Before / After, X vs Y, the same attributes side by side)
  const rel = groups.length === 2 && typeof planRelation === 'function' ? planRelation({ title: SX.title, full: SX.full || SX.title, items, groups: groups.map(g => g.name),
    groupItems: SX.sections.map(s => s.items.map(it => it.label + ' ' + (it.detail || ''))) }) : { relation: '', why: '' };
  const cmp = rel.relation === 'comparison';
  return planSemantics({ title: SX.title, headline: SX.title, takeaway: SX.paragraph && SX.lead && SX.lead.length <= 140 ? SX.lead.replace(/[.!]\s*$/, '') : '', hero: heroFor(SX.short, SX.full || SX.title), short: SX.short, statement: st, verbs: st ? st.verbs : [],
    relation: cmp ? 'comparison' : groups.length >= 2 ? 'categories' : 'independent', relationWhy: cmp ? rel.why : '', items, groups: groups.length >= 2 ? groups : [], flow: [], layouts: [], from: 'text', sections: true, paragraph: !!SX.paragraph,
    sectionName: groups.length === 1 ? groups[0].name : '',
    intro: SX.paragraph ? '' : String(SX.intro || '').trim() });   // 10.23: the topic's one-line description (packs/spotlight-10.23.js)
}
/* The object for a whole topic: its short name first ("AI & ML" -> the brain, "Digital Marketing" -> the megaphone),
   then its full title; '' when the catalogue has no accurate one. */
function heroFor(short, title, more) {
  for (const t of [short, title, more]) {
    if (!t) continue;
    const best = conceptScores(t, '').find(x => x.score >= 3 && CMP[x.key]);
    if (best) return best.key;
  }
  return '';
}

/* ---------- one statement (V10.16) ----------
   "Claude ai helps you create, organize, and edit diverse types of content - from written copy and code-based animations
   to presentations and AI-marked text" is not a banner of text: it names a subject (Claude AI), what it does (create,
   organize, edit), on what (diverse types of content) and the examples (written copy, code-based animations, ...).
   statementRead returns that in the shape of sectionsRead (one section, the examples as its items) plus
   { statement: { subject, verbs, object, text } }, or null when the sentence has no list a visual can show. Every word
   shown comes from the sentence; nothing is added. */
const ST_ACRO = /\b(ai|ml|ui|ux|api|apis|seo|aws|gcp|iot|vr|llm|llms|nlp|crm|erp|sql)\b/gi;
const stAcro = t => String(t).replace(ST_ACRO, m => /^(?:apis|llms)$/i.test(m) ? m.slice(0, -1).toUpperCase() + 's' : m.toUpperCase());
const ST_VERB = /\s(?:helps?|lets?|enables?|allows?|empowers?|supports?|provides?|offers?|gives?|makes?|turns?|uses?|includes?|covers?|delivers?|automates?|transforms?|combines?|connects?|teaches?|shows?|explores?|features?|spans?|involves?|focuses on|consists of|comprises?|can|will|is|are)\s/i;
const ST_WHO = /^(?:you|users?|teams?|learners?|students?|people|businesses|organi[sz]ations|developers|creators|marketers|professionals|companies|everyone)\s+(?:to\s+)?/i;
const ST_LIST_AT = [/\s*[—–]\s*|\s+-{1,2}\s+/, /\s+(?:such as|including|like|e\.g\.,?|for example,?|for instance,?)\s+/i, /:\s+/];
function stSplitList(t) {
  t = t.replace(/^from\s+/i, '').replace(/[.;!]+\s*$/, '').trim();
  // "from A and B to C and D": "to" divides the range; then commas, "and", "or"
  const parts = (/^(?!.*\bto\b.*\bto\b)/.test(t) ? t.split(/\s+to\s+/i) : [t]).flatMap(p => secSplitTop(p))
    .flatMap(p => p.split(/\s+(?:and|or|as well as|plus)\s+/i)).map(p => p.replace(/^(?:and|or)\s+/i, '').trim()).filter(Boolean);
  return parts;
}
function statementRead(text) {
  const raw = String(text || '').replace(/\r\n?/g, '\n').trim();
  if (!raw || raw.length > 420) return null;
  let lines = raw.split('\n').map(l => l.trim()).filter(Boolean), head = '', abbr = '';
  // 10.17: a slide's title and subtitle above the sentence ("Artificial Intelligence" / "AI" / "The best content ...")
  const isHead = l => l.split(/\s+/).length <= 8 && !/[.!?]$/.test(l) && !ST_VERB.test(' ' + l + ' ');
  if (lines.length === 3 && isHead(lines[0]) && isHead(lines[1]) && lines[1].split(/\s+/).length <= 4) {
    head = lines[0].replace(/[:.]\s*$/, ''); abbr = lines[1].replace(/[:.()]/g, '').trim(); lines = [lines[2]]; }
  if (lines.length === 2 && lines[0].split(/\s+/).length <= 8 && !/[.!?]$/.test(lines[0])) { head = lines[0].replace(/[:.]\s*$/, ''); lines = [lines[1]]; }
  if (lines.length !== 1 || /^\s*(?:[-•*▪●◦–]|\d{1,2}[.)])\s/.test(lines[0])) return null;
  const s = lines[0].replace(/\s+/g, ' ');
  if ((s.match(/[.!?](?:\s|$)/g) || []).length > 2) return null;
  // where the examples start
  let at = null;
  for (const re of ST_LIST_AT) { const m = re.exec(s); if (m && m.index > 12) { at = { i: m.index, j: m.index + m[0].length }; break; } }
  // 10.18: a list between two dashes ("content—such as text, images, and code—in response to prompts") ends at the
  // second dash; what follows is part of the statement (kept in the heading); a lead-in ("such as") is not an item
  let listPart = at ? s.slice(at.j) : '', tail = '';
  if (at) { const k = /\s*[—–]\s*|\s+-{1,2}\s+/.exec(listPart); if (k && k.index > 2) { tail = listPart.slice(k.index + k[0].length).replace(/[.;!]+\s*$/, '').trim(); listPart = listPart.slice(0, k.index); } }
  listPart = listPart.replace(/^(?:such as|including|like|e\.g\.,?|for example,?|for instance,?)\s+/i, '');
  let first = (at ? s.slice(0, at.i) : s).replace(/[,.]\s*$/, '').trim(), list = at ? stSplitList(listPart) : [];
  // no lead-in: a list at the end of the sentence ("... used for web development, data science, and automation")
  if (!at) { const m = /^(.*\s(?:for|in|of|with|to|on|across|into|like)\s)((?:[^,]{2,40},\s+)+(?:and\s+|or\s+)?[^,]{2,40})$/i.exec(first.replace(/[.!]\s*$/, ''));
    if (m) { first = m[1].trim(); list = stSplitList(m[2]); } }
  // the subject: the words before the first verb
  const v = ST_VERB.exec(' ' + first + ' ');
  if (!v || v.index < 1) return null;
  const subject = stAcro(first.slice(0, v.index).trim()).replace(/^(?:the|a|an)\s+/i, '');
  if (!subject || subject.split(/\s+/).length > 5) return null;
  const main = v[0].trim().toLowerCase(), helper = /^(?:helps?|lets?|enables?|allows?|empowers?|can|will)$/.test(main);
  let rest = first.slice(v.index + v[0].length - 1).trim();
  // "lets analysts connect, ..." - who it helps is not a verb
  if (helper) rest = rest.replace(ST_WHO, '').replace(/^(?!(?:[a-z]+,|[a-z]+\s+(?:and|or)\s))[a-z]+\s+(?:to\s+)?(?=(?:[a-z]+,\s+)+(?:and\s+|or\s+)?[a-z]+\s)/i, '');
  // a list of verbs ("create, organize, and edit") and what they act on - only after "helps", "lets", "can", ...
  let verbs = [], object = rest, nouns = [];
  const vm = /^((?:[a-z-]+,\s+)+(?:and\s+|or\s+)?[a-z-]+|[a-z-]+\s+(?:and|or)\s+[a-z-]+)\s+(.+)$/i.exec(rest);
  if (vm) { const L = vm[1].split(/,\s*|\s+(?:and|or)\s+/).map(x => x.replace(/^(?:and|or)\s+/i, '').trim()).filter(Boolean);
    if (helper) verbs = L; else nouns = L;
    object = vm[2]; }
  object = object.replace(/[.,;]\s*$/, '').replace(/^(?:of|for|in)\s+/i, '').replace(/\s+(?:from|for|in|with|on|across|into|like)(?:\s+(?:sources?|areas?|fields?|things|tools?|platforms?))?$/i, '').trim();
  let items = list.filter(x => x.split(/\s+/).length <= 6);
  if (items.length !== list.length) items = [];
  let usesVerbs = false, multi = false;
  // 10.17: "covers foundational concepts, everyday writing and research assistants, and structured learning courses" -
  // a list of several-word items straight after the verb (commas divide it; "and" inside an item stays)
  if (items.length < 2 && nouns.length < 2 && !helper && !/^(?:is|are)$/.test(main) && /,/.test(rest)) {
    const L = secSplitTop(rest.replace(/[.;!]+\s*$/, '')).map(x => x.trim().replace(/^(?:and|or)\s+/i, '').trim()).filter(Boolean);
    if (L.length >= 2 && L.length <= 8 && L.every(x => x.split(/\s+/).length <= 6)) { items = L; nouns = L; multi = true; object = ''; }
  }
  if (items.length < 2 && nouns.length >= 2) { items = nouns; verbs = [main]; }
  else if (items.length < 2 && verbs.length >= 3) { items = verbs.slice(); usesVerbs = true; }
  else if (!helper && !/^(?:is|are)$/.test(main)) verbs = [main];
  if (items.length < 2 || items.length > 8) return null;
  // the heading: the sentence's own words for what it does and on what ("create, organize, and edit diverse types of
  // content"), so a design that shows only the heading still says everything; else the object alone
  const phrase = helper && verbs.length && !usesVerbs ? rest.replace(/[.,;]\s*$/, '').replace(/\s+(?:from|for|in|with|on|across|into|like)(?:\s+(?:sources?|areas?|fields?|things|tools?|platforms?))?$/i, '').trim() : '';
  // "automates deployment, scaling, and management of containerized applications": the verb, then what the items belong to
  const ofPart = !helper && nouns.length >= 2 && verbs.length === 1 ? (/^\s*(of|for|in|on|across)\s/i.exec(first.slice(first.indexOf(nouns[nouns.length - 1]) + nouns[nouns.length - 1].length)) || [])[1] : '';
  const lead = multi ? first.slice(0, v.index + v[0].length - 1).trim() : '';
  const named1 = phrase && phrase.length <= 56 ? phrase : ofPart && object ? `${main} … ${ofPart.toLowerCase()} ${object}` : multi ? (lead.length <= 56 ? lead : `${subject} ${main}`) : object;
  // 10.18: the rest of the sentence after a dash-enclosed list belongs to the heading (when it stays readable)
  const named0 = tail && named1 && (named1 + ' ' + tail).length <= 110 ? named1.replace(/[,.]\s*$/, '') + ' ' + tail : named1;
  const sec = { name: secCap(named0), kind: 'other', items: items.map(x => ({ label: secCap(stAcro(x)), detail: '' })) };
  if (!sec.name || sec.name.length > 110) sec.name = '';   // 10.18: 110 (was 56) - a heading may take two lines
  // the hero names the topic: the slide's subtitle when it is the title's abbreviation ("AI"), else the title's short
  // form, else the sentence's subject
  const short = abbr && abbr.length <= 12 ? abbr : head ? secShort(head) : subject;
  return { title: head || subject, full: head || subject, short, abbr, intro: '', sections: [sec],
    statement: { subject, verbs: usesVerbs ? [] : verbs.map(secCap), object, text: s, head: head || '' } };
}
/* ---------- a paragraph of several sentences (V10.19) ----------
   "Cloud computing delivers computing services over the internet ... . It offers three main service models: IaaS
   provides ...; PaaS provides ...; and SaaS delivers ... . Key benefits include A, B, C and D. Organizations can choose
   public, private or hybrid cloud deployments depending on ..." was read as its first list only (V10.18: the benefits
   and deployment options were in no design). Now: the topic (the first sentence's subject), its lead idea (a sentence
   without a list) and one section per sentence that names a list, the section's name in the sentence's own words
   ("three main service models" -> "Service models"). Same shape as sectionsRead; nothing is added. */
const PA_COUNT = /^(?:the\s+)?(?:two|three|four|five|six|seven|eight|nine|ten|several|many|various|\d+)\s+/i;
const PA_QUAL = /^(?:main|key|major|core|primary|basic|important|common|different|essential)\s+/i;
const PA_INCL = /^(.{3,70}?)\s+(?:include|includes|including|are|cover|covers|consist of|consists of|comprise|comprises|span|spans|range from|ranges from)\s+(.+)$/i;
const PA_TAIL = /\s+(?:depending|based|according|for|to|in|on|that|which|so|because|when|if|across|within|with)\b/i;
const paSentences = t => t.replace(/\s+/g, ' ').trim().split(/(?<=[a-z0-9)\]][.!?])\s+(?=[A-Z(])/).map(s => s.trim()).filter(Boolean);
function paName(t) {
  t = String(t).replace(/^(?:it|they|this|these|the course|the program(?:me)?|you|we|there)\s+/i, '').replace(ST_VERB, ' ').trim();
  const v = ST_VERB.exec(' ' + t + ' ');
  if (v && v.index < t.length) t = t.slice(v.index + v[0].length - 1).trim();
  t = t.replace(/^(?:the|a|an)\s+/i, '').replace(PA_COUNT, '').replace(PA_QUAL, '').replace(/[,:;.]+$/, '').trim();
  return t && t.split(/\s+/).length <= 6 ? secCap(stAcro(t)) : '';
}
/* "Infrastructure as a Service (IaaS) provides virtual machines, storage and networks" -> IaaS: what it provides */
function paClause(c) {
  c = c.replace(/^\s*(?:and|or|plus)\s+/i, '').replace(/[.;]+\s*$/, '').trim();
  const v = ST_VERB.exec(' ' + c + ' ');
  if (!v || v.index < 1) { const it = secItem(c); return it && it.label.split(/\s+/).length <= 7 ? it : null; }
  const head = c.slice(0, v.index).trim(), rest = c.slice(v.index + v[0].length - 1).trim();
  if (head.split(/\s+/).length > 7) return null;
  const it = secItem(head);
  const verb = v[0].trim();
  return { label: it.label, detail: secCap((it.detail ? it.detail + ': ' : '') + verb + ' ' + rest) };
}
function paragraphRead(text) {
  const raw = String(text || '').replace(/\r\n?/g, '\n').trim();
  if (!raw || raw.length > 2400) return null;
  let lines = raw.split('\n').map(l => l.trim()).filter(Boolean), head = '';
  if (lines.length >= 2 && lines[0].split(/\s+/).length <= 8 && !/[.!?]$/.test(lines[0]) && !ST_VERB.test(' ' + lines[0] + ' ')) head = lines.shift().replace(/[:.]\s*$/, '');
  if (lines.some(l => /^\s*(?:[-•*▪●◦–]|\d{1,2}[.)])\s/.test(l))) return null;     // bullet points: sectionsRead / the list readers
  const S = paSentences(lines.join(' '));
  if (S.length < 2) return null;
  const secs = [], lead = [];
  let subject = '';
  for (const s0 of S) {
    const s = s0.replace(/[.!?]+$/, '').trim();
    if (!subject) { const v = ST_VERB.exec(' ' + s + ' '); if (v && v.index > 0) { const sj = stAcro(s.slice(0, v.index).trim()).replace(/^(?:the|a|an)\s+/i, ''); if (sj.split(/\s+/).length <= 5) subject = sj; } }
    let sec = null, m;
    if ((m = /^(.{6,}?):\s+(.+)$/.exec(s))) {                                     // "It offers three main service models: A ...; B ...; and C ..."
      const body = m[2], parts = body.includes(';') ? body.split(/;\s*/) : stSplitList(body);
      const items = parts.map(p => body.includes(';') ? paClause(p) : secItem(p)).filter(Boolean);
      sec = { name: paName(m[1]), items };
    } else if ((m = PA_INCL.exec(s)) && /,|\s(?:and|or)\s/.test(m[2])) {           // "Key benefits include A, B, C and D"
      const L = stSplitList(m[2]);
      if (L.every(x => x.split(/\s+/).length <= 6)) sec = { name: secCap(stAcro(m[1].replace(/^(?:the|its|their)\s+/i, ''))), items: L.map(secItem).filter(Boolean) };
    } else if ((m = /\b((?:[A-Za-z][\w-]*,\s+)+(?:[A-Za-z][\w-]*,?\s+)?(?:and|or)\s+[A-Za-z][\w-]*)\s+([a-z][\w -]{2,40}?)(?=(?:\s+(?:depending|based|according|for|to|in|on|that|which|so|because|when|if|across|within|with)\b)|$)(.*)$/.exec(s))) {
      // "Organizations can choose public, private or hybrid cloud deployments depending on ..."
      const L = m[1].split(/,\s*|\s+(?:and|or)\s+/).map(x => x.trim()).filter(Boolean);
      if (L.length >= 2 && L.length <= 8) sec = { name: secCap(stAcro(m[2].trim())), items: L.map(x => ({ label: secCap(stAcro(x)), detail: '' })), note: m[3].trim() };
    }
    if (sec && sec.name && sec.items.length >= 2 && sec.items.length <= 8) secs.push(sec);
    else lead.push(s0);
  }
  const total = secs.reduce((a, x) => a + x.items.length, 0);
  if (secs.length < 2 || total > 14 || new Set(secs.map(x => x.name.toLowerCase())).size !== secs.length) return null;
  const title = head || subject;
  if (!title) return null;
  return { title, full: title, short: secShort(title), intro: lead.join(' '), lead: lead[0] || '', paragraph: true,
    sections: secs.map(x => ({ name: x.name, kind: sectionKind(x.name), items: x.items, note: x.note || '' })) };
}
/* What the text is: labelled sections, else a paragraph of several lists (10.19), else one statement with a list, else null (V10.16). */
const contentRead = text => sectionsRead(text) || paragraphRead(text) || statementRead(text);

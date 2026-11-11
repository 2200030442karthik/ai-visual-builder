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
  const t = title.replace(/\s*\([^)]*\)\s*$/, '').trim(), w = t.split(/\s+/);
  if (w.length <= 3) return t;
  const head = t.split(/\s+(?:and|&|for|with|in|of)\s+/i)[0];
  return head.split(/\s+/).length <= 3 ? head : w.slice(0, 2).join(' ');
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
  secs.forEach(s => { s.items = secItems(s.body); });
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
    parts.push(s.name + ':\n' + s.items.map(it => '- ' + it.label + (it.detail ? ': ' + it.detail : '')).join('\n'));
    s.items.forEach(it => points.push({ label: it.label, detail: it.detail, group: s.name }));
  });
  const concepts = [...new Set(points.map(p => p.label))];
  const context = (SX.title ? `Topic: ${SX.title}. ` : '') + `Show ${SX.sections.length > 1 ? 'these ' + SX.sections.length + ' named sections' : 'this named section'}, each with its items under its own heading: ` +
    SX.sections.map(s => `${s.name} (${s.items.map(i => i.label).join('; ')})`).join('; ') + '. Show the whole content in one visual, as a modern, engaging educational infographic' +
    ' with an object for each item. Use the wording of the text; do not add facts, figures or items.';
  return { content: parts.join('\n\n'), concepts, ordered: false, list: true, points, headings: SX.sections.map(s => s.name), source: text, context: context.slice(0, 900),
    record: null, title: SX.title, short: SX.short, sections: SX.sections };
}
/* The plan of sectioned content: one group per section (its name drawn as the group's heading), every item in it. */
function sectionsPlan(SX) {
  const groups = SX.sections.map((s, i) => ({ id: 's' + i, name: s.name, role: 'category', kind: s.kind }));
  const items = [];
  SX.sections.forEach((s, i) => s.items.forEach(it => items.push({ id: 'p' + items.length, label: planClean(it.label), detail: planClean(it.detail || ''), group: 's' + i })));
  planIcons(items);
  return planSemantics({ title: SX.title, headline: SX.title, takeaway: '', hero: heroFor(SX.short, SX.full || SX.title), short: SX.short,
    relation: groups.length >= 2 ? 'categories' : 'independent', items, groups: groups.length >= 2 ? groups : [], flow: [], layouts: [], from: 'text', sections: true,
    sectionName: groups.length === 1 ? groups[0].name : '' });
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

/* AI Visual Builder - visual-quality benchmark (V10.16, V10.17: the AI slide text), run in the real panel by tests/run_bench.py through
   run_probe.py (stand-in PowerPoint, AI services off: no network, no credits). For each example text it presses
   Generate, then "More visuals", and measures every design in the gallery:
     objects   pictorial objects drawn (0 = text in boxes only)
     minPt     smallest text size
     issues    layout problems found by the panel's own checker (overlap, clipping, outside the area)
     missing   key facts of the text that no text of the design shows
   and the gallery as a whole: distinct categories, families repeated, and pairs of designs that look the same (the
   same coloured areas AND texts in similar places). Self-contained, so the same file measures an older version. */
const R = W.eval('Object.assign({}, TEMPLATE.contentArea)'), A = W.__app, d = W.document;
const EX = {
  genai: { text: 'Generative AI (GenAI) is a branch of artificial intelligence that creates original content—such as text, images, video, audio, and code—in response to natural language prompts',
    facts: ['Generative AI', 'Text', 'Images', 'Video', 'Audio', 'Code', 'natural language prompts'] },
  ai: { text: 'Artificial Intelligence\nAI\nThe best content about artificial intelligence covers foundational concepts, everyday writing and research assistants, and structured learning courses',
    facts: ['AI', 'covers', 'foundational concepts', 'everyday writing and research assistants', 'structured learning courses'] },
  claude: { text: 'Claude ai helps you create, organize, and edit diverse types of content—from written copy and code-based animations to presentations and AI-marked text',
    facts: ['Claude', 'create', 'organize', 'edit', 'written copy', 'code-based animations', 'presentations', 'AI-marked text'] },
  aiml: { text: 'Artificial Intelligence and Machine Learning (AI & ML)\n\nWhat you learn: Neural networks, data mining, predictive modeling, and working with tools like ChatGPT or Python.\n\nBest for: Building smart apps, data analysis, and high-demand tech careers.',
    facts: ['AI & ML|Artificial Intelligence', 'What you learn', 'Best for', 'Neural networks', 'Data mining', 'Predictive modeling', 'ChatGPT', 'Python', 'smart apps', 'Data analysis', 'tech careers'] },
  dm: { text: 'Digital Marketing and Social Media Growth\nWhat you learn: Search Engine Optimization (SEO), paid advertising, email campaigns, and audience building on platforms like TikTok and LinkedIn.\nBest for: Launching side hustles, promoting brands, or growing digital content.',
    facts: ['Digital Marketing', 'What you learn', 'Best for', 'SEO', 'Paid advertising', 'Email campaigns', 'Audience building', 'TikTok', 'LinkedIn', 'side hustles', 'brands', 'digital content'] },
  k8s: { text: 'Kubernetes automates deployment, scaling, and management of containerized applications.',
    facts: ['Kubernetes', 'automates', 'deployment', 'scaling', 'management', 'containerized applications'] },
};
// the same stand-in host as tests/app.html: signed in, Content_Slide selected, both AI services off
const ACC = `access: { configured: true, mode: 'windows', authorized: true, user: 'test', reason: '', template: { layout_name: 'Content_Slide', fingerprint: { shapes: { 'content placeholder': [101.7, 205, 1078.5, 435.2], 'heading placeholder': [101.7, 119.1, 1078.5, 71.2], 'section tag strip': [1287.2, 0, 80.8, 720.3] }, tolerance: 3 } } }`;
W.eval(`api = async () => ({ server: 'bench', ${ACC}, napkin: { configured: false, enabled: false }, claude: { configured: false, enabled: false }, orchestrate: { paid: 'never', order: 'auto' } }); 1`);
try { W.localStorage.clear(); W.localStorage.setItem('aivb.paidPolicy', 'never'); } catch (e) { /* none */ }
W.__mock.layoutName = 'Content_Slide';
await W.eval('refreshStatus()'); await W.eval('checkSlide()'); W.eval('showGate(); updateButtons(); 1');

const cells = (prims, test, nx, ny) => { const G = new Set(), CW = R.w / nx, CH = R.h / ny;
  prims.forEach(p => { if (!test(p)) return; for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const cx = R.x + (i + 0.5) * CW, cy = R.y + (j + 0.5) * CH; if (cx >= p.x && cx <= p.x + p.w && cy >= p.y && cy <= p.y + p.h) G.add(i + ',' + j); } }); return G; };
const jac = (a, b) => { if (!a.size && !b.size) return 1; let n = 0; a.forEach(k => { if (b.has(k)) n++; }); return n / (a.size + b.size - n); };
// what a design looks like: the panel's own measure when it has one (10.17: cells also say light panel or colour)
const shapePrint = W.eval('typeof orchShapePrint === "function"') ? W.eval('orchShapePrint') : null;
const look = prims => ({ sp: shapePrint ? shapePrint(prims) : cells(prims, p => p.t === 'shape' && p.fill && !/^#F{6}$/i.test(p.fill) && !p.cmp, 24, 10),
  fp: new Set(prims.filter(p => p.text && p.w > 0).map(p => Math.round((p.x + p.w / 2 - R.x) / R.w * 16) + ',' + Math.round((p.y + p.h / 2 - R.y) / R.h * 8))) });
const same = (a, b) => jac(a.sp, b.sp) >= 0.72 && jac(a.fp, b.fp) >= 0.45;
const vq = W.eval('typeof visualQuality === "function" && typeof qualityItems === "function"') ? W.eval('(p, R) => visualQuality(qualityItems(p), R)') : null;
function measure(c, facts) {
  const prims = c.prims || [], texts = prims.filter(p => p.text).map(p => String(p.text)).join('\n').toLowerCase();
  const q = vq ? vq(prims, R) : null;
  return { name: String(c.title || c.name || '').replace(/ · .*$/, ''), category: c.category || '', family: c.family || '', engine: c.engine || '', edit: c.edit || '',
    objects: new Set(prims.filter(p => p.cmp && p.cmp !== 'none').map(p => p.grp)).size, shapes: prims.length,
    minPt: Math.min(99, ...prims.filter(p => p.text).map(p => p.size || 99)), issues: q ? (q.block || []).length : -1,
    missing: facts.filter(f => !f.split('|').some(x => texts.includes(x.toLowerCase()))) };
}
const out = {}, svg = {};
for (const [k, ex] of Object.entries(EX)) {
  A.ORCH.memo.clear(); W.eval('state.runText = ""; state.sections = []; 1');
  d.getElementById('content').value = ex.text; d.getElementById('content').dispatchEvent(new W.Event('input'));
  await A.appGenerate();
  const first = A.APP.list.slice();
  const more = await W.eval('orchMore')(d.getElementById('content').value.trim(), () => {});
  const added = more && more.fresh ? more.list.slice(0, more.fresh) : [];
  const all = first.concat(added), looks = all.map(c => look(c.prims || []));
  const pairs = []; for (let i = 0; i < all.length; i++) for (let j = 0; j < i; j++) if (same(looks[i], looks[j])) pairs.push([j, i]);
  const fams = all.map(c => (c.family || c.title || '').replace(/ · .*$/, '')), famRep = fams.filter((f, i) => fams.indexOf(f) !== i).length;
  out[k] = { generate: first.length, more: added.length, designs: all.map(c => measure(c, ex.facts)), lookAlikePairs: pairs.length, pairs,
    categories: new Set(all.map(c => c.category)).size, familyRepeats: famRep };
  all.forEach((c, i) => { svg[`${k}-${String(i).padStart(2, '0')}${i >= first.length ? '-more' : ''}`] = W.toSVG(c.prims, 1280, 720); });
}
return { out, svg };

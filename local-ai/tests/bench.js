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
  // 10.19: large text - a paragraph of several sentences, and a slide of eight labelled points
  cloud: { text: 'Cloud computing delivers computing services over the internet so organizations no longer need to own and maintain physical data centers. ' +
      'It offers three main service models: Infrastructure as a Service (IaaS) provides virtual machines, storage and networks; Platform as a Service (PaaS) provides tools to build and deploy applications; ' +
      'and Software as a Service (SaaS) delivers ready-to-use applications through a browser. Key benefits include lower upfront costs, on-demand scalability, global availability and faster innovation. ' +
      'Organizations can choose public, private or hybrid cloud deployments depending on their security, compliance and cost needs.',
    facts: ['Cloud computing', 'IaaS|Infrastructure as a Service', 'PaaS|Platform as a Service', 'SaaS|Software as a Service', 'lower upfront costs', 'scalability', 'global availability', 'faster innovation', 'public', 'private', 'hybrid'] },
  dslife: { text: 'Data Science Lifecycle\n- Problem definition: understand the business question and success metrics\n- Data collection: gather data from databases, APIs and files\n' +
      '- Data cleaning: handle missing values, duplicates and outliers\n- Exploratory analysis: find patterns with statistics and charts\n- Feature engineering: create variables that improve the model\n' +
      '- Modeling: train and compare machine learning algorithms\n- Evaluation: measure accuracy, precision and recall\n- Deployment: put the model into production and monitor it',
    facts: ['Data Science Lifecycle', 'Problem definition', 'Data collection', 'Data cleaning', 'Exploratory analysis', 'Feature engineering', 'Modeling', 'Evaluation', 'Deployment'] },
  // 10.21.1: realistic LVC slide texts - short, long, structured, dense - and two whose relation must be read right
  lvcShort: { text: 'Benefits of Python\n- Easy to learn\n- Large ecosystem of libraries\n- Strong community support',
    facts: ['Python', 'Easy to learn', 'Large ecosystem of libraries', 'Strong community support'] },
  lvcLong: { text: 'Machine learning lets computers learn patterns from data instead of following hand-written rules. In supervised learning, a model is trained on labelled examples so it can predict ' +
      'outcomes for new data, such as classifying emails as spam. Unsupervised learning finds hidden structure in unlabelled data, for example grouping customers into segments. ' +
      'Reinforcement learning trains an agent through rewards and penalties as it interacts with an environment, which is how game-playing systems improve.',
    facts: ['Machine learning', 'Supervised learning', 'Unsupervised learning', 'Reinforcement learning'] },
  lvcStructured: { text: 'Project Management Professional (PMP)\nWhat you learn: Agile and hybrid approaches, risk management, stakeholder engagement, scheduling and budgeting.\nBest for: Project managers, team leads and consultants preparing for the PMP exam.',
    facts: ['What you learn', 'Best for', 'Risk management', 'Stakeholder engagement', 'Project managers', 'Team leads', 'Consultants'] },
  lvcCompare: { text: 'SQL vs NoSQL databases\nSQL: Fixed schema, vertical scaling, strong consistency\nNoSQL: Flexible schema, horizontal scaling, eventual consistency',
    facts: ['SQL', 'NoSQL', 'Fixed schema', 'Flexible schema', 'Vertical scaling', 'Horizontal scaling', 'Strong consistency', 'Eventual consistency'] },
  lvcDense: { text: 'Cybersecurity fundamentals\n1. Confidentiality: only authorised people can read the data\n2. Integrity: data is not altered without permission\n3. Availability: systems stay up when users need them\n' +
      '4. Authentication: users prove who they are with passwords, tokens or biometrics\n5. Authorisation: each user gets only the access their role needs\n6. Encryption: data is unreadable without the key, at rest and in transit\n' +
      '7. Patching: known vulnerabilities are fixed quickly\n8. Monitoring: suspicious activity is detected and investigated\n9. Backups: copies are kept offline and tested\n10. Awareness training: staff learn to spot phishing',
    facts: ['Confidentiality', 'Integrity', 'Availability', 'Authentication', 'Authorisation', 'Encryption', 'Patching', 'Monitoring', 'Backups', 'Awareness training'] },
  lvcCycle: { text: 'The Agile sprint cycle\n- Sprint planning: the team picks the work for the sprint\n- Development: the team builds and tests the increment\n- Sprint review: stakeholders see the result\n- Retrospective: the team improves how it works, then the next sprint starts again',
    facts: ['Sprint planning', 'Development', 'Sprint review', 'Retrospective'], relation: 'cycle' },
  lvcLoops: { text: 'Loops in Python\n- For loop: repeats over each item of a sequence\n- While loop: repeats while a condition is true\n- Nested loops: a loop inside another loop',
    facts: ['For loop', 'While loop', 'Nested loops'], relation: 'not cycle' },
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
  const prims = (c.prims || []).concat(...(c.nextPrims || [])), texts = prims.filter(p => p.text).map(p => String(p.text)).join('\n').toLowerCase();
  const q = vq ? vq(c.prims || [], R) : null;     // 10.19: layout per slide (a design on several slides: its first), content over all its slides
  return { name: String(c.title || c.name || '').replace(/ · .*$/, ''), category: c.category || '', family: c.family || '', engine: c.engine || '', edit: c.edit || '',
    objects: new Set(prims.filter(p => p.cmp && p.cmp !== 'none').map(p => p.grp)).size, shapes: prims.length,
    minPt: Math.min(99, ...prims.filter(p => p.text).map(p => p.size || 99)), issues: q ? (q.block || []).length : -1,
    missing: facts.filter(f => !f.split('|').some(x => texts.includes(x.toLowerCase()))) };
}
const out = {}, svg = {};
for (const [k, ex] of Object.entries(EX)) {
  A.ORCH.memo.clear(); W.eval('state.runText = ""; state.sections = []; 1');
  d.getElementById('content').value = ex.text; d.getElementById('content').dispatchEvent(new W.Event('input'));
  const t0 = performance.now();
  await A.appGenerate();
  const genMs = Math.round(performance.now() - t0);
  const first = A.APP.list.slice();
  const more = await W.eval('orchMore')(d.getElementById('content').value.trim(), () => {});
  const added = more && more.fresh ? more.list.slice(0, more.fresh) : [];
  const all = first.concat(added), looks = all.map(c => look(c.prims || []));
  const pairs = []; for (let i = 0; i < all.length; i++) for (let j = 0; j < i; j++) if (same(looks[i], looks[j])) pairs.push([j, i]);
  const fams = all.map(c => (c.family || c.title || '').replace(/ · .*$/, '')), famRep = fams.filter((f, i) => fams.indexOf(f) !== i).length;
  const cyc = c => /cycle|loop|orbit|ring/i.test((c.family || '') + ' ' + (c.title || ''));
  out[k] = { generate: first.length, more: added.length, genMs, top3: first.slice(0, 3).map(c => (c.family || c.title || '').replace(/ · .*$/, '')),
    cycleTop3: first.slice(0, 3).filter(cyc).length, relation: ex.relation || '', designs: all.map(c => measure(c, ex.facts)), lookAlikePairs: pairs.length, pairs,
    categories: new Set(all.map(c => c.category)).size, familyRepeats: famRep };
  all.forEach((c, i) => { svg[`${k}-${String(i).padStart(2, '0')}${i >= first.length ? '-more' : ''}`] = W.toSVG(c.prims, 1280, 720); });
}
return { out, svg };

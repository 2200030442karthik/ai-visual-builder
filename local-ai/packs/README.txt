AI VISUAL BUILDER - DESIGN PACKS (V10.11)
=========================================
A design pack adds layout families without changing the application. Each file in this folder is served by the panel
host automatically; add one <script src="/packs/NAME.js"></script> line after plan.js in v10.html to load it.

  registerPack('name', '1.0.0', () => {
    regPlan('key', { name: 'Shown name', family: 'key', kind: 'architecture|layered|pictorial|grouped|sequence|list',
      needs: P => '' or the reason the content does not suit it,
      suits: P => true when it should be offered for this content (10.13; plan.js planCandidates adds it),
      opts: [ sizes tried in order, e.g. { s: 24, D: 32 }, { s: 22, D: 28 } ],
      build: (P, R, o) => primitives, or planNo('why it does not fit') });
    // or as data only (a zone grid of 12 columns x 6 rows):
    regPlan('key2', planZoneFamily({ key: 'key2', name: '...', kind: '...', zones: [...], connectors: 'flow' }));
  });

Rules every family must keep (plan.js checks them; a layout that fails is not offered, with its reason):
- every item's label and description on the slide, at 22 pt or more (labels 24 or 22), Open Sans, colours from the
  approved palette (brand.js maps anything else), native shapes only (editable);
- no overlaps, clipping, text on icons or connectors, nothing outside the area (svg2ppt.js visualQuality);
- only relationships the content states: read the plan's semantics (planRoles: stages, outputs, functions across the
  flow; P.sources), never draw an order, hierarchy or connection the plan does not have.
The four variations are chosen one per kind first, so a new family competes with the others of its kind.
Claude chooses compositions by key: add a new key to PLAN_LAYOUTS in claude_visual.py too (tests/test_claude.py checks
that the lists match).

Packs: core@10.10 (plan.js: 11 families), pro@10.11.0 (pro-10.11.js: 12 families), modern@10.13.0 (modern-10.13.js:
roadmap, pillars, quadrant framework).

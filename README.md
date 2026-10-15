AI VISUAL BUILDER - NO NODE.JS STARTER

FILES
index.html: the add-in panel. Analyses your text, suggests visuals, inserts them as editable PowerPoint shapes.
manifest.xml: tells PowerPoint where the webpage is hosted

STEP 1 FEATURES (current)
- Paste keywords, bullet points, sub-points, dated items or a paragraph.
- The panel detects title, points, sub-points, dates and the kind of content
  (sequence, time, cycle, levels, funnel, comparison, components) and ranks 15 layouts:
  Process flow, Numbered steps, Cycle, Hub & spoke, Mind map, Hierarchy, Timeline, Pyramid,
  Funnel, Infographic cards, 2x2 matrix, Comparison, Isometric steps, Pillars, Key message.
- Live previews; 5 colour palettes; insert onto the selected slide as native, editable shapes.
- "Use text from selected shape" pulls text from the slide.
- You can open the GitHub Pages URL in a normal browser to try the previews; inserting needs PowerPoint.

STEP 2 FEATURES (current) - AI analysis with Claude
- Click "Analyse with AI" (or Ctrl+Enter in the text box). Claude (claude-opus-5-5) reads the text,
  writes a title, summarises it into 2-8 short key points with supporting details, ranks the layouts
  that fit (with a reason for each) and picks a colour palette. AI picks are marked on the cards.
- "Put the AI key points in the text box" lets you edit the AI's version before inserting.
- Typing still gives instant rule-based suggestions; AI runs only when you click (each run costs a few cents).
- Setup: open "AI settings" in the panel and paste an Anthropic API key (console.anthropic.com > API keys).
  The key is stored only in that browser (untick "Remember" to keep it for the session only; "Forget" removes it).
  It is never written into index.html, so the public GitHub Pages site stays key-free.
- Needs network access to api.anthropic.com and cdn.jsdelivr.net (the Anthropic SDK loads from there).
- Your text is sent to Anthropic. Follow your company's rules on what content may be sent.

INPUT TIPS
- First line = title, then one point per line ("-", "*", "1." bullets are fine).
- Sub-points: indent them, or put them under a line ending with ":" (e.g. "Pros:").
- Dates: "2024: Pilot launch", "Q1 2025 - Rollout", "Phase 2: Scale".
- One line of keywords: "Cloud, Security, Data, AI".

HOW TO USE / UPDATE
1. Sign into github.com (only if company policy permits uploading development files).
2. In your public repository ai-visual-builder, upload the new index.html (Add file > Upload files > Commit changes),
   replacing the old one.
3. Wait 1-2 minutes for GitHub Pages, then open https://2200030442karthik.github.io/ai-visual-builder/ to confirm.
4. manifest.xml changed (version 1.2, new ?v=step2 cache-buster), so re-upload it:
   PowerPoint on the web > Add-ins > More Add-ins / More Settings > Upload My Add-in > select manifest.xml.
5. Open AI Visual Builder Starter from My Add-ins, select a slide, pick a visual and click Insert.

BE AWARE
- A public GitHub Pages site is public. Never upload company material, internal slide text or API keys.
- Some Microsoft 365 tenants restrict sideloading even if a menu is visible.
- Needs PowerPoint API 1.5 (PowerPoint on the web or current Microsoft 365). Grouping needs API 1.8 and
  is skipped automatically on older versions.
- Layouts are designed for 16:9 slides.
- The PowerPoint project is not a Node.js app. No npm packages are needed.

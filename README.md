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

STEP 3 FEATURES (current) - isometric illustration next to the visual (works WITHOUT an API key)
- As you type, the panel picks a matching isometric illustration from 20 built-in pictures:
  AI & technology, Cloud & IT, Security, Data & analytics, Finance, Business growth, Healthcare,
  Manufacturing, Education, Marketing, Team & people, Energy & sustainability, Logistics,
  Ideas & innovation, Global, Roadmap & planning, Digital & apps, Retail & e-commerce,
  Goals & strategy, Communication.
  Example: a paragraph about artificial intelligence gets the AI chip / neural-network picture.
- Matching uses keywords in your text (the first line counts double). Not right? Choose another
  picture in the "Illustration" dropdown; "Auto" goes back to automatic matching.
- For a paragraph, "Isometric steps" is suggested first.
- "Place it beside the visual" (on by default): the visual moves to the left ~60% of the slide and the
  illustration fills the right side, in previews and when inserting.
- The pictures use your colour palette and repaint when you click another palette.
- "Insert it alone" puts just the illustration on the slide; "Download SVG" saves it.
- Inserted as an SVG picture (PNG if the host has no SVG support). In desktop PowerPoint,
  right-click > Convert to Shape makes every part editable.
- Built-in pictures are free, instant, work offline and send nothing anywhere.
- Optional, needs an Anthropic key: "Draw with AI" asks Claude to draw a custom picture for your exact text
  (or tick "Also ask Claude to draw a custom illustration" in AI settings to draw one with every analysis).
  The built-in picture stays until Claude's drawing is ready. AI drawings are checked before use:
  scripts, links, text and external images are removed.

INPUT TIPS
- First line = title, then one point per line ("-", "*", "1." bullets are fine).
- Sub-points: indent them, or put them under a line ending with ":" (e.g. "Pros:").
- Dates: "2024: Pilot launch", "Q1 2025 - Rollout", "Phase 2: Scale".
- One line of keywords: "Cloud, Security, Data, AI".

STEP 4 (current) - easy to open, easy to use
- Ribbon button: "AI Visual Builder" on the Home tab opens the panel (no more hunting in My Add-ins).
- The panel is a clear 3-step flow: 1 Paste your text, 2 Pick a visual, 3 Insert.
- A short welcome tip shows the first time (click "Got it" to hide it).
- AI is tucked away under "Optional: smarter results with AI" and never opens by itself.
- Plain-language messages, e.g. "Click once on a slide ... then press Insert again".
- If no slide is selected, the visual goes on slide 1 instead of failing.

HOW TO USE (everyone)
1. In PowerPoint, click Home > AI Visual Builder.
2. Paste your text (or click "Use text from slide").
3. Click the visual you like, then click a slide and press Insert.

PUBLISH AN UPDATE (owner)
1. Upload the new index.html to the GitHub repository ai-visual-builder (Add file > Upload files > Commit).
   Changes to index.html reach everyone automatically within a few minutes; nobody needs to reinstall.
2. Only when manifest.xml changes (it did in Step 4: version 1.4, ribbon button, ?v=step4):
   - for yourself: remove the old add-in from My Add-ins and upload the new manifest.xml;
   - for the company: send the new manifest.xml to the Microsoft 365 admin to update the deployment.

COMPANY-WIDE ROLLOUT (done once by a Microsoft 365 admin)
1. Go to https://admin.microsoft.com > Settings > Integrated apps > Upload custom apps.
2. App type: Office Add-in. Choose "Upload manifest file (.xml) from device" and pick manifest.xml. Click Validate.
3. Assign users: "Entire organization" (or a test group first). Accept the permissions (read/write document).
4. Finish deployment. The button appears on the Home tab for everyone, usually within a few hours
   (allow up to 24-72 hours). Users may need to close and reopen PowerPoint.
5. To update later: Integrated apps > AI Visual Builder > Update add-in > upload the new manifest.xml.
Notes for IT:
- The panel is a static web page (https://2200030442karthik.github.io/ai-visual-builder/). Your IT team may
  prefer to host it on a company-owned site (e.g. a company GitHub organisation or Azure Static Web Apps);
  then change every github.io URL in manifest.xml to the new address.
- Nothing is sent anywhere unless a user adds their own Anthropic API key in the optional AI section.

BE AWARE
- A public GitHub Pages site is public. Never upload company material, internal slide text or API keys.
- Some Microsoft 365 tenants restrict sideloading even if a menu is visible.
- Needs PowerPoint API 1.5 (PowerPoint on the web or current Microsoft 365). Grouping needs API 1.8 and
  is skipped automatically on older versions.
- Layouts are designed for 16:9 slides.
- The PowerPoint project is not a Node.js app. No npm packages are needed.

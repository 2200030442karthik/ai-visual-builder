# AI Visual Builder — manager demo (13 Nov 2026)

**Where it runs:** on Karthik's Windows PC. The local server is at https://localhost:44317 and PowerPoint uses the
Simplilearn LVC template. Remote sharing is **not live yet**; section 5 explains what it needs.

## 1. Before the meeting (10 minutes)

1. Double-click `local-ai\Start AI Visual Builder.bat`, or `Restart AI Visual Builder.bat` if it was running.
   Wait for "running".
2. Open PowerPoint with a deck on the LVC template and select a **Content_Slide**.
3. Home tab → **AI Visual Builder → Generate visuals**. The panel opens. To confirm the version beforehand,
   open https://localhost:44317/v10.html?dev=1 in Edge: the heading shows "version 10.18.0".
4. Run sample A once (below). Its Napkin result from 12 Nov is kept on this PC and is reused at no cost, so the
   demo makes **no paid request** for it.
5. Keep `local-ai\tests\evidence\v10.18-bench\` open in a browser or Explorer as a backup (before/after images).

## 2. The 8-minute walkthrough

| Step | What to do | What to say |
|---|---|---|
| 1 | Paste sample A and press **Generate visuals** | "One button. It reads the content, plans the visual and designs many options." |
| 2 | Point at the first designs: **AI-designed infographic** (Napkin's own composition), then the scenes | "The AI services design the best ones; the rest are drawn natively from the same understanding of the text." |
| 3 | Press **Open large gallery**; rest the pointer on designs | "Twenty-odd distinct designs, not colour swaps; hover shows each one large." |
| 4 | Double-click a design (e.g. *Disc and tile grid* or *Device links*) | "It goes onto the slide as native PowerPoint shapes and text." |
| 5 | Click a label on the slide and type; move a card | "Everything is editable: our template, our colours, 22 pt minimum." |
| 6 | Press **Undo last insert** | "Safe to try." |
| 7 | Paste sample B (AI & ML) → Generate → insert **Learning map** | "Course summaries keep every section and item." |
| 8 | **Several slides** (optional) | "Long content is split across slides instead of shrunk." |

Close with section 4: what's ready, and what IT needs to do to share it with the team.

## 3. Sample texts (non-confidential)

**A. Generative AI (one sentence)**
```
Generative AI (GenAI) is a branch of artificial intelligence that creates original content—such as text, images, video, audio, and code—in response to natural language prompts
```

**B. AI & ML (course summary)**
```
Artificial Intelligence and Machine Learning (AI & ML)

What you learn: Neural networks, data mining, predictive modeling, and working with tools like ChatGPT or Python.

Best for: Building smart apps, data analysis, and high-demand tech careers.
```

**C. Claude AI (statement)**
```
Claude ai helps you create, organize, and edit diverse types of content—from written copy and code-based animations to presentations and AI-marked text
```

**D. Kubernetes (statement)**
```
Kubernetes automates deployment, scaling, and management of containerized applications.
```

A new text (not A) may send **one paid AI request**, depending on the policy (`paid_policy` in
`local-ai\config.json`). To demo with no cost at all, set `"paid_policy": "never"` before the meeting: the built-in
designs remain, and sample A still shows its kept Napkin designs.

## 4. Status to present honestly

| | Status |
|---|---|
| Generate → 15–24 distinct designs, hover preview, large gallery, insert, Undo, Several slides, Edit a visual | **Working on this PC** (Windows PowerPoint) |
| Napkin designs (original AI infographics, inserted as shapes, partly editable when they contain artwork) | **Working**: real requests on 12 Nov |
| Claude's own compositions | Built and tested with saved answers; **not yet run against the real API** |
| Hosted team service (no Python or installation per user, Entra sign-in, per-user limits, keys in Key Vault) | **Code ready and tested locally**; needs IT: Azure web app, Entra app registration, admin deployment (`deploy/README-PILOT.md`) |
| Mac | Same Office.js code; **not tested on a Mac yet** |
| Button on the SL Smart Design tab | Kit ready; needs the SL Smart Design maintainer and the current `.pptm` source (`local-ai/sl-smart-design/SOURCE-REVIEW.txt`) |

## 5. If something goes wrong

- **"Sorry, we can't load the add-in":** the local server isn't running. Run `Restart AI Visual Builder.bat`, then
  reopen the panel.
- **No AI-designed infographic for sample A:** check that the text is exactly as above (the kept result is matched
  by text). The built-in designs still appear.
- **Fallback:** show the before/after images in `local-ai\tests\evidence\v10.18-bench\` and the real Napkin
  designs in `napkin-kept-genai.png`.

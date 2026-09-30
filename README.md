# SMC Event Report Generator and Uploader

A web form for writing Stella Maris College event reports in the **Data & Evidence Event Report** format. You fill in the event details, upload the invite, photographs, participant list, certificate, feedback and signature, and it downloads a formatted Word (`.docx`) report on the official letterhead.

- **Nothing is stored or uploaded.** The report is built inside your browser, and closing the tab clears everything.
- **Official format.** The report uses the college letterhead, watermark and footer, Times New Roman 12 pt, and 1.5 line spacing, with the section order from the template.
- **Free hosting.** The app is a set of static files, so GitHub Pages can host it at no cost.

## Put it on GitHub Pages

1. Sign in to GitHub and create a **new repository**, for example `event-report`. It can be public or private (Pages on a private repo needs a paid plan).
2. Click **Add file → Upload files** and drag in **everything inside this folder**: `index.html`, `README.md`, `.nojekyll`, and the `assets`, `css`, `js` and `lib` folders. Then click **Commit changes**.
3. Go to **Settings → Pages**. Under *Build and deployment*, set **Source** to *Deploy from a branch*, then choose **Branch:** `main` and folder `/ (root)`, and click **Save**.
4. Wait a minute or two, then refresh the page. The site's address appears at the top, for example `https://<your-username>.github.io/event-report/`.

If you want to try it without hosting, open `index.html` in Chrome or Edge. Everything works offline except reading PDF files (see below).

## What the report contains

| Section in the form | Where it appears in the Word report |
|---|---|
| Event details (Academic Year, Name, Organised By, Date, Participants) | Details table on page 1 |
| Invite (optional; images or PDF, drag to reorder) | Page 1, centred with its caption. Two invite images sit side by side |
| Objectives, with optional Course Title / Code / PO-PSO-CO | New page, as bullet points |
| Description (intro, sessions with resource persons, closing) | Paragraphs. Sessions follow the sample's pattern: **Session 1:** ***Title*** – Speaker |
| Outcomes | Bullet points with an optional lead-in sentence |
| Photographs with captions (drag to reorder) | New page, **two photographs per page**, headed *Geotagged Photographs* or *Photographs* |
| Participant list (scans or PDF) | New page. The first sheet is sized to fit under the heading; each further sheet fills a page of its own |
| Sample certificate | New page |
| Feedback (Google Forms charts or scans, plus an optional summary) | New page. Chart sizes are adjusted so the signature fits on the same page as the last chart |
| Signature(s) with name, designation and institution | At the end of the report. Two or three signatories sit side by side; four are arranged two per row; five or six, three per row |

## College Event Entry Form

The page ends with two steps: **11 Generate Word Report** (organiser short name, file name, and the Generate button) and **12 College Event Entry Form**. Section 12 collects the extra details the college Google Form asks for: faculty-in-charge, level, mode, organising departments / centres / clubs / units, MoU, alumnae, FMM 150th year, category, theme and course code(s). The event name, dates and academic year are taken from the report sections above.

**Open College Event Entry Form** (at the end of section 12) opens the Google Form in a new tab with all of these answers filled in. The person signs in with their college account if asked, checks the answers, attaches the report and submits. The report upload can't be pre-filled, because Google doesn't allow it.

The downloaded report is named by the form's rule, `AcademicYear_Organiser_EventName.docx` (for example `2026-27_IQAC_ProfessionalDevelopmentProgramme.docx`). The organiser part comes from **Organiser short name**. If that's blank, it's worked out from the first line of *Organised By*.

### If the Google Form is changed

The question IDs and option texts are stored in `js/form-link.js`. They were read from the live form on 30 September 2026. If someone later edits the form, for example by adding a new theme, adding a department or renaming an option, update the matching list in that file. Option texts must match the form exactly, including spaces and punctuation. A new question that isn't in the file is simply left blank for the person to fill in.

## Tips

- **Bold and italic text:** in any text box, type `**bold**` or `*italic*`.
- **Paragraphs:** leave a blank line between paragraphs.
- **Objectives and outcomes:** put one point on each line. Each line becomes a bullet.
- **Word counts:** the counters show the template's targets (description 150–200 words, outcomes 50–100 words).
- **PDF uploads:** every page of an uploaded PDF (for example a participant list) is added as an image. Reading PDFs needs an internet connection, because the PDF reader (pdf.js) loads from cdnjs. Images work offline.
- **Reordering:** drag thumbnails or photographs with the mouse. On a phone or tablet, use the arrow buttons.
- **Photo sizes:** large photographs are shrunk automatically so the Word file stays a manageable size. Phone photos are also turned the right way up.
- **iPhone photos (HEIC):** convert these to JPG first. Most browsers other than Safari can't read HEIC.
- **Save draft** downloads your typed text as a small `.json` file. **Open draft** loads it back later, but you'll need to upload the images again.
- **After downloading:** open the report in Word, check page breaks, and make any final edits.

## Files

```
index.html            the form
assets/               college logo and favicon (from the letterhead)
css/style.css         styling
js/app.js             form behaviour and image processing
js/form-link.js       Google Form pre-fill link (paste your link here)
js/docx-builder.js    builds the Word document (WordprocessingML)
js/template.js        the official template (letterhead/watermark/footer), embedded
lib/jszip.min.js      JSZip 3.10.1 (MIT), used to write the .docx
```

### Updating the letterhead

`js/template.js` holds the base template (`SMC_DataEvidence_Template_Report.docx` with its body text removed), stored as base64. If the college letterhead changes, re-create the file from the new template:

```bash
# unzip the new template, blank out the body, zip it again, and embed it
mkdir t && cd t && unzip ../NewTemplate.docx
python3 - <<'PY'
p='word/document.xml'; d=open(p,encoding='utf-8').read()
i=d.index('<w:body>')+8; j=d.rindex('<w:sectPr')
open(p,'w',encoding='utf-8').write(d[:i]+'<!--BODY-->'+d[j:])
PY
zip -q -X -r ../base.docx . && cd ..
python3 -c "import base64;open('js/template.js','w').write('window.SMC_TEMPLATE_B64=\"'+base64.b64encode(open('base.docx','rb').read()).decode()+'\";\n')"
```

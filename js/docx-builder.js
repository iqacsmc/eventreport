/*
 * SMC Event Report – DOCX builder
 * Builds a Word document on top of the official template (letterhead, watermark
 * and footer are preserved) using plain WordprocessingML + JSZip.
 * Everything runs in the browser; nothing is uploaded or stored.
 */
(function () {
  'use strict';

  // ---------- units ----------
  const EMU_PER_INCH = 914400;
  const TWIP_PER_INCH = 1440;
  // Usable page area of the template (A4, margins 1304 twips L/R, 1694 top, 1134 bottom)
  const PAGE_W_IN = (11901 - 1304 * 2) / TWIP_PER_INCH; // ≈ 6.45in
  const PAGE_H_IN = (16817 - 1694 - 1134) / TWIP_PER_INCH; // ≈ 9.71in

  const BULLET_NUM_ID = 901;

  // ---------- XML helpers ----------
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      // strip characters illegal in XML 1.0
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  }

  const FONT = '<w:rFonts w:ascii="Times New Roman" w:eastAsia="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>';

  function rPr(o) {
    o = o || {};
    return '<w:rPr>' + FONT + (o.b ? '<w:b/><w:bCs/>' : '') + (o.i ? '<w:i/><w:iCs/>' : '') +
      '<w:sz w:val="' + (o.size || 24) + '"/><w:szCs w:val="' + (o.size || 24) + '"/>' +
      (o.u ? '<w:u w:val="single"/>' : '') + '<w:lang w:val="en-GB"/></w:rPr>';
  }

  function run(text, o) {
    return '<w:r>' + rPr(o) + '<w:t xml:space="preserve">' + esc(text) + '</w:t></w:r>';
  }

  /**
   * Very small inline-markup parser: **bold**, *italic*, ***bold italic***.
   * Returns runs XML. `base` formatting is merged in.
   */
  function richRuns(text, base) {
    base = base || {};
    const out = [];
    const re = /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g;
    let last = 0, m;
    text = String(text || '');
    while ((m = re.exec(text))) {
      if (m.index > last) out.push(run(text.slice(last, m.index), base));
      const tok = m[0];
      if (tok.startsWith('***')) out.push(run(tok.slice(3, -3), Object.assign({}, base, { b: true, i: true })));
      else if (tok.startsWith('**')) out.push(run(tok.slice(2, -2), Object.assign({}, base, { b: true })));
      else out.push(run(tok.slice(1, -1), Object.assign({}, base, { i: true })));
      last = m.index + tok.length;
    }
    if (last < text.length) out.push(run(text.slice(last), base));
    return out.join('');
  }

  function pPr(o) {
    o = o || {};
    let x = '<w:pPr>';
    if (o.keepNext) x += '<w:keepNext/>';
    if (o.keepLines) x += '<w:keepLines/>';
    if (o.pageBreakBefore) x += '<w:pageBreakBefore/>';
    if (o.numId) x += '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="' + o.numId + '"/></w:numPr>';
    const line = o.line || 360; // 1.5 line spacing
    x += '<w:spacing w:before="' + (o.before || 0) + '" w:after="' + (o.after == null ? 120 : o.after) +
      '" w:line="' + line + '" w:lineRule="auto"/>';
    if (o.ind) x += o.ind;
    x += '<w:jc w:val="' + (o.jc || 'both') + '"/>';
    x += rPr(o.r) + '</w:pPr>';
    return x;
  }

  function para(runsXml, o) {
    return '<w:p>' + pPr(o) + (runsXml || '') + '</w:p>';
  }

  function heading(text, o) {
    o = o || {};
    return para(run(String(text).toUpperCase(), { b: true }),
      { jc: 'center', before: o.pageBreakBefore ? 0 : 240, after: 160, keepNext: true, pageBreakBefore: o.pageBreakBefore, r: { b: true } });
  }

  function pageBreak() {
    return '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:br w:type="page"/></w:r></w:p>';
  }

  function emptyPara(after) {
    return '<w:p><w:pPr><w:spacing w:before="0" w:after="' + (after || 0) + '" w:line="240" w:lineRule="auto"/></w:pPr></w:p>';
  }

  // ---------- images ----------
  let docPrId = 1000;

  function drawing(rid, wIn, hIn, name) {
    const cx = Math.round(wIn * EMU_PER_INCH), cy = Math.round(hIn * EMU_PER_INCH);
    const id = ++docPrId;
    return '<w:r><w:rPr><w:noProof/></w:rPr><w:drawing>' +
      '<wp:inline distT="0" distB="0" distL="0" distR="0">' +
      '<wp:extent cx="' + cx + '" cy="' + cy + '"/>' +
      '<wp:effectExtent l="0" t="0" r="0" b="0"/>' +
      '<wp:docPr id="' + id + '" name="' + esc(name || ('Picture ' + id)) + '"/>' +
      '<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>' +
      '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
      '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
      '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
      '<pic:nvPicPr><pic:cNvPr id="' + id + '" name="' + esc(name || ('Picture ' + id)) + '"/><pic:cNvPicPr><a:picLocks noChangeAspect="1" noChangeArrowheads="1"/></pic:cNvPicPr></pic:nvPicPr>' +
      '<pic:blipFill><a:blip r:embed="' + rid + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
      '<pic:spPr bwMode="auto"><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>' +
      '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
  }

  /** Fit (w,h) pixels into a box (inches) keeping aspect ratio. */
  function fit(img, maxW, maxH) {
    const r = Math.min(maxW / img.width, maxH / img.height);
    return { w: img.width * r, h: img.height * r };
  }

  // ---------- main builder ----------
  /**
   * data: {
   *   academicYear, eventName, organisedBy (string, multi-line), date, participants,
   *   invites: [img], inviteCaption,
   *   course: {title, code, outcomes}, objectivesIntro, objectives: [str],
   *   descIntro: str (paragraphs separated by blank lines), sessions: [{label,title,speaker,text}], descClosing,
   *   outcomesIntro, outcomes: [str],
   *   photoHeading, photos: [{img, caption}],
   *   participantPages: [img], participantNote,
   *   certificates: [img],
   *   feedbackPages: [img], feedbackText,
   *   signatories: [{img, name, designation, institution}], signatureLabel
   * }
   * img = { bytes: Uint8Array, ext: 'png'|'jpeg', width, height }
   */
  async function buildDocx(data) {
    if (!window.JSZip) throw new Error('JSZip library failed to load.');
    const zip = await JSZip.loadAsync(window.SMC_TEMPLATE_B64, { base64: true });

    const relsPath = 'word/_rels/document.xml.rels';
    let rels = await zip.file(relsPath).async('string');
    let ct = await zip.file('[Content_Types].xml').async('string');
    let numbering = await zip.file('word/numbering.xml').async('string');
    let docXml = await zip.file('word/document.xml').async('string');

    // --- ensure jpeg content type ---
    if (!/Extension="jpeg"/i.test(ct)) ct = ct.replace('<Default ', '<Default Extension="jpeg" ContentType="image/jpeg"/><Default ');
    if (!/Extension="png"/i.test(ct)) ct = ct.replace('<Default ', '<Default Extension="png" ContentType="image/png"/><Default ');

    // --- add a clean bullet list definition ---
    const absId = 901;
    const abstractNum =
      '<w:abstractNum w:abstractNumId="' + absId + '"><w:multiLevelType w:val="hybridMultilevel"/>' +
      '<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val=""/><w:lvlJc w:val="left"/>' +
      '<w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr><w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol" w:hint="default"/></w:rPr></w:lvl>' +
      '</w:abstractNum>';
    // abstractNum elements must precede num elements
    numbering = numbering.replace(/(<w:num )/, abstractNum + '$1');
    // new <w:num> goes right after the last existing <w:num> (before numIdMacAtCleanup, if any)
    const numXml = '<w:num w:numId="' + BULLET_NUM_ID + '"><w:abstractNumId w:val="' + absId + '"/></w:num>';
    const lastNum = numbering.lastIndexOf('</w:num>');
    if (lastNum >= 0) numbering = numbering.slice(0, lastNum + 8) + numXml + numbering.slice(lastNum + 8);
    else numbering = numbering.replace('</w:numbering>', numXml + '</w:numbering>');

    // --- image registration ---
    let imgCounter = 0;
    function addImage(img) {
      imgCounter++;
      const rid = 'rIdEvt' + imgCounter;
      const fname = 'evt_img' + imgCounter + '.' + img.ext;
      zip.file('word/media/' + fname, img.bytes);
      rels = rels.replace('</Relationships>',
        '<Relationship Id="' + rid + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/' + fname + '"/></Relationships>');
      return rid;
    }

    const B = []; // body parts

    // ===== Title =====
    B.push(para(run('EVENT REPORT', { b: true }), { jc: 'center', after: 240, r: { b: true } }));

    // ===== Details table =====
    const rows = [
      ['Academic Year', data.academicYear],
      ['Name of the Event', data.eventName],
      ['Organised By', data.organisedBy],
      ['Date', data.date],
      ['Number of Participants', data.participants]
    ];
    if (data.extraDetails) data.extraDetails.forEach(function (d) { if (d.label) rows.push([d.label, d.value]); });

    const cellMar = '<w:tcMar><w:top w:w="100" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar>';
    const noBorders = '<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>';
    let tbl = '<w:tbl><w:tblPr><w:tblW w:w="9225" w:type="dxa"/><w:jc w:val="center"/>' + noBorders +
      '<w:tblLayout w:type="fixed"/><w:tblLook w:val="0600" w:firstRow="0" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="1" w:noVBand="1"/></w:tblPr>' +
      '<w:tblGrid><w:gridCol w:w="2535"/><w:gridCol w:w="240"/><w:gridCol w:w="6450"/></w:tblGrid>';
    rows.forEach(function (r) {
      const values = String(r[1] || '').split(/\n/).map(function (s) { return s.trim(); }).filter(Boolean);
      if (!values.length) values.push('');
      const cellP = function (xml, bold, line) {
        return '<w:p>' + pPr({ jc: 'left', after: 0, line: line || 276, r: { b: bold } }) + xml + '</w:p>';
      };
      tbl += '<w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="518"/><w:jc w:val="center"/></w:trPr>' +
        '<w:tc><w:tcPr><w:tcW w:w="2535" w:type="dxa"/>' + cellMar + '</w:tcPr>' + cellP(run(r[0])) + '</w:tc>' +
        '<w:tc><w:tcPr><w:tcW w:w="240" w:type="dxa"/>' + cellMar + '</w:tcPr>' + cellP(run(':')) + '</w:tc>' +
        '<w:tc><w:tcPr><w:tcW w:w="6450" w:type="dxa"/>' + cellMar + '</w:tcPr>' +
        values.map(function (v) { return cellP(run(v, { b: true }), true, 360); }).join('') +
        '</w:tc></w:tr>';
    });
    tbl += '</w:tbl>';
    B.push(tbl);
    B.push(emptyPara(120));

    // ===== Invite =====
    const invites = (data.invites || []);
    if (invites.length) {
      const n = invites.length;
      let maxW, maxH;
      if (n === 1) { maxW = 5.6; maxH = 5.9; }
      else if (n === 2) { maxW = (PAGE_W_IN - 0.25) / 2; maxH = 5.9; }
      else { maxW = (PAGE_W_IN - 0.4) / 3; maxH = 4.2; }
      let runs = '';
      invites.forEach(function (img, i) {
        const s = fit(img, maxW, maxH);
        if (i > 0) runs += run('  ');
        runs += drawing(addImage(img), s.w, s.h, 'Invite ' + (i + 1));
      });
      B.push(para(runs, { jc: 'center', after: 240, line: 240, keepNext: true }));
      B.push(para(richRuns(data.inviteCaption || 'Invite of the Event'), { jc: 'center', after: 120 }));
    }

    // ===== Objectives (new page) =====
    const hasCourse = data.course && (data.course.title || data.course.code || data.course.outcomes);
    const objectives = (data.objectives || []).filter(Boolean);
    if (hasCourse || objectives.length || data.objectivesIntro) {
      B.push(heading('Objectives of the Event', { pageBreakBefore: true }));
      if (hasCourse) {
        const courseRows = [['Course Title', data.course.title], ['Course Code', data.course.code], ['PO / PSO / CO', data.course.outcomes]];
        let ctbl = '<w:tbl><w:tblPr><w:tblW w:w="9225" w:type="dxa"/>' + noBorders +
          '<w:tblLayout w:type="fixed"/><w:tblLook w:val="0600" w:firstRow="0" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="1" w:noVBand="1"/></w:tblPr>' +
          '<w:tblGrid><w:gridCol w:w="1985"/><w:gridCol w:w="284"/><w:gridCol w:w="6956"/></w:tblGrid>';
        courseRows.forEach(function (r) {
          if (!r[1]) return;
          const lines = String(r[1]).split(/\n/).map(function (s) { return s.trim(); }).filter(Boolean);
          const cm = '<w:tcMar><w:top w:w="40" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tcMar>';
          ctbl += '<w:tr><w:trPr><w:cantSplit/></w:trPr>' +
            '<w:tc><w:tcPr><w:tcW w:w="1985" w:type="dxa"/>' + cm + '</w:tcPr>' + para(run(r[0], { b: true }), { jc: 'left', after: 0 }) + '</w:tc>' +
            '<w:tc><w:tcPr><w:tcW w:w="284" w:type="dxa"/>' + cm + '</w:tcPr>' + para(run(':', { b: true }), { jc: 'left', after: 0 }) + '</w:tc>' +
            '<w:tc><w:tcPr><w:tcW w:w="6956" w:type="dxa"/>' + cm + '</w:tcPr>' +
            lines.map(function (l) { return para(richRuns(l), { jc: 'both', after: 0 }); }).join('') + '</w:tc></w:tr>';
        });
        ctbl += '</w:tbl>';
        B.push(ctbl);
        B.push(emptyPara(120));
      }
      if (data.objectivesIntro) B.push(para(richRuns(data.objectivesIntro), { after: 60 }));
      objectives.forEach(function (o) { B.push(para(richRuns(o), { numId: BULLET_NUM_ID, after: 0 })); });
    }

    // ===== Description =====
    const descParas = splitParas(data.descIntro);
    const sessions = (data.sessions || []).filter(function (s) { return s.title || s.speaker || s.text; });
    const closing = splitParas(data.descClosing);
    if (descParas.length || sessions.length || closing.length) {
      B.push(heading('Description of the Event'));
      descParas.forEach(function (p) { B.push(para(richRuns(p), { after: 160 })); });
      sessions.forEach(function (s, i) {
        let head = '';
        const label = (s.label || ('Session ' + (i + 1))).trim();
        head += run(label + (s.title ? ': ' : ''), { b: true });
        if (s.title) head += run(s.title, { b: true, i: true });
        if (s.speaker) head += run(' – ' + s.speaker);
        B.push(para(head, { after: 120, keepNext: !!s.text, jc: 'both' }));
        splitParas(s.text).forEach(function (p) { B.push(para(richRuns(p), { after: 160 })); });
      });
      closing.forEach(function (p) { B.push(para(richRuns(p), { after: 160 })); });
    }

    // ===== Outcomes =====
    const outcomes = (data.outcomes || []).filter(Boolean);
    if (outcomes.length || data.outcomesIntro) {
      B.push(heading('Outcomes of the Event'));
      if (data.outcomesIntro) B.push(para(richRuns(data.outcomesIntro), { after: 60, keepNext: outcomes.length > 0 }));
      outcomes.forEach(function (o) { B.push(para(richRuns(o), { numId: BULLET_NUM_ID, after: 0 })); });
    }

    // ===== Photographs – max two per page =====
    const photos = (data.photos || []).filter(function (p) { return p.img; });
    if (photos.length) {
      B.push(heading(data.photoHeading || 'Photographs (Geotagged and Non-Geotagged)', { pageBreakBefore: true }));
      photos.forEach(function (p, i) {
        if (i > 0 && i % 2 === 0) B.push(pageBreak());
        const s = fit(p.img, 6.0, 3.4);
        B.push(para(drawing(addImage(p.img), s.w, s.h, 'Photograph ' + (i + 1)),
          { jc: 'center', before: 0, after: 240, line: 240, keepNext: true }));
        B.push(para(richRuns(p.caption || ''), { jc: 'center', after: (i % 2 === 0) ? 600 : 0, line: 276 }));
      });
    }

    // ===== Layout estimates (inches) =====
    // Conservative numbers so the result also fits in Word, which lays out slightly differently from other viewers.
    const USABLE_H = PAGE_H_IN - 0.35;
    const HEADING_H = 0.45;                         // heading at top of page (1.5 spacing + 8pt after)
    function textBlockH(text) {                     // justified 12pt TNR, 1.5 spacing, ~95 characters per line
      return splitParas(text).reduce(function (h, p) { return h + Math.ceil(p.length / 95) * 0.29 + 0.11; }, 0);
    }

    // ===== Participant list / certificate: first sheet shares the page with the heading, the rest get a page each =====
    function fullPageSection(title, pages, noteTop) {
      pages = (pages || []).filter(Boolean);
      if (!pages.length && !noteTop) return;
      B.push(heading(title, { pageBreakBefore: true }));
      if (noteTop) splitParas(noteTop).forEach(function (p) { B.push(para(richRuns(p), { after: 160, keepNext: true })); });
      const firstMax = USABLE_H - HEADING_H - textBlockH(noteTop);
      pages.forEach(function (img, i) {
        const s = fit(img, PAGE_W_IN, i === 0 ? firstMax : USABLE_H - 0.05);
        B.push(para(drawing(addImage(img), s.w, s.h, title + ' ' + (i + 1)),
          { jc: 'center', after: 0, line: 240, pageBreakBefore: i > 0 }));
      });
    }

    fullPageSection('Participant List', data.participantPages, data.participantNote);
    fullPageSection('Sample Certificate', data.certificates);

    // ===== Signatories: 1–3 side by side, 4 as 2 + 2, 5–6 three per row =====
    const sigs = (data.signatories || []).filter(function (s) { return s.img || s.name || s.designation; });
    const nSig = sigs.length;
    const perRow = nSig <= 3 ? nSig : (nSig === 4 ? 2 : 3);
    const sigRows = perRow ? Math.ceil(nSig / perRow) : 0;
    // about 13 characters of 12pt Times New Roman per inch of column width
    const charsPerLine = Math.max(12, Math.floor((PAGE_W_IN / Math.max(1, nSig === 1 ? 1 : perRow)) * 13) - 2);
    function sigRowH(rowSigs) {
      return rowSigs.reduce(function (m, s) {
        const lines = [s.name, s.designation, s.institution].reduce(function (n, l) {
          return n + String(l || '').split(/\n/).filter(function (x) { return x.trim(); })
            .reduce(function (k, x) { return k + Math.ceil(x.trim().length / charsPerLine); }, 0);
        }, 0);
        return Math.max(m, (s.img ? 0.88 : 0.4) + lines * 0.2);
      }, 0) + 0.15;
    }
    let SIG_H = 0;
    if (nSig) {
      SIG_H = 0.4; // spacer above the block
      for (let r = 0; r < sigRows; r++) SIG_H += sigRowH(sigs.slice(r * perRow, r * perRow + perRow));
    }

    // ===== Feedback: pack charts into pages, then shrink the last page's charts so the signature fits beneath them =====
    const fb = (data.feedbackPages || []).filter(Boolean);
    if (fb.length || data.feedbackText) {
      B.push(heading('Feedback on the Event', { pageBreakBefore: true }));
      splitParas(data.feedbackText).forEach(function (p) { B.push(para(richRuns(p), { after: 160 })); });
      const IMG_GAP = 0.13;                                 // paragraph spacing under each chart
      const firstAvail = USABLE_H - HEADING_H - textBlockH(data.feedbackText);
      const pagesFb = [{ avail: firstAvail, used: 0, items: [] }];
      fb.forEach(function (img) {
        let pg = pagesFb[pagesFb.length - 1];
        const s = fit(img, PAGE_W_IN, pg.items.length ? USABLE_H - IMG_GAP : Math.min(pg.avail, USABLE_H) - IMG_GAP);
        if (pg.items.length && pg.used + s.h + IMG_GAP > pg.avail) {
          pg = { avail: USABLE_H, used: 0, items: [] };
          pagesFb.push(pg);
        }
        pg.items.push({ img: img, w: s.w, h: s.h });
        pg.used += s.h + IMG_GAP;
      });
      // make room for the signature on the last page
      const last = pagesFb[pagesFb.length - 1];
      if (nSig && last.items.length) {
        const room = last.avail - last.used;
        if (room < SIG_H) {
          const imgsH = last.items.reduce(function (h, it) { return h + it.h; }, 0);
          const f = Math.max(0.4, (imgsH - (SIG_H - room)) / imgsH);
          last.items.forEach(function (it) { it.w *= f; it.h *= f; });
        }
      }
      let k = 0;
      pagesFb.forEach(function (pg, pi) {
        pg.items.forEach(function (it, ii) {
          k++;
          B.push(para(drawing(addImage(it.img), it.w, it.h, 'Feedback ' + k),
            { jc: 'center', after: 90, line: 240, pageBreakBefore: pi > 0 && ii === 0 }));
        });
      });
    }

    // ===== Signature block =====
    if (nSig) {
      B.push('<w:p><w:pPr><w:keepNext/><w:spacing w:before="0" w:after="240" w:line="240" w:lineRule="auto"/></w:pPr></w:p>');
      const total = 9293;
      const cols = nSig === 1 ? 1 : perRow;
      const colW = Math.floor(total / cols);
      const jcFor = function (c) {
        if (cols === 1) return data.signatureAlign === 'right' ? 'right' : 'left';
        if (cols === 2) return c === 0 ? 'left' : 'right';
        return c === 0 ? 'left' : (c === cols - 1 ? 'right' : 'center');
      };
      let st = '<w:tbl><w:tblPr><w:tblW w:w="' + (colW * cols) + '" w:type="dxa"/>' + noBorders +
        '<w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar>' +
        '<w:tblLook w:val="0000" w:firstRow="0" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="1" w:noVBand="1"/></w:tblPr><w:tblGrid>';
      for (let c = 0; c < cols; c++) st += '<w:gridCol w:w="' + colW + '"/>';
      st += '</w:tblGrid>';
      for (let r = 0; r < sigRows; r++) {
        const lastRow = r === sigRows - 1;
        st += '<w:tr><w:trPr><w:cantSplit/></w:trPr>';
        for (let c = 0; c < cols; c++) {
          const s = sigs[r * cols + c];
          const jc = jcFor(c);
          let cell = '';
          if (!s) {
            cell = para('', { jc: jc, after: 0, line: 240 });
          } else {
            if (s.img) {
              const sz = fit(s.img, 1.9, 0.85);
              cell += para(drawing(addImage(s.img), sz.w, sz.h, 'Signature ' + (r * cols + c + 1)),
                { jc: jc, before: r > 0 ? 200 : 0, after: 40, line: 240, keepNext: true });
            } else {
              cell += para('', { jc: jc, before: r > 0 ? 200 : 0, after: 0, line: 240, keepNext: true }) +
                para('', { jc: jc, after: 0, line: 240, keepNext: true });
            }
            const textLines = [];
            [s.name, s.designation, s.institution].forEach(function (line, k) {
              String(line || '').split(/\n/).map(function (x) { return x.trim(); }).filter(Boolean).forEach(function (l) {
                textLines.push(run(l, { b: k === 0 && !!data.boldSignName }));
              });
            });
            textLines.forEach(function (x, li) {
              cell += para(x, { jc: jc, after: 0, line: 240, keepNext: !(lastRow && li === textLines.length - 1) });
            });
          }
          st += '<w:tc><w:tcPr><w:tcW w:w="' + colW + '" w:type="dxa"/></w:tcPr>' + cell + '</w:tc>';
        }
        st += '</w:tr>';
      }
      st += '</w:tbl>';
      B.push(st);
      // Word needs a paragraph after a table; keep it 1pt high so it can never spill onto a new page
      B.push('<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr></w:pPr></w:p>');
    }

    // ---- write parts ----
    docXml = docXml.replace('<!--BODY-->', B.join(''));
    zip.file('word/document.xml', docXml);
    zip.file(relsPath, rels);
    zip.file('[Content_Types].xml', ct);
    zip.file('word/numbering.xml', numbering);

    // update core properties (title / modified)
    try {
      let core = await zip.file('docProps/core.xml').async('string');
      const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
      core = core.replace(/<dc:title>[\s\S]*?<\/dc:title>|<dc:title\/>/, '');
      core = core.replace('</cp:coreProperties>', '<dc:title>' + esc('Event Report – ' + (data.eventName || '')) + '</dc:title></cp:coreProperties>');
      core = core.replace(/<dcterms:modified([^>]*)>[^<]*<\/dcterms:modified>/, '<dcterms:modified$1>' + now + '</dcterms:modified>');
      zip.file('docProps/core.xml', core);
    } catch (e) { /* non-fatal */ }

    return zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });
  }

  function splitParas(text) {
    return String(text || '').split(/\n\s*\n/).map(function (p) { return p.replace(/\s*\n\s*/g, ' ').trim(); }).filter(Boolean);
  }

  window.SMCDocx = { buildDocx: buildDocx, PAGE_W_IN: PAGE_W_IN, PAGE_H_IN: PAGE_H_IN };
})();

/*
 * SMC Event Report Generator and Uploader – form logic.
 * All processing happens in the browser. Nothing is uploaded or stored.
 */
(function () {
  'use strict';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const PDFJS_VERSION = '3.11.174';
  const PDFJS_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/' + PDFJS_VERSION + '/';

  // Image lists held in memory only
  const state = {
    invites: [],
    photos: [],          // {img, caption, name}
    participantPages: [],
    certificates: [],
    feedbackPages: []
  };

  // How each upload target is processed
  const PROFILES = {
    invites: { maxPx: 2000, type: 'auto', quality: 0.9 },
    photos: { maxPx: 1600, type: 'jpeg', quality: 0.85 },
    participantPages: { maxPx: 2000, type: 'jpeg', quality: 0.82 },
    certificates: { maxPx: 2000, type: 'auto', quality: 0.9 },
    feedbackPages: { maxPx: 1800, type: 'auto', quality: 0.9 },
    signature: { maxPx: 900, type: 'png', quality: 1 }
  };

  let dirty = false;
  let reportGenerated = false;

  // ---------------------------------------------------------------- status
  // Status messages appear as a small pop-up at the bottom of the screen and fade after a few seconds.
  let statusTimer = null;
  function setStatus(msg, kind) {
    const el = $('#status');
    clearTimeout(statusTimer);
    el.textContent = msg || '';
    el.className = 'status' + (kind ? ' ' + kind : '');
    if (msg) statusTimer = setTimeout(() => el.classList.add('hide'), kind === 'error' ? 10000 : 7000);
  }

  // ---------------------------------------------------------------- academic year
  function initAcademicYear() {
    const sel = $('#academicYear');
    const now = new Date();
    const startYear = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1; // AY starts in June
    for (let y = startYear + 1; y >= startYear - 4; y--) {
      const o = document.createElement('option');
      o.value = o.textContent = y + ' – ' + (y + 1);
      if (y === startYear) o.selected = true;
      sel.appendChild(o);
    }
  }

  // ---------------------------------------------------------------- dates
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function parseISO(v) { if (!v) return null; const [y, m, d] = v.split('-').map(Number); return { y, m: m - 1, d }; }
  function formatRange(a, b) {
    if (!a) return '';
    const dd = n => String(n).padStart(2, '0'); // 1 → 01
    a = Object.assign({}, a, { d: dd(a.d) });
    if (b) b = Object.assign({}, b, { d: dd(b.d) });
    if (!b || (a.y === b.y && a.m === b.m && a.d === b.d)) return a.d + ' ' + MONTHS[a.m] + ' ' + a.y;
    if (a.y === b.y && a.m === b.m) return a.d + ' – ' + b.d + ' ' + MONTHS[a.m] + ' ' + a.y;
    if (a.y === b.y) return a.d + ' ' + MONTHS[a.m] + ' – ' + b.d + ' ' + MONTHS[b.m] + ' ' + a.y;
    return a.d + ' ' + MONTHS[a.m] + ' ' + a.y + ' – ' + b.d + ' ' + MONTHS[b.m] + ' ' + b.y;
  }
  function onDateChange() {
    const from = $('#dateFrom'), to = $('#dateTo');
    // one-day event: "to" follows "from"; "to" can never be earlier than "from"
    if (from.value) {
      to.min = from.value;
      if (!to.value || to.value < from.value) to.value = from.value;
    }
    [from, to].forEach(el => { if (el.value) el.classList.remove('invalid'); });
    const a = parseISO(from.value), b = parseISO(to.value);
    if (a) { $('#dateText').value = formatRange(a, b); $('#dateText').classList.remove('invalid'); }
    updateFileName();
  }

  // ---------------------------------------------------------------- word counts
  function words(s) { return (String(s || '').replace(/\*/g, '').match(/\S+/g) || []).length; }
  function updateCounts() {
    const desc = words($('#descIntro').value) + words($('#descClosing').value) +
      $$('.session').reduce((n, s) => n + words($('.s-text', s).value), 0);
    const out = words($('#outcomesIntro').value) + words($('#outcomes').value);
    paint($('#descCount'), desc, 150, 200);
    paint($('#outCount'), out, 50, 100);
    function paint(el, n, lo, hi) {
      el.textContent = n + ' words · aim ' + lo + '–' + hi;
      el.className = 'counter' + (n === 0 ? '' : (n >= lo && n <= hi ? ' ok' : ' warn'));
    }
  }

  // ---------------------------------------------------------------- nav progress
  function updateNav() {
    const has = {
      'sec-details': ['eventName', 'organisedBy', 'dateFrom', 'dateTo', 'dateText', 'participants'].every(id => $('#' + id).value.trim()),
      'sec-invite': state.invites.length > 0,
      'sec-objectives': !!$('#objectives').value.trim(),
      'sec-description': !!($('#descIntro').value.trim() || $$('.session .s-text').some(t => t.value.trim())),
      'sec-outcomes': !!$('#outcomes').value.trim(),
      'sec-photos': state.photos.length > 0,
      'sec-participants': state.participantPages.length > 0,
      'sec-certificate': state.certificates.length > 0,
      'sec-feedback': state.feedbackPages.length > 0 || !!$('#feedbackText').value.trim(),
      'sec-signature': $$('.signatory').some(s => s._img || $('.g-name', s).value.trim()),
      'sec-generate': reportGenerated,
      'sec-college': !!($('#cfFacultyName').value.trim() && $('#cfCategory').value && $('#cfTheme').value)
    };
    $$('#navList a').forEach(a => a.classList.toggle('done', !!has[a.getAttribute('href').slice(1)]));
  }

  function changed() { dirty = true; updateCounts(); updateNav(); }

  // ---------------------------------------------------------------- image processing
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('Could not load ' + src));
      document.head.appendChild(s);
    });
  }

  let pdfjsPromise = null;
  function getPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (!pdfjsPromise) {
      pdfjsPromise = loadScript(PDFJS_BASE + 'pdf.min.js').then(() => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_BASE + 'pdf.worker.min.js';
        return window.pdfjsLib;
      }).catch(e => { pdfjsPromise = null; throw new Error('PDF support needs an internet connection (the PDF reader loads from cdnjs). You can upload JPG/PNG images instead.'); });
    }
    return pdfjsPromise;
  }

  async function decodeImage(file) {
    if (window.createImageBitmap) {
      try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { /* fall through */ }
    }
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const im = new Image();
      im.onload = () => { resolve(im); };
      im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('"' + file.name + '" could not be read as an image. If it is a HEIC photo from an iPhone, please convert it to JPG first.')); };
      im.src = url;
    });
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Image conversion failed')), type, quality));
  }

  function hasTransparency(ctx, w, h) {
    try {
      const step = Math.max(1, Math.floor(Math.min(w, h) / 60));
      const data = ctx.getImageData(0, 0, w, h).data;
      for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) if (data[(y * w + x) * 4 + 3] < 250) return true;
    } catch (e) { /* ignore */ }
    return false;
  }

  /** Draw any drawable into a canvas, scaled, and encode. */
  async function encodeDrawable(src, srcW, srcH, profile, sourceMime, name) {
    const scale = Math.min(1, profile.maxPx / Math.max(srcW, srcH));
    const w = Math.max(1, Math.round(srcW * scale)), h = Math.max(1, Math.round(srcH * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');

    let type = profile.type;
    if (type === 'auto') type = (sourceMime === 'image/png') ? 'png' : 'jpeg';

    if (type === 'jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, w, h);

    // A PNG screenshot without transparency and with lots of pixels is smaller as JPEG
    let blob = await canvasToBlob(canvas, type === 'png' ? 'image/png' : 'image/jpeg', profile.quality);
    if (type === 'png' && profile.type === 'auto' && blob.size > 1.8e6 && !hasTransparency(ctx, w, h)) {
      ctx.globalCompositeOperation = 'destination-over'; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
      blob = await canvasToBlob(canvas, 'image/jpeg', 0.9); type = 'jpeg';
    }
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return { bytes, ext: type === 'png' ? 'png' : 'jpeg', width: w, height: h, url: URL.createObjectURL(blob), name: name };
  }

  /** Returns an array of processed images (PDFs expand into one image per page). */
  async function processFile(file, profileKey, allowPdf) {
    const profile = PROFILES[profileKey];
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    if (isPdf) {
      if (!allowPdf) throw new Error('"' + file.name + '": please upload an image (JPG/PNG) here.');
      const pdfjs = await getPdfJs();
      const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
      const out = [];
      const pages = Math.min(doc.numPages, 60);
      for (let i = 1; i <= pages; i++) {
        setStatus('Reading ' + file.name + ' – page ' + i + ' of ' + pages + '…');
        const page = await doc.getPage(i);
        const vp1 = page.getViewport({ scale: 1 });
        const scale = profile.maxPx / Math.max(vp1.width, vp1.height);
        const vp = page.getViewport({ scale: scale });
        const c = document.createElement('canvas');
        c.width = Math.round(vp.width); c.height = Math.round(vp.height);
        const cx = c.getContext('2d');
        cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height);
        await page.render({ canvasContext: cx, viewport: vp }).promise;
        out.push(await encodeDrawable(c, c.width, c.height, Object.assign({}, profile, { type: 'jpeg', quality: 0.88 }), 'image/jpeg', file.name + ' p.' + i));
      }
      if (doc.numPages > pages) setStatus('Only the first ' + pages + ' pages of ' + file.name + ' were added.', 'error');
      return out;
    }
    if (!/^image\//.test(file.type) && !/\.(jpe?g|png|gif|webp|bmp)$/i.test(file.name)) {
      throw new Error('"' + file.name + '" is not an image' + (allowPdf ? ' or PDF' : '') + '.');
    }
    const bmp = await decodeImage(file);
    const res = await encodeDrawable(bmp, bmp.width, bmp.height, profile, file.type, file.name);
    if (bmp.close) bmp.close();
    return [res];
  }

  // ---------------------------------------------------------------- dropzones
  function wireDropzone(dz, onFiles) {
    const input = $('input[type=file]', dz);
    dz.addEventListener('click', e => { if (e.target !== input) input.click(); });
    dz.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    input.addEventListener('change', () => { if (input.files.length) onFiles(Array.from(input.files)); input.value = ''; });
    ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('drag'); }));
    dz.addEventListener('drop', e => { if (e.dataTransfer.files.length) onFiles(Array.from(e.dataTransfer.files)); });
  }

  async function handleFiles(target, files, dz) {
    const allowPdf = (dz.dataset.accept || '').includes('pdf');
    dz.classList.add('busy');
    let added = 0;
    try {
      for (const f of files) {
        setStatus('Processing ' + f.name + '…');
        try {
          const imgs = await processFile(f, target, allowPdf);
          imgs.forEach(img => {
            if (target === 'photos') state.photos.push({ img, caption: '' });
            else state[target].push(img);
          });
          added += imgs.length;
        } catch (err) {
          console.error(err);
          setStatus(err.message, 'error');
          await new Promise(r => setTimeout(r, 1800));
        }
      }
      if (added) setStatus(added + (added === 1 ? ' image' : ' images') + ' added.', 'ok');
    } finally {
      dz.classList.remove('busy');
      render(target);
      changed();
    }
  }

  // ---------------------------------------------------------------- rendering lists
  function move(arr, i, d) { const j = i + d; if (j < 0 || j >= arr.length) return; const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }

  /** Drag-to-reorder (mouse / trackpad). Arrow buttons remain for touch screens. */
  function makeSortable(el, index, arr, horizontal, rerender) {
    el.draggable = true;
    el.dataset.index = index;
    el.addEventListener('dragstart', e => {
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/x-smc-index', String(index));
    });
    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      $$('.drop-before, .drop-after', el.parentNode).forEach(x => x.classList.remove('drop-before', 'drop-after'));
    });
    const side = e => {
      const r = el.getBoundingClientRect();
      return horizontal ? (e.clientX - r.left > r.width / 2) : (e.clientY - r.top > r.height / 2);
    };
    el.addEventListener('dragover', e => {
      if (!e.dataTransfer.types.includes('text/x-smc-index')) return; // let file drops through
      e.preventDefault(); e.stopPropagation();
      const after = side(e);
      el.classList.toggle('drop-after', after); el.classList.toggle('drop-before', !after);
    });
    el.addEventListener('dragleave', () => el.classList.remove('drop-before', 'drop-after'));
    el.addEventListener('drop', e => {
      const raw = e.dataTransfer.getData('text/x-smc-index');
      if (raw === '') return;
      e.preventDefault(); e.stopPropagation();
      const from = Number(raw);
      let to = index + (side(e) ? 1 : 0);
      if (from < to) to--;
      if (from !== to) { const [it] = arr.splice(from, 1); arr.splice(to, 0, it); }
      rerender(); changed();
    });
  }

  function render(target) {
    if (target === 'photos') return renderPhotos();
    const box = $('#list-' + target);
    box.innerHTML = '';
    state[target].forEach((img, i) => {
      const t = document.createElement('div');
      t.className = 'thumb';
      t.innerHTML = '<img alt="" draggable="false"><span class="t-order"></span><div class="t-meta"></div><div class="t-tools">' +
        '<button type="button" class="icon-btn" data-a="left" title="Move earlier">←</button>' +
        '<button type="button" class="icon-btn" data-a="right" title="Move later">→</button>' +
        '<button type="button" class="icon-btn del" data-a="del" title="Remove">✕</button></div>';
      $('img', t).src = img.url;
      $('.t-meta', t).textContent = (i + 1) + '. ' + (img.name || '');
      $('.t-meta', t).title = img.name || '';
      $('.t-order', t).textContent = i + 1;
      makeSortable(t, i, state[target], true, () => render(target));
      t.addEventListener('click', e => {
        const a = e.target.dataset && e.target.dataset.a; if (!a) return;
        if (a === 'del') { URL.revokeObjectURL(img.url); state[target].splice(i, 1); }
        if (a === 'left') move(state[target], i, -1);
        if (a === 'right') move(state[target], i, 1);
        render(target); changed();
      });
      box.appendChild(t);
    });
  }

  function renderPhotos() {
    const box = $('#list-photos');
    box.innerHTML = '';
    state.photos.forEach((p, i) => {
      if (i > 0 && i % 2 === 0) {
        const d = document.createElement('div'); d.className = 'page-divider'; d.textContent = 'New page';
        box.appendChild(d);
      }
      const row = document.createElement('div');
      row.className = 'photo-item';
      row.innerHTML = '<img alt=""><div><div class="p-num"></div><input type="text" class="p-cap" placeholder="Caption, e.g. Dr. … interacting with the participants"></div>' +
        '<div class="p-tools"><button type="button" class="icon-btn" data-a="up" title="Move up">↑</button>' +
        '<button type="button" class="icon-btn" data-a="down" title="Move down">↓</button>' +
        '<button type="button" class="icon-btn del" data-a="del" title="Remove">✕</button></div>';
      $('img', row).src = p.img.url;
      $('img', row).draggable = false;
      makeSortable(row, i, state.photos, false, renderPhotos);
      $('.p-num', row).textContent = 'Photograph ' + (i + 1) + ' · ' + (p.img.name || '');
      const cap = $('.p-cap', row);
      cap.addEventListener('dragstart', e => e.preventDefault());
      cap.addEventListener('mousedown', () => { row.draggable = false; });
      cap.addEventListener('blur', () => { row.draggable = true; });
      cap.value = p.caption || '';
      cap.addEventListener('input', () => { p.caption = cap.value; dirty = true; });
      row.addEventListener('click', e => {
        const a = e.target.dataset && e.target.dataset.a; if (!a) return;
        if (a === 'del') { URL.revokeObjectURL(p.img.url); state.photos.splice(i, 1); }
        if (a === 'up') move(state.photos, i, -1);
        if (a === 'down') move(state.photos, i, 1);
        renderPhotos(); changed();
      });
      box.appendChild(row);
    });
  }

  // ---------------------------------------------------------------- sessions
  function renumberSessions() {
    $$('.session').forEach((s, i) => {
      const lab = $('.s-label', s);
      if (/^Session \d+$/.test(lab.value.trim()) || !lab.value.trim()) lab.value = 'Session ' + (i + 1);
    });
  }
  function addSession(data) {
    const node = $('#tpl-session').content.firstElementChild.cloneNode(true);
    $('#sessions').appendChild(node);
    if (data) {
      $('.s-label', node).value = data.label || '';
      $('.s-title', node).value = data.title || '';
      $('.s-speaker', node).value = data.speaker || '';
      $('.s-text', node).value = data.text || '';
    }
    renumberSessions();
    node.addEventListener('click', e => {
      const b = e.target.closest('.icon-btn'); if (!b) return;
      if (b.classList.contains('del')) node.remove();
      if (b.classList.contains('up') && node.previousElementSibling) node.parentNode.insertBefore(node, node.previousElementSibling);
      if (b.classList.contains('down') && node.nextElementSibling) node.parentNode.insertBefore(node.nextElementSibling, node);
      renumberSessions(); changed();
    });
    return node;
  }

  // ---------------------------------------------------------------- signatories
  function addSignatory(data) {
    const node = $('#tpl-signatory').content.firstElementChild.cloneNode(true);
    $('#signatories').appendChild(node);
    node._img = null;
    const drop = $('.sig-drop', node), prev = $('.sig-preview', node);
    const show = () => {
      drop.hidden = !!node._img; prev.hidden = !node._img;
      if (node._img) $('img', prev).src = node._img.url;
    };
    wireDropzone(drop, async files => {
      drop.classList.add('busy');
      try {
        const [img] = await processFile(files[0], 'signature', false);
        node._img = img; show(); setStatus('Signature added.', 'ok');
      } catch (err) { setStatus(err.message, 'error'); }
      finally { drop.classList.remove('busy'); changed(); }
    });
    $('.sig-clear', node).addEventListener('click', () => { node._img = null; show(); changed(); });
    $('.sub-tools .del', node).addEventListener('click', () => {
      if ($$('.signatory').length === 1) { node._img = null; show(); $$('input', node).forEach(i => { if (!i.classList.contains('g-inst')) i.value = ''; }); }
      else node.remove();
      renumberSignatories(); changed();
    });
    if (data) {
      $('.g-name', node).value = data.name || '';
      $('.g-desig', node).value = data.designation || '';
      $('.g-inst', node).value = data.institution != null ? data.institution : 'Stella Maris College (Autonomous)';
    }
    renumberSignatories();
    return node;
  }
  function renumberSignatories() {
    const all = $$('.signatory');
    all.forEach((s, i) => { $('.sig-title', s).textContent = all.length > 1 ? 'Signatory ' + (i + 1) : 'Signatory'; });
    $('#addSignatory').hidden = all.length >= 6;
  }

  // ---------------------------------------------------------------- collect / fill
  const TEXT_IDS = ['academicYear', 'eventName', 'organisedBy', 'participants', 'dateFrom', 'dateTo', 'dateText', 'inviteCaption',
    'courseTitle', 'courseCode', 'courseOutcomes', 'objectivesIntro', 'objectives', 'descIntro', 'descClosing',
    'outcomesIntro', 'outcomes', 'photoHeading', 'participantNote', 'feedbackText', 'signatureAlign', 'fileName',
    'cfFacultyName', 'cfFacultyMobile', 'cfLevel', 'cfMode', 'cfMou', 'cfAlumnae', 'cfFmm150', 'cfCategory', 'cfTheme',
    'cfCourseCodes', 'cfOrganiser'];
  const CF_GROUPS = ['departments', 'centres', 'clubs', 'units'];

  function lines(s) { return String(s || '').split(/\n/).map(x => x.replace(/^\s*(?:[-•*●▪]|\d+[.)])\s+/, '').trim()).filter(Boolean); }

  function collectText() {
    const d = {};
    TEXT_IDS.forEach(id => { d[id] = $('#' + id).value; });
    d.curricular = $('#curricular').checked;
    d.boldSignName = $('#boldSignName').checked;
    d.sessions = $$('.session').map(s => ({ label: $('.s-label', s).value, title: $('.s-title', s).value, speaker: $('.s-speaker', s).value, text: $('.s-text', s).value }));
    d.signatories = $$('.signatory').map(s => ({ name: $('.g-name', s).value, designation: $('.g-desig', s).value, institution: $('.g-inst', s).value }));
    d.photoCaptions = state.photos.map(p => p.caption || '');
    d.cfGroups = {};
    CF_GROUPS.forEach(g => { d.cfGroups[g] = $$('.check-grid[data-group="' + g + '"] input:checked').map(i => i.value); });
    return d;
  }

  function fillText(d) {
    TEXT_IDS.forEach(id => {
      if (d[id] == null) return;
      const el = $('#' + id);
      if (el.tagName === 'SELECT' && !$$('option', el).some(o => o.value === d[id])) {
        const o = document.createElement('option'); o.value = o.textContent = d[id]; el.appendChild(o);
      }
      el.value = d[id];
    });
    $('#curricular').checked = !!d.curricular; $('#courseBlock').hidden = !d.curricular;
    $('#boldSignName').checked = !!d.boldSignName;
    $('#sessions').innerHTML = ''; (d.sessions || []).forEach(s => addSession(s));
    const sigs = d.signatories && d.signatories.length ? d.signatories : [{}];
    $('#signatories').innerHTML = ''; sigs.forEach(s => addSignatory(s));
    (d.photoCaptions || []).forEach((c, i) => { if (state.photos[i]) state.photos[i].caption = c; });
    CF_GROUPS.forEach(g => {
      const picked = (d.cfGroups && d.cfGroups[g]) || [];
      $$('.check-grid[data-group="' + g + '"] input').forEach(i => { i.checked = picked.includes(i.value); });
    });
    updatePickCounts();
    courseCodesTouched = !!(d.cfCourseCodes && d.cfCourseCodes !== d.courseCode);
    renderPhotos();
    changed();
  }

  function buildData() {
    const t = collectText();
    const curricular = t.curricular;
    return {
      academicYear: t.academicYear,
      eventName: t.eventName.trim(),
      organisedBy: t.organisedBy,
      date: t.dateText.trim(),
      participants: t.participants.trim(),
      invites: state.invites,
      inviteCaption: t.inviteCaption.trim() || 'Invite of the Event',
      course: curricular ? { title: t.courseTitle.trim(), code: t.courseCode.trim(), outcomes: t.courseOutcomes.trim() } : null,
      objectivesIntro: t.objectivesIntro.trim(),
      objectives: lines(t.objectives),
      descIntro: t.descIntro,
      sessions: t.sessions,
      descClosing: t.descClosing,
      outcomesIntro: t.outcomesIntro.trim(),
      outcomes: lines(t.outcomes),
      photoHeading: t.photoHeading,
      photos: state.photos,
      participantPages: state.participantPages,
      participantNote: t.participantNote.trim(),
      certificates: state.certificates,
      feedbackPages: state.feedbackPages,
      feedbackText: t.feedbackText,
      signatories: $$('.signatory').map(s => ({ img: s._img, name: $('.g-name', s).value.trim(), designation: $('.g-desig', s).value.trim(), institution: $('.g-inst', s).value.trim() })),
      signatureAlign: t.signatureAlign,
      boldSignName: t.boldSignName
    };
  }

  // ---------------------------------------------------------------- file name
  // College convention: AcademicYear_Organiser_EventName.docx, e.g. 2026-27_IQAC_NewFacultyInduction.docx
  let fileNameTouched = false;
  function camel(s) {
    return String(s || '').replace(/&/g, ' and ').replace(/[^A-Za-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean)
      .map(w => /^[A-Z0-9]+$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join('').slice(0, 60);
  }
  function shortYear(ay) { const m = String(ay || '').match(/(\d{4})\D+\d{2}(\d{2})/); return m ? m[1] + '-' + m[2] : ''; }
  function organiserShort() {
    const own = $('#cfOrganiser').value.trim();
    if (own) return camel(own);
    const first = String($('#organisedBy').value || '').split(/\n/).map(x => x.trim()).filter(Boolean)[0] || '';
    const acr = first.match(/\(([A-Z][A-Za-z0-9-]{1,12})\)/);
    if (acr) return acr[1].replace(/-/g, '');
    const dept = first.match(/^Department of (.+?)(?:,|$)/i);
    const name = dept ? dept[1] : first;
    const words = name.replace(/[^A-Za-z ]+/g, ' ').split(/\s+/).filter(w => w && !/^(of|and|the|for|in)$/i.test(w));
    if (!words.length) return '';
    return words.length === 1 ? camel(words[0]) : words.map(w => w[0].toUpperCase()).join('');
  }
  function slug(s) { return camel(s); }
  function updateFileName() {
    if (fileNameTouched) return;
    const parts = [shortYear($('#academicYear').value), organiserShort(), camel($('#eventName').value)].filter(Boolean);
    $('#fileName').value = (parts.length ? parts.join('_') : 'Event_Report') + '.docx';
  }

  // ---------------------------------------------------------------- validation
  const COURSE_CODE_RE = /^\d{2}[A-Z]{2,5}\/[A-Z]{2,5}\/[A-Z0-9]{2,8}$/;
  function isAllCaps(v) {
    // shouting check that ignores short acronyms such as IQAC or NSS
    const long = String(v || '').split(/[^A-Za-z]+/).filter(w => w.length >= 5);
    return long.length > 0 && long.every(w => w === w.toUpperCase());
  }
  function normaliseMobile(v) {
    let d = String(v || '').replace(/[\s\-().]/g, '');
    d = d.replace(/^\+?91(?=\d{10}$)/, '').replace(/^0(?=\d{10}$)/, '');
    return d;
  }
  // Each check returns an error message, or '' when the value is fine. Empty optional fields pass.
  const CHECKS = {
    participants: v => !v ? '' : (/^\d+$/.test(v) && Number(v) > 0 ? '' : 'Enter the number of participants in digits, e.g. 241.'),
    eventName: v => isAllCaps(v) ? 'Please don’t type the name in capital letters, e.g. A Two-Day Workshop on Data Analytics.' : '',
    cfFacultyName: v => isAllCaps(v) ? 'Please don’t type the name in capital letters, e.g. Dr. Rebecca Devaprasad.' : '',
    cfFacultyMobile: v => !v ? '' : (/^[6-9]\d{9}$/.test(normaliseMobile(v)) ? '' : 'Enter a 10-digit mobile number, e.g. 9876543210.'),
    cfCourseCodes: v => !v ? '' : (v.split(',').map(x => x.trim().toUpperCase()).filter(Boolean).every(x => COURSE_CODE_RE.test(x)) ? '' : 'Use the format 23CS/MC/CN55. Separate several codes with commas.'),
    courseCode: v => !v ? '' : (v.split(',').map(x => x.trim().toUpperCase()).filter(Boolean).every(x => COURSE_CODE_RE.test(x)) ? '' : 'Use the format 23CS/MC/CN55.')
  };
  // tidy values once the person leaves the field
  const TIDY = {
    cfFacultyMobile: v => { const d = normaliseMobile(v); return /^\d{10}$/.test(d) ? d : v; },
    cfCourseCodes: v => v.split(',').map(x => x.trim().toUpperCase()).filter(Boolean).join(', '),
    courseCode: v => v.split(',').map(x => x.trim().toUpperCase()).filter(Boolean).join(', ')
  };

  function fieldError(el, msg) {
    const host = el.closest('.field') || el.parentNode;
    let err = host.querySelector(':scope > .field-error');
    el.classList.toggle('invalid', !!msg);
    if (msg) {
      if (!err) { err = document.createElement('small'); err.className = 'field-error'; host.appendChild(err); }
      err.textContent = msg;
    } else if (err) err.remove();
  }

  /** Checks the given ids. `required` ids must be filled. Returns the first bad element, or null. */
  function validate(ids, required) {
    let first = null;
    ids.forEach(id => {
      const el = $('#' + id); if (!el) return;
      const v = el.value.trim();
      let msg = '';
      if (required.includes(id) && !v) msg = el.tagName === 'SELECT' ? 'Please choose one.' : 'This is required.';
      else if (CHECKS[id]) msg = CHECKS[id](v);
      fieldError(el, msg);
      if (msg && !first) first = el;
    });
    return first;
  }

  function goTo(el, message) {
    setStatus(message, 'error');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (el.focus) el.focus({ preventScroll: true });
  }

  function initValidation() {
    Object.keys(CHECKS).forEach(id => {
      const el = $('#' + id); if (!el) return;
      el.addEventListener('blur', () => {
        const v = el.value.trim();
        if (TIDY[id] && v && !CHECKS[id](TIDY[id](v))) el.value = TIDY[id](v);
        fieldError(el, CHECKS[id](el.value.trim()));
      });
    });
    // clear an error as soon as the person starts fixing it
    document.addEventListener('input', e => { if (e.target.classList && e.target.classList.contains('invalid')) fieldError(e.target, ''); });
    document.addEventListener('change', e => {
      if (e.target.tagName === 'SELECT' && e.target.value) fieldError(e.target, '');
      if (e.target.closest && e.target.closest('#cfPickers')) $('#cfPickers').classList.remove('invalid');
    });
  }

  // ---------------------------------------------------------------- generate
  async function generate(e) {
    e.preventDefault();
    const required = ['eventName', 'organisedBy', 'dateFrom', 'dateTo', 'dateText', 'participants'];
    const firstBad = validate(required.concat($('#curricular').checked ? ['courseCode'] : []), required);
    if (firstBad) { goTo(firstBad, 'Please correct the highlighted field before generating the report.'); return; }
    const data = buildData();
    const missing = [];
    if (!data.objectives.length) missing.push('objectives');
    if (!data.outcomes.length) missing.push('outcomes');
    if (!data.photos.length) missing.push('photographs');
    if (!data.participantPages.length) missing.push('participant list');
    if (!data.feedbackPages.length && !data.feedbackText.trim()) missing.push('feedback');
    if (!data.signatories.some(s => s.img)) missing.push('signature image');
    const uncaptioned = data.photos.filter(p => !String(p.caption || '').trim()).length;

    const btn = $('#btnGenerate');
    btn.disabled = true; setStatus('Building the Word document…');
    try {
      const blob = await window.SMCDocx.buildDocx(data);
      let name = $('#fileName').value.trim() || 'Event_Report.docx';
      if (!/\.docx$/i.test(name)) name += '.docx';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);
      reportGenerated = true; updateNav();
      let msg = 'Downloaded ' + name + ' (' + (blob.size / 1048576).toFixed(1) + ' MB). Next: step 12, College Event Entry Form.';
      if (missing.length) msg += ' Not included: ' + missing.join(', ') + '.';
      if (uncaptioned) msg += ' ' + uncaptioned + ' photograph' + (uncaptioned > 1 ? 's have' : ' has') + ' no caption.';
      setStatus(msg, missing.length || uncaptioned ? '' : 'ok');
    } catch (err) {
      console.error(err);
      setStatus('Could not build the report: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  }

  // ---------------------------------------------------------------- Google Form pre-fill
  function formValues() {
    const val = id => $('#' + id).value.trim();
    const groups = {};
    CF_GROUPS.forEach(g => { groups[g] = $$('.check-grid[data-group="' + g + '"] input:checked').map(i => i.value); });
    const codes = TIDY.cfCourseCodes(val('cfCourseCodes') || ($('#curricular').checked ? val('courseCode') : ''));
    return {
      academicYear: window.SMCForm.academicYearOption(val('academicYear')),
      eventName: val('eventName'),
      startDate: val('dateFrom'),
      endDate: val('dateTo') || val('dateFrom'),
      facultyName: val('cfFacultyName'),
      facultyMobile: normaliseMobile(val('cfFacultyMobile')),
      level: val('cfLevel'),
      mode: val('cfMode'),
      departments: groups.departments, centres: groups.centres, clubs: groups.clubs, units: groups.units,
      mou: val('cfMou'), alumnae: val('cfAlumnae'), fmm150: val('cfFmm150'),
      category: val('cfCategory'), theme: val('cfTheme'),
      courseCodes: codes
    };
  }

  function updatePickCounts() {
    CF_GROUPS.forEach(g => {
      const n = $$('.check-grid[data-group="' + g + '"] input:checked').length;
      const el = $('.pick-count[data-for="' + g + '"]');
      if (el) el.textContent = n ? n + ' selected' : '';
    });
  }

  let courseCodesTouched = false;
  function initCollegeForm() {
    const cfg = window.SMC_COLLEGE_FORM;
    if (!cfg || !window.SMCForm) { $('#sec-college').hidden = true; $('#btnForm').hidden = true; return; }
    // dropdowns
    $$('#sec-college select[data-opts]').forEach(sel => {
      const blank = document.createElement('option'); blank.value = ''; blank.textContent = 'Select…'; sel.appendChild(blank);
      cfg.options[sel.dataset.opts].forEach(o => { const op = document.createElement('option'); op.value = op.textContent = o; sel.appendChild(op); });
    });
    // checkbox groups
    $$('.check-grid[data-group]').forEach(box => {
      cfg.options[box.dataset.group].forEach(o => {
        const l = document.createElement('label');
        const i = document.createElement('input'); i.type = 'checkbox'; i.value = o;
        l.appendChild(i); l.appendChild(document.createTextNode(o));
        box.appendChild(l);
      });
    });
    $('#sec-college').addEventListener('change', e => { if (e.target.type === 'checkbox') updatePickCounts(); });
    // course code follows the Objectives course code unless edited here
    $('#courseCode').addEventListener('input', () => { if (!courseCodesTouched) $('#cfCourseCodes').value = $('#courseCode').value; });
    $('#cfCourseCodes').addEventListener('input', () => { courseCodesTouched = !!$('#cfCourseCodes').value.trim(); });
    $('#cfOrganiser').addEventListener('input', updateFileName);
    $('#organisedBy').addEventListener('input', updateFileName);
    $('#academicYear').addEventListener('change', updateFileName);
    // build the link at the moment of clicking so it carries the latest details
    ['#btnForm'].forEach(sel => $(sel).addEventListener('click', e => {
      const a = e.currentTarget;
      // the college form needs these; check them here so nothing is missed there
      const required = ['cfFacultyName', 'cfFacultyMobile', 'cfLevel', 'cfMode', 'cfMou', 'cfAlumnae', 'cfFmm150', 'cfCategory', 'cfTheme'];
      const eventBad = validate(['eventName', 'dateFrom', 'dateTo'], ['eventName', 'dateFrom', 'dateTo']);
      const formBad = validate(required.concat(['cfCourseCodes']), required);
      const noOrganiser = !$$('#cfPickers input:checked').length;
      $('#cfPickers').classList.toggle('invalid', noOrganiser);
      if (eventBad || formBad || noOrganiser) {
        e.preventDefault();
        if (eventBad) goTo(eventBad, 'Please fill in the event name and dates in step 1 first.');
        else if (formBad) goTo(formBad, 'Please complete the highlighted fields before opening the college form.');
        else goTo($('#cfPickers'), 'Please tick at least one organising department, centre, club or unit.');
        return;
      }
      a.href = window.SMCForm.buildPrefillUrl(formValues());
      setStatus('College form opened in a new tab with your details filled in. Check the answers, attach the report, then submit.', 'ok');
    }));
  }

  // ---------------------------------------------------------------- drafts
  function saveDraft() {
    const d = collectText();
    d._app = 'smc-event-report'; d._version = 1; d._saved = new Date().toISOString();
    const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'Draft_' + (slug(d.eventName) || 'Event_Report') + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
    dirty = false;
    setStatus('Draft saved (text only). Images need to be uploaded again when you open the draft.', 'ok');
  }
  function openDraft(file) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (d._app !== 'smc-event-report') throw new Error('not a draft from this app');
        fillText(d);
        fileNameTouched = !!d.fileName;
        setStatus('Draft opened. Please upload the images again.', 'ok');
      } catch (err) { setStatus('Could not open the draft: ' + err.message, 'error'); }
    };
    r.readAsText(file);
  }

  function resetForm() {
    if (!window.confirm('Clear everything in the form?')) return;
    $('#reportForm').reset();
    Object.keys(state).forEach(k => { state[k].forEach(x => URL.revokeObjectURL((x.img || x).url)); state[k] = []; render(k); });
    $('#sessions').innerHTML = ''; $('#signatories').innerHTML = '';
    addSignatory();
    $('#courseBlock').hidden = true;
    $('#inviteCaption').value = 'Invite of the Event';
    courseCodesTouched = false; updatePickCounts();
    fileNameTouched = false; updateFileName();
    $$('.invalid').forEach(el => el.classList.remove('invalid'));
    $$('.field-error').forEach(el => el.remove());
    setStatus(''); changed(); dirty = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------------------------------------------------------------- nav highlight
  function initNavHighlight() {
    if (!('IntersectionObserver' in window)) return;
    const links = $$('#navList a');
    const obs = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting) links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + en.target.id));
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    $$('section.card').forEach(s => obs.observe(s));
  }

  // ---------------------------------------------------------------- init
  function init() {
    initAcademicYear();
    addSignatory();
    updateFileName();
    updateCounts();

    $$('section .dropzone[data-target]').forEach(dz => wireDropzone(dz, files => handleFiles(dz.dataset.target, files, dz)));

    $('#dateFrom').addEventListener('change', onDateChange);
    $('#dateTo').addEventListener('change', onDateChange);
    $('#eventName').addEventListener('input', updateFileName);
    $('#dateText').addEventListener('input', updateFileName);
    $('#fileName').addEventListener('input', () => { fileNameTouched = true; });
    $('#curricular').addEventListener('change', e => { $('#courseBlock').hidden = !e.target.checked; });
    $('#addSession').addEventListener('click', () => { const n = addSession(); $('.s-title', n).focus(); changed(); });
    $('#addSignatory').addEventListener('click', () => { addSignatory(); changed(); });
    $('#reportForm').addEventListener('input', e => { if (e.target.classList.contains('invalid') && e.target.value.trim()) e.target.classList.remove('invalid'); changed(); });
    $('#reportForm').addEventListener('submit', generate);
    $('#btnSaveDraft').addEventListener('click', saveDraft);
    $('#draftFile').addEventListener('change', e => { if (e.target.files[0]) openDraft(e.target.files[0]); e.target.value = ''; });
    $('#btnReset').addEventListener('click', resetForm);
    // a file dropped outside an upload box should not replace the page
    ['dragover', 'drop'].forEach(ev => window.addEventListener(ev, e => { if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) e.preventDefault(); }));
    window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
    initNavHighlight();
    initCollegeForm();
    initValidation();

    if (!window.JSZip || !window.SMC_TEMPLATE_B64) setStatus('A required file did not load. Please make sure the lib/ and js/ folders were uploaded.', 'error');
    dirty = false;
  }

  document.addEventListener('DOMContentLoaded', init);

  // exposed for testing
  window.SMCApp = { state, buildData, processFile };
})();

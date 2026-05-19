/* ══════════════════════════════════════════════════════════════════════
   generate-demo-pack.js
   ──────────────────────────────────────────────────────────────────────
   Launches headless Chrome (via puppeteer-core + your installed Chrome),
   loads the inspection app from the local file system, injects a
   realistic demo state, then calls every PDF generator and writes the
   output PDFs into C:\Users\arche\Downloads.

   Run with: node scripts/generate-demo-pack.js
   ══════════════════════════════════════════════════════════════════════ */
const path  = require('path');
const fs    = require('fs');
const os    = require('os');
const puppeteer = require('puppeteer-core');

const REPO_ROOT  = path.resolve(__dirname, '..');
const INDEX_PATH = path.join(REPO_ROOT, 'public', 'index.html');
const SEED_PATH  = path.join(__dirname, 'demo-seed.js');
const CHROME     = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUTPUT_DIR = path.join(os.homedir(), 'Downloads');

(async () => {
  if(!fs.existsSync(INDEX_PATH)) throw new Error(`Missing ${INDEX_PATH}`);
  if(!fs.existsSync(SEED_PATH))  throw new Error(`Missing ${SEED_PATH}`);
  if(!fs.existsSync(CHROME))     throw new Error(`Missing Chrome at ${CHROME}`);

  console.log('▸ Launching headless Chrome…');
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    protocolTimeout: 180000,
    args: ['--no-sandbox','--disable-gpu','--allow-file-access-from-files']
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);

  // Auto-dismiss any confirm/alert prompts the app might raise so the
  // headless run doesn't hang on a missing user response.
  page.on('dialog', async d => { try { await d.accept(); } catch(e){} });
  page.on('pageerror', e => console.warn('  [page error]', e.message));
  page.on('console',   m => { const t = m.text(); if(/error|fail/i.test(t)) console.warn('  [page console]', t); });

  // Capture every doc.save / browser-download from the app and pipe each
  // PDF binary back to Node so we can write it to Downloads.
  const captures = [];
  // We can override the filename for the NEXT capture from Node-side, so we
  // can name files by inspection rather than relying on the generator's
  // auto-name (which collides when multiple Apr/May walkrounds exist).
  let nextOverride = null;
  await page.exposeFunction('__capturePdf', (filename, base64) => {
    const finalName = nextOverride || filename;
    nextOverride = null;
    captures.push({ filename: finalName, base64 });
    console.log('  ◂ captured', finalName, '(' + Math.round(base64.length*0.75/1024) + ' KB)');
  });
  const setNextFilename = (name) => { nextOverride = name; };

  // Load the app from the local filesystem
  const fileUrl = 'file:///' + INDEX_PATH.replace(/\\/g,'/');
  console.log('▸ Loading app:', fileUrl);
  await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });

  // Give DOMContentLoaded handlers a moment to run + signature pads to settle
  await new Promise(r => setTimeout(r, 1500));

  // Monkey-patch the download function so PDFs are captured as base64 in-page
  // and forwarded to Node via the exposeFunction bridge.
  await page.evaluate(() => {
    // Always-accept confirm/alert so the seed doesn't stop on "not signed in"
    window.confirm = () => true;
    window.alert   = () => {};
    // Replace savePdfWithFolderPicker — it normally clicks <a download>.
    window.savePdfWithFolderPicker = async (blob, filename) => {
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = '';
      for(let i=0;i<buf.length;i++) bin += String.fromCharCode(buf[i]);
      const b64 = btoa(bin);
      await window.__capturePdf(filename, b64);
    };
    // Make the toast a no-op so it doesn't flood the console
    window.showToast = () => {};
    // Bypass folder picker modal entirely
    window.openPdfOptions = window.openPdfOptions || (()=>{});
  });

  // Inject seed
  console.log('▸ Injecting demo seed…');
  const seed = fs.readFileSync(SEED_PATH, 'utf8');
  await page.evaluate(seed);
  // Wait for re-render + saveData to complete
  await new Promise(r => setTimeout(r, 1500));

  // FORCE-set the demo brand so the PDFs render in the client's livery
  // (Easy Travel Leeds — navy + gold). Without this they'd default to
  // AHS Compliance Consulting in cyan.
  await page.evaluate(() => {
    if(!S.branding) S.branding = {};
    S.branding.name      = 'Easy Travel Leeds';
    S.branding.tagline   = 'Coach Operator · Leeds';
    S.branding.website   = 'www.easytravelleeds.co.uk';
    S.branding.phone     = '0113 555 0123';
    S.branding.email     = 'fleet@easytravelleeds.co.uk';
    S.branding.primary   = '#1D428A';   // Leeds navy
    S.branding.accent    = '#FFCD00';   // Leeds gold
    S.branding.textColor = '#1a1a1a';
    if(typeof applyBrandingToCSS === 'function') applyBrandingToCSS();
    if(typeof saveData === 'function') saveData();
  });

  // Get the list of demo inspections so we can generate per-card PDFs.
  // We grab `periodTo` so we can name each PDF distinctly.
  const inspections = await page.evaluate(() =>
    (S.inspections||[])
      .filter(i => String(i.id).startsWith('demo_'))
      .map(i => ({
        id: i.id, kind: i.kind, typeId: i.typeId,
        title: i.title || i.typeName,
        periodTo: i.periodTo
      }))
  );
  console.log(`▸ Found ${inspections.length} demo inspections:`);
  inspections.forEach(i => console.log(`    · [${i.kind}] ${i.title} (${i.id})`));

  // Map an inspection to a friendly filename — collision-safe across the set.
  const friendlyFilename = (insp, indexOneBased) => {
    const t = insp.title.replace(/[\\\/:*?"<>|]+/g,' ').replace(/\s+/g,' ').trim();
    const prefix = String(indexOneBased).padStart(2,'0');
    return `Easy-Travel-Leeds-${prefix}-${t}-${insp.periodTo}.pdf`;
  };

  // 1) Generate one PDF per inspection (per-card 📄 PDF button)
  for(let i = 0; i < inspections.length; i++){
    const insp = inspections[i];
    const fname = friendlyFilename(insp, i+1);
    console.log(`▸ Generating per-card PDF for: ${insp.title}  →  ${fname}`);
    setNextFilename(fname);
    await page.evaluate(id => {
      window.generateSingleInspectionPDF(id);
    }, insp.id);
    await new Promise(r => setTimeout(r, 1500));
  }

  // 2) Generate the bulk Monthly Report PDF covering every inspection
  const bulkName = `Easy-Travel-Leeds-00-MASTER-Monthly-Report-2026-05.pdf`;
  console.log(`▸ Generating bulk Monthly Report PDF (all demo inspections)  →  ${bulkName}`);
  setNextFilename(bulkName);
  await page.evaluate(() => {
    const set = (id, v) => { const el = document.getElementById(id); if(el) el.value = v; };
    set('pdfClientName',  'Easy Travel Leeds');
    set('pdfPreparedBy',  'AHS Compliance Consulting');
    set('pdfReportRef',   'AHS-DEMO-PACK-2026-05');
    set('pdfReportStatus','final');
    set('reportDateFrom', '');
    set('reportDateTo',   '');
    if(typeof generatePDF === 'function') generatePDF();
  });
  await new Promise(r => setTimeout(r, 5000));

  // Wipe any previous AHS-Demo-* PDFs from a prior run so the user doesn't
  // end up with duplicates from earlier iterations.
  try {
    const existing = fs.readdirSync(OUTPUT_DIR);
    let cleared = 0;
    for(const f of existing){
      if(/^(AHS-Demo-|Easy-Travel-Leeds-)/.test(f) && f.toLowerCase().endsWith('.pdf')){
        try { fs.unlinkSync(path.join(OUTPUT_DIR, f)); cleared++; } catch(e){}
      }
    }
    if(cleared) console.log(`▸ Cleared ${cleared} stale demo PDFs from previous runs`);
  } catch(e){ /* Downloads might not exist? unlikely */ }

  // Write all captured PDFs to Downloads.
  console.log(`▸ Writing ${captures.length} PDFs to ${OUTPUT_DIR}…`);
  const written = [];
  const usedNames = new Set();
  captures.forEach((c) => {
    let base = c.filename.replace(/[\\\/:*?"<>|]/g,'-');
    if(usedNames.has(base.toLowerCase())){
      const ext = path.extname(base);
      const stem = base.slice(0, -ext.length);
      let n = 2;
      while(usedNames.has((stem + '-' + n + ext).toLowerCase())) n++;
      base = stem + '-' + n + ext;
    }
    usedNames.add(base.toLowerCase());
    const fullPath  = path.join(OUTPUT_DIR, base);
    fs.writeFileSync(fullPath, Buffer.from(c.base64, 'base64'));
    written.push(fullPath);
    console.log('  ✓', fullPath);
  });

  await browser.close();

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(`✓ DONE — ${written.length} PDFs written to your Downloads folder.`);
  console.log('══════════════════════════════════════════════════════════════');
  written.forEach(p => console.log('  ', path.basename(p)));
})().catch(err => {
  console.error('\n✗ FAILED:', err);
  process.exit(1);
});

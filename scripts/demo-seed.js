/* ══════════════════════════════════════════════════════════════════════
   DEMO PACK SEED — paste this into the browser DevTools console
   ──────────────────────────────────────────────────────────────────────
   Purpose: populate the signed-in tenant with a realistic portfolio of
   inspections so you can generate a full client-presentation PDF pack
   from the Monthly Report tab in ~30 seconds.

   USAGE (when you're back at the keyboard)
   ────────────────────────────────────────
   1. Open https://inspections.archerhs.co.uk (or your local dev URL)
   2. Sign in
   3. Open DevTools (F12 or Ctrl+Shift+I) → Console tab
   4. Copy this WHOLE file and paste it into the console, press Enter
   5. Wait ~2 seconds for the "✓ Demo pack seeded" toast
   6. Go to the Monthly Report tab
   7. Click the cyan 📄 PDF button on each card → each PDF downloads
   8. Optionally click "📄 Build PDF" at the top of Monthly Report
      to also produce a bulk multi-inspection report

   What gets seeded (8 inspections + 5 actions)
   ────────────────────────────────────────────
     • Near Miss — Forklift incident report (signed)
     • Tardiness — Late arrival report (signed)
     • Return to Work — Post-absence form
     • Refuelling Site Safety Induction — Pre-signed driver record
     • Workplace Inspection — Last Friday (mixed: 2 actions raised,
       1 rectified on site)
     • Workplace Inspection — 2 weeks ago (all-pass clean record)
     • Workplace Inspection — 4 weeks ago (2 actions, 1 resolved,
       1 overdue — demonstrates the audit trail)
     • Workplace Inspection — 6 weeks ago (1 action, fully resolved)

   To CLEAR everything afterwards (back to a clean tenant):
     S.inspections = []; S.actions = []; saveData(); _rerenderEverything();
   ══════════════════════════════════════════════════════════════════════ */

(async function seedDemoPack(){
  if(typeof S === 'undefined' || typeof saveData !== 'function'){
    alert('Demo seed must be run inside the inspections app, while signed in.');
    return;
  }
  if(!Auth || !Auth.isSignedIn()){
    if(!confirm('You are not signed in. The seed will only save to localStorage (no server sync). Continue?')) return;
  }

  // ── Helper: draw a believable signature on a canvas → PNG data URL ──
  function makeSignaturePng(seed = 'AHS'){
    const W = 600, H = 160;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#1a3a5a';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Deterministic pseudo-random based on seed string
    let s = 0; for(const ch of seed) s = (s*31 + ch.charCodeAt(0)) & 0xffff;
    const rnd = () => { s = (s*9301 + 49297) % 233280; return s/233280; };

    // 3 looping strokes that mimic a quick handwritten signature
    for(let stroke = 0; stroke < 3; stroke++){
      ctx.beginPath();
      let x = 60 + stroke*40 + rnd()*30;
      let y = H/2 + (rnd()-0.5)*20;
      ctx.moveTo(x, y);
      const segs = 12 + Math.floor(rnd()*6);
      for(let i = 0; i < segs; i++){
        x += 30 + rnd()*25;
        y = H/2 + Math.sin((i+stroke)*0.9 + rnd()*1.5) * (30 + rnd()*20);
        const cpx = x - 15 + (rnd()-0.5)*10;
        const cpy = y + (rnd()-0.5)*30;
        ctx.quadraticCurveTo(cpx, cpy, x, y);
        if(x > W-60) break;
      }
      ctx.stroke();
    }
    // A final flourish
    ctx.beginPath();
    ctx.moveTo(W*0.3, H*0.75);
    ctx.quadraticCurveTo(W*0.5, H*0.95, W*0.75, H*0.78);
    ctx.stroke();
    return c.toDataURL('image/png');
  }

  // ── Date helpers ──
  const today = new Date();
  const iso = d => d.toISOString().split('T')[0];
  const daysAgo = n => { const d = new Date(today); d.setDate(d.getDate()-n); return d; };
  const fmt = d => iso(d instanceof Date ? d : new Date(d));
  const isoT = d => (d instanceof Date ? d : new Date(d)).toISOString();

  // ── Pull the live forms / checklist out of state so the seed always
  //    matches whatever's deployed (no hardcoded item IDs to drift) ──
  const types = S.inspectionTypes || {};
  const FORM_DEFS = {
    near_miss:            types.near_miss            && types.near_miss.kind === 'form'            ? FORMS.near_miss            : null,
    tardiness:            types.tardiness            && types.tardiness.kind === 'form'            ? FORMS.tardiness            : null,
    return_to_work:       types.return_to_work       && types.return_to_work.kind === 'form'       ? FORMS.return_to_work       : null,
    refuelling_induction: types.refuelling_induction && types.refuelling_induction.kind === 'form' ? FORMS.refuelling_induction : null,
  };

  // The default Workplace Inspection (garage walkround) is in S.checklist
  const walkround = JSON.parse(JSON.stringify(S.checklist || []));

  // ── 1. NEAR MISS submission ──────────────────────────────────────
  if(FORM_DEFS.near_miss){
    const nm = FORM_DEFS.near_miss;
    S.inspections.push({
      id: 'demo_nm_' + Date.now(),
      kind: 'form',
      typeId: 'near_miss',
      typeName: nm.name,
      periodFrom: iso(daysAgo(1)),
      periodTo:   iso(daysAgo(1)),
      manager: S.branding?.name || 'Easy Travel Leeds',
      location: 'Workshop Aisle 3',
      ref: 'NM-2026-04',
      freq: 'weekly',
      generalNotes: '',
      title: 'Near Miss — Forklift / pedestrian close-call',
      inspType: '',
      formData: {
        findings: 'A counterbalance forklift exiting bay 3 did not sound its horn when emerging from behind racking. A pedestrian (parts dept. employee) walking the marked walkway had to step backwards to avoid being struck. No injury, no contact. The driver acknowledged the procedural lapse immediately. Briefed driver and posted reminder signage at bay-3 exit. Adding horn-check to daily pre-use FLT checks.',
        photo: []
      },
      formSnapshot: JSON.parse(JSON.stringify(nm)),
      submittedAt: isoT(daysAgo(1)),
      status: 'open',
      awaitingReview: true,
      signedOffBy: null, signedOffAt: null,
    });
  }

  // ── 2. TARDINESS submission ──────────────────────────────────────
  if(FORM_DEFS.tardiness){
    const t = FORM_DEFS.tardiness;
    const arrivalDt = new Date(daysAgo(3));
    arrivalDt.setHours(8, 47, 0, 0);
    S.inspections.push({
      id: 'demo_td_' + Date.now() + 1,
      kind: 'form',
      typeId: 'tardiness',
      typeName: t.name,
      periodFrom: iso(daysAgo(3)),
      periodTo:   iso(daysAgo(3)),
      manager: S.branding?.name || 'Easy Travel Leeds',
      location: 'Transport Office',
      ref: 'TD-2026-11',
      freq: 'weekly',
      generalNotes: '',
      title: 'Tardiness — A. Riley',
      inspType: '',
      formData: {
        completed_on: arrivalDt.toISOString().slice(0,16),
        employee_name: 'A. Riley',
        lateness_arrival: arrivalDt.toISOString().slice(0,16),
        contracted_start: '08:00',
        reason: 'M62 closed eastbound between junctions 27–28 following an early-morning RTC. Alternative A-road route added ~45 minutes to commute. Employee notified the duty manager via WhatsApp at 07:54.',
        support_needed: 'no',
        signed: makeSignaturePng('A. Riley'),
        signed_date: iso(daysAgo(3))
      },
      formSnapshot: JSON.parse(JSON.stringify(t)),
      submittedAt: isoT(daysAgo(3)),
      status: 'signed_off', awaitingReview: false,
      signedOffBy: 'L. Briggs', signedOffAt: isoT(daysAgo(2)),
    });
  }

  // ── 3. RETURN TO WORK submission ─────────────────────────────────
  if(FORM_DEFS.return_to_work){
    const r = FORM_DEFS.return_to_work;
    const lastDay  = daysAgo(8);
    const returnD  = daysAgo(5);
    const firstDay = daysAgo(11);
    const contactDt = new Date(firstDay);
    contactDt.setHours(7, 35, 0, 0);
    S.inspections.push({
      id: 'demo_rtw_' + Date.now() + 2,
      kind: 'form',
      typeId: 'return_to_work',
      typeName: r.name,
      periodFrom: iso(returnD),
      periodTo:   iso(returnD),
      manager: S.branding?.name || 'Easy Travel Leeds',
      location: 'Garage',
      ref: 'RTW-2026-07',
      freq: 'weekly',
      generalNotes: '',
      title: 'Return to Work — M. Holroyd',
      inspType: '',
      formData: {
        conducted_on: new Date(returnD.getTime()).toISOString().slice(0,16),
        employee_name: 'M. Holroyd',
        department: 'garage',
        first_day: iso(firstDay),
        last_day:  iso(lastDay),
        return_date: iso(returnD),
        contacted: 'yes',
        contact_datetime: contactDt.toISOString().slice(0,16),
        contact_who: 'Liam B. (workshop foreman)',
        absence_reason: 'Influenza-A confirmed by NHS 111 phone consultation on 2026-05-08. Bed rest advised; symptoms peaked days 2–3 then steadily improved. Cleared by GP for return on 2026-05-13.',
        gp_contacted: 'yes',
        fit_note: 'no',
        work_caused: 'no',
        has_disability: 'no'
      },
      formSnapshot: JSON.parse(JSON.stringify(r)),
      submittedAt: isoT(daysAgo(5)),
      status: 'signed_off', awaitingReview: false,
      signedOffBy: 'L. Briggs', signedOffAt: isoT(daysAgo(4)),
    });
  }

  // ── 4. REFUELLING INDUCTION — pre-signed driver record ───────────
  if(FORM_DEFS.refuelling_induction){
    const rf = FORM_DEFS.refuelling_induction;
    const condDt = new Date(daysAgo(2));
    condDt.setHours(13, 10, 0, 0);
    S.inspections.push({
      id: 'demo_rf_' + Date.now() + 3,
      kind: 'form',
      typeId: 'refuelling_induction',
      typeName: rf.name,
      periodFrom: iso(daysAgo(2)),
      periodTo:   iso(daysAgo(2)),
      manager: S.branding?.name || 'Easy Garage Services',
      location: 'Whitehall Road Industrial Estate',
      ref: 'RFI-2026-19',
      freq: 'weekly',
      generalNotes: '',
      title: 'Refuelling Site Induction — Watson Petroleum',
      inspType: '',
      formData: {
        conducted_on: condDt.toISOString().slice(0,16),
        operative: 'L. Briggs',
        driver_name: 'D. McKenzie (Watson Petroleum)',
        sig_date: iso(daysAgo(2)),
        signature: makeSignaturePng('D. McKenzie')
      },
      formSnapshot: JSON.parse(JSON.stringify(rf)),
      submittedAt: isoT(daysAgo(2)),
      status: 'signed_off', awaitingReview: false,
      signedOffBy: 'L. Briggs', signedOffAt: isoT(daysAgo(2)),
    });
  }

  // ── 5–8. WORKPLACE INSPECTION (checklist walkrounds) ──────────────
  // Helper: build a checklist inspection given a period, manager,
  // and an actionMap { sectionIndex: { itemIndex: 'pass'|'action'|'rectified'|'na' } }.
  // Unspecified items default to 'pass'.
  function buildWalkround({periodFrom, periodTo, ref, location, manager, title, actionMap = {}, rectifyMap = {}, notesMap = {}, status = 'signed_off', generalNotes = ''}){
    const results = {};
    const notes = {};
    const actionDetails = {};
    const rectifyDetails = {};
    walkround.forEach((sec, si) => {
      sec.items.forEach((item, ii) => {
        const flag = actionMap?.[si]?.[ii];
        results[item.id] = flag || 'pass';
        if(notesMap?.[si]?.[ii]){
          notes[item.id] = notesMap[si][ii];
        }
        if(flag === 'rectified'){
          rectifyDetails[item.id] = rectifyMap?.[si]?.[ii] || {note:'Issue addressed during walkround.', by: manager};
        }
      });
    });
    const insp = {
      id: 'demo_wi_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
      kind: 'checklist',
      typeId: 'garage_inspection',
      typeName: 'Garage Inspection (Full Walkround)',
      periodFrom, periodTo,
      manager, location,
      ref, freq:'weekly',
      generalNotes,
      title, inspType:'',
      results, notes, actionDetails, rectifyDetails,
      checklistSnapshot: walkround,
      submittedAt: isoT(periodTo),
      status, awaitingReview: status !== 'signed_off',
      signedOffBy: status === 'signed_off' ? manager : null,
      signedOffAt: status === 'signed_off' ? isoT(periodTo) : null,
    };
    return insp;
  }

  // Helper: push an action linked to an inspection
  function pushAction({insp, sectionName, itemName, issue, assignedTo, dueDate, note, resolved, resolvedBy, resolvedNote, resolvedAt}){
    S.actions.push({
      id: 'demo_act_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
      inspId: insp.id,
      periodTo: insp.periodTo,
      location: insp.location,
      manager: insp.manager,
      sectionName, itemName,
      itemId: 'demo_item',
      issue,
      note: note || '',
      assignedTo, dueDate,
      beforePhotos: [],
      resolved: !!resolved,
      resolvedBy: resolved ? (resolvedBy || insp.manager) : '',
      resolvedAt: resolved ? (resolvedAt || isoT(daysAgo(1))) : '',
      resolvedNote: resolved ? (resolvedNote || 'Completed as planned.') : '',
      afterPhotos: []
    });
  }

  // Bail if checklist is empty (no library loaded for some reason)
  if(walkround.length){

    // ── 5. Last Friday — mixed: 2 actions raised + 1 rectified ──
    const fri = daysAgo(today.getDay() === 0 ? 2 : today.getDay()+2);
    const friFrom = new Date(fri); friFrom.setDate(friFrom.getDate()-4);
    const insp1 = buildWalkround({
      periodFrom: iso(friFrom), periodTo: iso(fri),
      ref: 'WI-2026-19',
      location: S.branding?.name || 'Easy Travel Leeds — Main Workshop',
      manager: 'L. Briggs',
      title: 'Workshop Weekly Walkround',
      actionMap: {
        0: { 0: 'rectified' },              // first section, first item — rectified on site
        1: { 1: 'action', 3: 'action' }     // second section, items 1 and 3 — actions raised
      },
      notesMap: {
        2: { 0: 'COSHH cabinet door catch sticky — flagged for maintenance.' }
      },
      rectifyMap: {
        0: { 0: { note: 'Replaced damaged extension lead on the spot — sourced from the spares cabinet.', by: 'L. Briggs' } }
      },
      generalNotes: 'Overall housekeeping good. Two items raised for action plus one minor electrical item rectified on the spot. No serious concerns.',
      status: 'open'
    });
    S.inspections.push(insp1);
    pushAction({
      insp: insp1, sectionName: walkround[1]?.name || 'Section 2',
      itemName: walkround[1]?.items[1]?.name || 'Fire extinguisher inspection tag',
      issue: 'Fire extinguisher in bay 2 has an out-of-date service tag (dated 2025-11). Needs re-certification.',
      assignedTo: 'M. Holroyd', dueDate: iso(daysAgo(-7)),
      note: 'Booked with Phoenix Fire Safety for next Tuesday.', resolved: false
    });
    pushAction({
      insp: insp1, sectionName: walkround[1]?.name || 'Section 2',
      itemName: walkround[1]?.items[3]?.name || 'Emergency lighting test',
      issue: 'Emergency lighting in the rear store has not been tested this month (logbook missing entry).',
      assignedTo: 'L. Briggs', dueDate: iso(daysAgo(-3)),
      resolved: false
    });

    // ── 6. Two weeks ago — clean all-pass record ──
    const twoFri = daysAgo(14);
    const twoFrom = new Date(twoFri); twoFrom.setDate(twoFrom.getDate()-4);
    S.inspections.push(buildWalkround({
      periodFrom: iso(twoFrom), periodTo: iso(twoFri),
      ref: 'WI-2026-17',
      location: S.branding?.name || 'Easy Travel Leeds — Main Workshop',
      manager: 'L. Briggs',
      title: 'Workshop Weekly Walkround',
      generalNotes: 'Clean walkround — no items raised. Housekeeping excellent.',
      status: 'signed_off'
    }));

    // ── 7. Four weeks ago — 2 actions, 1 resolved + 1 OVERDUE ──
    const fourFri = daysAgo(28);
    const fourFrom = new Date(fourFri); fourFrom.setDate(fourFrom.getDate()-4);
    const insp3 = buildWalkround({
      periodFrom: iso(fourFrom), periodTo: iso(fourFri),
      ref: 'WI-2026-15',
      location: S.branding?.name || 'Easy Travel Leeds — Main Workshop',
      manager: 'L. Briggs',
      title: 'Workshop Weekly Walkround',
      actionMap: { 0: { 2: 'action' }, 2: { 1: 'action' } },
      generalNotes: 'Two issues raised, one closed promptly, one still open and now overdue — chased with team owner this week.',
      status: 'signed_off'
    });
    S.inspections.push(insp3);
    pushAction({
      insp: insp3, sectionName: walkround[0]?.name || 'Section 1',
      itemName: walkround[0]?.items[2]?.name || 'PAT testing labels',
      issue: 'Two small power tools missing current PAT labels. Removed from service pending test.',
      assignedTo: 'M. Holroyd', dueDate: iso(daysAgo(18)),
      resolved: true, resolvedBy: 'M. Holroyd', resolvedAt: isoT(daysAgo(17)),
      resolvedNote: 'Both tools tested + relabelled by external PAT contractor. Back in service.'
    });
    pushAction({
      insp: insp3, sectionName: walkround[2]?.name || 'Section 3',
      itemName: walkround[2]?.items[1]?.name || 'Spill kit re-stock',
      issue: 'Workshop spill kit missing 2× granulate sacks following overspill at end of January.',
      assignedTo: 'L. Briggs', dueDate: iso(daysAgo(14)),  // now overdue
      note: 'Reordered with supplier; awaiting next delivery.',
      resolved: false
    });

    // ── 8. Six weeks ago — 1 action, fully resolved ──
    const sixFri = daysAgo(42);
    const sixFrom = new Date(sixFri); sixFrom.setDate(sixFrom.getDate()-4);
    const insp4 = buildWalkround({
      periodFrom: iso(sixFrom), periodTo: iso(sixFri),
      ref: 'WI-2026-13',
      location: S.branding?.name || 'Easy Travel Leeds — Main Workshop',
      manager: 'L. Briggs',
      title: 'Workshop Weekly Walkround',
      actionMap: { 1: { 0: 'action' } },
      generalNotes: 'One item raised and closed. No further concerns.',
      status: 'signed_off'
    });
    S.inspections.push(insp4);
    pushAction({
      insp: insp4, sectionName: walkround[1]?.name || 'Section 2',
      itemName: walkround[1]?.items[0]?.name || 'First-aid kit re-stock',
      issue: 'Workshop first-aid kit short of plasters and saline. Restocked from main store.',
      assignedTo: 'L. Briggs', dueDate: iso(daysAgo(38)),
      resolved: true, resolvedBy: 'L. Briggs', resolvedAt: isoT(daysAgo(38)),
      resolvedNote: 'Restocked same day from central first-aid cabinet.'
    });
  } // end if walkround.length

  // ── Save + render ──
  if(typeof saveData === 'function') saveData();
  if(typeof _rerenderEverything === 'function') _rerenderEverything();
  else if(typeof renderMonthlyReport === 'function') renderMonthlyReport();

  // Friendly summary in the toast + console
  const summary = `Seeded ${S.inspections.filter(i => i.id.startsWith('demo_')).length} inspections + ${S.actions.filter(a => a.id.startsWith('demo_act_')).length} actions.`;
  console.log('%c✓ Demo pack seeded', 'color:#1a7a4a;font-weight:700;font-size:14px;', summary);
  console.log('Next: go to the Monthly Report tab and click "📄 PDF" on each card to download the pack.');
  if(typeof showToast === 'function'){
    showToast('✓ Demo pack seeded — go to Monthly Report and click 📄 PDF on each card', 'success');
  }
})();

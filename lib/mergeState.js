// ══════════════════════════════════════════════════════════════
//  mergeAppState — combine two copies of a tenant's app state
//
//  The app is used by several people on several devices (employee on a
//  phone, manager on a desktop, assignee on another phone). Each device
//  posts its whole state. Overwriting meant a device holding an older copy
//  silently deleted inspections/actions another device had just saved.
//
//  Rules:
//    • inspections[] and actions[] are unioned by id.
//    • Same record on both sides → the newer edit wins (record._u, a ms
//      timestamp the browser stamps when it changes a record). Ties go to
//      `incoming`, so records without _u behave exactly as before.
//    • Deletes are remembered in state._deleted[key][id] so a device still
//      holding a deleted record can't bring it back.
//    • Every other top-level field is last-write-wins (`incoming`).
//
//  Returns { state, fromBase } — fromBase is true when the result holds
//  something `incoming` didn't have (a record, a newer edit or a delete),
//  i.e. the sender is behind and should be sent the merged state.
//
//  KEEP IDENTICAL to mergeAppState() in public/index.html.
// ══════════════════════════════════════════════════════════════
const REC_KEYS = ['inspections', 'actions'];

function mergeAppState(base, incoming){
  if(!base || typeof base !== 'object') return { state: incoming, fromBase: false };
  if(!incoming || typeof incoming !== 'object') return { state: base, fromBase: true };
  const out = Object.assign({}, base, incoming);
  let fromBase = false;
  const deleted = {};
  REC_KEYS.forEach(k => {
    const bd = (base._deleted && base._deleted[k]) || {};
    const id = (incoming._deleted && incoming._deleted[k]) || {};
    deleted[k] = Object.assign({}, bd, id);
    if(Object.keys(bd).some(x => !(x in id))) fromBase = true;
  });
  out._deleted = deleted;
  REC_KEYS.forEach(k => {
    const map = new Map();
    (Array.isArray(base[k]) ? base[k] : []).forEach(r => { if(r && r.id) map.set(r.id, r); });
    const inIds = new Set();
    (Array.isArray(incoming[k]) ? incoming[k] : []).forEach(r => {
      if(!r || !r.id) return;
      inIds.add(r.id);
      const cur = map.get(r.id);
      if(!cur || (r._u || 0) >= (cur._u || 0)) map.set(r.id, r);
      else fromBase = true;                       // base holds a newer edit
    });
    const list = [];
    map.forEach((r, rid) => {
      if(deleted[k][rid]) return;
      if(!inIds.has(rid)) fromBase = true;        // only base knows this record
      list.push(r);
    });
    out[k] = list;
  });
  return { state: out, fromBase };
}

module.exports = { mergeAppState };

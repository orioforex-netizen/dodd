// <dodd-photo pid="ext-0" placeholder="ด้านหน้า" radius="10"> — photo slot for DO DD reports.
// Stores the ORIGINAL uploaded file in IndexedDB (no resize, no re-encode) and shows it
// uncropped (object-fit: contain). Controls: ขยาย / เปลี่ยน / หมุน / ลบ.
// Multi-file: dropping/picking several files fills this slot, then the next empty slots
// of the same category (pid "<cat>-<index>"). window.doddPhotos.pick(cat) fills a category.
(() => {
  if (customElements.get('dodd-photo')) return;
  const DB = 'dodd-photos', ST = 'photos';
  let dbP = null;
  const db = () => dbP || (dbP = new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(ST);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  const run = async (mode, fn) => {
    const d = await db();
    return new Promise((res, rej) => {
      const t = d.transaction(ST, mode), req = fn(t.objectStore(ST));
      t.oncomplete = () => res(req ? req.result : undefined);
      t.onerror = t.onabort = () => rej(t.error);
    });
  };
  const idb = {
    get: k => run('readonly', s => s.get(k)),
    put: (k, v) => run('readwrite', s => s.put(v, k)),
    del: k => run('readwrite', s => s.delete(k)),
    keys: () => run('readonly', s => s.getAllKeys()),
    clear: () => run('readwrite', s => s.clear()),
  };
  const isImg = f => f && (/^image\//.test(f.type) || /\.(heic|heif)$/i.test(f.name || ''));
  const parse = pid => { const m = /^(.+)-(\d+)$/.exec(pid || ''); return m ? { cat: m[1], i: +m[2] } : null; };
  const live = new Set();
  let nt = 0;
  const notify = () => { clearTimeout(nt); nt = setTimeout(() => window.dispatchEvent(new CustomEvent('dodd-photos-changed')), 30); };

  let toastEl = null, toastT = 0;
  const toast = msg => {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.setAttribute('data-screen-only', '');
      toastEl.style.cssText = "position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:2147483646;max-width:90vw;font:600 13px/1.45 'Bai Jamjuree',system-ui,sans-serif;color:#fff;background:#1F3160;border-radius:999px;padding:9px 18px;box-shadow:0 6px 24px rgba(15,20,35,.25);pointer-events:none;transition:opacity .2s;opacity:0";
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.style.opacity = '1';
    clearTimeout(toastT);
    toastT = setTimeout(() => { toastEl.style.opacity = '0'; }, 3200);
  };

  const slotsOf = cat => [...live]
    .filter(el => { const p = parse(el.getAttribute('pid')); return p && p.cat === cat; })
    .sort((a, b) => parse(a.getAttribute('pid')).i - parse(b.getAttribute('pid')).i);

  async function distribute(cat, files, origin) {
    const imgs = [...files].filter(isImg);
    if (!imgs.length) { toast('ใช้ไฟล์รูปภาพเท่านั้น'); return; }
    const list = slotsOf(cat);
    let targets;
    if (origin) {
      const oi = parse(origin.getAttribute('pid')).i;
      const after = list.filter(el => el !== origin && !el._rec && parse(el.getAttribute('pid')).i > oi);
      const before = list.filter(el => el !== origin && !el._rec && parse(el.getAttribute('pid')).i < oi);
      targets = [origin, ...after, ...before];
    } else {
      targets = list.filter(el => !el._rec);
    }
    const n = Math.min(imgs.length, targets.length);
    let ok = 0;
    for (let k = 0; k < n; k++) if (await targets[k]._ingest(imgs[k])) ok++;
    const extra = imgs.length - n;
    if (extra > 0) toast('ใส่แล้ว ' + ok + ' รูป · ช่องในหมวดนี้เต็ม เหลือ ' + extra + ' รูปที่ไม่ได้ใส่');
    else if (imgs.length > 1) toast('ใส่แล้ว ' + ok + ' รูป');
    notify();
  }

  window.doddPhotos = {
    async clearAll() { try { await idb.clear(); } catch (e) {} live.forEach(el => el._load()); notify(); },
    async keys() { try { return (await idb.keys()).map(String); } catch (e) { return []; } },
    pick(cat) {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
      inp.style.display = 'none';
      inp.addEventListener('change', () => { if (inp.files && inp.files.length) distribute(cat, inp.files, null); inp.remove(); });
      document.body.appendChild(inp);
      inp.click();
    },
  };

  const css =
    ":host{position:absolute;inset:0;display:block;font-family:'Bai Jamjuree',system-ui,sans-serif;color:#6A6F80}" +
    '.f{position:absolute;inset:0;border-radius:var(--r,10px);overflow:hidden;background:#FBF4EA}' +
    ':host([data-filled]) .f{background:#F2ECE2}' +
    'img{position:absolute;left:50%;top:50%;width:100%;height:100%;object-fit:contain;transform:translate(-50%,-50%);display:none;user-select:none;-webkit-user-drag:none}' +
    '.e{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:8px;box-sizing:border-box;text-align:center;cursor:pointer;border:1.5px dashed #D8C6AA;border-radius:var(--r,10px)}' +
    '.e:hover{background:#F6ECDD}' +
    '.e svg{opacity:.55}' +
    '.e b{font-size:12.5px;font-weight:600;color:#4A4F60;line-height:1.35}' +
    '.e span{font-size:10.5px}' +
    ':host([data-over]) .f{box-shadow:inset 0 0 0 2px #1F3160;background:#EEF1F8}' +
    '.c{position:absolute;top:6px;right:6px;left:6px;display:flex;flex-wrap:wrap;justify-content:flex-end;gap:4px;opacity:0;pointer-events:none;transition:opacity .12s}' +
    ':host([data-filled]:hover) .c,:host([data-filled][data-show]) .c{opacity:1}' +
    ':host([data-filled]:hover) .c button,:host([data-filled][data-show]) .c button{pointer-events:auto}' +
    'button{font:inherit;font-size:10.5px;font-weight:600;line-height:1;border:0;border-radius:999px;padding:5px 8px;background:rgba(31,49,96,.9);color:#fff;cursor:pointer;pointer-events:none}' +
    'button:hover{background:#1F3160}' +
    'button.d{background:rgba(194,59,44,.92)}button.d:hover{background:#A82E21}' +
    '.msg{position:absolute;left:8px;right:8px;bottom:8px;display:none;font-size:11px;line-height:1.4;color:#B2321F;background:rgba(255,255,255,.94);border-radius:6px;padding:4px 6px;text-align:center}' +
    '.msg.on{display:block}' +
    '@media print{.c,.e,.msg{display:none!important}.f{background:transparent!important;box-shadow:none!important}}';
  const ICON = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>';

  class DoddPhoto extends HTMLElement {
    static get observedAttributes() { return ['pid', 'placeholder', 'radius']; }
    constructor() {
      super();
      const root = this.attachShadow({ mode: 'open' });
      root.innerHTML = '<style>' + css + '</style>' +
        '<div class="f"><img alt="" draggable="false">' +
        '<div class="e" data-dc-edit-transparent>' + ICON + '<b></b><span>คลิกหรือลากรูปมาวาง · เลือกได้หลายรูป</span></div>' +
        '<div class="msg"></div>' +
        '<div class="c" data-dc-edit-transparent><button data-a="zoom">ขยาย</button><button data-a="rep">เปลี่ยน</button><button data-a="rot">หมุน</button><button data-a="del" class="d">ลบ</button></div>' +
        '</div><input type="file" accept="image/*" hidden>';
      this._f = root.querySelector('.f');
      this._img = root.querySelector('img');
      this._e = root.querySelector('.e');
      this._b = root.querySelector('.e b');
      this._m = root.querySelector('.msg');
      this._del = root.querySelector('button.d');
      this._input = root.querySelector('input');
      this._gen = 0;
      this._rec = null;
      this._e.addEventListener('click', e => { e.stopPropagation(); this._open(true); });
      root.addEventListener('click', e => {
        const b = e.target && e.target.closest && e.target.closest('button');
        if (b) {
          e.stopPropagation();
          const a = b.dataset.a;
          if (a === 'rep') this._open(false);
          else if (a === 'rot') this._rotate();
          else if (a === 'zoom') this._zoom();
          else if (a === 'del') this._delete();
          return;
        }
        if (this.hasAttribute('data-filled')) this.toggleAttribute('data-show');
      });
      this._input.addEventListener('change', () => {
        const files = this._input.files ? [...this._input.files] : [];
        this._input.value = '';
        this._take(files);
      });
      this._img.addEventListener('load', () => this._msg(''));
      this._img.addEventListener('error', () => {
        if (this._img.getAttribute('src')) this._msg('เบราว์เซอร์นี้แสดงไฟล์นี้ไม่ได้ (เช่น HEIC) · กด เปลี่ยน แล้วเลือก JPG หรือ PNG');
      });
      const over = e => {
        if (!e.dataTransfer || ![...e.dataTransfer.types].includes('Files')) return;
        e.preventDefault(); e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
        this.setAttribute('data-over', '');
      };
      this.addEventListener('dragenter', over);
      this.addEventListener('dragover', over);
      this.addEventListener('dragleave', e => {
        if (e.relatedTarget && (e.relatedTarget === this || this.contains(e.relatedTarget))) return;
        this.removeAttribute('data-over');
      });
      this.addEventListener('drop', e => {
        e.preventDefault(); e.stopPropagation();
        this.removeAttribute('data-over');
        const files = e.dataTransfer && e.dataTransfer.files ? [...e.dataTransfer.files] : [];
        this._take(files);
      });
    }
    connectedCallback() {
      live.add(this);
      if (!this._ro) this._ro = new ResizeObserver(() => this._fit());
      this._ro.observe(this);
      this._radius();
      this._b.textContent = this.getAttribute('placeholder') || 'เพิ่มรูป';
      if (this._loadedPid !== (this.getAttribute('pid') || '')) this._load();
    }
    disconnectedCallback() {
      live.delete(this);
      if (this._ro) this._ro.disconnect();
    }
    attributeChangedCallback(n, o, v) {
      if (n === 'placeholder') this._b.textContent = v || 'เพิ่มรูป';
      if (n === 'radius') this._radius();
      if (n === 'pid' && o !== v && this.isConnected) this._load();
    }
    _open(multi) { this._input.multiple = !!multi; this._input.click(); }
    _take(files) {
      if (!files.length) return;
      const p = parse(this.getAttribute('pid'));
      if (files.length > 1 && p) distribute(p.cat, files, this);
      else if (!isImg(files[0])) this._msg('ใช้ไฟล์รูปภาพเท่านั้น');
      else this._ingest(files[0]).then(notify);
    }
    _radius() {
      const r = parseFloat(this.getAttribute('radius'));
      this._f.style.setProperty('--r', (Number.isFinite(r) ? r : 10) + 'px');
    }
    _msg(t) { this._m.textContent = t; this._m.classList.toggle('on', !!t); }
    async _load() {
      const pid = this.getAttribute('pid') || '';
      this._loadedPid = pid;
      const g = ++this._gen;
      let rec = null;
      if (pid) { try { rec = await idb.get(pid); } catch (e) {} }
      if (g !== this._gen) return;
      this._show(rec || null);
    }
    _show(rec) {
      this._rec = rec;
      if (this._url) { URL.revokeObjectURL(this._url); this._url = null; }
      this._msg('');
      this.removeAttribute('data-show');
      this._resetDel();
      if (rec && rec.blob) {
        this._url = URL.createObjectURL(rec.blob);
        this._img.src = this._url;
        this._img.style.display = 'block';
        this._e.style.display = 'none';
        this.setAttribute('data-filled', '');
      } else {
        this._img.removeAttribute('src');
        this._img.style.display = 'none';
        this._e.style.display = 'flex';
        this.removeAttribute('data-filled');
      }
      this._fit();
    }
    _fit() {
      const r = (this._rec && this._rec.rot) || 0, s = this._img.style;
      if (r % 180) { s.width = this.clientHeight + 'px'; s.height = this.clientWidth + 'px'; }
      else { s.width = '100%'; s.height = '100%'; }
      s.transform = 'translate(-50%,-50%) rotate(' + r + 'deg)';
    }
    async _ingest(file) {
      const pid = this.getAttribute('pid');
      if (!pid || !isImg(file)) return false;
      const rec = { blob: file, rot: 0, name: file.name, type: file.type, size: file.size, t: Date.now() };
      try { await idb.put(pid, rec); }
      catch (e) { this._msg('บันทึกรูปไม่สำเร็จ (พื้นที่เก็บข้อมูลอาจเต็ม)'); return false; }
      this._gen++;
      this._show(rec);
      return true;
    }
    async _rotate() {
      if (!this._rec) return;
      const rec = Object.assign({}, this._rec, { rot: ((this._rec.rot || 0) + 90) % 360 });
      this._rec = rec;
      this._fit();
      try { await idb.put(this.getAttribute('pid'), rec); } catch (e) {}
    }
    _resetDel() { this._armDel = false; clearTimeout(this._delT); this._del.textContent = 'ลบ'; }
    async _delete() {
      if (!this._armDel) {
        this._armDel = true;
        this._del.textContent = 'ยืนยันลบ';
        clearTimeout(this._delT);
        this._delT = setTimeout(() => this._resetDel(), 3000);
        return;
      }
      this._resetDel();
      try { await idb.del(this.getAttribute('pid')); } catch (e) {}
      this._gen++;
      this._show(null);
      notify();
    }
    _zoom() {
      if (!this._url) return;
      const r = (this._rec && this._rec.rot) || 0, side = r % 180;
      const o = document.createElement('div');
      o.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(15,20,35,.9);display:flex;align-items:center;justify-content:center;cursor:zoom-out';
      const im = document.createElement('img');
      im.src = this._url;
      im.style.cssText = 'max-width:' + (side ? '94vh' : '94vw') + ';max-height:' + (side ? '94vw' : '94vh') + ';object-fit:contain;transform:rotate(' + r + 'deg)';
      o.appendChild(im);
      const close = () => { o.remove(); document.removeEventListener('keydown', key, true); };
      const key = e => { if (e.key === 'Escape') close(); };
      o.addEventListener('click', close);
      document.addEventListener('keydown', key, true);
      document.body.appendChild(o);
    }
  }
  customElements.define('dodd-photo', DoddPhoto);
  notify();
})();

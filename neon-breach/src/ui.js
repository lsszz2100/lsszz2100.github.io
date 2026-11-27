/* Neon Breach — DOM interface: HUD, screens, upgrade deck, results. */

import { clamp, lerp } from './core.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor(i18n) {
    this.i18n = i18n;
    this.screen = 'loading';
    this._cache = {};
    this.hpFill = $('hp-fill');
    this.shFill = $('sh-fill');
    this.hpNum = $('hp-num');
    this.shNum = $('sh-num');
    this.ammoMag = $('ammo-mag');
    this.ammoRes = $('ammo-res');
    this.weaponName = $('weapon-name');
    this.reloadBar = $('reload-fill');
    this.reloadWrap = document.querySelector('.reload-bar');
    this.waveNum = $('wave-num');
    this.waveSub = $('wave-sub');
    this.scoreEl = $('score');
    this.comboEl = $('combo');
    this.comboX = $('combo-x');
    this.comboN = $('combo-n');
    this.crosshair = $('crosshair');
    this.hitEl = $('hitmarker');
    this.feverEl = $('fever');
    this.vignette = $('dmg-vignette');
    this.feed = $('killfeed');
    this.toasts = $('toast-stack');
    this.bossWrap = $('boss-wrap');
    this.bossName = $('boss-name');
    this.bossFill = $('boss-fill');
    this.slotsEl = $('weapon-slots');
    this.perfEl = $('perf');
    this.dmgArrows = $('dmg-arrows');
    this.dashPips = document.querySelectorAll('.dash-pips i');
    this.hud = $('hud');
    this._toastCount = 0;
  }

  t(key, vars) { return this.i18n.t(key, vars); }

  /* ---------------------------------------------------------- screens */
  show(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('show'));
    const el = $(id);
    if (el) el.classList.add('show');
    this.screen = id;
  }

  hide(id) {
    const el = $(id);
    if (el) el.classList.remove('show');
  }

  hideAll() {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('show'));
    this.screen = null;
  }

  showHud(on) {
    this.hud.classList.toggle('hidden', !on);
    this.hud.setAttribute('aria-hidden', on ? 'false' : 'true');
  }

  showTouch(on) {
    $('touch').classList.toggle('hidden', !on);
    document.body.classList.toggle('touch', !!on);
  }

  /* ------------------------------------------------------------- hud */
  setVitals(hp, hpMax, sh, shMax) {
    const hpf = clamp(hp / hpMax, 0, 1);
    const shf = clamp(sh / shMax, 0, 1);
    if (this._cache.hp !== hp || this._cache.hpMax !== hpMax) {
      this.hpFill.style.width = (hpf * 100).toFixed(1) + '%';
      this.hpNum.textContent = Math.max(0, Math.ceil(hp));
      this.hpFill.parentElement.classList.toggle('low', hpf < 0.32);
      this._cache.hp = hp;
      this._cache.hpMax = hpMax;
    }
    if (this._cache.sh !== sh) {
      this.shFill.style.width = (shf * 100).toFixed(1) + '%';
      this.shNum.textContent = Math.max(0, Math.ceil(sh));
      this._cache.sh = sh;
    }
  }

  setAmmo(def, mag, reserve, reloading, reloadK) {
    if (this._cache.mag !== mag || this._cache.res !== reserve || this._cache.wid !== def.id) {
      this.ammoMag.textContent = mag;
      this.ammoRes.textContent = '/ ' + reserve;
      this.ammoMag.classList.toggle('low', mag <= Math.max(2, def.mag * 0.25));
      this.weaponName.textContent = def.name;
      this._cache.mag = mag;
      this._cache.res = reserve;
      this._cache.wid = def.id;
    }
    this.reloadWrap.classList.toggle('on', reloading);
    if (reloading) this.reloadBar.style.width = (clamp(reloadK, 0, 1) * 100).toFixed(0) + '%';
  }

  setScore(score, combo, mult) {
    if (this._cache.score !== score) {
      this.scoreEl.textContent = score.toLocaleString('en-US');
      this._cache.score = score;
    }
    this.comboX.textContent = 'x' + mult.toFixed(1);
    this.comboN.textContent = combo;
    this.comboEl.classList.toggle('hot', mult >= 2);
  }

  setWave(n, label) {
    if (this._cache.wave !== n) {
      this.waveNum.textContent = n;
      this._cache.wave = n;
    }
    if (label !== undefined && this._cache.waveSub !== label) {
      this.waveSub.textContent = label;
      this._cache.waveSub = label;
    }
  }

  setDash(pips) {
    for (let i = 0; i < this.dashPips.length; i++) {
      const v = pips[i] === undefined ? 0 : pips[i];
      this.dashPips[i].style.setProperty('--f', v.toFixed(2));
    }
  }

  setCrosshair(gap, len, target, enemy) {
    const c = this.crosshair;
    const key = gap;
    if (this._cache.gap !== key) {
      c.style.setProperty('--gap', gap.toFixed(1) + 'px');
      c.style.setProperty('--len', len.toFixed(1) + 'px');
      this._cache.gap = key;
    }
    if (this._cache.target !== target) {
      c.classList.toggle('target', !!target);
      this._cache.target = target;
    }
    if (this._cache.enemy !== enemy) {
      c.classList.toggle('enemy', !!enemy);
      this._cache.enemy = enemy;
    }
  }

  hitmarker(kind) {
    const el = this.hitEl;
    el.className = 'hitmarker';
    void el.offsetWidth;
    el.classList.add('on');
    if (kind === 'head') el.classList.add('head');
    if (kind === 'kill') el.classList.add('kill');
  }

  setFever(on) {
    this.feverEl.classList.toggle('on', !!on);
  }

  flashDamage(amount) {
    this.vignette.style.opacity = String(clamp(0.18 + amount / 60, 0, 0.9));
    clearTimeout(this._dmgTimer);
    this._dmgTimer = setTimeout(() => { this.vignette.style.opacity = '0'; }, 180);
  }

  damageArrow(angle) {
    const wrap = document.createElement('div');
    wrap.className = 'dmg-arrow';
    wrap.style.transform = `rotate(${angle}rad)`;
    const bar = document.createElement('i');
    wrap.appendChild(bar);
    this.dmgArrows.appendChild(wrap);
    setTimeout(() => wrap.remove(), 720);
  }

  killfeed(text, cls) {
    const el = document.createElement('div');
    el.className = 'kf ' + (cls || '');
    el.textContent = text;
    this.feed.appendChild(el);
    while (this.feed.children.length > 5) this.feed.removeChild(this.feed.firstChild);
    setTimeout(() => {
      if (el.parentElement) el.remove();
    }, 2600);
  }

  toast(text, warn) {
    const el = document.createElement('div');
    el.className = 'toast' + (warn ? ' warn' : '');
    el.textContent = text;
    this.toasts.appendChild(el);
    while (this.toasts.children.length > 3) this.toasts.removeChild(this.toasts.firstChild);
    setTimeout(() => el.remove(), 2600);
  }

  boss(name, frac) {
    this.bossWrap.classList.remove('hidden');
    this.bossName.textContent = name;
    this.bossFill.style.width = (clamp(frac, 0, 1) * 100).toFixed(1) + '%';
  }

  hideBoss() { this.bossWrap.classList.add('hidden'); }

  setPerf(text) {
    this.perfEl.textContent = text;
  }

  showPerf(on) { this.perfEl.classList.toggle('hidden', !on); }

  /* ------------------------------------------------------- weapon slots */
  renderSlots(list, currentId) {
    const key = list.map((w) => w.id + (w.owned ? '1' : '0')).join(',') + '|' + currentId;
    if (this._cache.slots === key) return;
    this._cache.slots = key;
    this.slotsEl.innerHTML = '';
    list.forEach((w, i) => {
      const d = document.createElement('div');
      d.className = 'slot' + (w.id === currentId ? ' active' : '') + (w.owned ? '' : ' locked');
      d.innerHTML = `<span class="k">${i + 1}</span><span>${w.name}</span>`;
      this.slotsEl.appendChild(d);
    });
  }

  /* ------------------------------------------------------- upgrade deck */
  showUpgrade(cards, wave, onPick) {
    const head = $('upgrade-wave');
    head.textContent = this.t('upgrade.wave', { n: wave });
    const wrap = $('upgrade-cards');
    wrap.innerHTML = '';
    cards.forEach((c, i) => {
      const el = document.createElement('button');
      el.className = 'card ' + (c.rarity === 3 ? 'r3' : c.rarity === 2 ? 'r2' : 'r1');
      el.innerHTML = `
        <span class="rar">${c.rarityLabel}</span>
        <div class="glyph">${c.glyph}</div>
        <h3>${c.title}</h3>
        <p>${c.desc}</p>
        <span class="key">${i + 1}</span>`;
      el.addEventListener('click', () => onPick(i));
      wrap.appendChild(el);
    });
    this.show('screen-upgrade');
  }

  /* ------------------------------------------------------------ results */
  showResults(data) {
    $('res-kicker').textContent = this.t('results.kicker');
    $('res-title').textContent = this.t('results.overrun');
    $('res-record').classList.toggle('hidden', !data.newBest);
    $('res-score').textContent = Math.round(data.score).toLocaleString('en-US');
    $('res-wave').textContent = data.wave;
    $('res-kills').textContent = data.kills;
    $('res-best-combo').textContent = data.bestCombo;
    $('res-acc').textContent = Math.round(data.accuracy * 100) + '%';
    $('res-heads').textContent = data.headshots;
    const mm = Math.floor(data.time / 60);
    const ss = Math.floor(data.time % 60);
    $('res-time').textContent = mm + ':' + String(ss).padStart(2, '0');
    this.show('screen-results');
  }

  setDoubleUsed(used) {
    const btn = $('btn-double');
    btn.classList.toggle('hidden', !!used);
  }

  /* ------------------------------------------------------------- menu */
  updateMenu(store) {
    $('stat-best').textContent = Math.round(store.data.best).toLocaleString('en-US');
    $('stat-wave').textContent = store.data.bestWave;
    $('stat-kills').textContent = store.data.kills;
    $('stat-runs').textContent = store.data.runs;
  }

  setLangButtons(lang) {
    document.querySelectorAll('#seg-lang button').forEach((b) => b.classList.toggle('on', b.dataset.lang === lang));
    document.querySelectorAll('#lang-menu b').forEach((b) => b.classList.toggle('on', b.textContent.toLowerCase() === lang));
  }

  showRotateHint(on) { $('rotate-hint').classList.toggle('hidden', !on); }

  loadProgress(p) {
    $('load-fill').style.width = (p * 100).toFixed(0) + '%';
  }

  bump(el) {
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }
}

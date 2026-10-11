// 背景音樂：用 Web Audio 即時合成，不需要音樂檔
// 使用方式：<script src="music.js" data-style="calm|clock|playful"></script>
// - 右上角 🎵 按鈕可開關，設定會記住（所有頁面共用）
// - iPad 規定要使用者先觸控才能出聲，所以第一次點畫面時才開始播放
// - 語音在唸的時候，音樂自動變小聲，唸完再恢復
(() => {
  const STYLE = (document.currentScript && document.currentScript.dataset.style) || 'calm';
  const VOLUME = 0.7;         // 平常音量（0~1）
  const DUCK_VOLUME = 0.15;   // 語音播放時的音量

  // 和弦進行 C → Am → F → G（每個和弦 4 個音，由低到高）
  const CHORDS = [[60, 64, 67, 72], [60, 64, 69, 72], [60, 65, 69, 72], [59, 62, 67, 71]];
  const BASS = [48, 45, 41, 43];

  const STYLES = {
    // 主頁：柔和、慢
    calm:    { bpm: 64, wave: 'sine',     decay: 1.6, pattern: [0, 2, 1, 3, 2, 1, 2, 1], octave: 0,  gain: 0.9 },
    // 時鐘：像音樂盒，音高較高、節奏穩定
    clock:   { bpm: 60, wave: 'sine',     decay: 1.2, pattern: [3, 1, 2, 1, 3, 1, 2, 1], octave: 12, gain: 0.7 },
    // 剪刀石頭布：輕快、有彈跳感
    playful: { bpm: 92, wave: 'triangle', decay: 0.35, pattern: [0, 2, 3, 2, 1, 2, 3, -1], octave: 0, gain: 0.8 },
  };
  const S = STYLES[STYLE] || STYLES.calm;

  const store = {
    get() { try { return localStorage.getItem('bgm') !== 'off'; } catch (_) { return true; } },
    set(on) { try { localStorage.setItem('bgm', on ? 'on' : 'off'); } catch (_) {} },
  };

  let enabled = store.get();
  let ctx = null, master = null, timer = null, nextTime = 0, step = 0;

  const freq = m => 440 * Math.pow(2, (m - 69) / 12);

  function note(midi, time, dur, gain, wave) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = wave;
    o.frequency.value = freq(midi);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(gain, time + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    o.connect(g).connect(master);
    o.start(time);
    o.stop(time + dur + 0.05);
  }

  // 提前排程接下來 0.3 秒內要播的音，節奏才會穩
  function schedule() {
    const eighth = 60 / S.bpm / 2;
    while (nextTime < ctx.currentTime + 0.3) {
      const bar = Math.floor(step / 8) % CHORDS.length, pos = step % 8;
      const idx = S.pattern[pos];
      if (idx >= 0) note(CHORDS[bar][idx] + S.octave, nextTime, S.decay, 0.3 * S.gain, S.wave);
      if (pos === 0) note(BASS[bar], nextTime, eighth * 7, 0.35 * S.gain, 'sine');
      if (pos === 4 && STYLE === 'calm') note(BASS[bar] + 7, nextTime, eighth * 3.5, 0.18, 'sine');
      nextTime += eighth;
      step++;
    }
  }

  function start() {
    if (!enabled) return;
    try {
      if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain();
        master.gain.value = 0;
        // 壓縮器：音量調大時避免多個音疊在一起而破音
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -12;
        comp.ratio.value = 4;
        master.connect(comp).connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume();
      if (!timer) {
        nextTime = ctx.currentTime + 0.1;
        timer = setInterval(schedule, 100);
      }
      master.gain.setTargetAtTime(VOLUME, ctx.currentTime, 0.5);   // 淡入
    } catch (_) {}
  }

  function stop() {
    if (!ctx) return;
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.2);          // 淡出
    setTimeout(() => { if (!enabled && timer) { clearInterval(timer); timer = null; } }, 800);
  }

  // 語音播放時自動降低音量
  setInterval(() => {
    if (!ctx || !enabled || !timer) return;
    const speaking = 'speechSynthesis' in window && speechSynthesis.speaking;
    master.gain.setTargetAtTime(speaking ? DUCK_VOLUME : VOLUME, ctx.currentTime, 0.15);
  }, 200);

  // 切到背景（回主畫面、鎖螢幕）時暫停
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else if (enabled) ctx.resume();
  });

  // 開關按鈕
  const btn = document.createElement('button');
  btn.setAttribute('aria-label', '背景音樂開關');
  btn.style.cssText = [
    'position:fixed', 'top:calc(env(safe-area-inset-top) + 16px)', 'right:calc(env(safe-area-inset-right) + 16px)',
    'z-index:50', 'width:56px', 'height:56px', 'border-radius:50%', 'border:4px solid #fff',
    'font-size:26px', 'cursor:pointer', 'box-shadow:0 3px 6px rgba(0,0,0,.25)', 'padding:0',
  ].join(';');
  function paint() {
    btn.textContent = enabled ? '🎵' : '🔇';
    btn.style.background = enabled ? '#4caf50' : '#9e9e9e';
  }
  btn.addEventListener('click', e => {
    e.stopPropagation();
    enabled = !enabled;
    store.set(enabled);
    paint();
    if (enabled) start(); else stop();
  });
  paint();

  function mount() {
    document.body.appendChild(btn);
    // 第一次觸控畫面任何地方就開始播放
    const first = () => { start(); document.removeEventListener('pointerdown', first, true); };
    document.addEventListener('pointerdown', first, true);
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();

// [v1.0.0] 본 스크립트는 8개의 장면, 씬별 전환, 클릭 기반 파티클 효과, 오디오, WASM 연동을 담당한다.
const scenes = [...document.querySelectorAll('.scene')];
const stage = document.getElementById('stage');
const fxLayer = document.getElementById('fxLayer');
const pageIndicator = document.getElementById('pageIndicator');
const musicBtn = document.getElementById('musicBtn');
let index = 0;
let audioCtx;
let masterGain;
let isMusicOn = false;
let wasmMix = (a, b) => (a + b) % 32;

// [v1.0.0] 최소 WASM 모듈을 런타임에 로드하여 이펙트 강도 계산을 수행한다.
(async function initWasm() {
  const bytes = new Uint8Array([
    0x00,0x61,0x73,0x6d,0x01,0x00,0x00,0x00,0x01,0x07,0x01,0x60,0x02,0x7f,0x7f,0x01,0x7f,
    0x03,0x02,0x01,0x00,0x07,0x07,0x01,0x03,0x6d,0x69,0x78,0x00,0x00,0x0a,0x09,0x01,0x07,
    0x00,0x20,0x00,0x20,0x01,0x6a,0x0b
  ]);
  const mod = await WebAssembly.instantiate(bytes);
  wasmMix = mod.instance.exports.mix;
})();

// [v1.0.0] 씬 전환 시 테마별로 클래스를 적용해 장면마다 다른 효과를 강제한다.
function showScene(next) {
  scenes[index].classList.remove('active');
  index = (next + scenes.length) % scenes.length;
  const scene = scenes[index];
  scene.classList.add('active');
  const transition = `transition-${scene.dataset.transition}`;
  scene.classList.add(transition);
  scene.addEventListener('animationend', () => scene.classList.remove(transition), { once: true });
  pageIndicator.textContent = `${index + 1} / ${scenes.length}`;
  pulseTone(index);
}

document.getElementById('prevBtn').addEventListener('click', () => showScene(index - 1));
document.getElementById('nextBtn').addEventListener('click', () => showScene(index + 1));
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') showScene(index + 1);
  if (e.key === 'ArrowLeft') showScene(index - 1);
});

// [v1.0.0] 클릭 인터랙션은 파티클 폭발, 스테이지 흔들림, 효과음을 한 번에 발생시킨다.
stage.addEventListener('click', (e) => {
  const amount = 18 + (wasmMix(index + 3, (e.clientX + e.clientY) % 17) % 16);
  burst(e.clientX, e.clientY, amount);
  stage.classList.remove('shake');
  void stage.offsetWidth;
  stage.classList.add('shake');
  clickTone();
});

function burst(x, y, amount) {
  for (let i = 0; i < amount; i += 1) {
    const dot = document.createElement('i');
    dot.className = 'particle';
    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;
    const ang = (Math.PI * 2 * i) / amount;
    const dist = 25 + Math.random() * 130;
    dot.style.setProperty('--dx', `${Math.cos(ang) * dist}px`);
    dot.style.setProperty('--dy', `${Math.sin(ang) * dist}px`);
    dot.style.background = `hsl(${(index * 45 + i * 7) % 360} 95% 70%)`;
    fxLayer.appendChild(dot);
    dot.addEventListener('animationend', () => dot.remove(), { once: true });
  }
}

// [v1.0.0] WebAudio는 외부 파일 없이 분위기 음악을 합성하며 사용자 제스처 이후에만 시작한다.
function ensureAudio() {
  if (audioCtx) return;
  audioCtx = new AudioContext();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.06;
  masterGain.connect(audioCtx.destination);
}

function loopMusic() {
  if (!audioCtx || !isMusicOn) return;
  const now = audioCtx.currentTime;
  const root = [110, 138.59, 174.61, 220][index % 4];
  [1, 1.5, 2].forEach((m, i) => {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = i === 0 ? 'sine' : 'triangle';
    osc.frequency.value = root * m;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.03 / (i + 1), now + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);
    osc.connect(g).connect(masterGain);
    osc.start(now);
    osc.stop(now + 2.3);
  });
  setTimeout(loopMusic, 1800);
}

function clickTone() {
  if (!audioCtx || !isMusicOn) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(260 + index * 40, now);
  osc.frequency.exponentialRampToValueAtTime(90, now + 0.12);
  g.gain.setValueAtTime(0.001, now);
  g.gain.exponentialRampToValueAtTime(0.05, now + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
  osc.connect(g).connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.15);
}

function pulseTone(step) {
  if (!audioCtx || !isMusicOn) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.value = 120 + step * 18;
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.025, now + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
  osc.connect(g).connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.31);
}

musicBtn.addEventListener('click', async () => {
  ensureAudio();
  if (audioCtx.state === 'suspended') await audioCtx.resume();
  isMusicOn = !isMusicOn;
  musicBtn.textContent = isMusicOn ? '음악 중지' : '음악 시작';
  if (isMusicOn) loopMusic();
});

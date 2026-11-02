// STAR SWARM 요구사항 검증 (헤드리스 크롬)
// 실행: node scripts/verify_game.js   (playwright 필요: npm i -D playwright)
const http = require('http'), fs = require('fs'), path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

const ROOT = path.join(__dirname, '../src/StarSwarm/wwwroot');
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, req.url === '/' ? 'index.html' : req.url);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : 'text/html' });
  fs.createReadStream(f).pipe(res);
});

const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`); };

(async () => {
  await new Promise(r => server.listen(0, r));
  const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://localhost:${server.address().port}/`);
  await page.waitForTimeout(500); await page.keyboard.press('Enter');
  const until = (fn, ms = 30000) => page.waitForFunction(fn, null, { timeout: ms }).then(() => true, () => false);
  await until(() => G.phase === 'play' && !G.entering && player.state === 'play');

  // 요구사항 1: 보스를 격추하면 붙잡힌 전투기를 되찾아 합체 (편대 안에서 격추해도)
  await page.evaluate(() => { G.atk = 1e9; const b = enemies.find(e => e.kind === 'boss'); player.x = W / 2; startDive(b, true); b.tx = W / 2; window.BO = b; });
  check('트랙터 빔으로 납치', await until(() => captive && captive.st === 'held'));
  await until(() => BO.st === 'form' && player.state === 'play');
  await page.evaluate(() => { BO.hp = 1; hitEnemy(BO); });
  check('편대 안의 보스 격추 → 듀얼 파이터', await until(() => player.dual, 10000));

  await page.evaluate(() => {
    player.dual = false; G.reserve = 3; const b = enemies.find(e => e.kind === 'boss' && !e.dead);
    captive = { boss: b, st: 'held', x: b.x, y: b.y - 14, a: 0 }; player.state = 'dead'; G.dt = 0; b.hp = 1; hitEnemy(b);
  });
  check('내가 죽은 동안 격추 → 부활 후 합체', await until(() => player.dual, 15000));

  // 요구사항 2: 스테이지가 오를수록 난이도 상승
  const ramp = await page.evaluate(() => {
    const at = st => { const s = G.stage; G.stage = st; const e = { x: 50 }; startDive(e); const r = { d: diff(), sp: e.sp, shots: e.shots, turn: e.turn }; G.stage = s; return r; };
    return [at(1), at(7), at(13), at(30)];
  });
  const [s1, s7, s13, s30] = ramp;
  check('급강하 속도·사격 수·추적력 단조 증가', s1.sp < s7.sp && s7.sp < s13.sp && s1.shots < s13.shots && s13.shots === 3 && s1.turn < s13.turn,
    `sp ${s1.sp.toFixed(2)}→${s13.sp.toFixed(2)}, shots ${s1.shots}→${s13.shots}`);
  check('13스테이지 이후 난이도 상한 유지', s13.sp === s30.sp && s30.d === 1);

  // 호위기가 혼자 남아도 보스의 능력치를 유지
  const esc = await page.evaluate(() => {
    G.stage = 13; const b = enemies.find(e => e.kind === 'boss' && !e.dead && e.st === 'form');
    const x = enemies.find(e => e.kind === 'escort' && e.st === 'form');
    if (!b || !x) return null;
    startDive(b); Object.assign(x, { st: 'escort', leader: b, ox: 14, oy: -10, sp: b.sp, turn: b.turn });
    b.dead = true; updEnemy(x); return { st: x.st, turn: x.turn, sp: x.sp, bturn: b.turn };
  });
  check('보스를 잃은 호위기가 난이도 능력치로 급강하', !!esc && esc.st === 'dive' && esc.turn === esc.bturn, esc ? `turn ${esc.turn.toFixed(3)}` : '대상 없음');

  // 요구사항 3: 후반 스테이지에서 입장하면서 공격
  await page.evaluate(() => {
    G.stage = 8; player.dual = false; nextStage(); window.EB = 0; window.BRK = new Set();
    setInterval(() => {
      if (player.state !== 'play' && G.phase === 'play') player.state = 'play'; // 검증용 무적
      if (G.entering) EB = Math.max(EB, eB.length);
      enemies.forEach(e => e.breakAway && e.st === 'dive' && BRK.add(e));
    }, 16);
  });
  await page.waitForTimeout(14000);
  const entry = await page.evaluate(() => ({ eb: EB, brk: BRK.size }));
  check('입장 중 조준 사격', entry.eb > 0, `동시 탄 최대 ${entry.eb}발`);
  check('입장 직후 이탈 급강하', entry.brk > 0, `${entry.brk}기`);

  // 챌린징 스테이지: 사격 없이 모두 화면 밖으로 퇴장해야 스테이지가 끝남
  await page.evaluate(() => { G.stage = 2; nextStage(); });
  check('챌린징 스테이지 진입', await page.evaluate(() => G.challenge));
  check('챌린징 스테이지 적이 모두 퇴장하고 종료', await until(() => G.stage === 4, 40000));

  check('페이지 오류 없음', errors.length === 0, errors.join(' | '));
  await browser.close(); server.close();
  const failed = results.filter(r => !r).length;
  console.log(failed ? `\n${failed}개 실패` : `\n전체 ${results.length}개 통과`);
  process.exit(failed ? 1 : 0);
})();

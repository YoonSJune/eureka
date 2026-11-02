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
  // Supabase REST API 흉내: 조회는 빈 목록, 저장 요청은 본문을 기록 (failSave 가 true면 500 응답)
  const saved = []; let failSave = false;
  await page.route('**/rest/v1/scores**', route => {
    const req = route.request();
    if (req.method() === 'POST') {
      if (failSave) return route.fulfill({ status: 500, body: '{}' });
      saved.push({ body: JSON.parse(req.postData()), key: req.headers()['apikey'] });
      return route.fulfill({ status: 201, body: '' });
    }
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(saved.map(s => s.body)) });
  });
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

  // 요구사항 4: 게임 종료 → 결과 화면 → 저장 여부 질문 → 영문 닉네임 → Supabase 저장
  const toResults = () => page.evaluate(() => { G.score = 12340; G.stage = 5; G.shots = 80; G.hits = 30; state = 'results'; stTimer = 400; });
  const formShown = () => page.isVisible('#nick');
  await toResults();
  check('결과 화면 다음에 저장 여부 질문', await until(() => state === 'ask', 3000));
  check('저장 질문 단계에서는 입력창이 보이지 않음', !(await formShown()));
  await page.keyboard.press('Enter');
  check('YES 선택 → 닉네임 입력창 표시', await until(() => state === 'name', 3000) && await formShown());
  await page.waitForTimeout(100);
  check('입력창을 연 Enter 가 빈 값으로 제출되지 않음', await page.evaluate(() => nickMsg.textContent === ''));
  await page.keyboard.type('김Ace Pilot!7');
  check('영문 외 문자는 입력되지 않음', await page.inputValue('#nickInput') === 'Ace Pilot7', await page.inputValue('#nickInput'));
  await page.click('#nickSave');
  await until(() => state === 'title', 5000);
  const s0 = saved[0];
  check('Supabase에 기록 저장', !!s0 && s0.body.name === 'Ace Pilot7' && s0.body.score === 12340 && s0.body.stage === 5 && s0.body.hits === 30,
    s0 ? JSON.stringify(s0.body) : '요청 없음');
  check('공개용 publishable 키로 요청', !!s0 && /^sb_publishable_/.test(s0.key));
  check('저장 후 Enter 키가 눌린 채로 남지 않음', await page.evaluate(() => !keys.Enter));
  check('저장 후 타이틀 랭킹에 반영', await until(() => scores.some(s => s.name === 'Ace Pilot7'), 5000));

  await toResults(); await until(() => state === 'ask', 3000);
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  check('NO 선택 → 저장하지 않고 타이틀에 머무름', await page.evaluate(() => state === 'title') && saved.length === 1);

  failSave = true; await toResults(); await until(() => state === 'ask', 3000);
  await page.keyboard.press('Enter'); await page.fill('#nickInput', 'Retry'); await page.click('#nickSave');
  await page.waitForTimeout(500);
  check('저장 실패 시 안내 문구 표시 + 입력창 유지', await page.evaluate(() => state === 'name' && /저장하지 못했어요/.test(nickMsg.textContent)));
  failSave = false; await page.click('#nickSave');
  check('다시 누르면 저장 성공', await until(() => state === 'title', 5000) && saved.length === 2);

  check('저장 후 입력창이 화면에서 사라짐', !(await formShown()));
  check('페이지 오류 없음', errors.length === 0, errors.join(' | '));
  await browser.close(); server.close();
  const failed = results.filter(r => !r).length;
  console.log(failed ? `\n${failed}개 실패` : `\n전체 ${results.length}개 통과`);
  process.exit(failed ? 1 : 0);
})();

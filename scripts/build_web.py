"""src/StarSwarm/wwwroot 의 게임을 HTML 한 장으로 합칩니다.
- web/star-swarm.html : Claude 아티팩트용 (공유 랭킹 db 사용)
- web/index.html      : GitHub Pages용 단독 페이지 (랭킹은 브라우저에 저장)
실행: python3 scripts/build_web.py
"""
import re
from pathlib import Path

root = Path(__file__).resolve().parent.parent
js = (root / 'src/StarSwarm/wwwroot/game.js').read_text()
html = (root / 'src/StarSwarm/wwwroot/index.html').read_text()


def cut(s, start, end):
    return s[s.index(start):s.index(end)]


js = js.replace(cut(js, 'function loadScores()', 'loadScores();'), '''// 공유 랭킹: 아티팩트 db (플레이어마다 최고 점수 1개, scores/<userId>). 없으면 브라우저에만 저장
let DB = null, UID = null;
async function loadScores() {
  try { const b = JSON.parse(localStorage.getItem('ss-best') || 'null'); if (b) hi = Math.max(hi, b); } catch { }
  try { scores = JSON.parse(localStorage.getItem('ss-scores') || '[]'); } catch { }
  try {
    if (!window.claude?.use) return;
    DB = await claude.use('db'); const u = await claude.use('user');
    UID = u ? await u.id() : null;
    if (!DB) return;
    DB.collection('scores').orderBy('score', 'desc').limit(10).onSnapshot(s => {
      scores = s.docs.map(d => d.data()); if (scores[0]) hi = Math.max(hi, scores[0].score);
    }, () => {});
  } catch { }
}
''')
js = js.replace(cut(js, 'function submitName()', 'function update()'), '''function submitName() {
  const name = nameBuf.map(i => LETTERS[i]).join('').trim() || 'AAA';
  state = 'title';
  const entry = { name, score: G.score, stage: G.stage, at: Date.now() };
  const local = () => {
    scores = [...scores, entry].sort((a, b) => b.score - a.score).slice(0, 10);
    try { localStorage.setItem('ss-scores', JSON.stringify(scores)); } catch { }
  };
  try { localStorage.setItem('ss-best', JSON.stringify(Math.max(G.score, JSON.parse(localStorage.getItem('ss-best') || '0')))); } catch { }
  if (!DB || !UID) return local();
  const ref = DB.doc('scores/' + UID);
  ref.get().then(s => { const prev = s.data(); if (!prev || prev.score < entry.score) return ref.set(entry); }).catch(local);
}

''')
style = re.search(r'<style>.*?</style>', html, re.S).group(0)
style = style.replace('--accent:#ff3b3b; }', '--accent:#ff3b3b; color-scheme:dark; }')
style = style.replace('#wrap { display:flex;', '#wrap { padding-inline:16px; box-sizing:border-box; display:flex;')
style = style.replace('canvas { image-rendering', 'canvas { max-width:100%; image-rendering')
body = cut(html, '<div id="wrap">', '<script src')
fonts = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n'
         '<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">\n')
script = f'<script>\n{js}</script>\n'

(root / 'web').mkdir(exist_ok=True)
(root / 'web/star-swarm.html').write_text(f'<title>Star Swarm</title>\n{fonts}{style}\n{body}{script}')
(root / 'web/index.html').write_text(
    '<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n'
    '<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">\n'
    f'<title>Star Swarm</title>\n{fonts}{style}\n</head>\n<body>\n{body}{script}</body>\n</html>\n')
print('built web/star-swarm.html, web/index.html')

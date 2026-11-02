"""src/StarSwarm/wwwroot 의 게임을 HTML 한 장으로 합칩니다.
- web/star-swarm.html : Claude 아티팩트용 (랭킹: 아티팩트 db)
- web/index.html      : GitHub Pages용 단독 페이지 (랭킹: Supabase)
실행: python3 scripts/build_web.py
"""
import re
from pathlib import Path

root = Path(__file__).resolve().parent.parent
js = (root / 'src/StarSwarm/wwwroot/game.js').read_text()
html = (root / 'src/StarSwarm/wwwroot/index.html').read_text()


def cut(s, start, end):
    return s[s.index(start):s.index(end)]


# GitHub Pages 판은 game.js 그대로(Supabase 랭킹) 사용합니다.
# 아티팩트는 외부 서버 접속이 막혀 있어서, 랭킹 저장소만 아티팩트 내장 db로 바꿉니다.
artifact_js = js.replace(cut(js, '// ---------- 랭킹 저장소 (Supabase)', 'loadScores();'), '''// ---------- 랭킹 저장소 (아티팩트 db: 플레이어마다 최고 점수 1개, scores/<userId>) ----------
let DB = null, UID = null, watching = false;
async function loadScores() {
  if (watching || !window.claude?.use) return;
  try {
    DB = await claude.use('db'); const u = await claude.use('user');
    UID = u ? await u.id() : null;
    if (!DB) return;
    watching = true;
    DB.collection('scores').orderBy('score', 'desc').limit(10).onSnapshot(s => {
      scores = s.docs.map(d => d.data()); if (scores[0]) hi = Math.max(hi, scores[0].score);
    }, () => {});
  } catch { }
}
function saveScore(entry) {
  if (!DB || !UID) return Promise.reject(new Error('leaderboard unavailable'));
  const ref = DB.doc('scores/' + UID);
  return ref.get().then(s => { const prev = s.data(); if (!prev || prev.score < entry.score) return ref.set(entry); });
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
artifact_script = f'<script>\n{artifact_js}</script>\n'

(root / 'web').mkdir(exist_ok=True)
(root / 'web/star-swarm.html').write_text(f'<title>Star Swarm</title>\n{fonts}{style}\n{body}{artifact_script}')
(root / 'web/index.html').write_text(
    '<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n'
    '<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">\n'
    f'<title>Star Swarm</title>\n{fonts}{style}\n</head>\n<body>\n{body}{script}</body>\n</html>\n')
print('built web/star-swarm.html, web/index.html')

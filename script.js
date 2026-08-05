let board = null;
let game = new Chess();
let history = [];
let moveAnalysis = [];
let currentMoveIndex = -1;
let autoplayTimer = null;

const pieceVal = { p: 1, n: 3, b: 3.25, r: 5, q: 9, k: 0 };

function calcEval(cGame) {
  let score = 0;
  const b = cGame.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = b[r][c];
      if (p) score += (p.color === 'w' ? 1 : -1) * (pieceVal[p.type] || 0);
    }
  }
  return parseFloat(score.toFixed(1));
}

$(document).ready(function () {
  board = Chessboard('board', {
    position: 'start',
    draggable: false,
    pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
  });

  $('#btnAnalyze').on('click', () => parsePGN($('#pgnInput').val()));
  $('#btnNext').on('click', () => renderStep(currentMoveIndex + 1));
  $('#btnPrev').on('click', () => renderStep(currentMoveIndex - 1));
  $('#btnAuto').on('click', toggleAutoplay);

  $(document).on('keydown', (e) => {
    if (e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') renderStep(currentMoveIndex + 1);
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') renderStep(currentMoveIndex - 1);
  });
});

function parsePGN(pgn) {
  const g = new Chess();
  if (!g.load_pgn(pgn)) {
    alert('الرجاء التأكد من صحة كود الـ PGN');
    return;
  }

  history = g.history({ verbose: true });
  analyzeMoves();
  renderHorizontalMoves();
  renderStep(-1);
}

function analyzeMoves() {
  const cGame = new Chess();
  moveAnalysis = [];
  let prevVal = 0;

  for (let i = 0; i < history.length; i++) {
    const m = history[i];
    cGame.move(m);
    const score = calcEval(cGame);
    const side = i % 2 === 0 ? 'w' : 'b';
    const delta = side === 'w' ? (score - prevVal) : (prevVal - score);

    let info = { name: 'نقلة جيدة', icon: '✔️', bg: 'bg-good' };

    if (i < 5) {
      info = { name: 'نقلة من النظرية', icon: '📖', bg: 'bg-book' };
    } else if (delta >= 0.7) {
      info = { name: 'نقلة رائعة!', icon: '‼️', bg: 'bg-great' };
    } else if (delta >= 0.1) {
      info = { name: 'الأفضل', icon: '⭐', bg: 'bg-best' };
    } else if (delta >= -0.4) {
      info = { name: 'نقلة غير دقيقة', icon: '⁉️', bg: 'bg-inaccuracy' };
    } else if (delta >= -1.5) {
      info = { name: 'خطأ', icon: '❓', bg: 'bg-mistake' };
    } else {
      info = { name: 'خطأ فادح', icon: '❌', bg: 'bg-blunder' };
    }

    moveAnalysis.push({
      eval: score,
      toSquare: m.to,
      san: m.san,
      ...info
    });

    prevVal = score;
  }
}

function renderStep(idx) {
  if (idx < -1 || idx >= history.length) return;

  const g = new Chess();
  for (let i = 0; i <= idx; i++) g.move(history[i]);

  currentMoveIndex = idx;
  board.position(g.fen());

  $('.square-eval-badge').remove();

  if (idx >= 0) {
    const item = moveAnalysis[idx];
    const scoreStr = item.eval > 0 ? `+${item.eval}` : `${item.eval}`;
    
    $('#evalScore').text(scoreStr);
    $('#moveTitle').text(`${item.san} - ${item.name}`);
    $('#moveDescription').text(`تقييم الموقف: ${scoreStr}`);

    // إضافة شارة التقييم المباشرة على الرقعة فوق المربع
    const sq = `$(`#board .square-${item.toSquare}`);
    if (sq.length) {
      sq.append(`<div class="square-eval-badge ${item.bg}">${item.icon}</div>`);
    }

    // تحديث شريط التقييم الملون
    let height = 50 + (item.eval * 8);
    height = Math.max(5, Math.min(95, height));
    $('#evalBarFill').css('height', height + '%');
  } else {
    $('#evalScore').text('+0.0');
    $('#moveTitle').text('بداية المباراة');
    $('#moveDescription').text('جاهز للتحليل');
    $('#evalBarFill').css('height', '50%');
  }

  $('.chip-move').removeClass('active');
  if (idx >= 0) $(`#chip-${idx}`).addClass('active');
}

function renderHorizontalMoves() {
  const container = $('#movesContainer');
  container.empty();

  history.forEach((m, i) => {
    const btn = `<button id="chip-${i}" class="chip-move" onclick="renderStep(${i})">${m.san}</button>`;
    container.append(btn);
  });
}

function toggleAutoplay() {
  if (autoplayTimer) {
    clearInterval(autoplayTimer);
    autoplayTimer = null;
    $('#btnAuto').text('▶');
  } else {
    $('#btnAuto').text('⏸');
    autoplayTimer = setInterval(() => {
      if (currentMoveIndex < history.length - 1) {
        renderStep(currentMoveIndex + 1);
      } else {
        toggleAutoplay();
      }
    }, 1000);
  }
}

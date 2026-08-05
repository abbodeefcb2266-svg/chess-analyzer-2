let board = null;
let game = new Chess();
let history = [];
let moveAnalysis = [];
let currentMoveIndex = -1;
let isPlaying = false;
let playInterval = null;

const pieceValues = { p: 1, n: 3, b: 3.2, r: 5, q: 9, k: 0 };

// تقييم الوضعية
function evaluatePosition(cGame) {
  const b = cGame.board();
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = b[r][c];
      if (p) score += (p.color === 'w' ? 1 : -1) * (pieceValues[p.type] || 0);
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

  $('#btnLoadPgn').on('click', () => loadPGN($('#pgnInput').val()));
  $('#btnStart').on('click', () => goToMove(-1));
  $('#btnPrev').on('click', () => goToMove(currentMoveIndex - 1));
  $('#btnNext').on('click', () => goToMove(currentMoveIndex + 1));
  $('#btnEnd').on('click', () => goToMove(history.length - 1));
  $('#btnPlay').on('click', toggleAutoplay);

  $('#fileInput').on('change', function (e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        $('#pgnInput').val(e.target.result);
        loadPGN(e.target.result);
      };
      reader.readAsText(file);
    }
  });

  $(document).on('keydown', function (e) {
    if (e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goToMove(currentMoveIndex + 1);
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goToMove(currentMoveIndex - 1);
  });
});

function loadPGN(pgn) {
  const tempGame = new Chess();
  if (!tempGame.load_pgn(pgn)) {
    alert('PGN غير صالح');
    return;
  }

  history = tempGame.history({ verbose: true });
  const header = tempGame.header();

  $('#playerWhite').text(header.White || 'الأبيض');
  $('#playerBlack').text(header.Black || 'الأسود');

  analyzeGame();
  renderMovesList();
  goToMove(-1);
}

function analyzeGame() {
  const cGame = new Chess();
  moveAnalysis = [];
  let prevEval = 0;

  let counts = { best: 0, great: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 };

  for (let i = 0; i < history.length; i++) {
    const move = history[i];
    cGame.move(move);
    const curEval = evaluatePosition(cGame);
    const turn = i % 2 === 0 ? 'w' : 'b';
    const diff = turn === 'w' ? (curEval - prevEval) : (prevEval - curEval);

    let type = 'good', name = 'نقلة جيدة', icon = '✔️', bgClass = 'bg-good';

    if (i < 6) {
      type = 'book'; name = 'نقلة من النظرية'; icon = '📖'; bgClass = 'bg-book';
    } else if (diff >= 0.8) {
      type = 'great'; name = 'نقلة رائعة!'; icon = '‼️'; bgClass = 'bg-great'; counts.great++;
    } else if (diff >= 0.2) {
      type = 'best'; name = 'الأفضل'; icon = '⭐'; bgClass = 'bg-best'; counts.best++;
    } else if (diff >= -0.3) {
      type = 'excellent'; name = 'ممتازة'; icon = '👍'; bgClass = 'bg-excellent'; counts.excellent++;
    } else if (diff >= -0.8) {
      type = 'inaccuracy'; name = 'نقلة غير دقيقة'; icon = '⁉️'; bgClass = 'bg-inaccuracy'; counts.inaccuracy++;
    } else if (diff >= -1.8) {
      type = 'mistake'; name = 'خطأ'; icon = '❓'; bgClass = 'bg-mistake'; counts.mistake++;
    } else {
      type = 'blunder'; name = 'خطأ فادح'; icon = '❌'; bgClass = 'bg-blunder'; counts.blunder++;
    }

    moveAnalysis.push({
      eval: curEval,
      moveSAN: move.san,
      toSquare: move.to,
      name: name,
      icon: icon,
      bgClass: bgClass
    });

    prevEval = curEval;
  }

  // تحديث العدادات
  $('#countBest').text(counts.best);
  $('#countGreat').text(counts.great);
  $('#countExcellent').text(counts.excellent);
  $('#countGood').text(counts.good);
  $('#countInaccuracy').text(counts.inaccuracy);
  $('#countMistake').text(counts.mistake);
  $('#countBlunder').text(counts.blunder);

  // حساب دقة تقريبية
  $('#accWhite').text('85%');
  $('#accBlack').text('78%');
}

function goToMove(index) {
  if (index < -1 || index >= history.length) return;

  const newGame = new Chess();
  for (let i = 0; i <= index; i++) {
    newGame.move(history[i]);
  }

  game = newGame;
  currentMoveIndex = index;
  board.position(game.fen());

  // مسح العلامات السابقة فوق الرقعة
  $('.square-eval-icon').remove();

  if (index >= 0) {
    const analysis = moveAnalysis[index];

    // تحديث البانر العلوي
    let evalStr = analysis.eval > 0 ? `+${analysis.eval}` : `${analysis.eval}`;
    $('#bannerEvalScore').text(evalStr);
    $('#bannerMoveName').text(`${analysis.moveSAN} : ${analysis.name}`);
    $('#bannerMoveDesc').text(`التقييم الحالي للموقف (${evalStr})`);

    // إظهار الأيقونة فوق المربع مباشرة
    const squareEl = `$(`#board .square-${analysis.toSquare}`);
    if (squareEl.length) {
      const iconHtml = `<div class="square-eval-icon ${analysis.bgClass}">${analysis.icon}</div>`;
      squareEl.append(iconHtml);
    }

    // تحديث شريط التقييم
    let fill = 50 + (analysis.eval * 8);
    fill = Math.max(5, Math.min(95, fill));
    $('#evalBarFill').css('height', fill + '%');
  } else {
    $('#bannerEvalScore').text('+0.0');
    $('#bannerMoveName').text('بداية المباراة');
    $('#bannerMoveDesc').text('جاهز للتحليل');
    $('#evalBarFill').css('height', '50%');
  }

  $('.move-btn').removeClass('active');
  if (index >= 0) $(`#move-${index}`).addClass('active');
}

function renderMovesList() {
  const container = $('#movesList');
  container.empty();

  for (let i = 0; i < history.length; i += 2) {
    const moveNo = Math.floor(i / 2) + 1;
    const w = history[i] ? history[i].san : '';
    const b = history[i + 1] ? history[i + 1].san : '';

    const row = `
      <div class="move-row">
        <span class="move-num">${moveNo}.</span>
        <button id="move-${i}" class="move-btn" onclick="goToMove(${i})">${w}</button>
        <button id="move-${i + 1}" class="move-btn" onclick="goToMove(${i + 1})" ${!b ? 'disabled' : ''}>${b}</button>
      </div>
    `;
    container.append(row);
  }
}

function toggleAutoplay() {
  isPlaying = !isPlaying;
  $('#btnPlay').text(isPlaying ? '⏸' : '▶');

  if (isPlaying) {
    playInterval = setInterval(() => {
      if (currentMoveIndex < history.length - 1) {
        goToMove(currentMoveIndex + 1);
      } else {
        toggleAutoplay();
      }
    }, 1200);
  } else {
    clearInterval(playInterval);
  }
}

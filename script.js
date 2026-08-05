let board = null;
let game = new Chess();
let history = [];
let moveEvaluations = []; // يخزن التقييم ونوع كل نقلة
let currentMoveIndex = -1;
let isPlaying = false;
let playInterval = null;

// قيمة القطع لتنسيق تقييم المواقف (Material Weights)
const pieceValues = { p: 1, n: 3.2, b: 3.3, r: 5, q: 9, k: 0 };

// تقييم الموقف حسابياً (موقف بسيط يمثل قوة الأبيض مقابل الأسود)
function evaluatePosition(chessGame) {
  const boardArr = chessGame.board();
  let score = 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = boardArr[r][c];
      if (piece) {
        let val = pieceValues[piece.type] || 0;
        // مكافأة بسيطة للسيطرة على منتصف الرقعة (d4, d5, e4, e5)
        if ((r === 3 || r === 4) && (c === 3 || c === 4)) val += 0.2;
        
        score += (piece.color === 'w' ? val : -val);
      }
    }
  }

  // كش ملك
  if (chessGame.in_checkmate()) {
    score = chessGame.turn() === 'w' ? -99 : 99;
  }

  return parseFloat(score.toFixed(1));
}

// تشغيل صوت النقلات
function playMoveSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.08);
  } catch (e) {}
}

// تهيئة الرقعة عند تحميل الصفحة
$(document).ready(function () {
  board = Chessboard('board', {
    position: 'start',
    draggable: false,
    pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
  });

  // أحداث الأزرار
  $('#btnLoadPgn').on('click', () => loadPGN($('#pgnInput').val()));
  $('#btnStart').on('click', () => goToMove(-1));
  $('#btnPrev').on('click', () => goToMove(currentMoveIndex - 1));
  $('#btnNext').on('click', () => goToMove(currentMoveIndex + 1));
  $('#btnEnd').on('click', () => goToMove(history.length - 1));
  $('#btnPlay').on('click', toggleAutoplay);

  // رفع ملف
  $('#fileInput').on('change', function (e) {
    const file = e.target.files[0];
    if (file) readFile(file);
  });

  // أسهم الكيبورد
  $(document).on('keydown', function (e) {
    if (e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'ArrowRight') goToMove(currentMoveIndex - 1);
    if (e.key === 'ArrowLeft') goToMove(currentMoveIndex + 1);
  });
});

function readFile(file) {
  const reader = new FileReader();
  reader.onload = function (e) {
    const content = e.target.result;
    $('#pgnInput').val(content);
    loadPGN(content);
  };
  reader.readAsText(file);
}

// تحميل الـ PGN وتحليله بالكامل
function loadPGN(pgn) {
  const tempGame = new Chess();
  if (!tempGame.load_pgn(pgn)) {
    alert('صيغة PGN غير صحيحة، يرجى التأكد من النص.');
    return;
  }

  history = tempGame.history();
  const header = tempGame.header();

  $('#playerWhite').text(header.White || 'الأبيض');
  $('#playerBlack').text(header.Black || 'الأسود');
  $('#gameResult').text(header.Result || '*');

  // تحليل تفصيلي لجميع الحركات وتوليد التقييمات والدقة
  analyzeFullGame();
  renderMovesList();
  goToMove(-1);
}

// تحليل كل حركة وإحصاء دقة الأطوار (افتتاح، وسط، نهاية)
function analyzeFullGame() {
  const calcGame = new Chess();
  moveEvaluations = [];

  let prevEval = 0;
  let openingLoss = [], middleLoss = [], endLoss = [];

  for (let i = 0; i < history.length; i++) {
    calcGame.move(history[i]);
    const currentEval = evaluatePosition(calcGame);
    const turn = i % 2 === 0 ? 'w' : 'b'; // 'w' للأبيض، 'b' للأسود

    // تغيير التقييم من وجهة نظر اللاعب الحالي
    let evalDiff = turn === 'w' ? (currentEval - prevEval) : (prevEval - currentEval);
    let moveQuality = 'good'; // ممتاز/جيد
    let badgeClass = 'badge-good';
    let symbol = '';

    if (evalDiff < -1.8) {
      moveQuality = 'blunder'; // خطأ فادح
      badgeClass = 'badge-blunder';
      symbol = '??';
    } else if (evalDiff < -0.9) {
      moveQuality = 'mistake'; // خطأ
      badgeClass = 'badge-mistake';
      symbol = '?';
    } else if (evalDiff < -0.4) {
      moveQuality = 'inaccuracy'; // عدم دقة
      badgeClass = 'badge-inaccuracy';
      symbol = '?!';
    }

    const loss = Math.max(0, -evalDiff);

    // تقسيم المباراة إلى 3 مراحل:
    if (i < 16) {
      openingLoss.push(loss); // الافتتاح (أول 8 نقلات للطرفين)
    } else if (i < 40) {
      middleLoss.push(loss); // وسط الدور
    } else {
      endLoss.push(loss); // نهاية الدور
    }

    moveEvaluations.push({
      eval: currentEval,
      quality: moveQuality,
      badgeClass: badgeClass,
      symbol: symbol
    });

    prevEval = currentEval;
  }

  // حساب النسبة المئوية للدقة لكل مرحلة
  const calcAcc = (losses) => {
    if (losses.length === 0) return 100;
    const avgLoss = losses.reduce((a, b) => a + b, 0) / losses.length;
    return Math.max(50, Math.min(100, Math.round(100 - (avgLoss * 20))));
  };

  const accOp = calcAcc(openingLoss);
  const accMid = calcAcc(middleLoss);
  const accEnd = calcAcc(endLoss);
  const totalAcc = Math.round((accOp + accMid + accEnd) / 3);

  // تحديث الشاشة بالنسب المئوية
  $('#accOpening').text(accOp + '%');
  $('#accMiddle').text(accMid + '%');
  $('#accEnd').text(accEnd + '%');
  $('#accTotal').text(totalAcc + '%');
}

// التنقل بين النقلات وتحديث شريط التقييم
function goToMove(index) {
  if (index < -1 || index >= history.length) return;

  const newGame = new Chess();
  for (let i = 0; i <= index; i++) {
    newGame.move(history[i]);
  }

  game = newGame;
  currentMoveIndex = index;
  board.position(game.fen());
  playMoveSound();

  // تحديث شريط التقييم
  const currentEval = index >= 0 ? moveEvaluations[index].eval : 0;
  updateEvalBar(currentEval);

  // تحديد النقلة النشطة في القائمة
  $('.move-btn').removeClass('active');
  if (index >= 0) {
    $(`#move-${index}`).addClass('active');
  }
}

// تحديث الـ Eval Bar الجانبي
function updateEvalBar(score) {
  // تحويل النتيجة إلى نسبة مئوية لارتفاع الشريط (من 5% إلى 95%)
  let winPercent = 50 + (score * 8);
  winPercent = Math.max(5, Math.min(95, winPercent));

  $('#evalBarFill').css('height', winPercent + '%');
  
  let formattedScore = score > 0 ? `+${score}` : `${score}`;
  $('#evalScoreText').text(formattedScore);
}

// عرض قائمة الحركات مع التقييمات
function renderMovesList() {
  const container = $('#movesList');
  container.empty();

  for (let i = 0; i < history.length; i += 2) {
    const moveNo = Math.floor(i / 2) + 1;
    const whiteMove = history[i];
    const blackMove = history[i + 1] || '';

    const wEval = moveEvaluations[i];
    const bEval = moveEvaluations[i + 1];

    const wBadge = wEval && wEval.symbol ? `<span class="eval-badge ${wEval.badgeClass}">${wEval.symbol}</span>` : '';
    const bBadge = bEval && bEval.symbol ? `<span class="eval-badge ${bEval.badgeClass}">${bEval.symbol}</span>` : '';

    const row = `
      <div class="move-row">
        <span class="move-number">${moveNo}.</span>
        <button id="move-${i}" class="move-btn" onclick="goToMove(${i})">
          <span>${whiteMove}</span> ${wBadge}
        </button>
        <button id="move-${i + 1}" class="move-btn" onclick="goToMove(${i + 1})" ${!blackMove ? 'disabled' : ''}>
          <span>${blackMove}</span> ${bBadge}
        </button>
      </div>
    `;
    container.append(row);
  }
}

// التشغيل التلقائي
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
    }, 1000);
  } else {
    clearInterval(playInterval);
  }
}

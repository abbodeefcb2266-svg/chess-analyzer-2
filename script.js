let board = null;
let game = new Chess();
let history = [];
let moveAnalysis = [];
let currentMoveIndex = -1;
let autoplayTimer = null;
let evalChart = null;

// قيم القطع لحساب التقييم المبدئي
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
  return parseFloat(score.toFixed(2));
}

$(document).ready(function () {
  board = Chessboard('board', {
    position: 'start',
    draggable: false,
    pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
  });

  $(window).on('resize', function() { if (board) board.resize(); });

  $('#btnAnalyze').on('click', () => parsePGN($('#pgnInput').val()));
  $('#btnNext').on('click', () => renderStep(currentMoveIndex + 1));
  $('#btnPrev').on('click', () => renderStep(currentMoveIndex - 1));
  $('#btnAuto').on('click', toggleAutoplay);

  // التنقل السريع باستخدام أسهم لوحة المفاتيح
  $(document).on('keydown', (e) => {
    if (e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') renderStep(currentMoveIndex + 1);
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') renderStep(currentMoveIndex - 1);
  });
});

function parsePGN(pgn) {
  const g = new Chess();
  // تنظيف النص ودعم الأرقام العربية
  pgn = pgn.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
  
  if (!g.load_pgn(pgn)) {
    alert('الرجاء التأكد من صحة كود الـ PGN المدخل!');
    return;
  }

  history = g.history({ verbose: true });
  analyzeMoves();
  renderHorizontalMoves();
  drawChart();
  renderStep(-1);
  
  // تحديث حالة المدرب بعد التحليل
  if ($('#coachText').length) {
    $('#coachText').text('اكتمل التحليل الاحترافي بنجاح! استخدم الأزرار أو الأسهم لمراجعة النقاط المفصلية.');
    $('#coachIcon').text('🦉');
  }
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

    let info = { name: 'جيدة', icon: '✔️', bg: 'bg-good', msg: 'نقلة جيدة ومتوازنة.' };

    if (i < 6) {
      info = { name: 'كتاب', icon: '📖', bg: 'bg-book', msg: 'نقلة افتتاحية معتمدة في نظريات الشطرنج.' };
    } else if (delta >= 1.2) {
      info = { name: 'رائعة', icon: '‼️', bg: 'bg-great', msg: 'نقلة عبقرية! أحدثت تفوقاً كبيراً.' };
    } else if (delta >= 0.0) {
      info = { name: 'الأفضل', icon: '⭐', bg: 'bg-best', msg: 'الخيار الأقوى والأكثر دقة في هذا الموقف.' };
    } else if (delta >= -0.6) {
      info = { name: 'غير دقيقة', icon: '⁉️', bg: 'bg-inaccuracy', msg: 'نقلة غير دقيقة، كان هناك مسار أفضل.' };
    } else if (delta >= -2.0) {
      info = { name: 'خطأ', icon: '❓', bg: 'bg-mistake', msg: 'هفوة تكتيكية منحت الخصم أفضلية ملحوظة.' };
    } else {
      info = { name: 'خطأ فادح', icon: '❌', bg: 'bg-blunder', msg: 'كارثة! هذا خطأ فادح يقلب موازين الجيم.' };
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

  // إزالة الشارات القديمة من على الرقعة
  $('.square-eval-badge').remove();

  if (idx >= 0) {
    const item = moveAnalysis[idx];
    const scoreStr = item.eval > 0 ? `+${item.eval}` : `${item.eval}`;
    
    $('#evalScore').text(scoreStr);
    $('#moveTitle').text(`${item.san} - ${item.name}`);
    $('#moveDescription').text(`تقييم الموقف: ${scoreStr}`);

    // تحديث رسالة المدرب وصورة البومة التعبيرية
    if ($('#coachText').length) {
      $('#coachText').text(item.msg);
      $('#coachIcon').text(item.icon);
    }

    // إضافة شارة التحليل فوق المربع المستهدف بدقة
    const sq = $(`#board .square-${item.toSquare}`);
    if (sq.length) {
      sq.append(`<div class="square-eval-badge ${item.bg}" style="position:absolute; top:-6px; right:-6px; width:26px; height:26px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:900; color:#fff; z-index:99; border:2px solid #fff; box-shadow:0 4px 8px rgba(0,0,0,0.6);">${item.icon}</div>`);
    }

    // تحديث شريط التقييم العمودي أو الأفقي
    let height = 50 + (item.eval * 6);
    height = Math.max(5, Math.min(95, height));
    $('#evalBarFill, #evalFill').css('height', height + '%');

    // تحريك المخطط البياني وتحديد النقطة النشطة فوراً مع كل خطوة
    if (evalChart) {
      evalChart.setActiveElements([{ datasetIndex: 0, index: idx + 1 }]);
      evalChart.update();
    }

  } else {
    $('#evalScore').text('+0.0');
    $('#moveTitle').text('بداية المباراة');
    $('#moveDescription').text('جاهز للتحليل الفوري');
    $('#evalBarFill, #evalFill').css('height', '50%');
    
    if ($('#coachText').length) {
      $('#coachText').text('المباراة تبدأ من هنا. اضغط على زر التالي لنستعرض النقلات.');
      $('#coachIcon').text('🦉');
    }
  }

  $('.chip-move').removeClass('active');
  if (idx >= 0) $(`#chip-${idx}`).addClass('active');
}

function renderHorizontalMoves() {
  const container = $('#movesContainer, #movesBar');
  container.empty();

  history.forEach((m, i) => {
    const btn = `<button id="chip-${i}" class="chip-move" onclick="renderStep(${i})" style="background:#25252e; border:1px solid #282830; color:#fff; padding:6px 12px; border-radius:6px; font-size:12px; cursor:pointer; white-space:nowrap;">${m.san}</button>`;
    container.append(btn);
  });
}

// دالة رسم وإنشاء المخطط البياني الاحترافي باستخدام Chart.js
function drawChart() {
  const canvas = document.getElementById('evalChart');
  if (!canvas) return;
  
  if (evalChart) evalChart.destroy();
  
  const ctx = canvas.getContext('2d');
  const chartData = [0, ...moveAnalysis.map(m => Math.max(-10, Math.min(10, m.eval)))];
  const labels = chartData.map((_, i) => i);

  evalChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        data: chartData,
        borderColor: '#facc15',
        backgroundColor: 'rgba(250, 204, 21, 0.15)',
        borderWidth: 2,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 6,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: { 
        x: { display: false }, 
        y: { display: false, min: -10, max: 10 } 
      },
      plugins: { 
        legend: { display: false }, 
        tooltip: { enabled: false } 
      },
      onClick: (e, elements) => {
        if (elements.length > 0) {
          const index = elements[0].index - 1;
          renderStep(index);
        }
      }
    }
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
    }, 1200);
  }
}

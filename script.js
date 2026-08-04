let board = null;
let game = new Chess();
let history = [];
let currentMoveIndex = -1;
let isPlaying = false;
let playInterval = null;

// إنشاء مؤثر صوتي لنقلات الشطرنج باستخدام Web Audio API
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
  } catch (e) {
    // تجاهل القيود الصوتية للمتصفح قبل تفاعل المستخدم
  }
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

  // رفع ملف PGN من الجهاز
  $('#fileInput').on('change', function (e) {
    const file = e.target.files[0];
    if (file) readFile(file);
  });

  // ميزة سحب وإسقاط الملفات فوق الرقعة (Drag & Drop)
  const boardEl = document.getElementById('board');
  boardEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    boardEl.classList.add('drag-over');
  });
  boardEl.addEventListener('dragleave', () => boardEl.classList.remove('drag-over'));
  boardEl.addEventListener('drop', (e) => {
    e.preventDefault();
    boardEl.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.pgn')) {
      readFile(file);
    }
  });

  // التحكم بالأسهم في الكيبورد (سهم يمين = حركة سابقة، سهم يسار = حركة تالية)
  $(document).on('keydown', function (e) {
    if (e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'ArrowRight') goToMove(currentMoveIndex - 1);
    if (e.key === 'ArrowLeft') goToMove(currentMoveIndex + 1);
  });
});

// قراءة ملف الـ PGN
function readFile(file) {
  const reader = new FileReader();
  reader.onload = function (e) {
    const content = e.target.result;
    $('#pgnInput').val(content);
    loadPGN(content);
  };
  reader.readAsText(file);
}

// تحميل وتحليل الـ PGN
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

  renderMovesList();
  goToMove(-1);
}

// التنقل بين الحركات
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

  // تحديث الحركة النشطة في القائمة
  $('.move-btn').removeClass('active');
  if (index >= 0) {
    $(`#move-${index}`).addClass('active');
  }
}

// عرض قائمة الحركات المنسقة
function renderMovesList() {
  const container = $('#movesList');
  container.empty();

  for (let i = 0; i < history.length; i += 2) {
    const moveNo = Math.floor(i / 2) + 1;
    const whiteMove = history[i];
    const blackMove = history[i + 1] || '';

    const row = `
      <div class="move-row">
        <span class="move-number">${moveNo}.</span>
        <button id="move-${i}" class="move-btn" onclick="goToMove(${i})">${whiteMove}</button>
        <button id="move-${i + 1}" class="move-btn" onclick="goToMove(${i + 1})" ${!blackMove ? 'disabled' : ''}>${blackMove}</button>
      </div>
    `;
    container.append(row);
  }
}

// التشغيل التلقائي للمباراة
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

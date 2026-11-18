const container = document.getElementById('blocks-container');
const targetBox = document.getElementById('target-box');
const joinedCountEl = document.getElementById('joined-count');
const statusText = document.getElementById('status-text');
const resetBtn = document.getElementById('reset-btn');

let blocks = [];
const totalBlocks = 8;

function initPuzzle() {
  container.innerHTML = '';
  targetBox.innerHTML = '<span>Target Zone (<span id="joined-count">0</span>/8)</span>';
  blocks = [];
  
  for (let i = 1; i <= totalBlocks; i++) {
    const block = document.createElement('div');
    block.className = 'block';
    block.textContent = i;
    block.dataset.id = i;
    block.dataset.joined = 'false';
    
    addDragHandlers(block);
    container.appendChild(block);
    blocks.push(block);
  }
  
  updateCount();
  statusText.textContent = "Slide blocks to target!";
  broadcastState();
}

function addDragHandlers(block) {
  let startX = 0, startY = 0;
  let currentX = 0, currentY = 0;
  let isDragging = false;

  function onStart(e) {
    if (block.dataset.joined === 'true') return;
    isDragging = true;
    const touch = e.touches ? e.touches[0] : e;
    startX = touch.clientX - currentX;
    startY = touch.clientY - currentY;
    block.style.zIndex = '100';
    block.style.transition = 'none';
  }

  function onMove(e) {
    if (!isDragging) return;
    if (e.cancelable) e.preventDefault();
    const touch = e.touches ? e.touches[0] : e;
    currentX = touch.clientX - startX;
    currentY = touch.clientY - startY;
    block.style.transform = `translate(${currentX}px, ${currentY}px)`;
    
    // Stream live drag coordinates to TV
    broadcastState({
      draggingId: Number(block.dataset.id),
      dx: currentX,
      dy: currentY
    });
  }

  function onEnd() {
    if (!isDragging) return;
    isDragging = false;
    block.style.zIndex = '1';
    block.style.transition = 'transform 0.2s ease';

    const blockRect = block.getBoundingClientRect();
    const targetRect = targetBox.getBoundingClientRect();

    const isInside = (
      blockRect.left + blockRect.width / 2 > targetRect.left &&
      blockRect.left + blockRect.width / 2 < targetRect.right &&
      blockRect.top + blockRect.height / 2 > targetRect.top &&
      blockRect.top + blockRect.height / 2 < targetRect.bottom
    );

    if (isInside) {
      block.dataset.joined = 'true';
      block.classList.add('joined');
      block.style.transform = 'translate(0, 0)';
      targetBox.appendChild(block);
      updateCount();
    } else {
      currentX = 0;
      currentY = 0;
      block.style.transform = 'translate(0, 0)';
    }

    broadcastState();
  }

  block.addEventListener('mousedown', onStart);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onEnd);

  block.addEventListener('touchstart', onStart, { passive: true });
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('touchend', onEnd);
}

function updateCount() {
  const joinedCount = blocks.filter(b => b.dataset.joined === 'true').length;
  const countDisplay = document.getElementById('joined-count');
  if (countDisplay) countDisplay.textContent = joinedCount;
  
  if (joinedCount === totalBlocks) {
    statusText.textContent = "🎉 All Joined Successfully!";
  } else {
    statusText.textContent = `${totalBlocks - joinedCount} blocks remaining`;
  }
}

// ==========================================
// TV MIRROR SYNC HOOKS
// ==========================================
function broadcastState(activeDrag = null) {
  if (typeof window.syncGameToTV === 'function') {
    const joinedIds = blocks
      .filter(b => b.dataset.joined === 'true')
      .map(b => Number(b.dataset.id));

    window.syncGameToTV({
      joinedIds,
      activeDrag,
      statusMessage: statusText.textContent
    });
  }
}

window.renderTVState = function (state) {
  if (!state) return;

  blocks.forEach(block => {
    const id = Number(block.dataset.id);
    const shouldBeJoined = state.joinedIds.includes(id);

    if (shouldBeJoined && block.dataset.joined !== 'true') {
      block.dataset.joined = 'true';
      block.classList.add('joined');
      block.style.transform = 'translate(0, 0)';
      targetBox.appendChild(block);
    } else if (!shouldBeJoined && block.dataset.joined === 'true') {
      block.dataset.joined = 'false';
      block.classList.remove('joined');
      block.style.transform = 'translate(0, 0)';
      container.appendChild(block);
    }

    // Mirror active finger drag in real time on the TV
    if (state.activeDrag && state.activeDrag.draggingId === id && !shouldBeJoined) {
      block.style.zIndex = '100';
      block.style.transition = 'none';
      block.style.transform = `translate(${state.activeDrag.dx}px, ${state.activeDrag.dy}px)`;
    } else {
      block.style.zIndex = '1';
      block.style.transition = 'transform 0.2s ease';
      block.style.transform = 'translate(0, 0)';
    }
  });

  updateCount();
  if (state.statusMessage) {
    statusText.textContent = state.statusMessage;
  }
};

resetBtn.addEventListener('click', initPuzzle);

window.addEventListener('resize', () => {
  statusText.textContent = "Orientation checked!";
});

initPuzzle();

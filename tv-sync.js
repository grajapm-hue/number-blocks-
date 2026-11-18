/**
 * tv-sync.js
 * Serverless WebRTC TV Mirroring for Number Blocks PWA via PeerJS
 */
(function () {
  const PEER_PREFIX = 'nb-tv-';
  let peer = null;
  let activeConn = null;
  let isTVMode = false;
  let lastKnownState = null;

  window.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get('tv');

    if (joinCode) {
      initTVViewer(joinCode);
    } else {
      initHostUI();
    }
  });

  function initHostUI() {
    const castBtn = document.getElementById('tvCastBtn');
    const modal = document.getElementById('tvModal');
    const closeModal = document.getElementById('closeTvModal');
    const codeDisplay = document.getElementById('tvRoomCode');
    const statusText = document.getElementById('tvStatusText');

    if (!castBtn || !modal) return;

    castBtn.addEventListener('click', () => {
      modal.style.display = 'flex';
      if (!peer || peer.destroyed) {
        startHostSession(codeDisplay, statusText);
      }
    });

    closeModal.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }

  function startHostSession(codeDisplay, statusText) {
    const shortCode = Math.floor(1000 + Math.random() * 9000).toString();
    const fullPeerId = PEER_PREFIX + shortCode;

    codeDisplay.textContent = shortCode;
    statusText.textContent = 'Connecting to signaling server...';
    statusText.style.color = '#f4a261';

    // Explicitly configure secure connection for HTTPS (GitHub Pages)
    peer = new Peer(fullPeerId, {
      secure: true,
      host: '0.peerjs.com',
      port: 443,
      debug: 2
    });

    peer.on('open', (id) => {
      console.log('PeerJS Host ready with ID:', id);
      statusText.textContent = 'Waiting for TV to connect...';
      statusText.style.color = '#e76f51';
    });

    peer.on('connection', (conn) => {
      activeConn = conn;
      statusText.textContent = 'Connected to Smart TV!';
      statusText.style.color = '#2a9d8f';

      conn.on('open', () => {
        if (lastKnownState) {
          conn.send({ type: 'SYNC_STATE', payload: lastKnownState });
        }
      });

      conn.on('close', () => {
        activeConn = null;
        statusText.textContent = 'TV disconnected. Waiting...';
        statusText.style.color = '#e76f51';
      });
    });

    peer.on('error', (err) => {
      console.error('PeerJS Host Error:', err);
      if (err.type === 'unavailable-id') {
        statusText.textContent = 'Code collision. Re-open modal to retry.';
      } else {
        statusText.textContent = `Error: ${err.type}. Check network/HTTPS.`;
      }
      statusText.style.color = '#e76f51';
    });
  }

  window.syncGameToTV = function (gameState) {
    lastKnownState = gameState;
    if (!isTVMode && activeConn && activeConn.open) {
      activeConn.send({ type: 'SYNC_STATE', payload: gameState });
    }
  };

  function initTVViewer(shortCode) {
    isTVMode = true;
    document.body.classList.add('tv-viewer-mode');

    const blocker = document.createElement('div');
    blocker.id = 'tvInteractionBlocker';
    document.body.appendChild(blocker);

    const banner = document.createElement('div');
    banner.id = 'tvViewerBanner';
    banner.textContent = `Connecting to Room ${shortCode}...`;
    document.body.appendChild(banner);

    // Explicitly configure secure connection for TV viewer as well
    peer = new Peer({
      secure: true,
      host: '0.peerjs.com',
      port: 443,
      debug: 2
    });

    peer.on('open', () => {
      const targetId = PEER_PREFIX + shortCode.trim();
      console.log('Connecting to host:', targetId);
      const conn = peer.connect(targetId, { reliable: true });

      conn.on('open', () => {
        banner.textContent = `Live TV Mirror • Room ${shortCode}`;
        banner.style.background = '#2a9d8f';
        setTimeout(() => { banner.style.opacity = '0.35'; }, 4000);
      });

      conn.on('data', (data) => {
        if (data && data.type === 'SYNC_STATE' && typeof window.renderTVState === 'function') {
          window.renderTVState(data.payload);
        }
      });

      conn.on('close', () => {
        banner.style.opacity = '1';
        banner.style.background = '#e76f51';
        banner.textContent = 'Disconnected from controller.';
      });
    });

    peer.on('error', (err) => {
      console.error('PeerJS Viewer Error:', err);
      banner.style.background = '#e76f51';
      banner.textContent = `Connection failed (${err.type}). Check TV browser.`;
    });
  }
})();

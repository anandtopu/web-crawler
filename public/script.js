document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const crawlForm = document.getElementById('crawlForm');
  const urlInput = document.getElementById('urlInput');
  const submitBtn = document.getElementById('submitBtn');
  const stopBtn = document.getElementById('stopBtn');
  const clearDbBtn = document.getElementById('clearDbBtn');
  const statusMessage = document.getElementById('statusMessage');
  
  // Stat Elements
  const statWorkers = document.getElementById('stat-workers');
  const statSeen = document.getElementById('stat-seen');
  const statDB = document.getElementById('stat-db');
  const statLinks = document.getElementById('stat-links');

  // History Elements
  const historyTableBody = document.getElementById('historyTableBody');
  const refreshHistoryBtn = document.getElementById('refreshHistoryBtn');

  const API_BASE = '/api/crawl';

  // --- Form Submission ---
  crawlForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = urlInput.value.trim();
    if (!url) return;

    setLoading(true);
    showMessage('', '');

    try {
      const resp = await fetch(`${API_BASE}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      const data = await resp.json();
      
      if (!resp.ok) {
        throw new Error(data.error || 'Failed to start crawl');
      }

      showMessage(`Started crawling ${data.url}`, 'success');
      urlInput.value = '';
      
      // Trigger a refresh immediately
      fetchStats();
      fetchHistory();

    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setLoading(false);
    }
  });

  stopBtn.addEventListener('click', async () => {
    stopBtn.disabled = true;
    stopBtn.innerHTML = '<span>Stopping...</span>';
    try {
      const resp = await fetch(`${API_BASE}/stop`, { method: 'POST' });
      if (!resp.ok) throw new Error('Failed to stop crawl');
      showMessage('Crawling stopped successfully', 'success');
      setTimeout(fetchStats, 500); // trigger quick refresh
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      stopBtn.disabled = false;
      stopBtn.innerHTML = `
        <span>Stop</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        </svg>
      `;
    }
  });

  clearDbBtn.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to clear the entire crawled database?')) return;
    
    clearDbBtn.disabled = true;
    clearDbBtn.innerHTML = '<span>Clearing...</span>';
    try {
      const resp = await fetch(`${API_BASE}/clear-db`, { method: 'POST' });
      if (!resp.ok) throw new Error('Failed to clear database');
      showMessage('Database fully cleared!', 'success');
      fetchStats(); 
      fetchHistory();
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      clearDbBtn.disabled = false;
      clearDbBtn.innerHTML = `
        <span>Clear DB</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      `;
    }
  });

  function updateStopButtonVisibility(active, waiting) {
    if (active > 0 || waiting > 0) {
      stopBtn.style.display = 'flex';
    } else {
      stopBtn.style.display = 'none';
    }
  }

  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    if (isLoading) {
      submitBtn.innerHTML = `
        <div class="loader-spinner" style="width:16px; height:16px; margin:0; border-color: rgba(255,255,255,0.3); border-top-color: white;"></div>
        <span>Starting...</span>
      `;
    } else {
      submitBtn.innerHTML = `
        <span>Start Crawling</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"></line>
          <polyline points="12 5 19 12 12 19"></polyline>
        </svg>
      `;
    }
  }

  function showMessage(msg, type) {
    statusMessage.textContent = msg;
    statusMessage.className = `status-message ${type}`;
    if (msg) {
      setTimeout(() => {
        statusMessage.style.opacity = '0';
      }, 5000);
      statusMessage.style.opacity = '1';
    }
  }

  // --- Live Telemetry (Stats) ---
  async function fetchStats() {
    try {
      const resp = await fetch(`${API_BASE}/stats`);
      if (!resp.ok) return;
      const data = await resp.json();

      // Update UI
      // Workers: active / waiting
      statWorkers.textContent = `${data.queue.active} / ${data.queue.waiting}`;
      updateStopButtonVisibility(data.queue.active, data.queue.waiting);
      
      // Seen pages
      statSeen.textContent = formatNumber(data.redis.seenUrls);
      // DB indexed
      statDB.textContent = formatNumber(data.db.pageCount);
      // Links discovered
      statLinks.textContent = formatNumber(data.db.linkCount);

    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }

  // --- History ---
  async function fetchHistory() {
    refreshHistoryBtn.classList.add('spinning');
    
    try {
      const resp = await fetch(`${API_BASE}/history`);
      if (!resp.ok) throw new Error('Failed to fetch history');
      const data = await resp.json();

      renderHistory(data);
    } catch (err) {
      console.error('Error fetching history:', err);
      historyTableBody.innerHTML = `
        <tr>
          <td colspan="4" class="empty-state">
            <p style="color: #ef4444">Failed to load history</p>
          </td>
        </tr>
      `;
    } finally {
      setTimeout(() => refreshHistoryBtn.classList.remove('spinning'), 500); // Visual feedback duration
    }
  }

  function renderHistory(items) {
    if (!items || items.length === 0) {
      historyTableBody.innerHTML = `
        <tr>
          <td colspan="4" class="empty-state">
            <p>No pages crawled yet. Start exploring above.</p>
          </td>
        </tr>
      `;
      return;
    }

    historyTableBody.innerHTML = items.map(item => `
      <tr>
        <td class="title-cell" title="${item.title || 'No Title'}">${escapeHtml(item.title) || '<span style="color:var(--text-muted)">No Title</span>'}</td>
        <td class="url-cell" title="${item.url}">
          <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.url)}</a>
        </td>
        <td>
          <span class="badge purple">${formatNumber(item._count?.linksOut || 0)} links</span>
        </td>
        <td class="time-cell">${formatTimeAgo(new Date(item.crawledAt))}</td>
      </tr>
    `).join('');
  }

  // --- Utils ---
  function formatNumber(num) {
    return new Intl.NumberFormat().format(num || 0);
  }

  function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
  }

  function formatTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "y ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "mo ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "m ago";
    if (seconds < 10) return "just now";
    return Math.floor(seconds) + "s ago";
  }

  // Bind events
  refreshHistoryBtn.addEventListener('click', fetchHistory);

  // Add spinning anim for manual button toggle
  const style = document.createElement('style');
  style.innerHTML = `
    .icon-btn.spinning svg {
      animation: spin 1s linear infinite;
    }
  `;
  document.head.appendChild(style);

  // --- Initialization ---
  fetchStats();
  fetchHistory();

  // Poll stats every 3 seconds
  setInterval(fetchStats, 3000);
  
  // Poll history every 15 seconds to keep it semi-fresh without overwhelming UI
  setInterval(fetchHistory, 15000);
});

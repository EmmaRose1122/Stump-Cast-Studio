// Options page: pair with StumpCast Studio and show connection status.
interface StatusReply {
  paired: boolean;
  readingPaused: boolean;
  tabs: { matchId: string; url: string; confidence?: number }[];
  port?: number | null;
  detectedPorts?: number[];
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

$('extension-version').textContent = `v${chrome.runtime.getManifest().version}`;

let autoPairAttempted = false;

const renderStatus = (s: StatusReply | undefined) => {
  const el = $('status');
  const unpairBtn = $('unpair');
  const tabCount = $('tab-count');
  const tabsContainer = $('tabs-container');

  if (!s) {
    el.dataset.state = 'warn';
    el.textContent = 'Extension background is waking up / connecting…';
    unpairBtn.style.display = 'none';
    return;
  }

  $<HTMLInputElement>('pause-reading').checked = s.readingPaused;

  const portInput = $<HTMLInputElement>('studio-port-input');
  if (portInput && s.port && document.activeElement !== portInput) {
    portInput.value = String(s.port);
  }

  const detectedContainer = $('detected-ports-container');
  if (detectedContainer && s.detectedPorts && s.detectedPorts.length > 0) {
    detectedContainer.innerHTML = `
      <span style="font-size: 11px; color: var(--text-muted); font-weight: 600;">Detected Studios:</span>
      ${s.detectedPorts
        .map(
          (p) => `
        <button type="button" class="btn btn-secondary switch-port-pill" data-port="${p}" style="padding: 3px 8px; font-size: 11px; border-radius: 6px; ${
          p === s.port ? 'border-color: #22c55e; color: #86efac; font-weight: 700;' : ''
        }">
          Port ${p} ${p === s.port ? '✓ Active' : '⚡ Connect'}
        </button>
      `
        )
        .join('')}
    `;

    detectedContainer.querySelectorAll<HTMLButtonElement>('.switch-port-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        const portNum = Number(btn.dataset.port);
        if (portNum && portNum !== s.port) {
          switchPort(portNum);
        }
      });
    });
  }

  if (s.readingPaused) {
    el.dataset.state = 'warn';
    el.textContent = '⏸️ Reading paused. Uncheck below to resume match updates.';
    unpairBtn.style.display = s.paired ? 'inline-flex' : 'none';
    return;
  }

  if (!s.paired) {
    el.dataset.state = 'warn';
    el.textContent = '🟠 Not paired with StumpCast Studio.';
    unpairBtn.style.display = 'none';

    // Auto-attempt 1-click pairing once on open
    if (!autoPairAttempted) {
      autoPairAttempted = true;
      triggerAutoPair(false);
    }
  } else {
    el.dataset.state = 'ok';
    const portText = s.port ? ` (Port ${s.port})` : '';
    el.textContent =
      s.tabs.length > 0
        ? `🟢 Connected & Streaming ${s.tabs.length} match${s.tabs.length === 1 ? '' : 'es'}${portText}`
        : `🟢 Paired with StumpCast Studio${portText}. Ready for live match.`;
    unpairBtn.style.display = 'inline-flex';
  }

  // Render open tabs
  tabCount.textContent = String(s.tabs?.length ?? 0);
  if (s.tabs && s.tabs.length > 0) {
    tabsContainer.innerHTML = `
      <div class="tabs-list">
        ${s.tabs
          .map(
            (t) => `
          <div class="tab-item">
            <div class="tab-header">
              <span class="tab-id">Match #${t.matchId}</span>
              <span class="tab-badge">LIVE STREAMING</span>
            </div>
            <div class="tab-url" title="${t.url}">${t.url}</div>
          </div>
        `
          )
          .join('')}
      </div>
    `;
  } else {
    tabsContainer.innerHTML = `
      <p style="color: var(--text-muted); font-size: 13px; margin: 0; text-align: center;">
        No live match tabs detected yet. Open a live match on Cricbuzz or Crex in your browser.
      </p>
    `;
  }
};

const refresh = () => {
  chrome.runtime
    .sendMessage({ type: 'status' })
    .then((r: StatusReply) => renderStatus(r))
    .catch(() => renderStatus(undefined));
};

const triggerAutoPair = (_notifySuccess?: boolean) => {
  const msg = $('message');
  const btn = $<HTMLButtonElement>('auto-pair');
  btn.disabled = true;
  btn.textContent = 'Connecting…';
  msg.className = 'message';
  msg.textContent = 'Auto-discovering StumpCast Studio on 127.0.0.1:4000…';

  chrome.runtime
    .sendMessage({ type: 'auto-pair' })
    .then((r: { ok: boolean }) => {
      btn.disabled = false;
      btn.textContent = '⚡ 1-Click Auto Connect to Studio';
      if (r?.ok) {
        msg.className = 'message success';
        msg.textContent = 'Successfully paired with StumpCast Studio!';
      } else {
        msg.className = 'message error';
        msg.textContent = 'Could not auto-pair. Make sure StumpCast Studio is running on this computer.';
      }
      refresh();
    })
    .catch(() => {
      btn.disabled = false;
      btn.textContent = '⚡ 1-Click Auto Connect to Studio';
      msg.className = 'message error';
      msg.textContent = 'Could not reach extension background worker. Try reloading the extension.';
    });
};

const switchPort = (targetPort: number) => {
  const msg = $('message');
  msg.className = 'message';
  msg.textContent = `Connecting to StumpCast Studio on Port ${targetPort}…`;

  chrome.runtime
    .sendMessage({ type: 'set-port', port: targetPort })
    .then((r: { ok?: boolean; port?: number }) => {
      if (r?.ok) {
        msg.className = 'message success';
        msg.textContent = `Successfully connected to Port ${r.port ?? targetPort}!`;
      } else {
        msg.className = 'message error';
        msg.textContent = `Could not connect to Port ${targetPort}. Make sure Studio is running on that port.`;
      }
      refresh();
    })
    .catch(() => {
      msg.className = 'message error';
      msg.textContent = 'Could not reach extension background worker.';
    });
};

$('set-port-btn')?.addEventListener('click', () => {
  const val = Number($<HTMLInputElement>('studio-port-input').value.trim());
  if (val && val >= 1024 && val <= 65535) {
    switchPort(val);
  }
});

$('auto-pair').addEventListener('click', () => {
  triggerAutoPair(true);
});

$('unpair').addEventListener('click', () => {
  chrome.runtime
    .sendMessage({ type: 'unpair' })
    .then(() => {
      $('message').className = 'message';
      $('message').textContent = 'Disconnected from studio.';
      refresh();
    })
    .catch(() => undefined);
});

$('clear-data').addEventListener('click', () => {
  if (!window.confirm('Clear all saved extension data? Open browser tabs and Studio match data will not be deleted.')) {
    return;
  }

  const btn = $<HTMLButtonElement>('clear-data');
  const msg = $('message');
  btn.disabled = true;
  btn.textContent = 'Clearing…';
  msg.className = 'message';
  msg.textContent = 'Removing saved extension data…';

  chrome.runtime
    .sendMessage({ type: 'clear-data' })
    .then((r: { ok?: boolean }) => {
      if (!r?.ok) throw new Error('Clear failed');
      autoPairAttempted = false;
      msg.className = 'message success';
      msg.textContent = 'Extension data cleared. Open matches will be read afresh.';
      refresh();
    })
    .catch(() => {
      msg.className = 'message error';
      msg.textContent = 'Could not clear extension data. Reload the extension and try again.';
    })
    .finally(() => {
      btn.disabled = false;
      btn.textContent = 'Clear Extension Data';
    });
});

refresh();
setInterval(refresh, 2500);

$<HTMLInputElement>('pause-reading').addEventListener('change', (event) => {
  const paused = (event.currentTarget as HTMLInputElement).checked;
  chrome.storage.local
    .set({ readingPaused: paused })
    .then(() => {
      $('message').className = 'message';
      $('message').textContent = paused ? 'Reading paused.' : 'Reading resumed.';
      refresh();
    })
    .catch(() => {
      $('message').className = 'message error';
      $('message').textContent = 'Could not update reading setting.';
    });
});

$('open-cricbuzz')?.addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://www.cricbuzz.com/cricket-match/live-scores' });
});

$('open-crex')?.addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://crex.live' });
});

$('test-send')?.addEventListener('click', () => {
  const msg = $('message');
  msg.className = 'message';
  msg.textContent = 'Injecting live test match data into StumpCast Studio…';

  chrome.runtime
    .sendMessage({ type: 'status' })
    .then((s: StatusReply) => {
      const port = s?.port || 4000;
      fetch(`http://127.0.0.1:${port}/api/ext/seed-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
        .then((r) => r.json())
        .then((data: { ok?: boolean }) => {
          if (data?.ok) {
            msg.className = 'message success';
            msg.textContent = '✅ Live test match data injected into Studio Overlay!';
            refresh();
          } else {
            msg.className = 'message error';
            msg.textContent = 'Could not seed match. Check if Studio is running.';
          }
        })
        .catch(() => {
          msg.className = 'message error';
          msg.textContent = `Could not reach Studio on port ${port}. Ensure StumpCast is open.`;
        });
    })
    .catch(() => {
      msg.className = 'message error';
      msg.textContent = 'Extension background not responding. Reload extension.';
    });
});

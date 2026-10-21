// StumpCast Studio Website Script

document.addEventListener('DOMContentLoaded', () => {
  // 1. FAQ Accordion Logic
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach((item) => {
    const questionBtn = item.querySelector('.faq-question');
    questionBtn.addEventListener('click', () => {
      const isActive = item.classList.contains('active');
      // Close all other items
      faqItems.forEach((other) => other.classList.remove('active'));
      if (!isActive) {
        item.classList.add('active');
      }
    });
  });

  // 2. Scoreboard Simulation Animation (Live feeling)
  let score = 184;
  let balls = 2; // 18.2 overs
  const scoreElem = document.getElementById('sim-score');
  const oversElem = document.getElementById('sim-overs');
  const runsTypeElem = document.getElementById('sim-runs-type');

  if (scoreElem && oversElem) {
    setInterval(() => {
      // Simulate occasional ball event
      balls++;
      let runAdded = 1;
      const rand = Math.random();
      if (rand > 0.8) runAdded = 4;
      else if (rand > 0.92) runAdded = 6;
      else if (rand > 0.6) runAdded = 2;
      else if (rand > 0.4) runAdded = 1;
      else runAdded = 0;

      score += runAdded;
      const overNum = Math.floor(18 + balls / 6);
      const ballNum = balls % 6;

      scoreElem.textContent = `${score}/3`;
      oversElem.textContent = `(${overNum}.${ballNum} Ov)`;

      if (runsTypeElem) {
        if (runAdded === 4) {
          runsTypeElem.textContent = '⚡ FOUR! Beautiful boundary through extra cover!';
          runsTypeElem.style.color = '#f97316';
        } else if (runAdded === 6) {
          runsTypeElem.textContent = '🚀 MAXIMUM! Huge 98m six over long-on!';
          runsTypeElem.style.color = '#10b981';
        } else {
          runsTypeElem.textContent = `• ${runAdded} run taken. Batsman rotating strike smoothly.`;
          runsTypeElem.style.color = '#ffffff';
        }
      }
    }, 4500);
  }

  // 3. Dynamic GitHub Release Check (Fallback to local v1.0.4)
  const downloadBtn = document.getElementById('main-download-btn');
  const ctaDownloadBtn = document.getElementById('download-cta-btn');
  const versionDisplay = document.getElementById('latest-version-display');

  // Connected to your GitHub releases for dynamic updates
  const GITHUB_REPO = 'EmmaRose1122/Stump-Cast-Studio';

  if (GITHUB_REPO) {
    fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.tag_name) {
          const ver = data.tag_name.replace(/^v/, '');
          if (versionDisplay) versionDisplay.textContent = `v${ver} for Windows`;
          const exeAsset = data.assets?.find((a) => a.name.endsWith('.exe'));
          if (exeAsset) {
            if (downloadBtn) downloadBtn.href = exeAsset.browser_download_url;
            if (ctaDownloadBtn) ctaDownloadBtn.href = exeAsset.browser_download_url;
          }
        }
      })
      .catch(() => {
        // Fallback default remains v1.0.4
      });
  }
});

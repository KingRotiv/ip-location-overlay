(function() {
  'use strict';

  // Evita duplicação
  if (document.getElementById('ip-location-overlay')) return;

  // ========== CONFIGURAÇÃO DE APIs COM FALLBACK ==========
  const API_ENDPOINTS = [
    {
      name: 'FreeIPAPI',
      url: 'https://freeipapi.com/api/json/',
      parser: (data) => ({
        ip: data.ipAddress,
        country: data.countryName,
        countryCode: data.countryCode,
        region: data.regionName,
        city: data.cityName,
        isp: data.isp,
        lat: data.latitude,
        lon: data.longitude,
        timezone: data.timeZone,
        currency: data.currency?.name,
        currencySymbol: data.currency?.symbol
      })
    },
    {
      name: 'IP-API',
      url: 'http://ip-api.com/json/?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query',
      parser: (data) => ({
        ip: data.query,
        country: data.country,
        countryCode: data.countryCode,
        region: data.regionName,
        city: data.city,
        isp: data.isp,
        lat: data.lat,
        lon: data.lon,
        timezone: data.timezone,
        currency: null,
        currencySymbol: null
      })
    },
    {
      name: 'IPinfo Lite',
      url: 'https://ipinfo.io/lite/',
      parser: (data) => ({
        ip: data.ip,
        country: data.country,
        countryCode: data.country_code,
        region: null,
        city: null,
        isp: data.as_name,
        lat: null,
        lon: null,
        timezone: null,
        currency: null,
        currencySymbol: null
      })
    },
    {
      name: 'MyIP',
      url: 'https://api.myip.com',
      parser: (data) => ({
        ip: data.ip,
        country: data.country,
        countryCode: data.cc,
        region: null,
        city: null,
        isp: null,
        lat: null,
        lon: null,
        timezone: null,
        currency: null,
        currencySymbol: null
      })
    },
    {
      name: 'IPify',
      url: 'https://api.ipify.org?format=json',
      parser: (data) => ({
        ip: data.ip,
        country: null,
        countryCode: null,
        region: null,
        city: null,
        isp: null,
        lat: null,
        lon: null,
        timezone: null,
        currency: null,
        currencySymbol: null
      })
    }
  ];

  // ========== CRIAÇÃO DO PAINEL ==========
  const panel = document.createElement('div');
  panel.id = 'ip-location-overlay';
  panel.innerHTML = `
    <div class="ip-overlay-header">
      <span class="ip-overlay-title" id="content-title">🌐 Minha Conexão</span>
      <div class="ip-header-btns">
        <button class="ip-overlay-toggle" title="Minimizar">−</button>
        <button class="ip-overlay-close" title="Fechar">×</button>
      </div>
    </div>
    <div class="ip-overlay-body">
      <div class="ip-overlay-loading">
        <div class="ip-spinner"></div>
        <span>Detectando localização...</span>
        <span class="ip-api-name"></span>
      </div>
      <div class="ip-overlay-content" style="display: none;">
        <div class="ip-row">
          <span class="ip-label">IP:</span>
          <div class="ip-value-wrap">
            <span class="ip-value" id="ip-address">--</span>
            <button class="ip-copy-btn" data-target="ip-address" title="Copiar">📋</button>
          </div>
        </div>
        <div class="ip-row">
          <span class="ip-label">País:</span>
          <div class="ip-value-wrap">
            <span class="ip-value" id="ip-country">--</span>
            <img id="ip-flag" class="ip-flag" src="" alt="" style="display: none;">
          </div>
        </div>
        <div class="ip-row">
          <span class="ip-label">Região:</span>
          <span class="ip-value" id="ip-region">--</span>
        </div>
        <div class="ip-row">
          <span class="ip-label">Cidade:</span>
          <span class="ip-value" id="ip-city">--</span>
        </div>
        <div class="ip-row">
          <span class="ip-label">Provedor:</span>
          <span class="ip-value" id="ip-isp">--</span>
        </div>
        <div class="ip-row">
          <span class="ip-label">Coordenadas:</span>
          <span class="ip-value" id="ip-coords">--</span>
        </div>
        <div class="ip-row">
          <span class="ip-label">Fuso:</span>
          <span class="ip-value" id="ip-timezone">--</span>
        </div>
        <div class="ip-row">
          <span class="ip-label">Moeda:</span>
          <span class="ip-value" id="ip-currency">--</span>
        </div>
        <div class="ip-footer">
          <span id="ip-last-update">--</span>
          <div class="ip-footer-btns">
            <span class="ip-source-badge" id="ip-source">--</span>
            <button class="ip-refresh-btn" title="Atualizar">🔄</button>
          </div>
        </div>
      </div>
      <div class="ip-overlay-error" style="display: none;">
        <span>❌ Falha ao carregar</span>
        <button class="ip-retry-btn">Tentar novamente</button>
      </div>
    </div>
  `;

  document.body.appendChild(panel);

  // ========== REFERÊNCIAS DOM ==========
  const loadingEl = panel.querySelector('.ip-overlay-loading');
  const contentEl = panel.querySelector('.ip-overlay-content');
  const errorEl = panel.querySelector('.ip-overlay-error');
  const apiNameEl = panel.querySelector('.ip-api-name');
  const toggleBtn = panel.querySelector('.ip-overlay-toggle');
  const closeBtn = panel.querySelector('.ip-overlay-close');
  const refreshBtn = panel.querySelector('.ip-refresh-btn');
  const retryBtn = panel.querySelector('.ip-retry-btn');
  const contentTitle = panel.querySelector('#content-title');

  let isMinimized = false;
  let currentApiIndex = 0;
  let savedMinimizedPosition = null;
  const fixedSpacing = 15;

  // ========== FUNÇÃO PRINCIPAL COM FALLBACK ==========
  async function fetchIPData() {
    loadingEl.style.display = 'flex';
    contentEl.style.display = 'none';
    errorEl.style.display = 'none';
    currentApiIndex = 0;

    for (let i = 0; i < API_ENDPOINTS.length; i++) {
      const api = API_ENDPOINTS[i];
      apiNameEl.textContent = `Tentando ${api.name}...`;
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

        const response = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({ type: 'fetch-api', url: api.url }, (result) => {
            if (!result) {
              return reject(new Error('Nenhuma resposta do background'));
            }
            if (chrome.runtime.lastError) {
              return reject(new Error(chrome.runtime.lastError.message));
            }
            resolve(result);
          });
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText || ''}`);
        }

        const data = response.body;
        
        // Verifica se a API retornou erro (IP-API usa campo status)
        if (data.status === 'fail') {
          throw new Error(data.message || 'API retornou falha');
        }

        const parsed = api.parser(data);
        renderData(parsed, api.name);
        return; // Sucesso! Sai da função

      } catch (error) {
        console.warn(`Falha na API ${api.name}:`, error.message);
        currentApiIndex++;
        
        // Se for a última API, mostra erro
        if (i === API_ENDPOINTS.length - 1) {
          showError();
        }
        // Senão, continua o loop para próxima API
      }
    }
  }

  // ========== RENDERIZAR DADOS ==========
  function renderData(data, sourceName) {
    // Preenche campos com fallback para "N/A"
    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value || 'N/A';
    };

    setText('ip-address', data.ip);
    setText('ip-country', data.countryCode ? `${data.country} (${data.countryCode})` : data.country);
    setText('ip-region', data.region);
    setText('ip-city', data.city);
    setText('ip-isp', data.isp);
    
    // Coordenadas
    const coords = (data.lat && data.lon) 
      ? `${parseFloat(data.lat).toFixed(4)}, ${parseFloat(data.lon).toFixed(4)}` 
      : null;
    setText('ip-coords', coords);
    
    setText('ip-timezone', data.timezone);
    
    // Moeda
    const currency = data.currency 
      ? (data.currencySymbol ? `${data.currency} (${data.currencySymbol})` : data.currency)
      : null;
    setText('ip-currency', currency);

    // Bandeira
    const flagImg = document.getElementById('ip-flag');
    if (data.countryCode) {
      flagImg.src = `https://flagcdn.com/w20/${data.countryCode.toLowerCase()}.png`;
      flagImg.style.display = 'inline-block';
      flagImg.alt = `Bandeira ${data.country || ''}`;
    } else {
      flagImg.style.display = 'none';
    }

    // Badge da fonte
    document.getElementById('ip-source').textContent = sourceName;
    document.getElementById('ip-source').title = `Dados fornecidos por ${sourceName}`;

    // Timestamp
    const now = new Date();
    document.getElementById('ip-last-update').textContent = 
      `${now.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}`;

    loadingEl.style.display = 'none';
    contentEl.style.display = 'block';

    // Minimizar automaticamente
    setTimeout(() => {
      toggleBtn.click();
    }, 3000);
  }

  // ========== MOSTRAR ERRO ==========
  function showError() {
    loadingEl.style.display = 'none';
    errorEl.style.display = 'flex';
  }

  // ========== EVENT LISTENERS ==========
  
  // Minimizar/Expandir
  toggleBtn.addEventListener('click', () => {
    const wasMinimized = isMinimized;
    isMinimized = !isMinimized;
    const nowIP = document.getElementById('ip-address').textContent || 'N/A';
    const nowCountry = document.getElementById('ip-country').textContent || 'N/A';
    const nowFlagSrc = document.getElementById('ip-flag').src || '';
    const rect = panel.getBoundingClientRect();
    const currentLeft = rect.left;
    const currentTop = rect.top;

    if (!savedMinimizedPosition) {
      savedMinimizedPosition = { left: currentLeft, top: currentTop };
    }

    if (!isMinimized) {
      contentTitle.textContent = '🌐 Minha Conexão';
    } else {
      contentTitle.innerHTML = `<div class="ip-content-title-minimized"><span>${nowIP}</span><img id="ip-flag" class="ip-flag" src="${nowFlagSrc}" alt="${nowCountry}"></div>`;
    }

    panel.classList.toggle('ip-minimized', isMinimized);

    if (isMinimized) {
      panel.style.setProperty('left', `${savedMinimizedPosition.left}px`, 'important');
      panel.style.setProperty('top', `${savedMinimizedPosition.top}px`, 'important');
    } else {
      const expandedLeft = clamp(savedMinimizedPosition.left, 0, window.innerWidth - panel.offsetWidth - fixedSpacing);
      const expandedTop = clamp(savedMinimizedPosition.top, 0, window.innerHeight - panel.offsetHeight - fixedSpacing);
      panel.style.setProperty('left', `${expandedLeft}px`, 'important');
      panel.style.setProperty('top', `${expandedTop}px`, 'important');
      panel.style.setProperty('right', 'auto', 'important');
    }

    toggleBtn.textContent = isMinimized ? '+' : '−';
    toggleBtn.title = isMinimized ? 'Expandir' : 'Minimizar';
  });

  // Fechar
  closeBtn.addEventListener('click', () => {
    panel.remove();
    // Remove também o interval de auto-update
    if (window.ipOverlayInterval) {
      clearInterval(window.ipOverlayInterval);
    }
  });

  // Atualizar manual
  refreshBtn.addEventListener('click', () => {
    refreshBtn.style.animation = 'ip-spin 1s linear infinite';
    fetchIPData().then(() => {
      refreshBtn.style.animation = '';
    });
  });

  // Retry
  retryBtn.addEventListener('click', fetchIPData);

  // Copiar IP
  panel.addEventListener('click', (e) => {
    if (e.target.classList.contains('ip-copy-btn')) {
      const targetId = e.target.getAttribute('data-target');
      const text = document.getElementById(targetId)?.textContent || '';
      navigator.clipboard.writeText(text).then(() => {
        const original = e.target.textContent;
        e.target.textContent = '✅';
        setTimeout(() => e.target.textContent = original, 1200);
      }).catch(() => {
        // Fallback para clipboard se a API falhar
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        e.target.textContent = '✅';
        setTimeout(() => e.target.textContent = original, 1200);
      });
    }
  });

  // ========== ARRASTAR O PAINEL ==========
  let isDragging = false;
  let startX, startY, initialLeft, initialTop;
  const header = panel.querySelector('.ip-overlay-header');

  header.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return; // Não arrasta se clicou em botão
    
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    
    const rect = panel.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;
    
    panel.style.setProperty('transition', 'none');
    panel.style.setProperty('right', 'auto', 'important');
    panel.style.setProperty('left', `${initialLeft}px`, 'important');
    panel.style.setProperty('top', `${initialTop}px`, 'important');
    panel.style.cursor = 'grabbing';
  });

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  document.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    e.preventDefault();
   
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const panelWidth = panel.offsetWidth;
    const panelHeight = panel.offsetHeight;
    const minLeft = fixedSpacing;
    const maxLeft = window.innerWidth - panelWidth + (dx < 0 ? fixedSpacing : -fixedSpacing);
    const minTop = fixedSpacing;
    const maxTop = window.innerHeight - panelHeight + (dy < 0 ? fixedSpacing : -fixedSpacing);
    const newLeft = clamp(initialLeft + dx, minLeft, maxLeft);
    const newTop = clamp(initialTop + dy, minTop, maxTop);

    panel.style.setProperty('left', `${newLeft}px`, 'important');
    panel.style.setProperty('top', `${newTop}px`, 'important');

    if (isMinimized) {
      savedMinimizedPosition = { left: newLeft, top: newTop };
    }
  });

  document.addEventListener('pointerup', () => {
    if (isDragging) {
      isDragging = false;
      panel.style.transition = 'all 0.3s ease';
      panel.style.cursor = '';
    }
  });

  // ========== INICIALIZAÇÃO ==========
  fetchIPData();
  
  // Auto-update a cada 5 minutos
  window.ipOverlayInterval = setInterval(fetchIPData, 300000);

})();
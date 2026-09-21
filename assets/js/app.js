/**
 * BANCADA METROLOGÍA INDUSTRIAL - Controlador de Aplicación
 * Lógica modular para catálogo, filtrado, cotizador de lote y WhatsApp
 */

(function () {
  "use strict";

  // Estado reactivo de la aplicación
  const state = {
    activeMagnitude: "todas",
    searchQuery: "",
    quoteLot: {}, // { id: { instrument, quantity } }
    selectedInstrument: null
  };

  // Referencias al DOM
  const dom = {
    magnitudesNav: document.getElementById("magnitudes-nav"),
    magnitudesTabs: document.getElementById("magnitudes-tabs"),
    instrumentsGrid: document.getElementById("instruments-grid"),
    searchInput: document.getElementById("catalog-search"),
    searchClear: document.getElementById("search-clear"),
    resultsCount: document.getElementById("results-count"),
    currentCategoryTitle: document.getElementById("current-category-title"),
    lotFloatingBtn: document.getElementById("lot-floating-btn"),
    lotCountBadges: document.querySelectorAll(".lot-count-badge"),
    lotDrawer: document.getElementById("lot-drawer"),
    lotOverlay: document.getElementById("lot-overlay"),
    lotCloseBtn: document.getElementById("lot-close-btn"),
    lotItemsList: document.getElementById("lot-items-list"),
    lotTotalPieces: document.getElementById("lot-total-pieces"),
    lotTotalTypes: document.getElementById("lot-total-types"),
    lotClearBtn: document.getElementById("lot-clear-btn"),
    lotWhatsappBtn: document.getElementById("lot-whatsapp-btn"),
    serviceTypeRadios: document.getElementsByName("service-type"),
    notesInput: document.getElementById("lot-notes"),
    detailModal: document.getElementById("detail-modal"),
    detailModalContent: document.getElementById("detail-modal-content"),
    detailModalClose: document.getElementById("detail-modal-close"),
    mobileMenuBtn: document.getElementById("mobile-menu-btn"),
    mobileNav: document.getElementById("mobile-nav")
  };

  // Configuración de WhatsApp
  const WHATSAPP_PHONE = "528180108365"; // Línea oficial de ingeniería BANCADA

  // Inicialización
  function init() {
    loadLotFromStorage();
    renderMagnitudes();
    renderInstruments();
    updateLotUI();
    setupEventListeners();
    setupFaqAccordion();
    setupSmoothScroll();
  }

  // --- RENDERIZADO DE MAGNITUDES Y TABS ---
  function renderMagnitudes() {
    if (!dom.magnitudesNav && !dom.magnitudesTabs) return;

    // Tarjetas de navegación rápida (Hero Quick-Cards)
    if (dom.magnitudesNav) {
      dom.magnitudesNav.innerHTML = window.BANCADA_MAGNITUDES.map((mag) => {
        const count = window.BANCADA_INSTRUMENTOS.filter(i => i.magnitud === mag.id).length;
        return `
          <div class="mag-quick-card" data-mag="${mag.id}" role="button" tabindex="0">
            <div class="mag-icon-wrapper">${mag.icon}</div>
            <div class="mag-info">
              <h3 class="mag-title">${mag.nombre}</h3>
              <span class="mag-badge">${count} equipos</span>
            </div>
            <span class="mag-arrow">→</span>
          </div>
        `;
      }).join("");
    }

    // Tabs del catálogo
    if (dom.magnitudesTabs) {
      const allCount = window.BANCADA_INSTRUMENTOS.length;
      let tabsHtml = `
        <button class="tab-btn active" data-mag="todas">
          <span class="tab-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/></svg>
          </span>
          <span class="tab-label">Todas las Magnitudes</span>
          <span class="tab-count">${allCount}</span>
        </button>
      `;

      tabsHtml += window.BANCADA_MAGNITUDES.map((mag) => {
        const count = window.BANCADA_INSTRUMENTOS.filter(i => i.magnitud === mag.id).length;
        return `
          <button class="tab-btn" data-mag="${mag.id}">
            <span class="tab-icon">${mag.icon}</span>
            <span class="tab-label">${mag.nombre}</span>
            <span class="tab-count">${count}</span>
          </button>
        `;
      }).join("");

      dom.magnitudesTabs.innerHTML = tabsHtml;
    }
  }

  // --- FILTRADO Y RENDERIZADO DE INSTRUMENTOS ("PIEZAS PEQUEÑAS") ---
  function getFilteredInstruments() {
    const query = state.searchQuery.trim().toLowerCase();
    const mag = state.activeMagnitude;

    return window.BANCADA_INSTRUMENTOS.filter((inst) => {
      const matchesMag = (mag === "todas") || (inst.magnitud === mag);
      if (!matchesMag) return false;

      if (!query) return true;

      const haystack = [
        inst.nombre,
        inst.rango,
        inst.tipo,
        inst.norma,
        inst.descripcion,
        ...(inst.tags || [])
      ].join(" ").toLowerCase();

      return haystack.includes(query);
    });
  }

  function renderInstruments() {
    if (!dom.instrumentsGrid) return;

    const filtered = getFilteredInstruments();

    // Actualizar títulos y contadores
    if (dom.resultsCount) {
      dom.resultsCount.textContent = `${filtered.length} instrumento${filtered.length === 1 ? '' : 's'} disponible${filtered.length === 1 ? '' : 's'}`;
    }

    if (dom.currentCategoryTitle) {
      if (state.activeMagnitude === "todas") {
        dom.currentCategoryTitle.textContent = state.searchQuery ? `Resultados de búsqueda: "${state.searchQuery}"` : "Catálogo Integral de Calibración Industrial";
      } else {
        const magObj = window.BANCADA_MAGNITUDES.find(m => m.id === state.activeMagnitude);
        dom.currentCategoryTitle.textContent = magObj ? `Magnitud: ${magObj.nombre}` : "Instrumentos";
      }
    }

    // Si no hay resultados
    if (filtered.length === 0) {
      dom.instrumentsGrid.innerHTML = `
        <div class="catalog-empty-state">
          <div class="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M8 11h6"/></svg>
          </div>
          <h3>No encontramos instrumentos para tu criterio</h3>
          <p>Intenta buscar por otro término (ej. "vernier", "presión", "0 a 1000", "torque") o explora todas las magnitudes.</p>
          <button class="btn btn-secondary reset-filters-btn" id="empty-reset-btn">Restablecer Búsqueda</button>
        </div>
      `;
      document.getElementById("empty-reset-btn")?.addEventListener("click", () => {
        state.searchQuery = "";
        state.activeMagnitude = "todas";
        if (dom.searchInput) dom.searchInput.value = "";
        syncTabButtons();
        renderInstruments();
      });
      return;
    }

    // Renderizar tarjetas de instrumentos en piezas individuales
    dom.instrumentsGrid.innerHTML = filtered.map((inst) => {
      const magObj = window.BANCADA_MAGNITUDES.find(m => m.id === inst.magnitud);
      const inLot = state.quoteLot[inst.id];
      const qty = inLot ? inLot.quantity : 0;

      return `
        <article class="instrument-card ${inst.destacado ? 'is-featured' : ''}" data-id="${inst.id}">
          <div class="card-header">
            <span class="card-mag-badge" data-mag="${inst.magnitud}">
              ${magObj ? magObj.icon : ''}
              <span>${magObj ? magObj.nombre : inst.magnitud}</span>
            </span>
            ${inst.servicioInSitu ? `<span class="badge-insitu" title="Calibrable en planta sin desinstalar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> In Situ</span>` : ''}
          </div>

          <div class="card-body">
            <h3 class="instrument-name">${highlightText(inst.nombre, state.searchQuery)}</h3>
            <p class="instrument-desc">${inst.descripcion}</p>

            <div class="specs-grid">
              <div class="spec-row">
                <span class="spec-label">Alcance / Rango:</span>
                <span class="spec-value spec-highlight">${inst.rango}</span>
              </div>
              <div class="spec-row">
                <span class="spec-label">Tipo / Tecnología:</span>
                <span class="spec-value">${inst.tipo}</span>
              </div>
              <div class="spec-row">
                <span class="spec-label">Norma Aplicable:</span>
                <span class="spec-value spec-norma">${inst.norma}</span>
              </div>
            </div>
          </div>

          <div class="card-footer">
            <button class="btn-card-detail" data-action="detail" data-id="${inst.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
              <span>Ficha Técnica</span>
            </button>

            <div class="lot-action-box">
              ${qty > 0 ? `
                <div class="quantity-controller">
                  <button class="qty-btn" data-action="decrease" data-id="${inst.id}" title="Disminuir">-</button>
                  <span class="qty-display">${qty}</span>
                  <button class="qty-btn" data-action="increase" data-id="${inst.id}" title="Aumentar">+</button>
                </div>
              ` : `
                <button class="btn-add-lot" data-action="add" data-id="${inst.id}">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
                  <span>Agregar al Lote</span>
                </button>
              `}
            </div>
          </div>
        </article>
      `;
    }).join("");
  }

  // Resaltado de texto en búsquedas
  function highlightText(text, query) {
    if (!query) return text;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  // Sincronizar botones de tabs
  function syncTabButtons() {
    if (!dom.magnitudesTabs) return;
    const buttons = dom.magnitudesTabs.querySelectorAll(".tab-btn");
    buttons.forEach((btn) => {
      if (btn.getAttribute("data-mag") === state.activeMagnitude) {
        btn.classList.add("active");
        btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      } else {
        btn.classList.remove("active");
      }
    });
  }

  // --- GESTIÓN DEL LOTE DE CALIBRACIÓN (CARRITO METROLÓGICO) ---
  function addToLot(instrumentId) {
    const inst = window.BANCADA_INSTRUMENTOS.find(i => i.id === instrumentId);
    if (!inst) return;

    if (state.quoteLot[instrumentId]) {
      state.quoteLot[instrumentId].quantity += 1;
    } else {
      state.quoteLot[instrumentId] = {
        instrument: inst,
        quantity: 1
      };
    }

    saveLotToStorage();
    updateLotUI();
    renderInstruments();
    showToastNotification(`Se agregó "${inst.nombre}" al lote.`);
  }

  function changeLotQuantity(instrumentId, delta) {
    if (!state.quoteLot[instrumentId]) return;

    state.quoteLot[instrumentId].quantity += delta;
    if (state.quoteLot[instrumentId].quantity <= 0) {
      delete state.quoteLot[instrumentId];
    }

    saveLotToStorage();
    updateLotUI();
    renderInstruments();
  }

  function removeFromLot(instrumentId) {
    if (state.quoteLot[instrumentId]) {
      delete state.quoteLot[instrumentId];
      saveLotToStorage();
      updateLotUI();
      renderInstruments();
    }
  }

  function clearLot() {
    state.quoteLot = {};
    saveLotToStorage();
    updateLotUI();
    renderInstruments();
  }

  function updateLotUI() {
    const entries = Object.values(state.quoteLot);
    const totalTypes = entries.length;
    const totalPieces = entries.reduce((acc, curr) => acc + curr.quantity, 0);

    // Badges en cabecera y botón flotante
    dom.lotCountBadges.forEach(badge => {
      badge.textContent = totalPieces;
      badge.style.display = totalPieces > 0 ? "inline-flex" : "none";
    });

    if (dom.lotFloatingBtn) {
      if (totalPieces > 0) {
        dom.lotFloatingBtn.classList.add("is-visible");
      } else {
        dom.lotFloatingBtn.classList.remove("is-visible");
      }
    }

    // Totales en el drawer
    if (dom.lotTotalPieces) dom.lotTotalPieces.textContent = totalPieces;
    if (dom.lotTotalTypes) dom.lotTotalTypes.textContent = totalTypes;

    // Renderizado del contenido del Drawer
    if (dom.lotItemsList) {
      if (totalTypes === 0) {
        dom.lotItemsList.innerHTML = `
          <div class="lot-empty-box">
            <div class="empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 15h6"/></svg>
            </div>
            <h4>Tu lote de calibración está vacío</h4>
            <p>Selecciona verniers, manómetros, micrómetros o cualquier instrumento del catálogo para armar tu cotización oficial inmediata.</p>
          </div>
        `;
        if (dom.lotWhatsappBtn) dom.lotWhatsappBtn.disabled = true;
      } else {
        if (dom.lotWhatsappBtn) dom.lotWhatsappBtn.disabled = false;
        dom.lotItemsList.innerHTML = entries.map(({ instrument, quantity }) => {
          return `
            <div class="lot-item-row" data-id="${instrument.id}">
              <div class="lot-item-info">
                <span class="lot-item-mag">${instrument.magnitud.toUpperCase()}</span>
                <h4 class="lot-item-title">${instrument.nombre}</h4>
                <span class="lot-item-rango">${instrument.rango}</span>
              </div>
              <div class="lot-item-controls">
                <div class="quantity-controller qty-sm">
                  <button class="qty-btn" data-action="drawer-decrease" data-id="${instrument.id}">-</button>
                  <span class="qty-display">${quantity}</span>
                  <button class="qty-btn" data-action="drawer-increase" data-id="${instrument.id}">+</button>
                </div>
                <button class="btn-remove-item" data-action="drawer-remove" data-id="${instrument.id}" title="Eliminar del lote">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            </div>
          `;
        }).join("");
      }
    }
  }

  // Almacenamiento local para no perder selección al recargar
  function saveLotToStorage() {
    try {
      localStorage.setItem("BANCADA_QUOTE_LOT", JSON.stringify(state.quoteLot));
    } catch (e) {
      console.warn("Storage error", e);
    }
  }

  function loadLotFromStorage() {
    try {
      const stored = localStorage.getItem("BANCADA_QUOTE_LOT");
      if (stored) {
        state.quoteLot = JSON.parse(stored);
      }
    } catch (e) {
      state.quoteLot = {};
    }
  }

  // Generador del mensaje oficial de WhatsApp
  function sendLotToWhatsApp() {
    const entries = Object.values(state.quoteLot);
    if (entries.length === 0) {
      alert("Agrega al menos un instrumento a tu lote para solicitar cotización.");
      return;
    }

    let serviceType = "En Planta (In Situ)";
    if (dom.serviceTypeRadios) {
      for (const radio of dom.serviceTypeRadios) {
        if (radio.checked) {
          serviceType = radio.value;
          break;
        }
      }
    }

    const notes = dom.notesInput ? dom.notesInput.value.trim() : "";
    const totalPzs = entries.reduce((acc, curr) => acc + curr.quantity, 0);

    let msg = `*SOLICITUD DE COTIZACIÓN - BANCADA METROLOGÍA INDUSTRIAL*\n`;
    msg += `--------------------------------------------------\n`;
    msg += `Hola equipo técnico de BANCADA, requiero cotización formal para el siguiente lote de calibración trazable (ISO/IEC 17025):\n\n`;
    msg += `*Modalidad Requerida:* ${serviceType}\n`;
    msg += `*Total de Instrumentos:* ${totalPzs} pieza(s) en ${entries.length} tipo(s)\n\n`;
    msg += `*DESGLOSE DEL LOTE:*\n`;

    entries.forEach(({ instrument, quantity }, idx) => {
      msg += `${idx + 1}. *[${quantity} pz]* ${instrument.nombre}\n`;
      msg += `   • Magnitud: ${instrument.magnitud.toUpperCase()}\n`;
      msg += `   • Alcance/Rango: ${instrument.rango}\n`;
      msg += `   • Norma: ${instrument.norma}\n\n`;
    });

    if (notes) {
      msg += `*Comentarios / Requerimientos Adicionales:*\n${notes}\n\n`;
    }

    msg += `Favor de enviar disponibilidad, tiempos de entrega de dictamen y propuesta formal. Muchas gracias.`;

    const encoded = encodeURIComponent(msg);
    const whatsappUrl = `https://wa.me/${WHATSAPP_PHONE}?text=${encoded}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  }

  // --- MODAL DE FICHA TÉCNICA ---
  function openDetailModal(instrumentId) {
    const inst = window.BANCADA_INSTRUMENTOS.find(i => i.id === instrumentId);
    if (!inst || !dom.detailModal || !dom.detailModalContent) return;

    const magObj = window.BANCADA_MAGNITUDES.find(m => m.id === inst.magnitud);

    dom.detailModalContent.innerHTML = `
      <div class="modal-spec-header">
        <div class="modal-badge-row">
          <span class="card-mag-badge" data-mag="${inst.magnitud}">
            ${magObj ? magObj.icon : ''}
            <span>${magObj ? magObj.nombre : inst.magnitud}</span>
          </span>
          <span class="badge-iso">Acreditación ISO/IEC 17025:2017</span>
        </div>
        <h2 class="modal-title">${inst.nombre}</h2>
        <p class="modal-subtitle">${inst.descripcion}</p>
      </div>

      <div class="modal-spec-table">
        <div class="spec-table-row">
          <span class="t-label">Magnitud Metrológica</span>
          <span class="t-value">${magObj ? magObj.nombre : inst.magnitud}</span>
        </div>
        <div class="spec-table-row">
          <span class="t-label">Rango / Alcance Calibrable</span>
          <span class="t-value spec-highlight">${inst.rango}</span>
        </div>
        <div class="spec-table-row">
          <span class="t-label">Tipo y Construcción</span>
          <span class="t-value">${inst.tipo}</span>
        </div>
        <div class="spec-table-row">
          <span class="t-label">Norma Técnica / Referencia</span>
          <span class="t-value">${inst.norma}</span>
        </div>
        <div class="spec-table-row">
          <span class="t-label">Tiempo Estándar de Entrega</span>
          <span class="t-value">${inst.tiempoEntrega}</span>
        </div>
        <div class="spec-table-row">
          <span class="t-label">Disponibilidad In Situ</span>
          <span class="t-value">${inst.servicioInSitu ? "Sí (Servicio en planta disponible)" : "En Laboratorio de Calibración"}</span>
        </div>
        <div class="spec-table-row">
          <span class="t-label">Entregables Oficiales</span>
          <span class="t-value">Certificado de Calibración oficial con cálculo de incertidumbre expandida (k=2, nivel de confianza 95.45%), etiqueta inviolable de identificación y trazabilidad al CENAM/NIST.</span>
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn btn-primary btn-modal-add" id="modal-add-btn" data-id="${inst.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
          <span>Agregar este instrumento a mi Lote</span>
        </button>
        <button class="btn btn-secondary" id="modal-close-action-btn">Cerrar</button>
      </div>
    `;

    dom.detailModal.classList.add("is-open");
    document.body.style.overflow = "hidden";

    document.getElementById("modal-add-btn")?.addEventListener("click", () => {
      addToLot(inst.id);
      closeDetailModal();
    });

    document.getElementById("modal-close-action-btn")?.addEventListener("click", closeDetailModal);
  }

  function closeDetailModal() {
    if (!dom.detailModal) return;
    dom.detailModal.classList.remove("is-open");
    document.body.style.overflow = "";
  }

  // Notificación Toast flotante
  function showToastNotification(text) {
    let toast = document.getElementById("bancada-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "bancada-toast";
      toast.className = "bancada-toast";
      document.body.appendChild(toast);
    }
    toast.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>
      <span>${text}</span>
    `;
    toast.classList.add("is-active");
    clearTimeout(window.toastTimer);
    window.toastTimer = setTimeout(() => {
      toast.classList.remove("is-active");
    }, 2600);
  }

  // --- LISTENERS DE EVENTOS ---
  function setupEventListeners() {
    // Búsqueda en vivo con debounce
    if (dom.searchInput) {
      let debounceTimeout;
      dom.searchInput.addEventListener("input", (e) => {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
          state.searchQuery = e.target.value;
          if (dom.searchClear) {
            dom.searchClear.style.display = state.searchQuery ? "flex" : "none";
          }
          renderInstruments();
        }, 150);
      });
    }

    if (dom.searchClear) {
      dom.searchClear.addEventListener("click", () => {
        if (dom.searchInput) dom.searchInput.value = "";
        state.searchQuery = "";
        dom.searchClear.style.display = "none";
        renderInstruments();
      });
    }

    // Navegación por tabs de magnitudes
    if (dom.magnitudesTabs) {
      dom.magnitudesTabs.addEventListener("click", (e) => {
        const btn = e.target.closest(".tab-btn");
        if (!btn) return;
        const mag = btn.getAttribute("data-mag");
        if (!mag) return;

        state.activeMagnitude = mag;
        syncTabButtons();
        renderInstruments();
      });
    }

    // Clics en las tarjetas de magnitud del Hero
    if (dom.magnitudesNav) {
      dom.magnitudesNav.addEventListener("click", (e) => {
        const card = e.target.closest(".mag-quick-card");
        if (!card) return;
        const mag = card.getAttribute("data-mag");
        if (!mag) return;

        state.activeMagnitude = mag;
        syncTabButtons();
        renderInstruments();

        const catalogSection = document.getElementById("catalogo");
        if (catalogSection) {
          catalogSection.scrollIntoView({ behavior: "smooth" });
        }
      });
    }

    // Clics delegados en el grid de instrumentos
    if (dom.instrumentsGrid) {
      dom.instrumentsGrid.addEventListener("click", (e) => {
        const target = e.target.closest("[data-action]");
        if (!target) return;

        const action = target.getAttribute("data-action");
        const id = target.getAttribute("data-id");

        if (action === "add") {
          addToLot(id);
        } else if (action === "increase") {
          changeLotQuantity(id, 1);
        } else if (action === "decrease") {
          changeLotQuantity(id, -1);
        } else if (action === "detail") {
          openDetailModal(id);
        }
      });
    }

    // Drawer de Lote de Cotización
    const openDrawer = () => {
      if (!dom.lotDrawer) return;
      dom.lotDrawer.classList.add("is-open");
      if (dom.lotOverlay) dom.lotOverlay.classList.add("is-open");
      document.body.style.overflow = "hidden";
    };

    const closeDrawer = () => {
      if (!dom.lotDrawer) return;
      dom.lotDrawer.classList.remove("is-open");
      if (dom.lotOverlay) dom.lotOverlay.classList.remove("is-open");
      document.body.style.overflow = "";
    };

    if (dom.lotFloatingBtn) dom.lotFloatingBtn.addEventListener("click", openDrawer);
    document.querySelectorAll(".open-lot-drawer-btn").forEach(b => b.addEventListener("click", openDrawer));
    if (dom.lotCloseBtn) dom.lotCloseBtn.addEventListener("click", closeDrawer);
    if (dom.lotOverlay) dom.lotOverlay.addEventListener("click", closeDrawer);

    // Controles dentro del Drawer
    if (dom.lotItemsList) {
      dom.lotItemsList.addEventListener("click", (e) => {
        const target = e.target.closest("[data-action]");
        if (!target) return;

        const action = target.getAttribute("data-action");
        const id = target.getAttribute("data-id");

        if (action === "drawer-increase") {
          changeLotQuantity(id, 1);
        } else if (action === "drawer-decrease") {
          changeLotQuantity(id, -1);
        } else if (action === "drawer-remove") {
          removeFromLot(id);
        }
      });
    }

    if (dom.lotClearBtn) {
      dom.lotClearBtn.addEventListener("click", () => {
        if (confirm("¿Deseas vaciar todos los instrumentos de tu lote de calibración?")) {
          clearLot();
        }
      });
    }

    if (dom.lotWhatsappBtn) {
      dom.lotWhatsappBtn.addEventListener("click", sendLotToWhatsApp);
    }

    // Modal de Detalle
    if (dom.detailModalClose) dom.detailModalClose.addEventListener("click", closeDetailModal);
    if (dom.detailModal) {
      dom.detailModal.addEventListener("click", (e) => {
        if (e.target === dom.detailModal) closeDetailModal();
      });
    }

    // Menú móvil
    if (dom.mobileMenuBtn && dom.mobileNav) {
      dom.mobileMenuBtn.addEventListener("click", () => {
        dom.mobileNav.classList.toggle("is-active");
        dom.mobileMenuBtn.classList.toggle("is-active");
      });

      dom.mobileNav.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", () => {
          dom.mobileNav.classList.remove("is-active");
          dom.mobileMenuBtn.classList.remove("is-active");
        });
      });
    }

    // Tecla ESC para cerrar modales y drawer
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeDetailModal();
        closeDrawer();
      }
    });
  }

  // --- ACORDEÓN DE PREGUNTAS FRECUENTES ---
  function setupFaqAccordion() {
    const faqItems = document.querySelectorAll(".faq-item");
    faqItems.forEach((item) => {
      const header = item.querySelector(".faq-question");
      if (!header) return;
      header.addEventListener("click", () => {
        const isOpen = item.classList.contains("is-open");
        faqItems.forEach(i => i.classList.remove("is-open"));
        if (!isOpen) {
          item.classList.add("is-open");
        }
      });
    });
  }

  // --- SMOOTH SCROLL ---
  function setupSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        const targetId = this.getAttribute('href');
        if (!targetId || targetId === "#") return;
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
          e.preventDefault();
          const offsetTop = targetElement.getBoundingClientRect().top + window.pageYOffset - 80;
          window.scrollTo({
            top: offsetTop,
            behavior: 'smooth'
          });
        }
      });
    });
  }

  // Iniciar cuando el DOM esté listo
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
/*
 * Nodriza — medición de campañas.
 *
 * Un solo archivo para todo el sitio. Para activar la medición, completar
 * los dos identificadores de abajo y publicar. Mientras estén vacíos, este
 * archivo no carga nada de terceros: solo recuerda de qué campaña vino la
 * visita, para que cada consulta llegue al portal con su origen.
 *
 *   META_PIXEL_ID  → Meta Business Suite › Administrador de eventos › Píxel (solo números)
 *   GA4_ID         → Google Analytics › Administrar › Flujos de datos (empieza con G-)
 *   GOOGLE_ADS_ID  → opcional, Google Ads › Conversiones (empieza con AW-)
 */
(function () {
  'use strict';

  var CONFIG = {
    META_PIXEL_ID: '',
    GA4_ID: '',
    GOOGLE_ADS_ID: '',
    GOOGLE_ADS_LEAD_LABEL: '' // etiqueta de la conversión "Lead" en Google Ads (AW-XXX/esta-parte)
  };

  var CLAVE_ORIGEN = 'nodriza_origen';
  var CLAVE_PERMISO = 'nodriza_medicion';
  var PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid', 'wbraid', 'gbraid'];

  function leer(almacen, clave) { try { return window[almacen].getItem(clave); } catch (e) { return null; } }
  function guardar(almacen, clave, valor) { try { window[almacen].setItem(clave, valor); } catch (e) { /* modo privado */ } }

  // ---------- 1. De dónde vino la visita (se guarda la primera de la sesión)
  (function registrarOrigen() {
    var q = new URLSearchParams(window.location.search);
    var nuevo = {};
    var hay = false;
    PARAMS.forEach(function (p) { var v = q.get(p); if (v) { nuevo[p] = v.slice(0, 200); hay = true; } });
    var previo = leer('sessionStorage', CLAVE_ORIGEN);
    if (hay || !previo) {
      nuevo.entrada = window.location.pathname;
      nuevo.referente = document.referrer ? document.referrer.split('?')[0].slice(0, 200) : null;
      nuevo.fecha = new Date().toISOString();
      if (hay || !previo) guardar('sessionStorage', CLAVE_ORIGEN, JSON.stringify(nuevo));
    }
  })();

  window.nodrizaOrigen = function () {
    try { return JSON.parse(leer('sessionStorage', CLAVE_ORIGEN)) || null; } catch (e) { return null; }
  };

  // ---------- 2. Etiquetas de medición (solo si hay identificadores y no se rechazó)
  var hayMedicion = Boolean(CONFIG.META_PIXEL_ID || CONFIG.GA4_ID || CONFIG.GOOGLE_ADS_ID);
  var activa = false;

  function cargarScript(src) {
    var s = document.createElement('script'); s.async = true; s.src = src;
    document.head.appendChild(s);
  }

  function activar() {
    if (activa || !hayMedicion) return;
    activa = true;
    if (CONFIG.META_PIXEL_ID) {
      /* código base del Píxel de Meta */
      !function (f, b, e, v, n, t, s) {
        if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
        if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
        t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
      }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
      window.fbq('init', CONFIG.META_PIXEL_ID);
      window.fbq('track', 'PageView');
    }
    var gid = CONFIG.GA4_ID || CONFIG.GOOGLE_ADS_ID;
    if (gid) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      if (CONFIG.GA4_ID) window.gtag('config', CONFIG.GA4_ID);
      if (CONFIG.GOOGLE_ADS_ID) window.gtag('config', CONFIG.GOOGLE_ADS_ID);
      cargarScript('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(gid));
    }
    eventoDePagina();
  }

  // ---------- 3. Eventos
  var MAPA_GA = { Lead: 'generate_lead', Contact: 'contact', ViewContent: 'view_item' };

  window.nodrizaEvento = function (nombre, datos) {
    if (!activa) return;
    datos = datos || {};
    var id = nombre + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    if (window.fbq) window.fbq('track', nombre, datos, { eventID: id });
    if (window.gtag) {
      window.gtag('event', MAPA_GA[nombre] || nombre, datos);
      if (nombre === 'Lead' && CONFIG.GOOGLE_ADS_ID && CONFIG.GOOGLE_ADS_LEAD_LABEL) {
        window.gtag('event', 'conversion', { send_to: CONFIG.GOOGLE_ADS_ID + '/' + CONFIG.GOOGLE_ADS_LEAD_LABEL });
      }
    }
  };

  function eventoDePagina() {
    var p = window.location.pathname.replace(/^\//, '').replace(/\.html$/, '');
    if (/^(modulo-|plan-[abc]$|metodo-raiz-viva$|metodo-punto)/.test(p)) {
      window.nodrizaEvento('ViewContent', { content_name: p });
    }
  }

  // Clics a WhatsApp, correo y teléfono = intención de contacto
  document.addEventListener('click', function (ev) {
    var a = ev.target.closest ? ev.target.closest('a[href]') : null;
    if (!a) return;
    var h = a.getAttribute('href') || '';
    var medio = /wa\.me|whatsapp/.test(h) ? 'whatsapp' : /^mailto:/.test(h) ? 'correo' : /^tel:/.test(h) ? 'telefono' : null;
    if (medio) window.nodrizaEvento('Contact', { method: medio });
  }, true);

  // ---------- 4. Aviso de medición (solo aparece si la medición está configurada)
  function aviso() {
    var permiso = leer('localStorage', CLAVE_PERMISO);
    if (permiso === 'no') return;
    activar();
    if (permiso === 'si') return;
    var d = document.createElement('div');
    d.setAttribute('role', 'region');
    d.setAttribute('aria-label', 'Aviso de medición');
    d.style.cssText = 'position:fixed;left:16px;right:16px;bottom:16px;z-index:9999;max-width:520px;margin:0 auto;' +
      'background:#FDFBF7;color:#2A2520;border:1px solid #D2C4A7;border-radius:18px;padding:16px 18px;' +
      'box-shadow:0 8px 28px rgba(46,78,66,.12);font:400 14px/1.65 Montserrat,Arial,sans-serif;' +
      'display:flex;flex-wrap:wrap;gap:12px;align-items:center';
    d.innerHTML = '<p style="flex:1 1 260px;margin:0">Usamos cookies para medir qué campañas nos traen consultas. Nada más.</p>' +
      '<div style="display:flex;gap:8px">' +
      '<button type="button" data-r="no" style="min-height:44px;padding:0 18px;border-radius:999px;border:1.5px solid #2E4E42;background:transparent;color:#2E4E42;font:600 13px Montserrat,Arial,sans-serif;cursor:pointer">No, gracias</button>' +
      '<button type="button" data-r="si" style="min-height:44px;padding:0 18px;border-radius:999px;border:0;background:#2E4E42;color:#F7F1E6;font:600 13px Montserrat,Arial,sans-serif;cursor:pointer">Aceptar</button></div>';
    d.addEventListener('click', function (e) {
      var r = e.target.getAttribute && e.target.getAttribute('data-r');
      if (!r) return;
      guardar('localStorage', CLAVE_PERMISO, r);
      d.remove();
      if (r === 'no') window.location.reload();
    });
    document.body.appendChild(d);
  }

  if (hayMedicion) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', aviso);
    else aviso();
  }
})();

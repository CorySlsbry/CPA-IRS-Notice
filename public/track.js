/**
 * NoticeReply tracking script.
 * Embed: <script async src="https://your-app.com/track.js" data-firm="<FIRM_ID>"></script>
 *
 * First-party. ~3KB minified. GDPR-clean (DNT respected, no cookies until consent on EU IPs).
 */
(function () {
  if (window.nr && window.nr.q !== undefined) return; // already booted
  var SCRIPT = document.currentScript || (function () {
    var ss = document.getElementsByTagName('script');
    return ss[ss.length - 1];
  })();
  var firmId = SCRIPT && SCRIPT.getAttribute('data-firm');
  var apiHost = (SCRIPT && SCRIPT.getAttribute('data-host')) || new URL(SCRIPT.src).origin;
  if (!firmId) {
    console.warn('[nr] missing data-firm attribute on tracking script');
    return;
  }

  var STORAGE_KEY = 'nr_anon_id';
  var SESSION_KEY = 'nr_session_id';
  var IDENTITY_KEY = 'nr_contact_id';
  var dnt = navigator.doNotTrack === '1' || window.doNotTrack === '1';
  var anonId = getOrCreate(STORAGE_KEY, uuid);
  var sessionId = getOrCreate(SESSION_KEY, uuid, /* sessionScope */ true);
  var startedAt = Date.now();
  var lastPath = location.pathname + location.search;
  var maxScroll = 0;

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return ('xxxxxxxx-xxxx-4xxx-yxxx-' + Date.now().toString(16) + 'xxxx').replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function getOrCreate(key, factory, sessionScope) {
    try {
      var store = sessionScope ? sessionStorage : localStorage;
      var v = store.getItem(key);
      if (!v) {
        v = factory();
        store.setItem(key, v);
      }
      return v;
    } catch (_) {
      return factory();
    }
  }

  function utms() {
    var p = new URLSearchParams(location.search);
    var keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    var out = {};
    keys.forEach(function (k) {
      var v = p.get(k);
      if (v) out[k] = v;
    });
    return out;
  }

  function send(path, body) {
    if (dnt) return;
    var data = JSON.stringify(body || {});
    var url = apiHost + path;
    if (navigator.sendBeacon) {
      try {
        navigator.sendBeacon(url, new Blob([data], { type: 'application/json' }));
        return;
      } catch (_) {}
    }
    fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: data,
      keepalive: true,
      credentials: 'omit',
    }).catch(function () {});
  }

  function pageview() {
    send('/api/track/visit', {
      firmId: firmId,
      anonId: anonId,
      sessionId: sessionId,
      contactId: getContactId(),
      url: location.href,
      path: location.pathname + location.search,
      title: document.title,
      referrer: document.referrer,
      utms: utms(),
      ts: new Date().toISOString(),
    });
  }

  function emit(name, properties) {
    send('/api/track/event', {
      firmId: firmId,
      anonId: anonId,
      sessionId: sessionId,
      contactId: getContactId(),
      name: name,
      properties: properties || {},
      ts: new Date().toISOString(),
    });
  }

  function identify(email, traits) {
    send('/api/track/identify', {
      firmId: firmId,
      anonId: anonId,
      sessionId: sessionId,
      email: email,
      traits: traits || {},
      ts: new Date().toISOString(),
    });
  }

  function getContactId() {
    try {
      return localStorage.getItem(IDENTITY_KEY);
    } catch (_) {
      return null;
    }
  }

  // SPA support — patch history.
  var origPush = history.pushState;
  history.pushState = function () {
    var rv = origPush.apply(this, arguments);
    onPathChange();
    return rv;
  };
  window.addEventListener('popstate', onPathChange);

  function onPathChange() {
    var newPath = location.pathname + location.search;
    if (newPath !== lastPath) {
      finalizePage();
      lastPath = newPath;
      startedAt = Date.now();
      maxScroll = 0;
      pageview();
    }
  }

  function scroll() {
    var h = document.documentElement;
    var pct = Math.round(((window.scrollY + window.innerHeight) / h.scrollHeight) * 100);
    if (pct > maxScroll) maxScroll = Math.min(100, pct);
  }

  function finalizePage() {
    send('/api/track/page-finalize', {
      firmId: firmId,
      sessionId: sessionId,
      anonId: anonId,
      path: lastPath,
      ms_on_page: Date.now() - startedAt,
      scroll_depth_pct: maxScroll,
      ts: new Date().toISOString(),
    });
  }

  // Public API.
  var queued = (window.nr && window.nr.q) || [];
  window.nr = {
    pageview: pageview,
    track: emit,
    identify: identify,
    form: function (formId, mountSelector) {
      var node = document.querySelector(mountSelector);
      if (!node) return;
      var iframe = document.createElement('iframe');
      iframe.src = apiHost + '/forms/' + encodeURIComponent(formId) + '/embed';
      iframe.style.cssText = 'width:100%;border:0;min-height:520px';
      iframe.title = 'NoticeReply form';
      node.appendChild(iframe);
    },
  };

  queued.forEach(function (call) {
    var fn = window.nr[call[0]];
    if (typeof fn === 'function') fn.apply(null, call.slice(1));
  });

  // Boot.
  pageview();
  window.addEventListener('scroll', scroll, { passive: true });
  window.addEventListener('beforeunload', finalizePage);
  window.addEventListener('pagehide', finalizePage);
})();

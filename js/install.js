/* 앱 설치 버튼 + 버튼을 못 띄울 때의 안내
 *
 * 안드로이드 크롬의 ⋮ → "앱 설치" 메뉴는 '이 주소(origin)에 깔린 앱이 하나라도
 * 있으면' 이미 설치됐다고 판단한다(WebappRegistry.isAppInstalledForUrl →
 * hasAtLeastOneWebApkForOrigin). 이 저장소는 짐메이트·스캔메이트가 같은 주소
 * (gititit11.github.io)에 있어서, 하나를 깔면 다른 하나는 메뉴로 설치할 수 없고
 * "열기" 를 누르면 '앱을 열 수 없음' 이 뜬다.
 *
 * 페이지가 직접 띄우는 설치(beforeinstallprompt → prompt())는 앱의 범위(scope)
 * 기준으로 판단하므로(WebappsUtils::IsWebApkInstalled) 이 문제가 없다.
 * 그래서 설치할 수 있을 때 화면 위에 "앱 설치" 버튼을 띄운다.
 *
 * beforeinstallprompt 가 오지 않는 곳에서는 버튼을 띄울 수 없으므로 대신 안내를 띄운다.
 *  - 카톡·인스타 등 앱 안의 브라우저: 크롬(아이폰은 사파리)으로 열어 달라고 한다
 *  - 아이폰: 공유 → 홈 화면에 추가
 *  - 안드로이드에서 잠시 기다려도 신호가 없을 때: 브라우저 메뉴로 설치하는 법
 * 안내는 들어올 때마다 띄운다(✕ 는 이번에만 닫는다). 진짜 설치 신호가 오면 안내 대신 버튼을 띄운다.
 *
 * gymmate/js/install.js 와 scanner/js/install.js 는 같은 파일이다. 고치면 둘 다 고친다.
 */
(function () {
  'use strict';
  var HINT_WAIT_MS = 8000;              // 안드로이드에서 설치 신호를 기다리는 시간

  var ua = navigator.userAgent || '';
  var isIOS = /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/i.test(ua);
  var isKakao = /KAKAOTALK/i.test(ua);
  var inApp = isKakao ||
    /Instagram|FBAN|FBAV|FB_IAB|Line\/|NAVER\(inapp|DaumApps|everytimeApp|; wv\)/i.test(ua);
  var isSamsung = /SamsungBrowser/i.test(ua);

  var deferred = null, bar = null, hintTimer = null;

  function standalone() {
    try {
      if (window.matchMedia && matchMedia('(display-mode: standalone)').matches) return true;
    } catch (e) { }
    return navigator.standalone === true;
  }

  function hide() { if (bar) { bar.remove(); bar = null; } }

  function whenReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  // opts: { text, sub, action, onAction, hint }
  function render(opts) {
    hide();
    if (!document.body) return;
    bar = document.createElement('div');
    bar.setAttribute('role', 'dialog');
    bar.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);' +
      'top:calc(10px + env(safe-area-inset-top, 0px));z-index:2147483000;display:flex;' +
      'align-items:center;gap:6px;padding:6px 6px 6px 14px;' +
      'background:#eef1f6;color:#0f1115;box-shadow:0 6px 20px rgba(0,0,0,.45);' +
      'font:600 14px/1.35 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;' +
      'box-sizing:border-box;max-width:calc(100% - 24px);' +
      (opts.hint
        ? 'border-radius:16px;width:420px;padding-top:10px;padding-bottom:10px'
        : 'border-radius:999px;white-space:nowrap');

    var body = document.createElement('div');
    body.style.cssText = 'flex:1;min-width:0';
    var label = document.createElement('div');
    label.textContent = opts.text;
    body.appendChild(label);
    if (opts.sub) {
      var sub = document.createElement('div');
      sub.textContent = opts.sub;
      sub.style.cssText = 'margin-top:4px;font-weight:400;font-size:12.5px;color:#5b6577';
      body.appendChild(sub);
    }
    bar.appendChild(body);

    if (opts.action) {
      var go = document.createElement('button');
      go.type = 'button'; go.textContent = opts.action;
      go.style.cssText = 'flex:none;border:0;border-radius:999px;padding:8px 14px;background:#4d7cff;' +
        'color:#fff;font:inherit;cursor:pointer;white-space:nowrap';
      go.addEventListener('click', opts.onAction);
      bar.appendChild(go);
    }

    var x = document.createElement('button');
    x.type = 'button'; x.textContent = '✕'; x.setAttribute('aria-label', '닫기');
    x.style.cssText = 'flex:none;align-self:flex-start;border:0;background:transparent;' +
      'color:#5b6577;font:inherit;padding:8px 8px;cursor:pointer';
    x.addEventListener('click', hide);
    bar.appendChild(x);

    document.body.appendChild(bar);
  }

  /* ── 진짜 설치 버튼 ───────────────────────────── */

  function showInstall() {
    render({
      text: '홈 화면에 앱으로 설치할 수 있어요',
      action: '앱 설치',
      onAction: function () {
        if (!deferred) return hide();
        var ev = deferred; deferred = null;
        ev.prompt();
        ev.userChoice.then(hide, hide);
      }
    });
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); // 크롬 기본 안내 대신 이 버튼을 쓴다
    deferred = e;
    if (hintTimer) { clearTimeout(hintTimer); hintTimer = null; }
    whenReady(showInstall); // 안내가 떠 있었다면 버튼으로 바꾼다
  });
  window.addEventListener('appinstalled', function () {
    deferred = null;
    if (hintTimer) { clearTimeout(hintTimer); hintTimer = null; }
    hide();
  });

  /* ── 버튼을 못 띄울 때의 안내 ─────────────────── */

  function openInExternal() {
    var url = location.href;
    if (isKakao) {
      location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(url);
    } else if (isAndroid) {
      location.href = 'intent://' + location.host + location.pathname + location.search +
        location.hash + '#Intent;scheme=https;package=com.android.chrome;' +
        'S.browser_fallback_url=' + encodeURIComponent(url) + ';end';
    }
  }

  function hint(opts) {
    if (deferred) return;
    opts.hint = true;
    render(opts);
  }

  function inAppHint() {
    var browser = isIOS ? '사파리' : '크롬';
    var canJump = isKakao || isAndroid;
    hint({
      text: '이 화면에서는 앱을 설치할 수 없어요. ' + browser + '으로 열어 주세요.',
      sub: canJump ? null : '오른쪽 위나 아래의 메뉴에서 \'다른 브라우저로 열기\' 를 누르면 돼요.',
      action: canJump ? browser + '으로 열기' : null,
      onAction: openInExternal
    });
  }

  function iosHint() {
    hint({
      text: '공유 버튼 → \'홈 화면에 추가\' 를 누르면 앱처럼 쓸 수 있어요.',
      sub: '공유 버튼(□↑)은 화면 아래나 주소창 옆에 있어요.'
    });
  }

  function androidHint() {
    if (deferred) return;
    if (isSamsung) {
      hint({
        text: '메뉴(≡) → \'현재 페이지 추가\' → \'홈 화면\' 으로 설치할 수 있어요.'
      });
      return;
    }
    hint({
      text: '크롬 ⋮ 메뉴 → \'앱 설치\' 또는 \'홈 화면에 추가\' 로 설치할 수 있어요.',
      sub: '메뉴에 \'열기\' 만 보이면 같은 주소의 다른 앱 때문이에요. ' +
        '시크릿 탭이 아닌지 확인하고, 화면을 몇 번 누른 뒤 새로고침하면 \'앱 설치\' 버튼이 뜰 수 있어요.'
    });
  }

  if (standalone()) return;            // 이미 앱으로 실행 중
  if (!isIOS && !isAndroid) return;    // 컴퓨터에서는 안내하지 않는다

  whenReady(function () {
    if (inApp) inAppHint();
    else if (isIOS) setTimeout(iosHint, 1500);
    else hintTimer = setTimeout(function () { hintTimer = null; androidHint(); }, HINT_WAIT_MS);
  });
})();

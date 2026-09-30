// Wanderlust – optimised entry script (loaded with `defer`, no blocking).
(function () {
  'use strict';

  // 1) Parallax: transform only (compositor-friendly), throttled with requestAnimationFrame,
  //    passive listener, and only touches the hero (not hundreds of nodes).
  var heroImg = document.querySelector('.hero img');
  var ticking = false;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (heroImg && !reduce) {
    window.addEventListener('scroll', function () {
      if (ticking) { return; }
      ticking = true;
      requestAnimationFrame(function () {
        heroImg.style.transform = 'translate3d(0,' + (window.scrollY * 0.2) + 'px,0)';
        ticking = false;
      });
    }, { passive: true });
  }

  // 2) Code splitting: fetch the reviews module only when its section is close to the viewport.
  var target = document.getElementById('reviews');
  function loadReviews() {
    import('./%REVIEWS%').then(function (m) { m.init(); })
      .catch(function () {
        var list = document.getElementById('review-list');
        if (list) { list.textContent = 'Reviews could not be loaded. Please refresh to try again.'; }
      });
  }
  if (target && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { io.disconnect(); loadReviews(); }
    }, { rootMargin: '400px' });
    io.observe(target);
  } else {
    loadReviews(); // fallback for old browsers
  }
})();

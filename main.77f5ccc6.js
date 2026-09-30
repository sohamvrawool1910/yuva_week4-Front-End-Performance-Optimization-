(function () {
'use strict';
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
var target = document.getElementById('reviews');
function loadReviews() {
import('./reviews.0774713d.js').then(function (m) { m.init(); })
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
loadReviews();
}
})();
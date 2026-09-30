var NAMES = ['Ava', 'Ben', 'Chloe', 'Dev', 'Elena', 'Farid', 'Grace', 'Hiro', 'Isla', 'Jon', 'Kara', 'Leo'];
var QUOTES = ['Unforgettable views and friendly locals.', 'Perfect for a slow, relaxed week.', 'Great food, better company.', 'Worth every hour of the journey.', 'Best trip we have taken as a family.', 'Quiet, beautiful and easy to reach.'];
var TOTAL = 1200;
var PAGE = 12;
var shown = 0;
function renderBatch(list) {
var frag = document.createDocumentFragment();
var end = Math.min(shown + PAGE, TOTAL);
for (var i = shown; i < end; i++) {
var n = NAMES[i % NAMES.length];
var div = document.createElement('div');
div.className = 'review';
div.innerHTML = '<div class="avatar" aria-hidden="true">' + n.charAt(0) + '</div><div><strong>' + n + ' #' + (i + 1) + '</strong><p>' + QUOTES[i % QUOTES.length] + '</p></div>';
frag.appendChild(div);
}
list.appendChild(frag);
shown = end;
}
export function init() {
var list = document.getElementById('review-list');
var btn = document.getElementById('more-reviews');
var status = document.getElementById('review-status');
renderBatch(list);
btn.hidden = false;
btn.addEventListener('click', function () {
renderBatch(list);
status.textContent = 'Showing ' + shown + ' of ' + TOTAL + ' reviews';
if (shown >= TOTAL) { btn.hidden = true; }
});
}
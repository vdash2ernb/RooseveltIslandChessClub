// Page behaviour outside the story: navigation, schedule, entrances, and the puzzle loader.

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// ------------------------------------------------------------ menu (phones and tablets)
const nav = $('#site-nav');
const menuBtn = $('.menu-btn');
function setMenu(open) {
  nav.classList.toggle('open', open);
  menuBtn.setAttribute('aria-expanded', String(open));
}
menuBtn.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
nav.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && nav.classList.contains('open')) { setMenu(false); menuBtn.focus(); }
});
document.addEventListener('click', (e) => {
  if (nav.classList.contains('open') && !e.target.closest('.topbar')) setMenu(false);
});

// ------------------------------------------------------------ top bar turns solid after the story
const topbar = $('.topbar');
const story = $('#story');
function onScroll() {
  const past = story.getBoundingClientRect().bottom < 80;
  topbar.classList.toggle('solid', past);
}
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// Highlight the section in view.
const links = $$('.nav a');
const sections = links.map((a) => $(a.getAttribute('href'))).filter(Boolean);
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      links.forEach((a) => a.toggleAttribute('aria-current', a.getAttribute('href') === `#${e.target.id}`));
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach((s) => io.observe(s));
}

// ------------------------------------------------------------ schedule: open on today
const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const tabs = $$('.days [role="tab"]');
function selectDay(day, focus = false) {
  tabs.forEach((t) => {
    const on = t.dataset.day === day;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    if (on && focus) t.focus();
  });
  $$('.week .day').forEach((d) => d.classList.toggle('active', d.id === `day-${day}`));
}
const today = days[new Date().getDay()];
$(`#day-${today}`)?.classList.add('today');
selectDay(today);
tabs.forEach((t, i) => {
  t.addEventListener('click', () => selectDay(t.dataset.day));
  t.addEventListener('keydown', (e) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    selectDay(tabs[(i + step + tabs.length) % tabs.length].dataset.day, true);
  });
});

// ------------------------------------------------------------ entrances
const reveals = $$('.reveal');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  reveals.forEach((el) => io.observe(el));
} else {
  reveals.forEach((el) => el.classList.add('in'));
}
// Safety net: never leave content hidden if an observer never fires.
window.addEventListener('load', () => setTimeout(() => {
  reveals.forEach((el) => { if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add('in'); });
}, 1500));

// ------------------------------------------------------------ the puzzle loads when it comes near
const puzzle = $('#puzzle');
if (puzzle && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    import('./puzzle.js').then((m) => m.startPuzzle(puzzle)).catch((err) => {
      console.error(err);
      $('.puzzle-loading', puzzle).textContent = 'The 3D board could not load here.';
    });
  }, { rootMargin: '600px 0px' });
  io.observe(puzzle);
}

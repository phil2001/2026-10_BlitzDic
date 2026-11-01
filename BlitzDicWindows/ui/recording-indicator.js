const bars = [...document.querySelectorAll('.wave i')];
const elapsed = document.getElementById('elapsed');
let timer;
window.indicator.onActive(startedAt => {
  clearInterval(timer);
  bars.forEach(bar => {bar.style.height = '5px';});
  if (startedAt === null) return;
  const update = () => {
    const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    elapsed.textContent = `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  };
  update(); timer = setInterval(update, 1000);
});
window.indicator.onLevel(level => {
  const amplitude = Math.min(1, level * 5);
  bars.forEach((bar, index) => {bar.style.height = `${5 + amplitude * [12, 20, 25, 17, 10][index]}px`;});
});
document.getElementById('stop').onclick = () => window.indicator.stop();
document.getElementById('hide').onclick = () => window.indicator.hide();
document.addEventListener('contextmenu', event => {event.preventDefault(); window.indicator.hide();});

Reveal.initialize({
  width: 1920, height: 1080, margin: 0.02, minScale: 0.05, maxScale: 2,
  center: false, hash: true, controls: true, progress: true, slideNumber: false,
  transition: 'fade', backgroundTransition: 'fade', touch: true, keyboard: true,
  pdfSeparateFragments: false
});
document.getElementById('btn-tela').addEventListener('click', function () {
  var el = document.documentElement;
  if (el.requestFullscreen) el.requestFullscreen(); else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
});

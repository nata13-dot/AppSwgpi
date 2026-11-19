/*
 * Estilo cristal (data-glass="on"): igual que en la web (Frontend_Swgpi/includes/footer.php).
 * - Cualquier superficie que siga opaca dentro del contenido se vuelve translúcida (clase glass-auto), incluidas las que
 *   llegan después con datos; los bloques de color pasan a cristal azul (glass-auto-tinted).
 * - Los textos sueltos que quedan directo sobre la foto llevan una placa de cristal (glass-text).
 * Sin cristal no hace nada y quita las marcas.
 */
const SKIP = /^(BUTTON|INPUT|SELECT|TEXTAREA|TH|TD|TR|THEAD|TBODY|TABLE|SPAN|I|IMG|SVG|CODE|LABEL|PROGRESS|PATH)$/
const OUTSIDE = '.sheet, .sheet-backdrop, .topbar-app, .bottom-nav, .sidebar-app, .Toastify, .swal2-container, .badge-app, .btn-app, .chips-app, .tabs-app, .icon-btn, .progress-app, .switch-app, .help-fab'
const ROOT = '.content-app, .auth-page, .public-page'

const alphaOf = (color) => {
  const match = String(color).match(/rgba?\(([^)]+)\)/)
  if (!match) return 0
  const parts = match[1].split(/[ ,/]+/).filter(Boolean).map(Number)
  return parts.length > 3 ? parts[3] : 1
}

function scan() {
  if (document.documentElement.dataset.glass !== 'on') return
  document.querySelectorAll(`:is(${ROOT}) *:not(.glass-auto)`).forEach((el) => {
    if (SKIP.test(el.tagName) || el.closest(OUTSIDE)) return
    const box = el.getBoundingClientRect()
    if (box.width < 90 || box.height < 36) return
    const cs = getComputedStyle(el)
    const gradient = cs.backgroundImage.startsWith('linear-gradient')
    if (cs.backgroundImage !== 'none' && !gradient) return
    const color = gradient ? (cs.backgroundImage.match(/rgba?\([^)]+\)/) || [''])[0] : cs.backgroundColor
    if (alphaOf(color) < 0.85) return
    if (parseFloat(cs.borderTopLeftRadius) < 6 && cs.boxShadow === 'none' && cs.borderTopWidth === '0px') return
    el.classList.add('glass-auto')
    if (gradient) el.classList.add('glass-auto-tinted')
  })
  document.querySelectorAll(`:is(${ROOT}) :is(h1, h2, h3, h4, h5, h6, p, small, strong, .field-label, .sg-related-title, .muted, .pc-muted):not(.glass-text)`).forEach((el) => {
    if (el.closest(OUTSIDE) || !el.textContent.trim()) return
    if (el.querySelector('div, ul, ol, table, section, img, canvas, svg, input, select, textarea, button, .skeleton')) return
    if (el.getBoundingClientRect().height > 90) return
    const root = el.closest(ROOT)
    for (let node = el.parentElement; node && node !== root; node = node.parentElement) {
      const cs = getComputedStyle(node)
      if (alphaOf(cs.backgroundColor) > 0.2 || cs.backdropFilter !== 'none' || node.classList.contains('glass-auto')) return
    }
    el.classList.add('glass-text')
  })
}

let frame = 0
const queue = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; scan() }) }

export function initGlassSurfaces() {
  queue()
  new MutationObserver(queue).observe(document.body, { childList: true, subtree: true })
  window.addEventListener('sgpi:appearance', () => {
    if (document.documentElement.dataset.glass !== 'on') {
      document.querySelectorAll('.glass-auto, .glass-text').forEach((el) => el.classList.remove('glass-auto', 'glass-auto-tinted', 'glass-text'))
    }
    queue()
  })
}

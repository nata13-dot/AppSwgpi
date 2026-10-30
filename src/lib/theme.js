/** Tema claro/oscuro: preferencia propia o, si no hay, el tema por omisión de los ajustes públicos. */
export function resolveTheme(defaultTheme = 'light') {
  let theme = localStorage.getItem('sgpi-theme') || defaultTheme || 'light'
  if (theme === 'system') theme = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  return theme
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#111827' : '#1B396A')
}

export function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
  localStorage.setItem('sgpi-theme', next)
  applyTheme(next)
  return next
}

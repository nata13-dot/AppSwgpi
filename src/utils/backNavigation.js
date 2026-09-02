const handlers = []

export function registerBackHandler(handler) {
  const entry = { id: Symbol('back-handler'), handler }
  handlers.push(entry)

  return () => {
    const index = handlers.findIndex((item) => item.id === entry.id)
    if (index >= 0) handlers.splice(index, 1)
  }
}

export function handleRegisteredBack() {
  const entry = handlers.at(-1)
  if (!entry) return false
  entry.handler()
  return true
}

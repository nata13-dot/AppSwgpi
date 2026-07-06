import api, { apiError } from '../services/api'

const filenameFromDisposition = (header) => {
  if (!header) return ''
  const utf8 = header.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8?.[1]) return decodeURIComponent(utf8[1].replace(/["']/g, ''))
  const plain = header.match(/filename="?([^";]+)"?/i)
  return plain?.[1] || ''
}

const extensionFromType = (type) => ({
  'application/pdf': '.pdf',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'text/csv': '.csv',
})[String(type || '').split(';')[0].toLowerCase()] || ''

const ensureExtension = (filename, contentType) => {
  const safeName = String(filename || 'descarga').trim().replace(/[\\/:*?"<>|]+/g, '_')
  if (/\.[a-z0-9]{2,5}$/i.test(safeName)) return safeName
  return `${safeName}${extensionFromType(contentType)}`
}

const blobError = async (response) => {
  const type = String(response.headers?.['content-type'] || response.data?.type || '')
  if (!type.includes('application/json')) return null
  try {
    const payload = JSON.parse(await response.data.text())
    return payload.error || payload.message || Object.values(payload.errors || {}).flat().join(' ')
  } catch {
    return 'El servidor no devolvió un archivo válido.'
  }
}

export async function downloadApiFile(endpoint, fallbackName, config = {}) {
  try {
    const response = await api.get(endpoint, { ...config, responseType: 'blob' })
    const serverError = await blobError(response)
    if (serverError) throw new Error(serverError)

    const contentType = response.headers?.['content-type'] || response.data?.type
    const headerName = filenameFromDisposition(response.headers?.['content-disposition'])
    const filename = ensureExtension(headerName || fallbackName, contentType)
    const url = URL.createObjectURL(response.data)
    const link = window.document.createElement('a')
    link.href = url
    link.download = filename
    link.style.display = 'none'
    window.document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    return filename
  } catch (error) {
    if (error.response?.data instanceof Blob) {
      const type = String(error.response.headers?.['content-type'] || error.response.data.type || '')
      if (type.includes('application/json')) {
        try {
          const payload = JSON.parse(await error.response.data.text())
          throw new Error(payload.error || payload.message || Object.values(payload.errors || {}).flat().join(' '))
        } catch (blobParseError) {
          if (blobParseError?.message && blobParseError.message !== 'Unexpected end of JSON input') throw blobParseError
        }
      }
    }
    if (error instanceof Error && !error.response) throw error
    throw new Error(apiError(error))
  }
}

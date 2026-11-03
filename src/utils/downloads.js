import { Capacitor, registerPlugin } from '@capacitor/core'
import { toast } from 'react-toastify'
import api, { apiError } from '../services/api'

// Plugin nativo de la app Android (android/.../FileSaverPlugin.java): el WebView no descarga enlaces blob:.
const FileSaver = registerPlugin('FileSaver')

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
  'application/zip': '.zip',
  'application/gzip': '.gz',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
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

const sleep = (ms) => new Promise((resolve) => { window.setTimeout(resolve, ms) })

/** Informes que se generan en segundo plano: los pide, espera a que estén listos y los descarga. */
export async function downloadBackgroundReport(startEndpoint, fallbackName) {
  try {
    const { data } = await api.get(startEndpoint, { timeout: 60_000 })
    const deadline = Date.now() + 6 * 60_000
    while (Date.now() < deadline) {
      await sleep(2500)
      // Un corte momentáneo de red no cancela el informe: se sigue consultando hasta el límite.
      const check = await api.get(`/evaluations/report-jobs/${data.job}`).catch((error) => {
        if (error.response) throw error
        return null
      })
      if (check?.data.status === 'failed') throw new Error('No se pudo generar el informe. Intenta de nuevo; si se repite, avisa a sistemas.')
      if (check?.data.status === 'ready') return await downloadApiFile(`/evaluations/report-jobs/${data.job}/download`, check.data.filename || fallbackName, { timeout: 120_000 })
    }
    throw new Error('El informe está tardando demasiado. Intenta de nuevo en unos minutos.')
  } catch (error) {
    if (error instanceof Error && !error.response) throw error
    throw new Error(apiError(error))
  }
}

const blobToBase64 = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
  reader.onerror = () => reject(new Error('No se pudo leer el archivo descargado.'))
  reader.readAsDataURL(blob)
})

/** Guarda el archivo: en el navegador con un enlace temporal; en la app Android, en Descargas/SGPI. */
export async function saveBlob(blob, filename, contentType = blob.type) {
  if (Capacitor.isNativePlatform()) {
    const result = await FileSaver.save({ name: filename, mimeType: String(contentType || 'application/octet-stream').split(';')[0], data: await blobToBase64(blob) })
    if (!result.opened) toast.info(`Archivo guardado en ${result.location}.`)
    return
  }
  const url = URL.createObjectURL(blob)
  const link = window.document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  window.document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 10000)
}

export async function downloadApiFile(endpoint, fallbackName, config = {}) {
  try {
    const response = await api.get(endpoint, { ...config, responseType: 'blob' })
    const serverError = await blobError(response)
    if (serverError) throw new Error(serverError)

    const contentType = response.headers?.['content-type'] || response.data?.type
    const headerName = filenameFromDisposition(response.headers?.['content-disposition'])
    const filename = ensureExtension(headerName || fallbackName, contentType)
    await saveBlob(response.data, filename, contentType)
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

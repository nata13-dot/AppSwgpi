import { useState } from 'react'
import { FiUploadCloud } from 'react-icons/fi'
import api, { apiError } from '../../services/api'
import { Button, FileDrop, Sheet } from '../../components/ui'

/** Carga de proyectos desde la plantilla Excel (projectsImportModal de projects.php). */
export default function ProjectsImport({ onClose, onImported }) {
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const [importing, setImporting] = useState(false)
  const submit = async () => {
    const body = new FormData()
    body.append('archivo', file)
    setImporting(true)
    try {
      const { data } = await api.post('/projects/import-excel', body, { timeout: 120_000 })
      setResult({ ok: true, ...data })
      onImported()
    } catch (error) {
      const errors = error.response?.data?.errors
      setResult({ ok: false, message: apiError(error), messages: Array.isArray(errors) ? errors.flatMap((item) => item.errores || item) : Object.values(errors || {}).flat() })
    } finally {
      setImporting(false)
    }
  }
  const rowErrors = result?.ok ? result.errors || [] : []
  return (
    <Sheet open title="Cargar proyectos desde Excel" onClose={onClose} size="md"
      footer={<><Button variant="ghost" onClick={onClose}>Cerrar</Button><Button variant="success" icon={FiUploadCloud} disabled={!file} loading={importing} onClick={submit}>Importar</Button></>}>
      <div className="stack">
        <FileDrop accept=".xls,.xlsx,.csv" file={file} onFile={(selected) => { setFile(selected); setResult(null) }} hint="Plantilla .xls, .xlsx o .csv" />
        <p className="muted small-text">En <strong>matriculas_estudiantes</strong> separa una o más matrículas con coma (ejemplo: e000001, 0222222). La carga se toma del semestre y grupo de esos estudiantes.</p>
        {result && (
          <div className={`alert-app ${result.ok ? (rowErrors.length ? 'warning' : 'success') : 'danger'}`}>
            {result.ok ? <>Registros creados: <strong>{Number(result.created || 0)}</strong>. Errores: <strong>{rowErrors.length}</strong>.</> : result.message}
            <ul className="error-list">
              {rowErrors.slice(0, 10).map((item, index) => <li key={index}><strong>Fila {item.fila}:</strong> {(item.errores || []).join(' | ')}</li>)}
              {(result.messages || []).slice(0, 12).map((message, index) => <li key={`m${index}`}>{String(message)}</li>)}
            </ul>
          </div>
        )}
      </div>
    </Sheet>
  )
}

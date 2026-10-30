import { useState } from 'react'
import { FiDownload, FiUploadCloud } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../../services/api'
import { useSemesters } from '../../lib/semesters'
import { downloadApiFile } from '../../utils/downloads'
import { Button, Chips, FileDrop, Sheet } from '../../components/ui'

/** Carga de usuarios desde Excel con la plantilla mínima (alumnos o personal), como en users.php. */
export default function UsersImport({ onClose, onImported }) {
  const [kind, setKind] = useState('alumnos')
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const [importing, setImporting] = useState(false)
  const { policy } = useSemesters('period')

  const template = async () => {
    try { await downloadApiFile(`/users-template.xls?tipo=${kind}`, kind === 'personal' ? 'plantilla_personal.xls' : 'plantilla_alumnos.xls') } catch (error) { toast.error(error.message) }
  }
  const submit = async () => {
    if (!file) return
    const body = new FormData()
    body.append('archivo', file)
    body.append('tipo', kind)
    setImporting(true)
    setResult(null)
    try {
      const { data } = await api.post('/users/import-excel', body, { timeout: 120_000 })
      setResult({ ok: true, ...data })
      onImported()
    } catch (error) {
      const data = error.response?.data || {}
      const errors = Array.isArray(data.errors) ? data.errors : []
      setResult({ ok: false, message: apiError(error), errors: errors.length ? errors : [], fieldErrors: Array.isArray(data.errors) ? [] : Object.values(data.errors || {}).flat() })
    } finally {
      setImporting(false)
    }
  }

  const rowErrors = result?.errors || []
  return (
    <Sheet open title="Cargar usuarios desde Excel" onClose={onClose} size="md"
      footer={<><Button variant="ghost" onClick={onClose}>Cerrar</Button><Button variant="success" icon={FiUploadCloud} disabled={!file} loading={importing} onClick={submit}>Importar</Button></>}>
      <div className="stack">
        <div><span className="field-label">¿Qué vas a cargar?</span>
          <Chips options={[{ value: 'alumnos', label: 'Alumnos' }, { value: 'personal', label: 'Docentes y personal' }]} value={kind} onChange={(value) => { setKind(value); setResult(null) }} />
        </div>
        <div className="alert-app">
          {kind === 'personal'
            ? <><strong>Columnas:</strong> número de empleado, nombres, apellidos, correo, teléfono, especialidad y perfil (Jefe de carrera, Asistente de jefatura, Coordinador de proyectos integradores o Docente).</>
            : <><strong>Columnas:</strong> matrícula, nombres, apellidos, correo, semestre y grupo (letra). Los grupos que no existan en el periodo abierto se crean automáticamente (por ejemplo 7° A).
              {policy && (policy.period ? <> En <strong>{policy.period.nombre}</strong> sólo existen los semestres <strong>{(policy.period_semesters || []).join(', ')}</strong>.</> : ' La carrera necesita un periodo abierto para asignar grupos.')}</>}
        </div>
        <Button variant="ghost" size="sm" icon={FiDownload} onClick={template}>Descargar plantilla</Button>
        <FileDrop accept=".xls,.xlsx,.csv" file={file} onFile={(selected) => { setFile(selected); setResult(null) }} hint="Plantilla .xls, o guárdala como .xlsx/.csv" />
        <p className="muted small-text">La contraseña inicial de cada cuenta es su matrícula o número de empleado; se pide cambiarla al primer ingreso.</p>
        {result && (
          <div className={`alert-app ${result.ok ? (rowErrors.length ? 'warning' : 'success') : 'danger'}`}>
            {result.ok
              ? <>Registros creados: <strong>{Number(result.created || 0)}</strong>. Cuentas existentes vinculadas: <strong>{Number(result.linked || 0)}</strong>. Errores: <strong>{rowErrors.length}</strong>.
                {(result.groups_created || []).length > 0 && <><br />Grupos creados: <strong>{result.groups_created.join(', ')}</strong>.</>}</>
              : result.message}
            {(rowErrors.length > 0 || result.fieldErrors?.length > 0) && (
              <ul className="error-list">
                {rowErrors.slice(0, 12).map((item, index) => <li key={index}><strong>Fila {item.fila}:</strong> {(item.errores || []).join(' | ')}</li>)}
                {(result.fieldErrors || []).slice(0, 12).map((message) => <li key={message}>{message}</li>)}
                {rowErrors.length > 12 && <li>…</li>}
              </ul>
            )}
          </div>
        )}
      </div>
    </Sheet>
  )
}

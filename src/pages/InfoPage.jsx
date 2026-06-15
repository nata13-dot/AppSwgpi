import { FiCheckCircle, FiLayers, FiTool } from 'react-icons/fi'
import { PageHeader } from '../components/common/Ui'

export default function InfoPage({ title, description }) {
  return (
    <>
      <PageHeader eyebrow="Módulo SGPI" title={title} description={description} />
      <section className="panel feature-intro">
        <span className="feature-icon"><FiLayers /></span>
        <h2>Espacio preparado para el flujo institucional</h2>
        <p>Este módulo ya forma parte de la navegación protegida y comparte autenticación, diseño responsivo, manejo de sesión y cliente API.</p>
        <div className="feature-points"><span><FiCheckCircle /> Acceso según perfil</span><span><FiCheckCircle /> Estado y caché integrados</span><span><FiTool /> Formularios especializados en la siguiente iteración</span></div>
      </section>
    </>
  )
}

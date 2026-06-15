# React SGPI

Frontend React independiente para la API Laravel de SGPI.

## Inicio local

```bash
cd React_Swgpi
copy .env.example .env
npm install
npm run dev
```

La API debe estar disponible en `http://localhost:8000/api`. Para usar otra URL,
modifica `VITE_API_URL` en `.env`.

## Verificación

```bash
npm run lint
npm test
npm run build
```

## Módulos incluidos

- Autenticación JWT, persistencia opcional y recuperación de contraseña.
- Navegación protegida para administrador, docente y estudiante.
- Dashboards conectados a los endpoints reales de Laravel.
- Usuarios, proyectos, entregables, evaluaciones y gestión académica.
- Upload, descarga y calificación de entregables.
- Repositorio público y autenticado.
- Perfil, tema claro/oscuro y diseño adaptable.

import { Link } from 'react-router-dom';
import { ArrowLeft, Compass, ShieldX } from 'lucide-react';
import { EmptyState } from '../../components/ui';
import { useDocumentTitle } from '../../hooks';

export function ForbiddenPage() {
  useDocumentTitle('Acceso denegado');
  return (
    <div className="card error-page">
      <EmptyState
        icon={ShieldX}
        title="Acceso denegado"
        text="Tu rol no tiene permisos para ver esta sección. Si crees que es un error, contacta con un administrador."
        action={
          <Link to="/dashboard" className="btn btn--primary">
            <ArrowLeft aria-hidden="true" /> Ir al dashboard
          </Link>
        }
      />
    </div>
  );
}

export function NotFoundPage() {
  useDocumentTitle('Página no encontrada');
  return (
    <div className="card error-page">
      <EmptyState
        icon={Compass}
        title="Página no encontrada"
        text="La dirección que buscas no existe o fue movida."
        action={
          <Link to="/dashboard" className="btn btn--primary">
            <ArrowLeft aria-hidden="true" /> Volver al inicio
          </Link>
        }
      />
    </div>
  );
}

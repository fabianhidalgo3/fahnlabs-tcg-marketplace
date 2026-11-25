import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

/**
 * Adjunta el token JWT (si existe) en cada petición saliente.
 * Si el backend responde 401 (token vencido o de una sesión antigua),
 * limpia la sesión y manda al login — antes fallaba en silencio y el
 * usuario no entendía por qué "no podía agregar cartas".
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('tcg_token');
  if (token) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }
  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401 && token) {
        localStorage.removeItem('tcg_token');
        localStorage.removeItem('tcg_user');
        // Sin restos de la sesión anterior (ej. el badge del carrito).
        localStorage.removeItem('tcg_cart');
        // Redirección dura: resetea el estado de la app y muestra el aviso.
        location.assign('/login?expired=1');
      }
      return throwError(() => err);
    }),
  );
};

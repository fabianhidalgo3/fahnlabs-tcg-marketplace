import { HttpInterceptorFn } from '@angular/common/http';

/** Adjunta el token JWT (si existe) en cada petición saliente. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('tcg_token');
  if (token) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }
  return next(req);
};

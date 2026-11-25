import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthUser } from '../models/models';

interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

const TOKEN_KEY = 'tcg_token';
const USER_KEY = 'tcg_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  readonly user = signal<AuthUser | null>(this.restoreUser());
  readonly isLoggedIn = computed(() => this.user() !== null);
  readonly isAdmin = computed(() => this.user()?.role === 'admin');

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  async login(email: string, password: string) {
    const res = await firstValueFrom(
      this.http.post<AuthResponse>(`${this.api}/auth/login`, { email, password }),
    );
    this.persist(res);
  }

  async register(name: string, email: string, password: string) {
    const res = await firstValueFrom(
      this.http.post<AuthResponse>(`${this.api}/auth/register`, {
        name,
        email,
        password,
      }),
    );
    this.persist(res);
  }

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    // El carrito es de la sesión: al salir no deben quedar restos de ella.
    localStorage.removeItem('tcg_cart');
    this.user.set(null);
    // Recarga dura: resetea todo el estado en memoria (carrito, favoritos,
    // colección) para que no quede NADA del usuario anterior.
    location.assign('/catalogo');
  }

  private persist(res: AuthResponse) {
    localStorage.setItem(TOKEN_KEY, res.accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    this.user.set(res.user);
  }

  private restoreUser(): AuthUser | null {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  }
}

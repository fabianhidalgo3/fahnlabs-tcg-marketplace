import { Routes } from '@angular/router';
import { authGuard, adminGuard } from './core/guards';

export const routes: Routes = [
  {
    // Inicio del coleccionista (redirige a catálogo/admin según sesión).
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./pages/home.page').then((m) => m.HomePage),
  },
  {
    path: 'catalogo',
    loadComponent: () =>
      import('./pages/catalog.page').then((m) => m.CatalogPage),
  },
  {
    path: 'cartas/:id',
    loadComponent: () =>
      import('./pages/card-detail.page').then((m) => m.CardDetailPage),
  },
  {
    path: 'sets',
    loadComponent: () => import('./pages/sets.page').then((m) => m.SetsPage),
  },
  {
    path: 'sets/:id',
    loadComponent: () =>
      import('./pages/set-detail.page').then((m) => m.SetDetailPage),
  },
  {
    path: 'carrito',
    loadComponent: () => import('./pages/cart.page').then((m) => m.CartPage),
  },
  {
    path: 'coleccion',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/my-collection.page').then((m) => m.MyCollectionPage),
  },
  {
    path: 'publicaciones',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/listings.page').then((m) => m.ListingsPage),
  },
  {
    path: 'favoritos',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/favorites.page').then((m) => m.FavoritesPage),
  },
  {
    // OJO: antes de 'coleccion/:id' para que "agregar" no se tome como id.
    path: 'coleccion/agregar',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/collection-add.page').then((m) => m.CollectionAddPage),
  },
  {
    path: 'coleccion/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/collection-set.page').then((m) => m.CollectionSetPage),
  },
  {
    path: 'almacenamiento',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/storage.page').then((m) => m.StoragePage),
  },
  {
    path: 'almacenamiento/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/album-detail.page').then((m) => m.AlbumDetailPage),
  },
  {
    path: 'ordenes',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/orders.page').then((m) => m.OrdersPage),
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () => import('./pages/admin.page').then((m) => m.AdminPage),
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'registro',
    loadComponent: () =>
      import('./pages/register.page').then((m) => m.RegisterPage),
  },
  { path: '**', redirectTo: 'catalogo' },
];

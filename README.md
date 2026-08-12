# 🃏 TCG Marketplace

Marketplace e inventario de cartas coleccionables (TCG) con un **modelo de datos genérico**
que sirve para cualquier juego: Pokémon, One Piece, Star Wars Unlimited, etc.

- **Backend:** NestJS + Mongoose (**MongoDB**)
- **Frontend:** Angular 22 (standalone components + signals)
- **Base de datos:** MongoDB (contenedor Docker local, puerto `27017`)

## ✨ Características

- **Catálogo** con búsqueda y filtros por juego, set, rareza, tipo de carta y
  **tipo específico del juego** (p. ej. el tipo del Pokémon: Fire, Water…).
- **Modelo genérico**: cada carta tiene campos comunes + un documento libre
  `attributes` con lo propio de cada TCG (hp/types, cost/power, aspects/arena…).
- **Sets y completitud**: ver el set completo y su porcentaje de completitud
  (cartas con stock vs. total oficial del set), con filtro "solo faltantes".
- **Inventario**: unidades vendibles con condición (NM/LP/MP…), idioma, foil,
  precio y stock. Panel de administración.
- **Carrito + checkout** con descuento de stock atómico y órdenes.
- **Auth JWT** con roles `admin` / `customer`.

## 🧩 Modelo de datos

```
Game (juego)
  └─ CardSet (set/expansión, con totalCards → base de la completitud)
       └─ CardModel (carta de catálogo + attributes libre)
            └─ InventoryItem (unidad vendible: condición, precio, stock)

User ─< Order ─< OrderItem (embebido)
```

El campo `attributes` (documento sin esquema fijo de Mongo) es lo que hace el
modelo genérico. Ejemplos:

| Juego     | `cardType` | `attributes` |
|-----------|-----------|--------------|
| Pokémon   | Pokémon   | `{ hp: 330, types: ["Fire"], stage: "Stage 2", weakness: "Water" }` |
| One Piece | Character | `{ color: ["Red"], cost: 3, power: 5000, counter: 1000 }` |
| SWU       | Unit      | `{ aspects: ["Cunning"], cost: 6, power: 4, hp: 8, arena: "Space" }` |

## 🚀 Puesta en marcha

### 0. Requisitos

- Node 18+ y npm
- El contenedor de **MongoDB** de Docker corriendo (`mongo:7` en `localhost:27017`,
  usuario `root` / `rootpass`). La base de datos `tcgdb` se crea sola al conectar.

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env      # revisa MONGO_URI si tu Mongo usa otras credenciales
npm run seed              # carga 3 juegos, sets, cartas e inventario de ejemplo
npm run start:dev         # API en http://localhost:3333/api
```

> El puerto por defecto es **3333** (el 3000 lo usa Open WebUI en este equipo).

Usuarios del seed:
- **admin@tcg.local** / `admin123` (rol admin)
- **cliente@tcg.local** / `cliente123` (rol cliente)

### 2. Frontend

```bash
cd frontend
npm install
npm start                 # app en http://localhost:4200
```

## 🔌 Endpoints principales

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/register` · `/login` | Registro / login (JWT) |
| GET | `/api/games` | Juegos |
| GET | `/api/sets?gameId=` | Sets con estadísticas de completitud |
| GET | `/api/sets/:id` | Set completo (todas las cartas + completitud) |
| GET | `/api/cards?gameId=&setId=&q=&type=&rarity=&inStock=` | Catálogo paginado |
| GET | `/api/cards/:id` | Ficha de carta + inventario |
| GET | `/api/inventory?cardModelId=` | Inventario de una carta |
| POST/PATCH/DELETE | `/api/inventory` | Gestión de inventario (admin) |
| POST | `/api/orders` | Checkout (auth) |
| GET | `/api/orders/mine` · `/api/orders` | Mis órdenes · todas (admin) |

Las rutas de escritura de `games`, `sets`, `cards` e `inventory` requieren rol **admin**.

## 🐳 Desplegar / compartir con Docker

Empaqueta todo (MongoDB + backend + frontend con nginx) para compartir la web
sin instalar nada más que Docker:

```bash
docker compose build
docker compose up -d
docker compose --profile seed run --rm seed   # poblar la base (una vez)
```

- App: **http://localhost:8099** (compártela en tu red con `http://<tu-ip>:8099`).
- El frontend (nginx) sirve la app y proxya `/api` al backend, así que no hay CORS.
- La base persiste en el volumen `tcg_mongo_data`.
- Para volver a poblar tras importar más sets: `docker compose --profile seed run --rm seed`
  (usa la data del host montada, no hace falta reconstruir la imagen).

> Para un dominio público necesitas un host (Render/Railway/Fly + Mongo Atlas) o un
> túnel (cloudflared). Estas imágenes Docker sirven para cualquiera de esos destinos.

## 🗄️ Ver los datos

- **Mongo Express** (Docker) → http://localhost:8081 · base de datos `tcgdb`.

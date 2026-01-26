# Mini Fleet Monitor

Dieses Projekt ist ein kompletter Mini-Fleet-Monitor für virtuelle Roboter mit Live-Map, WebSocket-Updates, Geofences, Replay und Patrol Routes. Start mit `docker-compose up --build`.

## Inhaltsverzeichnis

1. [Readme](#readme)
2. [Ihre Aufgaben](#ihre-aufgaben)

## Readme

### TL;DR (schnell starten)

```bash
cd d:\Programming\Robotics
docker-compose up --build
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- Demo Login: `admin@test.com` / `test123`

### Setup (Docker, empfohlen)

```bash
docker-compose up --build
```

Das startet:
- `backend` (Node.js + Express + WebSocket)
- `postgres` (persistente DB)
- `redis` (Cache + Pub/Sub)
- `frontend` (React + Vite)

### Setup (lokal)

Backend:
```bash
cd backend
npm install
npm run dev
```

Frontend:
```bash
cd frontend
npm install
npm run dev
```

Optional: `.env` für Backend (Beispiel)
```env
PORT=3001
DATABASE_URL=postgres://fleet:fleet_secret@localhost:5432/fleet_monitor
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-secret
SIMULATION_ENABLED=true
SIMULATION_INTERVAL_MS=2000
SIMULATION_MOVE_RADIUS=0.001
OFFLINE_AFTER_MS=10000
OFFLINE_CHECK_MS=5000
```

### Architektur (kurz)

Frontend (React + OpenLayers) spricht per REST und WebSocket mit dem Node/Express-Backend; das Backend speichert Roboter, Zonen, Events und Historie in Postgres, nutzt Redis für Cache und Pub/Sub, pusht Live-Updates via WebSocket, und simuliert Bewegungen/Patrols im 2s-Takt inkl. Geofence-Checks und Offline-Erkennung.

### Demo Credentials

- `admin@test.com`
- `test123`

### API (wichtigste Endpoints)

Auth:
- `POST /api/auth/login` -> JWT
- `GET /api/auth/me` -> aktuelle Session

Robots:
- `GET /api/robots` (auth)
- `POST /api/robots` (auth, name/lat/lon)
- `POST /api/robots/:id/move` (auth)
- `GET /api/robots/:id/history?minutes=5` (auth)
- `GET /api/robots/:id/trail?duration=60` (auth)

Zones:
- `GET /api/zones` (auth)
- `POST /api/zones` (auth)
- `PATCH /api/zones/:id` (auth)
- `DELETE /api/zones/:id` (auth)

Simulation:
- `POST /api/simulation/start` (auth)
- `POST /api/simulation/stop` (auth)
- `PATCH /api/simulation/config` (auth)

WebSocket:
- `ws://localhost:3001/ws` (auth via `{"type":"auth","token":"..."}`)

### Features (Spec + Extras)

Core:
- Node.js + Express + PostgreSQL + Redis
- JWT Login + geschützte Routen
- REST + WebSocket Live-Updates
- Auto-Simulation (2s) + DB Update + Broadcast
- OpenLayers Map + Marker + Robot List

Realtime/Simulation:
- Statuswechsel, Battery-Low, Offline Detection
- Geofence Zones + Alerts
- Patrol Routes (CW/CCW)
- Replay + History (robot_positions)

UX/Produkt-Feeling:
- Unified Actor View + Focus Bar
- Trails mit einstellbarer Länge
- Replay Controls
- Presence (Operators online)
- Dark/Light Mode

### Screenshots

![Login Screen](./docs/images/login.png)

![Live Monitor](./docs/images/dashboard.png)

![Replay Mode](./docs/images/replay.png)

### Known Limitations

- Kein echter HTTPS-Setup im Docker (lokal unkritisch).
- DB/Redis Verschlüsselung im Ruhezustand ist Infrastruktur-Thema (Cloud/Host).
- Map Tiles kommen extern (Carto/OSM).

### Future Ideas

Aktuell lösen Zonen nur Alerts aus, wenn ein Roboter hineinfahrt. Mögliche Erweiterungen:

**Zone-basierte Aktionen:**
- **Restricted = Hard Block**: Roboter stoppt bei Einfahrt, wird zur letzten sicheren Position zurückbewegt
- **Warning = Speed Limit**: Geschwindigkeit automatisch reduzieren in Warning-Zonen
- **Safe = Patrol Boundary**: Roboter dürfen nur innerhalb ihrer zugewiesenen Safe-Zone patrouillieren

**Weitere Ideen:**
1. **Heatmap Layer**: Visualisierung der Roboter-Bewegungshistorie als Heatmap auf der Karte
2. **Collision Avoidance**: Warnung wenn zwei Roboter sich zu nah kommen
3. **Task Queue**: Roboter können Aufgaben zugewiesen bekommen (z.B. "Fahre zu Punkt X")
4. **Battery Management**: Automatische Rückkehr zur Ladestation bei niedrigem Akkustand

### Folder-Info

- `backend/src` -> API, Simulation, WebSocket, DB
- `frontend/src` -> UI, Map, Panels, Context
- `backend/src/db/schema.sql` + `seed.sql` -> DB Struktur + Demo Daten

## Ihre Aufgaben

Diese Aufgaben sind dafür da, dass ihr alle Features einmal gezielt durchklickt und die Funktionalität vollständig prüfen könnt. Bitte der Reihe nach abarbeiten.

1. Starten: `docker-compose up --build`, dann `http://localhost:5173` öffnen.
2. Login: `admin@test.com` / `test123` einloggen, danach Dashboard sehen.
3. Theme: Light/Dark Mode togglen und prüfen, dass Map + Panels umschalten.
4. WebSocket: Status-Badges im Header prüfen (WS ONLINE, STATUS OK), Operator-Count im Header prüfen.
5. Actor Search: Oben per Suche einen Robot finden, auswählen, Map zentriert sich.
6. Actors Liste: Filter (All/Moving/Idle/Offline) durchschalten, Fokus wechseln.
7. Map Tools: Follow, Trails, Zones, Patrols togglen und Ergebnis auf der Map prüfen.
8. Fokus-Bar: Replay, Move Random und Center testen.
9. Robot erstellen: Map-Tools -> Add Robot, Namen eingeben, per Klick auf der Karte platzieren.
10. Trails: Settings -> Trail Length (30-300s) ändern und Trail-Länge auf der Map prüfen.
11. Simulation: Settings -> Start/Stop, Intervall/Radius ändern, Apply.
12. Offline Detection: Simulation stoppen, ~10s warten, Robot wird offline.
13. Zones: Zones-Seite -> Polygon oder Circle zeichnen, speichern, in Live-Map sehen.
14. Zones-UX: Self-Intersection Warning provozieren, Undo/Redo (Ctrl+Z/Ctrl+Y) testen.
15. Geofence Alert: Robot per Move Random in Zone bewegen, Events-Timeline prüfen.
16. Patrol Routes: Route Editor öffnen, Route zeichnen, CW/CCW wählen, aktivieren.
17. Mehrere Routen: zweite Route anlegen, aktive Route wechseln.
18. Route aus Zone: Generate From Zone nutzen, Offset-Slider testen, Route speichern.
19. Rejoin: Robot per Move Random von der Route weg bewegen, grüne Rejoin-Line sehen.
20. Replay: Replay-Seite -> Robot wählen, Dauer ändern, Speed wechseln, Play/Pause + Scrubber nutzen.
21. Events: Events-Seite -> Severity-Filter testen, Export CSV/JSON.
22. Refresh: Seite neu laden -> letzter ausgewählter Robot bleibt fokussiert/zentriert.

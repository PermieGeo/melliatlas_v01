# Beekeeper UI Components

**Owner:** `apps/web/src/components/`.

- `MapCanvas` renders saved, source-attributed PostGIS treatment polygons by visible bbox; it does not render center-only source indexes or fetch provider data.
- `TerritorySelector` reads local pilot regions and saved district names through the public read-only territory API and uses their catalog centers solely to navigate the map. These references are not authoritative administrative boundaries or complete-coverage filters.
- `TreatmentDetailsPanel` and `WeatherPanel` show attribution, precision/review status and uncertainty without asserting pesticide safety.
- `HelpPage` displays validated localized guides.
- No component calls operator endpoints or initiates source collection. On an empty territory catalog or failed lookup, it shows a distinct state without inventing a default region.

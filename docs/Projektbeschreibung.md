# Projektbeschreibung: Prozeduraler Biome-Planet mit Three.js

Diese Datei fasst die Kernpunkte des Projekts zusammen und orientiert sich an der deutschen Projektbeschreibung.

## Zielsetzung

Das Ziel ist die dynamische Generierung eines prozeduralen 3D-Planeten, dessen Oberfläche ausschließlich durch Shader auf Basis von Noise-Funktionen erzeugt wird. Der Planet soll reliefartige Höhenstrukturen sowie eine Biome-Einfärbung auf Grundlage einer klimatischen Simulation (Temperatur und Feuchtigkeit) zeigen. Die Generierung erfolgt seed-basiert, so dass beliebig viele verschiedene Planeten reproduzierbar sind.

## Features (MVP)

| Feature | Beschreibung |
|---------|--------------|
| 🌐 **Kugelförmiger Planet** | Darstellung als 3D-Sphere mit hoher Auflösung |
| 🗻 **Höhenrelief per fBm** | Höheninformationen über 3D-Fractal-Noise direkt im Vertex Shader |
| 🏜️ **Biome-Visualisierung** | Einfärbung nach Temperatur und Feuchtigkeit im Fragment Shader |
| 🔄 **Seed-basierte Generierung** | Jeder Planet ist wiederholbar generierbar anhand eines Seeds |
| 🧭 **Orbitsteuerung** | Interaktive Betrachtung durch Maus (OrbitControls) |
| 🎨 **Nahtlose Shader-Texturen** | Alles wird prozedural ohne Textur-Assets erstellt |

## Technische Umsetzung

- **Three.js:** Rendering und Aufbau der Szene
- **GLSL Shader:** Vertex- und Fragment-Shader mit eingebautem `snoise3` und `fBm`
- **Vite:** Build- und Dev-Server für schnelles Entwickeln
- **JavaScript (ESM):** App-Logik, Uniform-Steuerung und Controls

## Funktionsweise

1. **Kugelgitter**
   - Verwendet wird eine `SphereBufferGeometry` mit 256×256 Segmenten.
   - Jeder Vertex repräsentiert einen Punkt auf der Kugel.
2. **Vertex-Shader: Höhenberechnung**
   - Jeder Punkt wird normalisiert und anschließend mit einer fBm-Funktion verändert.
   - Das Ergebnis skaliert den Radius und erzeugt so die Terrainhöhe.
3. **Fragment-Shader: Biome-Klassifikation**
   - Temperatur basiert auf der y-Koordinate (Breitengrad) sowie zusätzlichem Noise.
   - Feuchtigkeit wird über eine separate Noise-Funktion berechnet.
   - Die Farbwahl folgt einer vereinfachten Whittaker-Logik für Biome.

## Erweiterungsmöglichkeiten

- Ozean-Shader mit Meeresspiegel
- Schneekappen bei hoher Höhe und niedriger Temperatur
- Marker für Städte oder Points of Interest
- Echtzeit-Klima-Modell für Jahreszeiten oder Wettereinflüsse
- Export der Daten als Heightmap oder Voxelmodell
- Rotation und Atmosphärenshell


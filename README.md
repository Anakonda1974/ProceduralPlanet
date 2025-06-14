# ProceduralPlanet

ProceduralPlanet is an experimental project focused on generating and rendering planets procedurally using [Three.js](https://threejs.org/). The UI is built with [Vue 3](https://vuejs.org/) and [Vuetify](https://vuetifyjs.com/). The goal is to explore techniques for terrain creation, atmosphere effects and other visual features entirely through code.

A detailed project description in German can be found in [docs/Projektbeschreibung.md](docs/Projektbeschreibung.md).
See [docs/parameter_and_zoom_plan.md](docs/parameter_and_zoom_plan.md) for notes on exposing user parameters and handling zoom-based detail.

## Installation

1. Ensure [Node.js](https://nodejs.org/) is installed.
2. Install dependencies:
   ```sh
   npm install
   ```

## Development

Start the development server with live reload:
```sh
npm run dev
```
This launches a local server so you can iterate on the planet rendering.

## Build

To create an optimized production build:
```sh
npm run build
```
The output will be placed in a `dist` directory ready for deployment.

## Running with Express

After building or during development you can start a small Express server with CORS enabled:

```sh
npm start
```
The server serves the built `dist` directory and exposes a `/status` endpoint.

## Features

- Real-time procedurally displaced sphere geometry
- Biome coloring in the fragment shader
- Seed-based generation for reproducible planets
- Orbit controls for interactive inspection

## Future Improvements

- Higher fidelity surface details
- Additional planetary bodies (moons, rings)
- Performance optimizations
- Expanded tooling and documentation

## License

Distributed under the **ISC** license. See the `LICENSE` file for more information.

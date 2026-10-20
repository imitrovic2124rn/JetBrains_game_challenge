# Third-Party Notices

This document identifies the course foundation, direct software dependencies, and third-party asset files retained in Ash Relay — The Last Signal. Package versions below are taken from the committed `package-lock.json`.

## 1. JetBrains Academy course foundation

Ash Relay is an extension of the **Build a Game with an AI Coding Agent** course project by JetBrains Academy.

- Source: https://github.com/jetbrains-academy/game-course
- Course: https://academy.jetbrains.com/course/30327
- Upstream license: [MIT](https://github.com/jetbrains-academy/game-course/blob/main/LICENSE)
- Upstream copyright notice: **Copyright (c) 2025 JetBrains Academy**
- The course copyright and MIT permission notice are preserved in this repository's [LICENSE](LICENSE).

### Assets retained from the course

The following files match their counterparts in the upstream course repository byte for byte. The license shown is the MIT license under which that repository distributes them; no separate asset-specific license notices were found in the upstream repository tree reviewed. This identifies the distribution source and does not claim that the Ash Relay author created these assets.

| Local file | Upstream source | License as distributed upstream |
| --- | --- | --- |
| `public/models/tode.glb` | [game/public/models/tode.glb](https://github.com/jetbrains-academy/game-course/blob/main/game/public/models/tode.glb) | MIT — upstream repository LICENSE |
| `public/models/enemy.glb` | [game/public/models/enemy.glb](https://github.com/jetbrains-academy/game-course/blob/main/game/public/models/enemy.glb) | MIT — upstream repository LICENSE |
| `public/models/small_house.glb` | [game/public/models/small_house.glb](https://github.com/jetbrains-academy/game-course/blob/main/game/public/models/small_house.glb) | MIT — upstream repository LICENSE |
| `public/tode.svg` | [game/public/tode.svg](https://github.com/jetbrains-academy/game-course/blob/main/game/public/tode.svg) | MIT — upstream repository LICENSE |

These are retained course assets. The current gameplay code constructs its characters and houses procedurally and does not reference these four files.

## 2. Direct software dependencies

| Package | Locked version | Purpose | Source | License |
| --- | --- | --- | --- | --- |
| Three.js (`three`) | 0.181.2 | Runtime 3D rendering | [mrdoob/three.js](https://github.com/mrdoob/three.js) | MIT |
| Vite (`vite`) | 7.3.7 | Development server and build tooling | [vitejs/vite](https://github.com/vitejs/vite) | MIT |

### Three.js license notice

Source: [Three.js r181 LICENSE](https://github.com/mrdoob/three.js/blob/r181/LICENSE).

```text
The MIT License

Copyright © 2010-2025 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

### Vite license notice

Source: [Vite v7.3.7 LICENSE](https://github.com/vitejs/vite/blob/v7.3.7/LICENSE).

```text
MIT License

Copyright (c) 2019-present, VoidZero Inc. and Vite contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### Transitive build dependencies

Vite also installs other packages. Their exact versions and declared licenses are recorded in `package-lock.json`; their own license and notice files are included in the packages installed by `npm ci`. Their rights and license terms remain separate from the game author's code. Preserve applicable package notices when distributing dependencies or a built game.

## 3. Project-created presentation

The current project uses code-built characters, scenery and weapons, procedurally generated ground materials, and Web Audio sound synthesis. `public/relay-mark.svg` is the project's code-drawn relay mark. The UI names system fonts rather than bundling font files. There are no prerecorded music or sound-effect files in the reviewed repository tree.

AI-assisted development and the roles of JetBrains Junie and ChatGPT are described in [README.md](README.md#course-foundation-and-original-extension).

## 4. Scope and maintenance

These notices describe the files and locked dependencies present at review. Update this document when adding or removing third-party assets or changing dependency versions. Attribution does not imply endorsement by the course author or dependency maintainers. Any separately supplied competition attribution wording should also be retained verbatim where required.

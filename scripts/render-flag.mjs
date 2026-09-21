// Optional authoring dependency: npm install --no-save sharp, or NODE_PATH to an existing runtime.
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const sharp = require('sharp')
await sharp(new URL('../public/artworks/guestbook-flag.svg', import.meta.url).pathname)
  .png().toFile(new URL('../blender/textures/guestbook-flag.png', import.meta.url).pathname)

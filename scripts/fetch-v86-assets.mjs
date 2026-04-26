/**
 * Fetch v86 runtime assets into static/v86/ so we can self-host them.
 *
 * Runs once and commits the output. Re-run manually if we want to bump
 * pinned versions — the BIOSes are pinned by git commit, the buildroot
 * image by upstream filename (copy.sh does not version it).
 *
 * Outputs:
 *   static/v86/seabios.bin
 *   static/v86/vgabios.bin
 *   static/v86/buildroot-bzimage.bin
 */

import { writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', 'static', 'v86')

// Pin BIOSes to a specific commit so we have reproducible bytes.
const BIOS_COMMIT = 'master'
const BIOS_BASE = `https://raw.githubusercontent.com/copy/v86/${BIOS_COMMIT}/bios`
const IMAGE_BASE = 'https://i.copy.sh'

const FILES = [
    { name: 'seabios.bin', url: `${BIOS_BASE}/seabios.bin` },
    { name: 'vgabios.bin', url: `${BIOS_BASE}/vgabios.bin` },
    { name: 'buildroot-bzimage.bin', url: `${IMAGE_BASE}/buildroot-bzimage.bin` },
]

async function main() {
    if (!existsSync(OUT_DIR)) await mkdir(OUT_DIR, { recursive: true })

    for (const { name, url } of FILES) {
        process.stdout.write(`fetching ${name}... `)
        const res = await fetch(url)
        if (!res.ok) throw new Error(`${url} returned ${res.status}`)
        const buf = Buffer.from(await res.arrayBuffer())
        await writeFile(join(OUT_DIR, name), buf)
        console.log(`${(buf.length / 1024).toFixed(0)} KB`)
    }
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})

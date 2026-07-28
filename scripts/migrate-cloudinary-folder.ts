// One-off script: move all assets from the 'bocas-juniors' Cloudinary folder
// to 'tangerine-toucans'. Safe to re-run — skips assets already in the target folder.
// Writes the pre-migration resource list to disk so the move is auditable/reversible
// (rename each entry back to its original public_id if something goes wrong).
import { v2 as cloudinary } from 'cloudinary'
import { writeFileSync } from 'fs'

const OLD_FOLDER = 'bocas-juniors'
const NEW_FOLDER = 'tangerine-toucans'

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// Cloudinary paginates at 500 results max per call — must follow next_cursor
// until exhausted, or a folder with >500 assets silently only gets partially counted.
async function listAllResources(prefix: string) {
  const all: { public_id: string; resource_type: string }[] = []
  let cursor: string | undefined
  do {
    const page = await cloudinary.api.resources({
      type: 'upload', prefix, max_results: 500, next_cursor: cursor,
    })
    all.push(...page.resources)
    cursor = page.next_cursor
  } while (cursor)
  return all
}

async function main() {
  const before = await listAllResources(OLD_FOLDER)
  console.log(`Found ${before.length} assets in '${OLD_FOLDER}'`)
  writeFileSync('cloudinary-migration-before.json', JSON.stringify(before, null, 2))
  console.log(`Wrote pre-migration list to cloudinary-migration-before.json (needed to roll back)`)

  let moved = 0
  let skipped = 0
  for (const resource of before) {
    const newPublicId = resource.public_id.replace(`${OLD_FOLDER}/`, `${NEW_FOLDER}/`)
    try {
      await cloudinary.uploader.rename(resource.public_id, newPublicId, { resource_type: resource.resource_type })
      moved++
    } catch (e: any) {
      if (e?.error?.message?.includes('already exists')) {
        skipped++
      } else {
        console.error(`Failed to move ${resource.public_id}:`, e)
      }
    }
  }
  console.log(`Moved ${moved}, skipped ${skipped} (already migrated)`)

  const after = await listAllResources(NEW_FOLDER)
  console.log(`'${NEW_FOLDER}' now contains ${after.length} assets`)

  if (after.length < before.length) {
    console.error(`WARNING: count mismatch — before had ${before.length}, after has ${after.length}. Do NOT proceed to Step 4 (do not point the app at the new folder) until this is resolved.`)
    process.exitCode = 1
  }
}

main()

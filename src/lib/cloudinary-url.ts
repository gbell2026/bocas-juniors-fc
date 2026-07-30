// A club's uploaded badge is stored as a Cloudinary public ID (see
// registerLeagueTeam), not a full URL — this builds the same kind of
// display URL that media-tile.tsx already builds inline for gallery photos.
export function cloudinaryUrl(publicId: string, width: number) {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  return `https://res.cloudinary.com/${cloud}/image/upload/w_${width},q_auto,f_auto/${publicId}`
}

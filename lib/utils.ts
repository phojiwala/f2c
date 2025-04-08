import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const toCSSUnit = (value: number): string => {
  return `${Math.round(value)}px`;
};

export const downloadImages = async (nodesToProcess, fileKey, accessToken) => {
  const imageMap = new Map()
  const imageNodeIds = []

  const findImageNodes = (node) => {
    if (node.type === 'IMAGE' && node.id.split(':')[0]) {
      imageNodeIds.push(node.id.split(':')[0])
    }
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(findImageNodes)
    }
  }

  nodesToProcess.forEach(findImageNodes)

  if (imageNodeIds.length === 0) {
    return imageMap
  }

  try {
    const idsString = imageNodeIds.join(',')
    const response = await fetch(
      `https://api.figma.com/v1/images/${fileKey}?ids=${idsString}&format=png`,
      {
        headers: {
          'X-Figma-Token': accessToken,
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to get image URLs (Status: ${response.status})`)
    }

    const data = await response.json()

    if (data.err) {
      throw new Error(`Figma API error getting image URLs: ${data.err}`)
    }

    if (!data.images || Object.keys(data.images).length === 0) {
      console.warn('Figma API returned no image URLs for the requested IDs.')
      return imageMap
    }

    const downloadPromises = Object.entries(data.images).map(
      async ([nodeId, imageUrl]) => {
        if (!imageUrl) {
          console.warn(`No URL returned for image node ${nodeId}`)
          return
        }
        try {
          const imageResponse = await fetch(imageUrl)
          if (!imageResponse.ok) {
            throw new Error(
              `Failed to download image ${nodeId} (Status: ${imageResponse.status})`
            )
          }
          const blob = await imageResponse.blob()
          imageMap.set(`${nodeId}.png`, blob)
        } catch (imgError) {
          console.error(
            `Failed to download or process image ${nodeId} from ${imageUrl}:`,
            imgError
          )
        }
      }
    )

    await Promise.all(downloadPromises)
  } catch (error) {
    console.error('Failed to download images:', error)
    toast({
      title: 'Image Download Failed',
      description:
        error instanceof Error
          ? error.message
          : 'Could not download images from Figma.',
      variant: 'destructive',
    })
  }

  return imageMap
}

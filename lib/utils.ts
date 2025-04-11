import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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

export const toCSSUnit = (value) => {
  if (value === undefined || value === null) return '0px'
  return `${value}px`
}

export function rgbaFromColor(color, opacity = 1) {
  if (!color) return 'transparent'
  const r = Math.round(color.r * 255)
  const g = Math.round(color.g * 255)
  const b = Math.round(color.b * 255)
  const a = opacity ?? color.a ?? 1
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

export const generateHtmlFromNodes = (nodes) => {
  return nodes
    .map((node) => {
      let element = ''
      const baseClass = `${node.type.toLowerCase()}-${node.id.replace(/:/g, '-')}`
      const uniqueClass = `${baseClass}-${node.id.split(':')[0]}`
      const className = `${baseClass} ${uniqueClass}`

      switch (node.type) {
        case 'FRAME':
        case 'GROUP':
        case 'COMPONENT': {
          const sortedChildren = node.children
            ? [...node.children].sort((a, b) => {
                const ay = a.absoluteBoundingBox?.y || 0
                const by = b.absoluteBoundingBox?.y || 0
                return ay - by
              })
            : []

          const innerHtml = generateHtmlFromNodes(sortedChildren)
          element = `<div class="${className} form-container">${innerHtml}</div>`
          break
        }

        case 'TEXT': {
          const text = node.characters?.trim() || ''
          const lower = text.toLowerCase()

          const isTitle = node.style?.fontSize >= 20 && node.style?.fontWeight >= 600
          const isLabel = /email|password|confirm|name/.test(lower)
          const isInputPlaceholder = /enter|type/.test(lower)
          const isLink = /forgot|reset/.test(lower)
          const isCheckbox = /remember/.test(lower)

          if (isTitle) {
            element = `<h1 class="form-title ${className}">${text}</h1>`
          } else if (isLabel && !isInputPlaceholder) {
            element = `<label class="form-label ${className}">${text}</label>`
          } else if (isInputPlaceholder) {
            const type = lower.includes('email')
              ? 'email'
              : lower.includes('password')
              ? 'password'
              : 'text'
            element = `<input type="${type}" class="form-input ${className}" placeholder="${text}" />`
          } else if (isCheckbox) {
            element = `<label class="remember-option ${className}">
              <input type="checkbox" class="form-checkbox" />
              ${text}
            </label>`
          } else if (isLink) {
            element = `<a href="#" class="form-link ${className}">${text}</a>`
          } else {
            element = `<p class="${className}">${text}</p>`
          }
          break
        }

        case 'RECTANGLE': {
          // Treat it as a wrapper/container
          const childrenHtml = node.children ? generateHtmlFromNodes(node.children) : ''
          element = `<div class="${className} rectangle">${childrenHtml}</div>`
          break
        }

        case 'ELLIPSE':
          element = `<div class="${className} ellipse"></div>`
          break

        case 'IMAGE':
          element = `<img src="images/${node.id.split(':')[0]}.png" class="${className}" alt="${node.name || 'Image'}" />`
          break

        default:
          element = node.children ? generateHtmlFromNodes(node.children) : ''
      }

      return element
    })
    .join('\n')
}


export const generateCssFromStyles = (node) => {
  if (!node || !node.id || !node.type) return ''

  const styles = []
  const baseClass = `${node.type.toLowerCase()}-${node.id.replace(/:/g, '-')}`
  const cssRules = []

  if (node.absoluteBoundingBox) {
    const { width, height } = node.absoluteBoundingBox
    if (width) cssRules.push(`width: ${width}px`)
    if (height) cssRules.push(`height: ${height}px`)
  }

  // Remove unwanted background for TEXT elements
  if (node.type !== 'TEXT' && node.fills?.[0]?.visible !== false) {
    const fill = node.fills?.[0]
    if (fill && fill.type === 'SOLID') {
      cssRules.push(`background-color: ${rgbaFromColor(fill.color, fill.opacity ?? 1)}`)
    }
  }

  // Borders
  if (node.strokes?.length > 0 && node.strokeWeight) {
    const stroke = node.strokes[0]
    if (stroke.type === 'SOLID') {
      cssRules.push(`border: ${node.strokeWeight}px solid ${rgbaFromColor(stroke.color, stroke.opacity ?? 1)}`)
    }
  }

  // Rounded corners
  if (typeof node.cornerRadius === 'number') {
    cssRules.push(`border-radius: ${node.cornerRadius}px`)
  }

  // Typography
  if (node.type === 'TEXT' && node.style) {
    const s = node.style
    if (s.fontFamily) cssRules.push(`font-family: "${s.fontFamily}"`)
    if (s.fontSize) cssRules.push(`font-size: ${s.fontSize}px`)
    if (s.fontWeight) cssRules.push(`font-weight: ${s.fontWeight}`)
    if (s.lineHeightPx) cssRules.push(`line-height: ${s.lineHeightPx}px`)
    if (s.textAlignHorizontal) cssRules.push(`text-align: ${s.textAlignHorizontal.toLowerCase()}`)
    if (s.fills?.[0]?.type === 'SOLID') {
      cssRules.push(`color: ${rgbaFromColor(s.fills[0].color, s.fills[0].opacity ?? 1)}`)
    }
  }

  if (cssRules.length > 0) {
    styles.push(`.${baseClass} { ${cssRules.join('; ')} }`)
  }

  // Recurse for children
  if (node.children) {
    for (const child of node.children) {
      styles.push(generateCssFromStyles(child))
    }
  }

  return styles.join('\n')
}


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
        case 'COMPONENT':
        case 'FRAME':
        case 'GROUP': {
          const sortedChildren = node.children
            ? [...node.children].sort((a, b) => {
                const ay = a.absoluteBoundingBox?.y || 0
                const by = b.absoluteBoundingBox?.y || 0
                return ay - by
              })
            : []

          if (sortedChildren.length === 1 && ['TEXT', 'RECTANGLE', 'ELLIPSE', 'IMAGE'].includes(sortedChildren[0].type)) {
            element = generateHtmlFromNodes(sortedChildren)
          } else {
            element = `<div class="${className}">
              ${generateHtmlFromNodes(sortedChildren)}
            </div>`
          }
          break
        }

        case 'TEXT': {
          const text = node.characters?.trim() || ''
          const lower = text.toLowerCase()
          const isLargeTitle = node.style?.fontSize >= 22 && node.style?.fontWeight >= 600

          if (isLargeTitle) {
            element = `<h1 class="form-title ${className}">${text}</h1>`
          } else if (lower.includes('enter')) {
            const type = lower.includes('password')
              ? 'password'
              : lower.includes('email')
              ? 'email'
              : 'text'
            element = `<input type="${type}" class="form-input ${className}" placeholder="${text}" />`
          } else if (lower.includes('forgot')) {
            element = `<a href="#" class="form-link ${className}">${text}</a>`
          } else if (['submit', 'login', 'reset'].includes(lower)) {
            element = `<button class="form-button ${className}">${text}</button>`
          } else {
            element = `<label class="form-label ${className}">${text}</label>`
          }
          break
        }

        case 'RECTANGLE': {
          const name = node.name?.toLowerCase() || ''
          const looksLikeButton = name.includes('button') || node.children?.some(c => c.characters?.toLowerCase().includes('submit'))

          if (looksLikeButton) {
            const label = node.children?.find(c => c.type === 'TEXT')?.characters || 'Submit'
            element = `<button class="form-button ${className}">${label}</button>`
          } else {
            element = `<div class="${className}"></div>`
          }
          break
        }

        case 'ELLIPSE': {
          element = `<div class="${className}"></div>`
          break
        }

        case 'IMAGE': {
          const filename = `${node.id.split(':')[0]}.png`
          element = `<img src="images/${filename}" class="${className}" alt="${node.name || 'Image'}" />`
          break
        }

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

  // Dimensions and positioning
  if (node.absoluteBoundingBox) {
    const { width, height, x, y } = node.absoluteBoundingBox
    if (width) cssRules.push(`width: ${width}px`)
    if (height) cssRules.push(`height: ${height}px`)
    if (x !== undefined) cssRules.push(`left: ${x}px`)
    if (y !== undefined) cssRules.push(`top: ${y}px`)
  }

  // Flex layout
  if (node.layoutMode) {
    cssRules.push(`display: flex`)
    cssRules.push(`flex-direction: ${node.layoutMode.toLowerCase()}`)
    if (node.primaryAxisAlignItems)
      cssRules.push(`justify-content: ${node.primaryAxisAlignItems.toLowerCase()}`)
    if (node.counterAxisAlignItems)
      cssRules.push(`align-items: ${node.counterAxisAlignItems.toLowerCase()}`)
    if (node.itemSpacing)
      cssRules.push(`gap: ${node.itemSpacing}px`)
    if (node.paddingLeft) cssRules.push(`padding-left: ${node.paddingLeft}px`)
    if (node.paddingRight) cssRules.push(`padding-right: ${node.paddingRight}px`)
    if (node.paddingTop) cssRules.push(`padding-top: ${node.paddingTop}px`)
    if (node.paddingBottom) cssRules.push(`padding-bottom: ${node.paddingBottom}px`)
  }

  // Background
  if (node.fills && node.fills.length > 0) {
    const visibleFills = node.fills.filter((f) => f.visible !== false)
    if (visibleFills.length > 0) {
      const fill = visibleFills[0]
      if (fill.type === 'SOLID') {
        cssRules.push(`background-color: ${rgbaFromColor(fill.color, fill.opacity)}`)
      }
    }
  }

  // Border
  if (node.strokes && node.strokes.length > 0) {
    const stroke = node.strokes[0]
    if (stroke.type === 'SOLID') {
      cssRules.push(`border: ${node.strokeWeight || 1}px solid ${rgbaFromColor(stroke.color, stroke.opacity)}`)
    }
  }

  // Radius
  if (node.cornerRadius) {
    cssRules.push(`border-radius: ${node.cornerRadius}px`)
  }

  // Effects
  if (node.effects) {
    node.effects.forEach((effect) => {
      if (effect.type === 'DROP_SHADOW') {
        const { offset, radius, color } = effect
        cssRules.push(`box-shadow: ${offset.x}px ${offset.y}px ${radius}px ${rgbaFromColor(color)}`)
      }
    })
  }

  // Text styles
  if (node.type === 'TEXT' && node.style) {
    const s = node.style
    if (s.fontFamily) cssRules.push(`font-family: "${s.fontFamily}"`)
    if (s.fontSize) cssRules.push(`font-size: ${s.fontSize}px`)
    if (s.fontWeight) cssRules.push(`font-weight: ${s.fontWeight}`)
    if (s.letterSpacing) cssRules.push(`letter-spacing: ${s.letterSpacing}px`)
    if (s.lineHeightPx) cssRules.push(`line-height: ${s.lineHeightPx}px`)
    if (s.textAlignHorizontal)
      cssRules.push(`text-align: ${s.textAlignHorizontal.toLowerCase()}`)
    if (s.fills?.[0]?.type === 'SOLID') {
      cssRules.push(`color: ${rgbaFromColor(s.fills[0].color, s.fills[0].opacity ?? 1)}`)
    }

    // Remove background from labels and links
    const text = node.characters?.toLowerCase() || ''
    if (text.includes('email') || text.includes('password')) {
      cssRules.push(`background-color: transparent`)
    }
    if (text.includes('forgot')) {
      cssRules.push(`background-color: transparent`)
      cssRules.push(`color: #003966`)
      cssRules.push(`text-decoration: none`)
    }
  }

  // Opacity
  if (typeof node.opacity === 'number') {
    cssRules.push(`opacity: ${node.opacity}`)
  }

  // Blend mode
  if (node.blendMode && node.blendMode !== 'NORMAL') {
    cssRules.push(`mix-blend-mode: ${node.blendMode.toLowerCase()}`)
  }

  // Constraints
  if (node.constraints) {
    if (node.constraints.horizontal === 'CENTER') {
      cssRules.push('margin-left: auto', 'margin-right: auto')
    }
    if (node.constraints.vertical === 'CENTER') {
      cssRules.push('margin-top: auto', 'margin-bottom: auto')
    }
  }

  if (cssRules.length > 0) {
    styles.push(`.${baseClass} { ${cssRules.join('; ')}; }`)
  }

  // Recurse through children
  if (node.children) {
    node.children.forEach((child) => {
      styles.push(generateCssFromStyles(child))
    })
  }

  return styles.join('\n')
}


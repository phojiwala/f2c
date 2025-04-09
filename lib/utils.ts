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
        case 'GROUP':
        case 'FRAME': {
          const sortedChildren = node.children
            ? [...node.children].sort((a, b) => {
                const ay = a.absoluteBoundingBox?.y || 0
                const by = b.absoluteBoundingBox?.y || 0
                return ay - by
              })
            : []

          // Check if this is the main login container
          const isLoginContainer = node.name.toLowerCase().includes('login')
          if (isLoginContainer) {
            element = `<div class="${className} login-container">
              <div class="login-card">
                <h1 class="login-title">Login</h1>
                ${generateHtmlFromNodes(sortedChildren)}
              </div>
            </div>`
          } else {
            element = `<div class="${className}">
              ${generateHtmlFromNodes(sortedChildren)}
            </div>`
          }
          break
        }

        case 'TEXT': {
          const text = node.characters?.toLowerCase() || ''
          const style = node.style || {}

          if (text.includes('login') && style.fontSize >= 24) {
            // Skip the login title as it's handled in the container
            element = ''
          } else if (text.includes('remember')) {
            element = `<label class="${className} remember-me">
              <input type="checkbox" class="remember-checkbox" />
              <span>${node.characters}</span>
            </label>`
          } else if (text.includes('forgot')) {
            element = `<a href="#" class="${className} forgot-password">${node.characters}</a>`
          } else if (text.includes('email') || text.includes('password')) {
            const inputType = text.includes('password') ? 'password' : 'email'
            const placeholder = text.includes('password') ? 'Enter password' : 'Enter email address'
            element = `<div class="input-group">
              <label class="${className}">${node.characters}</label>
              <input type="${inputType}" class="form-input" placeholder="${placeholder}" />
            </div>`
          } else {
            element = `<p class="${className}">${node.characters}</p>`
          }
          break
        }

        case 'RECTANGLE': {
          const name = node.name?.toLowerCase() || ''
          if (name.includes('button') || name.includes('login')) {
            element = `<button class="${className} login-button">Login</button>`
          } else {
            element = `<div class="${className}"></div>`
          }
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

  // Extract dimensions if available
  if (node.absoluteBoundingBox) {
    const { width, height, x, y } = node.absoluteBoundingBox
    if (width) cssRules.push(`width: ${width}px`)
    if (height) cssRules.push(`height: ${height}px`)
    if (x) cssRules.push(`left: ${x}px`)
    if (y) cssRules.push(`top: ${y}px`)
  }

  // Layout properties
  if (node.layoutMode) {
    cssRules.push(`display: flex`)
    cssRules.push(`flex-direction: ${node.layoutMode.toLowerCase()}`)
    if (node.primaryAxisAlignItems) {
      cssRules.push(`justify-content: ${node.primaryAxisAlignItems.toLowerCase()}`)
    }
    if (node.counterAxisAlignItems) {
      cssRules.push(`align-items: ${node.counterAxisAlignItems.toLowerCase()}`)
    }
    if (node.itemSpacing) {
      cssRules.push(`gap: ${node.itemSpacing}px`)
    }
    if (node.paddingLeft) cssRules.push(`padding-left: ${node.paddingLeft}px`)
    if (node.paddingRight) cssRules.push(`padding-right: ${node.paddingRight}px`)
    if (node.paddingTop) cssRules.push(`padding-top: ${node.paddingTop}px`)
    if (node.paddingBottom) cssRules.push(`padding-bottom: ${node.paddingBottom}px`)
  }

  // Background
  if (node.fills && node.fills.length > 0) {
    const visibleFills = node.fills.filter(fill => fill.visible !== false)
    if (visibleFills.length > 0) {
      const fill = visibleFills[0]
      if (fill.type === 'SOLID') {
        cssRules.push(`background-color: ${rgbaFromColor(fill.color, fill.opacity)}`)
      } else if (fill.type === 'GRADIENT_LINEAR') {
        const gradientStops = fill.gradientStops.map(stop =>
          `${rgbaFromColor(stop.color)} ${stop.position * 100}%`
        ).join(', ')
        cssRules.push(`background: linear-gradient(${fill.gradientTransform[0]}deg, ${gradientStops})`)
      }
    }
  }

  // Border
  if (node.strokes && node.strokes.length > 0) {
    const stroke = node.strokes[0]
    if (stroke.type === 'SOLID') {
      const borderColor = rgbaFromColor(stroke.color, stroke.opacity)
      const borderWidth = node.strokeWeight || 1
      const borderStyle = 'solid'
      cssRules.push(`border: ${borderWidth}px ${borderStyle} ${borderColor}`)
    }
  }

  // Border radius
  if (node.cornerRadius) {
    cssRules.push(`border-radius: ${node.cornerRadius}px`)
  } else if (node.topLeftRadius || node.topRightRadius || node.bottomRightRadius || node.bottomLeftRadius) {
    cssRules.push(`border-radius: ${node.topLeftRadius || 0}px ${node.topRightRadius || 0}px ${node.bottomRightRadius || 0}px ${node.bottomLeftRadius || 0}px`)
  }

  // Effects (shadows, blurs)
  if (node.effects) {
    node.effects.forEach(effect => {
      if (effect.type === 'DROP_SHADOW') {
        const { offset, radius, color } = effect
        cssRules.push(`box-shadow: ${offset.x}px ${offset.y}px ${radius}px ${rgbaFromColor(color)}`)
      } else if (effect.type === 'INNER_SHADOW') {
        const { offset, radius, color } = effect
        cssRules.push(`box-shadow: inset ${offset.x}px ${offset.y}px ${radius}px ${rgbaFromColor(color)}`)
      } else if (effect.type === 'LAYER_BLUR') {
        cssRules.push(`filter: blur(${effect.radius}px)`)
      }
    })
  }

  // Text styles
  if (node.type === 'TEXT' && node.style) {
    const { style: s } = node
    if (s.fontFamily) cssRules.push(`font-family: "${s.fontFamily}"`)
    if (s.fontSize) cssRules.push(`font-size: ${s.fontSize}px`)
    if (s.fontWeight) cssRules.push(`font-weight: ${s.fontWeight}`)
    if (s.letterSpacing) cssRules.push(`letter-spacing: ${s.letterSpacing}px`)
    if (s.lineHeightPx) cssRules.push(`line-height: ${s.lineHeightPx}px`)
    if (s.textAlignHorizontal) cssRules.push(`text-align: ${s.textAlignHorizontal.toLowerCase()}`)
    if (s.textDecoration) cssRules.push(`text-decoration: ${s.textDecoration.toLowerCase()}`)
    if (s.textCase) {
      switch (s.textCase) {
        case 'UPPER': cssRules.push('text-transform: uppercase'); break
        case 'LOWER': cssRules.push('text-transform: lowercase'); break
        case 'TITLE': cssRules.push('text-transform: capitalize'); break
      }
    }
    // Text color from fills
    if (s.fills && s.fills[0] && s.fills[0].type === 'SOLID') {
      cssRules.push(`color: ${rgbaFromColor(s.fills[0].color, s.fills[0].opacity)}`)
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

  // Constraints and positioning
  if (node.constraints) {
    if (node.constraints.horizontal === 'CENTER') cssRules.push('margin-left: auto', 'margin-right: auto')
    if (node.constraints.vertical === 'CENTER') cssRules.push('margin-top: auto', 'margin-bottom: auto')
  }

  if (cssRules.length > 0) {
    styles.push(`.${baseClass} { ${cssRules.join('; ')}; }`)
  }

  // Process children recursively
  if (node.children) {
    node.children.forEach(child => {
      styles.push(generateCssFromStyles(child))
    })
  }

  return styles.join('\n')
}
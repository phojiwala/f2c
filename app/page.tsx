'use client'
import React, { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Code, Eye, Download } from 'lucide-react'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { useToast } from '@/hooks/use-toast'
import FeatureCard from '@/components/FeatureCard'
import { downloadImages } from '@/lib/utils'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import Main from '@/components/Main'
import Step1 from '@/components/Step1'
import Step2 from '@/components/Step2'
import Step3 from '@/components/Step3'

const toCSSUnit = (value) => {
  if (value === undefined || value === null) return '0px'
  return `${value}px`
}

function rgbaFromColor(color, opacity = 1) {
  const r = Math.round(color.r * 255)
  const g = Math.round(color.g * 255)
  const b = Math.round(color.b * 255)
  const a = opacity ?? 1
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

const generateHtmlFromNodes = (nodes) => {
  return nodes
    .map((node) => {
      let element = ''
      const baseClass = `${node.type.toLowerCase()}-${node.id.replace(
        /:/g,
        '-'
      )}`
      const uniqueClass = `${baseClass}-${node.id.split(':')[0]}`
      const className = `${baseClass} ${uniqueClass}`

      switch (node.type) {
        case 'COMPONENT':
        case 'GROUP':
        case 'FRAME': {
          const isTrivialWrapper = (node) => {
            return (
              ['TEXT', 'RECTANGLE', 'ELLIPSE', 'IMAGE'].includes(node.type) ||
              (node.type === 'GROUP' && !node.children?.length)
            )
          }

          const sortedChildren = node.children
            ? [...node.children].sort((a, b) => {
                const ay = a.absoluteBoundingBox?.y || 0
                const by = b.absoluteBoundingBox?.y || 0
                return ay - by
              })
            : []

          const onlyChild =
            sortedChildren.length === 1 ? sortedChildren[0] : null
          const isInputChild =
            onlyChild?.type === 'TEXT' &&
            onlyChild.characters?.toLowerCase().includes('enter')

          if (onlyChild && isInputChild) {
            element = generateHtmlFromNodes(sortedChildren)
          } else {
            element = `<div class="${className}">
            ${generateHtmlFromNodes(sortedChildren)}
            </div>`
          }

          break
        }

        case 'TEXT': {
          const text = node.characters?.toLowerCase() || ''

          if (text.includes('remember')) {
            element = `<label class="${className}"><input type="checkbox" /> ${node.characters}</label>`
          }

          const isPlaceholder =
            text.includes('enter email') || text.includes('enter password')

          const isLabel =
            text.includes('email') ||
            text.includes('password') ||
            text.includes('address')

          if (isPlaceholder) {
            if (text.includes('email')) {
              element = `<input type="email" class="${className}" placeholder="${node.characters}" />`
            } else if (text.includes('password')) {
              element = `<input type="password" class="${className}" placeholder="${node.characters}" />`
            } else {
              element = `<input type="text" class="${className}" placeholder="${node.characters}" />`
            }
          } else if (text.includes('forgot')) {
            element = `<a href="#" class="${className}">${node.characters}</a>`
          } else if (text.includes('remember')) {
            element = `<label class="${className}">${node.characters}</label>`
          } else if (isLabel) {
            element = `<label class="${className}">${node.characters}</label>`
          } else {
            element = `<p class="${className}">${node.characters}</p>`
          }

          break
        }

        case 'RECTANGLE': {
          const name = node.name?.toLowerCase() || ''
          const isEmail = name.includes('email')
          const isPassword = name.includes('password')
          const isButton =
            name.includes('login') ||
            node.children?.some((c) => c.characters?.toLowerCase() === 'login')

          if (isEmail) {
            element = `<input type="email" class="${className}" placeholder="Enter email address" />`
          } else if (isPassword) {
            element = `<input type="password" class="${className}" placeholder="Enter password" />`
          } else if (isButton) {
            const buttonText =
              node.children?.find((c) => c.type === 'TEXT')?.characters ||
              'Button'
            element = `<button class="${className}">${buttonText}</button>`
          } else {
            element = `<div class="${className}"></div>`
          }
          break
        }

        case 'ELLIPSE': {
          if (node.name.toLowerCase().includes('checkbox')) {
            element = `<input type="checkbox" class="${className}" />`
          } else {
            element = `<div class="${className}"></div>`
          }
          break
        }

        case 'IMAGE':
          element = `<img src="images/${
            node.id.split(':')[0]
          }.png" class="${className}" alt="${node.name || 'Figma Image'}" />`
          break

        case 'VECTOR':
        case 'BOOLEAN_OPERATION':
          element = ''
          break

        default:
          console.warn(`Unhandled Figma node type: ${node.type}`)
          element = node.children ? generateHtmlFromNodes(node.children) : ''
      }

      return element
    })
    .join('\n')
}

const generateCssFromStyles = (node) => {
  if (!node || !node.id || !node.type) return ''

  const styles = []
  const baseClass = `${node.type.toLowerCase()}-${node.id.replace(/:/g, '-')}`
  const cssRules = []

  if (
    node.absoluteBoundingBox &&
    node.absoluteBoundingBox.width < 1500 &&
    node.absoluteBoundingBox.height < 1000
  ) {
    const { width, height } = node.absoluteBoundingBox
    cssRules.push(`width: ${width}px`)
    cssRules.push(`height: ${height}px`)
  }

  if (
    node.name.toLowerCase().includes('login') ||
    node.name.toLowerCase().includes('form')
  ) {
    cssRules.push('display: flex')
    cssRules.push('flex-direction: column')
    cssRules.push('align-items: stretch')
    cssRules.push('gap: 16px')
  }

  if (node.name.toLowerCase().includes('checkbox')) {
    cssRules.push('display: inline-block')
    cssRules.push('margin-right: 8px')
  }

  if (node.type !== 'TEXT') {
    const fill = node.fills?.[0]
    if (fill && fill.type === 'SOLID' && fill.color) {
      cssRules.push(
        `background-color: ${rgbaFromColor(
          fill.color,
          fill.opacity ?? fill.color.a ?? 1
        )}`
      )
    }
  }

  if (node.strokes?.length > 0 && node.strokeWeight) {
    const stroke = node.strokes[0]
    if (stroke.type === 'SOLID') {
      cssRules.push(
        `border: ${node.strokeWeight}px solid ${rgbaFromColor(
          stroke.color,
          stroke.opacity ?? stroke.color.a ?? 1
        )}`
      )
    }
  }

  // Corner radius
  if (typeof node.cornerRadius === 'number') {
    cssRules.push(`border-radius: ${node.cornerRadius}px`)
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
      cssRules.push(
        `color: ${rgbaFromColor(s.fills[0].color, s.fills[0].opacity ?? 1)}`
      )
    }
  }

  if (
    node.type === 'RECTANGLE' &&
    (node.name.toLowerCase().includes('email') ||
      node.name.toLowerCase().includes('password'))
  ) {
    cssRules.push('padding: 8px 12px')
    cssRules.push('border: 1px solid #ccc')
    cssRules.push('border-radius: 6px')
    cssRules.push('font-size: 14px')
    cssRules.push('width: 100%')
  }

  if (
    node.name.toLowerCase().includes('button') ||
    node.children?.some((c) => c.characters?.toLowerCase() === 'login')
  ) {
    cssRules.push('padding: 10px 20px')
    cssRules.push('color: white')
    cssRules.push('font-size: 14px')
    cssRules.push('font-weight: 600')
    cssRules.push('border: none')
    cssRules.push('border-radius: 50px') // already coming from Figma
    cssRules.push('background-color: #003966') // fallback if no fill
  }

  if (
    node.type === 'TEXT' &&
    node.characters?.toLowerCase().includes('forgot')
  ) {
    cssRules.push('font-size: 14px')
    cssRules.push('font-weight: 600')
    cssRules.push('text-decoration: none')
    cssRules.push('color: #007BFF') // or extract from fills
  }

  if (
    node.type === 'TEXT' &&
    node.characters?.toLowerCase().includes('remember')
  ) {
    cssRules.push('display: flex')
    cssRules.push('align-items: center')
    cssRules.push('gap: 6px')
    cssRules.push('font-size: 12px')
  }

  // Drop shadow
  const shadow = node.effects?.find((e) => e.type === 'DROP_SHADOW')
  if (shadow) {
    const { offset, radius, color } = shadow
    cssRules.push(
      `box-shadow: ${offset.x}px ${offset.y}px ${radius}px ${rgbaFromColor(
        color,
        color.a ?? 1
      )}`
    )
  }

  // Centering logic for buttons
  if (
    node.name?.toLowerCase().includes('button') ||
    node.children?.some((c) => c.characters?.toLowerCase() === 'login')
  ) {
    cssRules.push('display: flex')
    cssRules.push('justify-content: center')
    cssRules.push('align-items: center')
    cssRules.push('cursor: pointer')
  }

  if (cssRules.length > 0) {
    styles.push(`.${baseClass} { ${cssRules.join('; ')} }`)
  }

  if (
    node.children?.length &&
    ['FRAME', 'GROUP', 'COMPONENT'].includes(node.type)
  ) {
    cssRules.push('display: flex')
    cssRules.push('flex-direction: column')
    cssRules.push('gap: 12px')
  }

  return styles.join('\n')
}

export default function Home() {
  const [figmaData, setFigmaData] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [figmaUrl, setFigmaUrl] = useState('')
  const [step, setStep] = useState(1)
  const [selectedFrames, setSelectedFrames] = useState([])
  const [outputType, setOutputType] = useState('both')
  const [frames, setFrames] = useState([])
  const [generatedFiles, setGeneratedFiles] = useState({})
  const { toast } = useToast()

  const FIGMA_ACCESS_TOKEN = process.env.NEXT_PUBLIC_FIGMA_ACCESS_TOKEN;

  const extractFileKey = (url) => {
    const regex = /figma\.com\/(file|design)\/([a-zA-Z0-9]+)/
    const match = url.match(regex)
    return match ? match[2] : null
  }

  const fetchFigmaFile = useCallback(
    async (fileKey) => {
      setIsProcessing(true)
      setFigmaData(null)
      setFrames([])
      setSelectedFrames([])

      try {
        const metaResponse = await fetch(
          `https://api.figma.com/v1/files/${fileKey}`,
          {
            headers: {
              'X-Figma-Token': FIGMA_ACCESS_TOKEN,
            },
          }
        )

        if (!metaResponse.ok) {
          throw new Error(
            `Failed to fetch Figma file metadata (Status: ${metaResponse.status})`
          )
        }
        const metaData = await metaResponse.json()

        const contentResponse = await fetch(
          `https://api.figma.com/v1/files/${fileKey}?geometry=paths`,
          {
            headers: {
              'X-Figma-Token': FIGMA_ACCESS_TOKEN,
            },
          }
        )

        if (!contentResponse.ok) {
          throw new Error(
            `Failed to fetch Figma file content (Status: ${contentResponse.status})`
          )
        }
        const contentData = await contentResponse.json()

        const combinedData = {
          name: metaData.name || 'Untitled Figma File',
          lastModified: metaData.lastModified || new Date().toISOString(),
          components: Object.keys(metaData.components || {}).length,
          styles: Object.keys(metaData.styles || {}).length,
          thumbnailUrl: metaData.thumbnailUrl,
          document: contentData.document,
        }

        setFigmaData(combinedData)

        const extracted = extractFrames(combinedData.document)
        setFrames(extracted)

        if (extracted.length > 0) {
          setStep(2)
          toast({
            title: 'Figma File Loaded',
            description: `Found ${extracted.length} frames.`,
          })
        } else {
          toast({
            title: 'No Frames Found',
            description:
              'Could not find any frames or components in this Figma file.',
            variant: 'destructive',
          })
        }
      } catch (error) {
        console.error('Figma API Error:', error)
        toast({
          title: 'Error Loading Figma File',
          description:
            error instanceof Error
              ? error.message
              : 'An unexpected error occurred.',
          variant: 'destructive',
        })
        setStep(1)
      } finally {
        setIsProcessing(false)
      }
    },
    [toast]
  )

  const handleProcessClick = () => {
    const fileKey = extractFileKey(figmaUrl)
    if (!fileKey) {
      toast({
        title: 'Invalid Figma URL',
        description: 'Please enter a valid Figma file URL.',
        variant: 'destructive',
      })
      return
    }
    fetchFigmaFile(fileKey)
  }

  const extractFrames = (documentNode) => {
    const topLevelFrames = []

    const findTopLevelNodes = (node) => {
      if (node.type === 'CANVAS' && node.children) {
        node.children.forEach((child) => {
          if (
            child.type === 'FRAME' ||
            child.type === 'COMPONENT' ||
            child.type === 'COMPONENT_SET'
          ) {
            topLevelFrames.push({
              id: child.id,
              name: child.name,
              type: child.type,
              children: child.children,
              absoluteBoundingBox: child.absoluteBoundingBox,
              fills: child.fills,
              strokes: child.strokes,
              strokeWeight: child.strokeWeight,
              cornerRadius: child.cornerRadius,
              style: child.style,
              characters: child.characters, // Include characters for TEXT nodes
              effects: child.effects, // Include effects for shadows
            })
          }
        })
      } else if (node.children) {
        node.children.forEach((child) => {
          const updatedChild = { ...child }
          if (child.type === 'TEXT') {
            updatedChild.characters = child.characters
          }
          if (child.effects) {
            updatedChild.effects = child.effects
          }
          child = updatedChild
          findTopLevelNodes(child)
        })
      }
    }

    if (documentNode) {
      findTopLevelNodes(documentNode)
    }

    return topLevelFrames
  }

  const handleFrameSelection = (frameId) => {
    setSelectedFrames((prev) =>
      prev.includes(frameId)
        ? prev.filter((id) => id !== frameId)
        : [...prev, frameId]
    )
  }

  const handleProceedToOutput = () => {
    if (selectedFrames.length === 0) {
      toast({
        title: 'No Frames Selected',
        description:
          'Please select at least one frame or component to generate code.',
        variant: 'destructive',
      })
      return
    }

    const { html, css } = generateCodeForSelectedFrames()
    setGeneratedFiles({ html, css })
    setStep(3)
  }

  const generateCodeForSelectedFrames = () => {
    const selectedFrameNodes = frames.filter((frame) =>
      selectedFrames.includes(frame.id)
    )

    if (!selectedFrameNodes.length) {
      return { html: '', css: '' }
    }

    const htmlContent = selectedFrameNodes
      .map((frame) => {
        return `<div class="frame-wrapper">
        ${generateHtmlFromNodes([frame])}
      </div>`
      })
      .join('\n\n')

    const cssContent = selectedFrameNodes
      .map((frame) => generateCssFromStyles(frame))
      .join('\n\n')

    const fullHtml = `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${figmaData?.name || 'Figma Export'}</title>
        <link rel="stylesheet" href="styles.css">
    </head>
    <body>
        <div class="frame">
          ${htmlContent}
        </div>
    </body>
    </html>`

    const fullCss = `
      body {
        margin: 0;
        padding: 0;
        font-family: Arial, sans-serif;
      }
      ${cssContent}
    `

    return { html: fullHtml, css: fullCss }
  }

  const handleDownload = async () => {
    if (!figmaData || !figmaData.document) {
      toast({
        title: 'Error',
        description: 'No Figma data loaded.',
        variant: 'destructive',
      })
      return
    }
    if (selectedFrames.length === 0) {
      toast({
        title: 'Error',
        description: 'No frames selected for download.',
        variant: 'destructive',
      })
      return
    }

    setIsProcessing(true)

    try {
      const { html, css } = generateCodeForSelectedFrames()
      setGeneratedFiles({ html, css })

      const zip = new JSZip()

      if (outputType === 'html' || outputType === 'both') {
        zip.file('index.html', html)
      }
      if (outputType === 'css' || outputType === 'both') {
        zip.file('styles.css', css)
      }

      if ((outputType === 'html' || outputType === 'both') && figmaUrl) {
        const fileKey = extractFileKey(figmaUrl)
        const accessToken = FIGMA_ACCESS_TOKEN

        if (fileKey && accessToken) {
          const selectedFrameNodes = frames.filter((frame) =>
            selectedFrames.includes(frame.id)
          )

          toast({
            title: 'Downloading Images',
            description: 'Fetching image assets from Figma...',
          })
          const images = await downloadImages(
            selectedFrameNodes,
            fileKey,
            accessToken
          )

          if (images.size > 0) {
            const imagesFolder = zip.folder('images')
            if (imagesFolder) {
              for (const [filename, blob] of images) {
                imagesFolder.file(filename, blob)
              }
              toast({
                title: 'Images Added',
                description: `${images.size} images added to ZIP.`,
              })
            }
          } else {
            toast({
              title: 'No Images Found',
              description: 'No images needed or found for selected frames.',
            })
          }
        } else {
          console.warn(
            'Missing File Key or Access Token, skipping image download.'
          )
          toast({
            title: 'Skipping Images',
            description: 'Missing Figma URL or Token for image download.',
            variant: 'destructive',
          })
        }
      }

      toast({
        title: 'Generating ZIP',
        description: 'Preparing your download...',
      })
      const zipContent = await zip.generateAsync({ type: 'blob' })
      const safeFilename =
        figmaData.name.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'export'
      saveAs(zipContent, `${safeFilename}.zip`)

      toast({
        title: 'Downloaded',
        description: 'Your code has been generated and zipped.',
      })
    } catch (error) {
      console.error('Download failed:', error)
      toast({
        title: 'Download Failed',
        description:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred during ZIP generation.',
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <Step1
            figmaUrl={figmaUrl}
            setFigmaUrl={setFigmaUrl}
            isProcessing={isProcessing}
            handleProcessClick={handleProcessClick}
          />
        )
      case 2:
        return (
          <Step2
            frames={frames}
            selectedFrames={selectedFrames}
            setSelectedFrames={setSelectedFrames}
            setStep={setStep}
            handleFrameSelection={handleFrameSelection}
            handleProceedToOutput={handleProceedToOutput}
            isProcessing={isProcessing}
          />
        )
      case 3:
        return (
          <Step3
            outputType={outputType}
            setOutputType={setOutputType}
            setStep={setStep}
            isProcessing={isProcessing}
            handleDownload={handleDownload}
            generatedFiles={generatedFiles}
          />
        )
      default:
        return null
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />
      <Main
        step={step}
        setStep={setStep}
        renderStepContent={renderStepContent}
        figmaData={figmaData}
        isProcessing={isProcessing}
        frames={frames}
      />
      <Footer />
    </main>
  )
}

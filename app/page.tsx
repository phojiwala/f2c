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
import {
  downloadImages,
  toCSSUnit,
  rgbaFromColor,
  generateHtmlFromNodes,
  generateCssFromStyles,
  enhanceComponentStyles,
} from '@/lib/utils'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import Main from '@/components/Main'
import Step1 from '@/components/Step1'
import Step2 from '@/components/Step2'
import Step3 from '@/components/Step3'

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

  const FIGMA_ACCESS_TOKEN = process.env.NEXT_PUBLIC_FIGMA_ACCESS_TOKEN

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

  const handleProcessClick = async () => {
    const fileKey = extractFileKey(figmaUrl)
    if (!fileKey) {
      toast({
        title: 'Invalid URL',
        description: 'Please enter a valid Figma file URL.',
        variant: 'destructive',
      })
      return { success: false }
    }

    try {
      await fetchFigmaFile(fileKey)
      // Wait for state update
      await new Promise((resolve) => setTimeout(resolve, 100))

      return {
        success: true,
        data: {
          name: figmaData?.name || 'Untitled',
          components: figmaData?.components || 0,
          styles: figmaData?.styles || 0,
          thumbnailUrl: figmaData?.thumbnailUrl,
          url: figmaUrl,
        },
      }
    } catch (error) {
      console.error('Error processing Figma file:', error)
      toast({
        title: 'Error',
        description:
          'Failed to process Figma file. Please check the URL and try again.',
        variant: 'destructive',
      })
      return { success: false }
    }
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
              characters: child.characters,
              effects: child.effects,
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

  const generateCodeForSelectedFrames = () => {
    const selectedFrameNodes = frames.filter((frame) =>
      selectedFrames.includes(frame.id)
    )

    if (!selectedFrameNodes.length) {
      return {}
    }

    const generatedFiles = {}

    selectedFrameNodes.forEach((frame) => {
      // Use improved HTML generator
      const htmlContent = `<div class="frame-wrapper">
      ${generateHtmlFromNodes([frame])}
      </div>`;

      let cssContent = generateCssFromStyles(frame);
      cssContent = enhanceComponentStyles('generic', cssContent);

      const fullHtml = `<!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${frame.name || 'Figma Export'}</title>
          <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.5/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-SgOJa3DmI69IUzQ2PVdRZhwQ+dy64/BUtbMJw1MZ8t5HZApcHrRKUc4W0kG879m7" crossorigin="anonymous">
          <link rel="stylesheet" href="${frame.name.replace(/\s+/g, '-').toLowerCase()}.css">
        </head>
        <body>
          ${htmlContent}
          <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.5/dist/js/bootstrap.bundle.min.js" integrity="sha384-k6d4wzSIapyDyv1kpU366/PK5hCdSbCRGRCMv+eplOQJWyd1fbcAu9OCUj5zNLiq" crossorigin="anonymous"></script>
        </body>
      </html>`;

      const fullCss = `* {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        line-height: 1.5;
        color: #333;
      }

      ${cssContent}`;

      generatedFiles[frame.id] = { html: fullHtml, css: fullCss };
    });

    return generatedFiles;
  };

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

    const generatedFiles = generateCodeForSelectedFrames()
    setGeneratedFiles(generatedFiles)
    setStep(3)
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
      const zip = new JSZip()

      // Get the selected frame nodes
      const selectedFrameNodes = frames.filter((frame) =>
        selectedFrames.includes(frame.id)
      )

      // Add each frame's files to the zip
      selectedFrameNodes.forEach((frame) => {
        const frameFiles = generatedFiles[frame.id]
        if (!frameFiles) return

        const safeName = frame.name.replace(/\s+/g, '-').toLowerCase()

        if (outputType === 'html' || outputType === 'both') {
          zip.file(`${safeName}.html`, frameFiles.html)
        }
        if (outputType === 'css' || outputType === 'both') {
          zip.file(`${safeName}.css`, frameFiles.css)
        }
      })

      // Download images if needed
      if ((outputType === 'html' || outputType === 'both') && figmaUrl) {
        const fileKey = extractFileKey(figmaUrl)
        const accessToken = FIGMA_ACCESS_TOKEN

        if (fileKey && accessToken) {
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
            figmaUrl={figmaUrl}
            accessToken={FIGMA_ACCESS_TOKEN}
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
            selectedFrames={selectedFrames}
            frames={frames}
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

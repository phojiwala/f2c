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

    const detectComponentType = (frame) => {
      const name = frame.name.toLowerCase();
      const hasChildren = frame.children && frame.children.length > 0;

      // Check for login form
      if (name.includes('login') || name.includes('signin')) {
        return 'login-form';
      }

      // Add more component type detection as needed
      // if (name.includes('card') || name.includes('product')) return 'product-card';
      // if (name.includes('nav') || name.includes('header')) return 'navigation';

      return 'generic'; // Default type
    };

    // Apply component-specific enhancements
    // In the enhanceComponentStyles function
    const enhanceComponentStyles = (componentType, cssContent) => {
      if (componentType === 'login-form') {
        return `${cssContent}

        /* Login Form Styles */
        .login-form-container {
          background-color: white;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          padding: 32px;
          width: 100%;
          max-width: 400px;
          margin: 0 auto;
        }

        .login-title {
          font-size: 24px;
          font-weight: 600;
          text-align: center;
          margin-bottom: 24px;
          color: #333;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .input-group label {
          font-size: 14px;
          font-weight: 500;
          color: #333;
        }

        .form-input {
          padding: 10px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          width: 100%;
        }

        .form-input:focus {
          border-color: #003966;
          outline: none;
        }

        .remember-me-container {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: 8px 0;
        }

        .remember-me {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          cursor: pointer;
        }

        .remember-checkbox {
          width: 16px;
          height: 16px;
        }

        .login-button {
          background-color: #003966;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 12px;
          font-weight: 600;
          cursor: pointer;
          width: 100%;
          margin-top: 8px;
        }

        .login-button:hover {
          background-color: #002b4d;
        }

        .forgot-password {
          color: #003966;
          text-decoration: none;
          font-size: 14px;
        }

        .forgot-password:hover {
          text-decoration: underline;
        }

        /* Center the login form in the page */
        .frame-wrapper {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          padding: 20px;
        }`;
      }

      return cssContent;
    };

    const htmlContent = selectedFrameNodes
      .map((frame) => {
        const componentType = detectComponentType(frame);

        if (componentType === 'login-form') {
          return `<div class="frame-wrapper">
            ${generateHtmlFromNodes([frame])}
          </div>`;
        }

        return `<div class="frame-wrapper">
          ${generateHtmlFromNodes([frame])}
        </div>`;
      })
      .join('\n\n');

    let cssContent = selectedFrameNodes
      .map((frame) => generateCssFromStyles(frame))
      .join('\n\n');

    // Enhance CSS based on detected component types
    for (const frame of selectedFrameNodes) {
      const componentType = detectComponentType(frame);
      cssContent = enhanceComponentStyles(componentType, cssContent);
    }

    const fullHtml = `<!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${figmaData?.name || 'Figma Export'}</title>
          <link rel="stylesheet" href="styles.css">
      </head>
      <body>
          ${htmlContent}
      </body>
      </html>`

    const fullCss = `
      /* Reset and base styles */
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        line-height: 1.5;
        color: #333;
      }

      /* Generated styles */
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

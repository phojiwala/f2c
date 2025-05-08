import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { Code, Eye, Download, Copy, Check, Maximize2 } from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function Step3({
  outputType,
  setOutputType,
  setStep,
  isProcessing,
  handleDownload,
  generatedFiles,
  selectedFrames,
  frames,
}) {
  const [activeTab, setActiveTab] = useState('html')
  const [previewTab, setPreviewTab] = useState('code')
  const [selectedFrameId, setSelectedFrameId] = useState(
    selectedFrames[0] || ''
  )
  const [copied, setCopied] = useState({ html: false, css: false })
  const iframeRef = useRef(null)

  const selectedFrame = frames.find((frame) => frame.id === selectedFrameId)
  const selectedFrameName = selectedFrame?.name || 'Frame'

  useEffect(() => {
    const updateIframe = () => {
      if (iframeRef.current && generatedFiles[selectedFrameId]) {
        const iframe = iframeRef.current
        const iframeDoc =
          iframe.contentDocument || iframe.contentWindow.document

        const formattedHtml = generatedFiles[selectedFrameId].html
          .replace(/></g, '>\n<')
          .split('\n')
          .map((line) => line.trim())
          .map((line, i, arr) => {
            let indent = 0
            if (i > 0) {
              for (let j = 0; j < i; j++) {
                const prevLine = arr[j]
                if (prevLine.match(/<[^/][^>]*[^/]>$/)) indent++
                if (prevLine.match(/<\//)) indent--
              }
              if (line.match(/<[^>]+\/>/)) indent = Math.max(0, indent)
              if (line.match(/<\//)) indent = Math.max(0, indent - 1)
            }
            return '  '.repeat(Math.max(0, indent)) + line
          })
          .join('\n')

        const formattedCss = generatedFiles[selectedFrameId].css
          .split('}')
          .map((block) => {
            if (!block.trim()) return ''
            const [selector, rules] = block.split('{')
            if (!rules) return ''
            return `${selector.trim()} {\n${rules
              .split(';')
              .map((rule) => rule.trim())
              .filter(Boolean)
              .map((rule) => `  ${rule};`)
              .join('\n')}\n}`
          })
          .filter(Boolean)
          .join('\n\n')

        const htmlWithInlineCSS = formattedHtml.replace(
          /<link rel="stylesheet" href=".*?\.css">/,
          `<style>\n${formattedCss}\n</style>`
        )

        iframeDoc.open()
        iframeDoc.write(htmlWithInlineCSS)
        iframeDoc.close()
      }
    }

    if (previewTab === 'preview') {
      setTimeout(updateIframe, 50)
    }
  }, [generatedFiles, previewTab, selectedFrameId])

  const handleCopy = (type) => {
    const textToCopy =
      type === 'html'
        ? generatedFiles[selectedFrameId]?.html
        : generatedFiles[selectedFrameId]?.css

    if (textToCopy) {
      navigator.clipboard
        .writeText(textToCopy)
        .then(() => {
          setCopied({ ...copied, [type]: true })
          setTimeout(() => setCopied({ ...copied, [type]: false }), 2000)
        })
        .catch((err) => console.error('Failed to copy: ', err))
    }
  }

  const [isFullscreen, setIsFullscreen] = useState(false)
  const previewContainerRef = useRef(null)

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      previewContainerRef.current?.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Download Options</h2>
        <p className="text-muted-foreground">
          Choose your output format and download the generated code.
        </p>
      </div>

      {selectedFrames.length > 1 && (
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Select Frame</label>
          <Select value={selectedFrameId} onValueChange={setSelectedFrameId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a frame" />
            </SelectTrigger>
            <SelectContent>
              {selectedFrames.map((frameId) => {
                const frame = frames.find((f) => f.id === frameId)
                return (
                  <SelectItem key={frameId} value={frameId}>
                    {frame?.name || frameId}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>
      )}

      <Tabs
        defaultValue="code"
        value={previewTab}
        onValueChange={setPreviewTab}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="code" className="flex items-center gap-2">
            <Code size={16} /> Code
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex items-center gap-2">
            <Eye size={16} /> Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="code" className="mt-4">
          <Tabs
            defaultValue="html"
            value={activeTab}
            onValueChange={setActiveTab}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="html">HTML</TabsTrigger>
              <TabsTrigger value="css">CSS</TabsTrigger>
            </TabsList>
            <TabsContent value="html" className="mt-4">
              <Card className="p-0 overflow-hidden relative">
                <div className="absolute top-2 right-2 z-10">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleCopy('html')}
                    className="h-8 w-8 rounded-full bg-background/90 backdrop-blur-sm"
                  >
                    {copied.html ? (
                      <Check size={16} className="text-green-500" />
                    ) : (
                      <Copy size={16} />
                    )}
                  </Button>
                </div>
                <SyntaxHighlighter
                  language="html"
                  style={vscDarkPlus}
                  showLineNumbers
                  customStyle={{ margin: 0, borderRadius: '0.5rem' }}
                >
                  {generatedFiles[selectedFrameId]?.html ||
                    '// No HTML generated yet'}
                </SyntaxHighlighter>
              </Card>
            </TabsContent>
            <TabsContent value="css" className="mt-4">
              <Card className="p-0 overflow-hidden relative">
                <div className="absolute top-2 right-2 z-10">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleCopy('css')}
                    className="h-8 w-8 rounded-full bg-background/90 backdrop-blur-sm"
                  >
                    {copied.css ? (
                      <Check size={16} className="text-green-500" />
                    ) : (
                      <Copy size={16} />
                    )}
                  </Button>
                </div>
                <SyntaxHighlighter
                  language="css"
                  style={vscDarkPlus}
                  showLineNumbers
                  customStyle={{ margin: 0, borderRadius: '0.5rem' }}
                >
                  {generatedFiles[selectedFrameId]?.css ||
                    '/* No CSS generated yet */'}
                </SyntaxHighlighter>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="preview" className="mt-4">
          <Card
            className="relative w-full overflow-hidden"
            ref={previewContainerRef}
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              className="absolute top-5 right-5 h-8 w-8 rounded-full bg-gray-400"
            >
              <Maximize2 size={16} />
            </Button>
            <iframe
              ref={iframeRef}
              className={`w-full border-0 ${
                isFullscreen ? 'h-screen' : 'h-[600px]'
              }`}
              title="Generated Code Preview"
            />
          </Card>
        </TabsContent>
      </Tabs>

      <div className="space-y-4">
        <div className="flex flex-col space-y-2">
          <h3 className="text-lg font-medium">Output Format</h3>
          <Tabs
            defaultValue="both"
            value={outputType}
            onValueChange={setOutputType}
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="html">HTML Only</TabsTrigger>
              <TabsTrigger value="css">CSS Only</TabsTrigger>
              <TabsTrigger value="both">HTML & CSS</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep(2)}>
          Back
        </Button>
        <Button
          onClick={handleDownload}
          disabled={isProcessing}
          className="flex items-center gap-2"
        >
          {isProcessing ? (
            'Processing...'
          ) : (
            <>
              Download{' '}
              {selectedFrames.length > 1 ? `(${selectedFrames.length})` : ''}
              <Download size={16} />
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

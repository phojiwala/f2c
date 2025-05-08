import React, { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { fetchFrameThumbnails } from '@/lib/figma-api'
import { useToast } from '@/hooks/use-toast'

export default function Step2({
  frames,
  selectedFrames,
  setSelectedFrames,
  setStep,
  handleFrameSelection,
  handleProceedToOutput,
  isProcessing,
  figmaUrl,
  accessToken,
}) {
  const [thumbnails, setThumbnails] = useState(new Map())
  const [isLoadingThumbnails, setIsLoadingThumbnails] = useState(false)
  const { toast } = useToast()

  const extractFileKey = (url) => {
    const regex = /figma\.com\/(file|design)\/([a-zA-Z0-9]+)/
    const match = url.match(regex)
    return match ? match[2] : null
  }

  useEffect(() => {
    const loadThumbnails = async () => {
      if (!frames.length) return

      setIsLoadingThumbnails(true)
      const fileKey = extractFileKey(figmaUrl)

      if (!fileKey) {
        console.error('Could not extract file key from URL')
        setIsLoadingThumbnails(false)
        return
      }

      try {
        const nodeIds = frames.map((frame) => frame.id)
        const thumbnailMap = await fetchFrameThumbnails(
          fileKey,
          nodeIds,
          accessToken
        )
        setThumbnails(thumbnailMap)
      } catch (error) {
        console.error('Error loading thumbnails:', error)
        toast({
          title: 'Thumbnail Loading Error',
          description: 'Could not load frame thumbnails.',
          variant: 'destructive',
        })
      } finally {
        setIsLoadingThumbnails(false)
      }
    }
    loadThumbnails()
  }, [frames, figmaUrl, accessToken, toast])

  const handleSelectAll = () => {
    if (selectedFrames.length === frames.length) {
      setSelectedFrames([])
    } else {
      setSelectedFrames(frames.map((frame) => frame.id))
    }
  }

  const allFramesSelected =
    frames.length > 0 && selectedFrames.length === frames.length

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Select Frames or Components</h2>
        <p className="text-muted-foreground">
          Choose which frames or components you want to convert to code.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {frames.map((frame) => (
          <Card
            key={frame.id}
            className={`p-4 cursor-pointer transition-all ${
              selectedFrames.includes(frame.id)
                ? 'outline outline-primary outline-2'
                : 'hover:border-gray-300'
            }`}
            onClick={() => handleFrameSelection(frame.id)}
          >
            <div className="flex flex-col space-y-3">
              <div className="flex items-center space-x-3">
                <Checkbox
                  checked={selectedFrames.includes(frame.id)}
                  onCheckedChange={() => handleFrameSelection(frame.id)}
                />
                <div className="font-medium">{frame.name}</div>
              </div>

              <div className="w-full aspect-video bg-gray-100 rounded-md overflow-hidden">
                {isLoadingThumbnails ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : thumbnails.has(frame.id) ? (
                  <img
                    src={thumbnails.get(frame.id)}
                    alt={frame.name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    No preview
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep(1)}>
          Back
        </Button>
        <div>
          {frames.length > 0 && (
            <Button variant="link" onClick={handleSelectAll}>
              {allFramesSelected ? 'Deselect All' : 'Select All'}
            </Button>
          )}
          <Button
            onClick={handleProceedToOutput}
            disabled={selectedFrames.length === 0 || isProcessing}
          >
            {isProcessing ? 'Processing...' : 'Generate Code'}
          </Button>
        </div>
      </div>
    </div>
  )
}

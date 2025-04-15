import React from 'react'
import FeatureCard from './FeatureCard'
import { Code, Download, Eye } from 'lucide-react'
import { Card } from './ui/card'
import { Button } from './ui/button'

export default function Main({ step, renderStepContent, figmaData, isProcessing, frames, setStep }) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {step === 1 && (
        <div className="text-center mb-16">
          <h1 className="text-4xl font-extrabold tracking-tight text-primary sm:text-5xl lg:text-6xl">
            Transform Your Designs
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground max-w-md mx-auto">
            Enter a Figma file URL to load frames, then select frames and export
            them as HTML & CSS code.
          </p>
        </div>
      )}

      <div>{renderStepContent()}</div>

      {/* {figmaData && (step === 1 || step === 2) && !isProcessing && (
        <div className="mt-12 w-full max-w-md mx-auto">
          <Card className="p-6 shadow-md">
            <h3 className="text-lg font-semibold mb-4 border-b pb-2">
              {figmaData.name}
            </h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                Last Modified:{' '}
                {new Date(figmaData.lastModified).toLocaleString()}
              </p>
              <p>Components: {figmaData.components}</p>
              <p>Styles: {figmaData.styles}</p>
              {figmaData.thumbnailUrl && (
                <img
                  src={figmaData.thumbnailUrl}
                  alt="Figma File Preview"
                  className="mt-4 rounded-md w-full border border-border"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              )}
            </div>
            {step === 1 && frames.length > 0 && (
              <Button onClick={() => setStep(2)} className="w-full mt-4">
                Select Frames ({frames.length})
              </Button>
            )}
          </Card>
        </div>
      )} */}

      {step === 1 && (
        <div className="mt-20">
          <h2 className="text-center text-2xl font-semibold mb-8">
            How it Works
          </h2>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<Download className="h-6 w-6 text-primary" />}
              title="1. Enter URL & Submit"
              description="Paste your Figma file URL and Access Token. Choose the frames or components you need."
            />
            <FeatureCard
              icon={<Code className="h-6 w-6 text-primary" />}
              title="2. Select Frame"
              description="Get the frame based on your Figma design's properties and layout."
            />
            <FeatureCard
              icon={<Eye className="h-6 w-6 text-primary" />}
              title="3. Preview & Download"
              description="Download a ZIP file with HTML, CSS, and images. Refine the code for production use."
            />
          </div>
        </div>
      )}
    </div>
  )
}

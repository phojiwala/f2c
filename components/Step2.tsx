import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export default function Step2({
  frames,
  selectedFrames,
  setSelectedFrames,
  setStep,
  handleProceedToOutput,
  isProcessing,
  setFigmaData,
  setFrames,
  handleFrameSelection 
}) {
  return (
    <div className="mt-8 w-full">
      <h2 className="text-2xl font-bold mb-4 text-center sm:text-left">
        Select Frames or Components
      </h2>
      <p className="text-muted-foreground mb-6 text-center sm:text-left">
        Choose the items you want to convert to code.
      </p>
      {frames.length === 0 && !isProcessing && (
        <p className="text-center text-red-500">
          No frames or components found in the loaded file.
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        {frames.map((frame) => (
          <Card
            key={frame.id}
            className={`p-4 cursor-pointer transition-all border-2 ${
              selectedFrames.includes(frame.id)
                ? 'border-primary ring-2 ring-primary ring-offset-2'
                : 'border-border hover:border-muted-foreground/50'
            }`}
            onClick={() => handleFrameSelection(frame.id)}
          >
            <div className="flex items-center space-x-3">
              <Checkbox
                id={`frame-${frame.id}`}
                checked={selectedFrames.includes(frame.id)}
                onCheckedChange={() => handleFrameSelection(frame.id)}
                aria-labelledby={`label-${frame.id}`}
              />
              <Label
                htmlFor={`frame-${frame.id}`}
                id={`label-${frame.id}`}
                className="font-medium truncate cursor-pointer"
              >
                {frame.name || `Untitled ${frame.type}`}
              </Label>
            </div>
          </Card>
        ))}
      </div>
      <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
        <Button
          onClick={() => {
            setStep(1)
            setFigmaData(null)
            setFrames([])
            setSelectedFrames([])
          }}
          variant="outline"
        >
          Back to Input
        </Button>
        <Button
          onClick={handleProceedToOutput}
          disabled={selectedFrames.length === 0 || isProcessing}
        >
          Continue ({selectedFrames.length} selected)
        </Button>
      </div>
    </div>
  )
}

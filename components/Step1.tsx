import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function Step1({ figmaUrl, setFigmaUrl, isProcessing, handleProcessClick }) {
  return (
    <div className="flex flex-col items-center justify-center space-y-4 w-full max-w-lg mx-auto">
      <div className="w-full space-y-2">
        <Label htmlFor="figmaUrl">Figma URL</Label>
        <Input
          id="figmaUrl"
          type="text"
          placeholder="Enter Figma URL (e.g., https://www.figma.com/...)"
          value={figmaUrl}
          onChange={(e) => setFigmaUrl(e.target.value)}
          className="w-full"
          disabled={isProcessing}
        />
      </div>
      <Button
        onClick={handleProcessClick}
        disabled={!figmaUrl || isProcessing}
        className="w-full sm:w-auto"
      >
        {isProcessing ? 'Processing...' : 'Submit'}
      </Button>
    </div>
  )
}

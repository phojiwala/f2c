import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Copy } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function Step3({
  outputType,
  setOutputType,
  setStep,
  isProcessing,
  handleDownload,
  generatedFiles,
}) {
  const { toast } = useToast()

  const handleCopy = (text) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast({ title: 'Copied to clipboard' })
      })
      .catch((err) => {
        console.error('Failed to copy: ', err)
      })
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-center">Download Options</h2>
      <Tabs
        defaultValue={outputType}
        onValueChange={(value) => setOutputType(value)}
      >
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="html">HTML Only</TabsTrigger>
          <TabsTrigger value="css">CSS Only</TabsTrigger>
          <TabsTrigger value="both">HTML & CSS</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="mt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
        <Button
          onClick={() => setStep(2)}
          variant="outline"
          disabled={isProcessing}
        >
          Back to Selection
        </Button>
        <Button onClick={handleDownload} disabled={isProcessing}>
          {isProcessing ? 'Generating ZIP...' : 'Download ZIP'}
        </Button>
      </div>
      <section>
        <div className="mt-6">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold">HTML Preview</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCopy(generatedFiles.html)}
              className="text-muted-foreground hover:text-primary"
            >
              <Copy className="h-4 w-4 mr-1" />
              Copy
            </Button>
          </div>
          <pre className="bg-muted p-4 rounded-md text-xs overflow-auto max-h-60">
            <code>{generatedFiles.html}</code>
          </pre>
        </div>
        <div className="mt-6">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold">CSS Preview</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCopy(generatedFiles.css)}
              className="text-muted-foreground hover:text-primary"
            >
              <Copy className="h-4 w-4 mr-1" />
              Copy
            </Button>
          </div>
          <pre className="bg-muted p-4 rounded-md text-xs overflow-auto max-h-60">
            <code>{generatedFiles.css}</code>
          </pre>
        </div>
      </section>
    </div>
  )
}

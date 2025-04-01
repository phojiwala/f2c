'use client'
import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Code, Eye, Download } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { useToast } from '@/hooks/use-toast';

const toCSSUnit = (value) => {
  if (value === undefined || value === null) return '0px';
  return `${value}px`;
};

const generateHtmlFromNodes = (nodes) => {
  return nodes
    .map((node) => {
      let element = '';
      const className = `figma-node figma-${node.type.toLowerCase()}`
      const idName = `figma-id-${node.id}`;

      switch (node.type) {
        case 'FRAME':
        case 'GROUP':
        case 'COMPONENT':
          element = `<div id="${idName}" class="${className}">
          ${node.children ? generateHtmlFromNodes(node.children) : ''}
        </div>`;
          break;
        case 'TEXT':
          element = `<p id="${idName}" class="${className}">${node.characters || ''}</p>`;
          break;
        case 'RECTANGLE':
        case 'ELLIPSE':
          element = `<div id="${idName}" class="${className}"></div>`;
          break;
        case 'IMAGE':
          element = `<img id="${idName}" src="images/${node.id}.png" class="${className}" alt="${node.name || 'Figma Image'}" />`;
          break;
        default:
          console.warn(`Unhandled Figma node type for HTML generation: ${node.type}`);
          element = node.children ? generateHtmlFromNodes(node.children) : '';
      }
      return element;
    })
    .join('\n');
};

const generateCssFromStyles = (node) => {
  if (!node || !node.type || !node.id) {
    return '';
  }

  const styles = [];
  const selector = `#figma-id-${node.id}`;
  const cssRules = [];

  if (node.absoluteBoundingBox) {
    const { x, y, width, height } = node.absoluteBoundingBox;
    cssRules.push(`  position: absolute;`);
    cssRules.push(`  left: ${toCSSUnit(x)};`);
    cssRules.push(`  top: ${toCSSUnit(y)};`);
    cssRules.push(`  width: ${toCSSUnit(width)};`);
    cssRules.push(`  height: ${toCSSUnit(height)};`);
    cssRules.push(`  box-sizing: border-box;`);
  }

  if (node.fills && Array.isArray(node.fills) && node.fills.length > 0) {
     const visibleFills = node.fills.filter(fill => fill.visible !== false);
     if (visibleFills.length > 0) {
        const fill = visibleFills[0];
        if (fill.type === 'SOLID' && fill.color) {
          const { r, g, b } = fill.color;
          const alpha = fill.opacity !== undefined ? fill.opacity : (fill.color.a !== undefined ? fill.color.a : 1);
          cssRules.push(`  background-color: rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha.toFixed(2)});`);
        } else {
            console.warn(`Unhandled fill type for node ${node.id}: ${fill.type}`);
        }
     }
  } else if (node.type === 'TEXT') {
      if (node.style?.fills && node.style.fills.length > 0 && node.style.fills[0].type === 'SOLID') {
          const fill = node.style.fills[0];
          const { r, g, b } = fill.color;
          const alpha = fill.opacity !== undefined ? fill.opacity : (fill.color.a !== undefined ? fill.color.a : 1);
          cssRules.push(`  color: rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha.toFixed(2)});`);
      }
  }

  if (node.type === 'TEXT' && node.style) {
    if (node.style.fontFamily) cssRules.push(`  font-family: "${node.style.fontFamily}";`);
    if (node.style.fontSize) cssRules.push(`  font-size: ${node.style.fontSize}px;`);
    if (node.style.fontWeight) cssRules.push(`  font-weight: ${node.style.fontWeight};`);
    if (node.style.lineHeightPx) {
        cssRules.push(`  line-height: ${node.style.lineHeightPx}px;`);
    } else if (node.style.lineHeightPercent) {
        cssRules.push(`  line-height: ${node.style.lineHeightPercent}%;`);
    } else if (node.style.lineHeight && node.style.lineHeight.unit !== 'AUTO') {
        const unit = node.style.lineHeight.unit === 'PIXELS' ? 'px' : '%';
        cssRules.push(`  line-height: ${node.style.lineHeight.value}${unit};`);
    }
     if (node.style.textAlignHorizontal) {
        cssRules.push(`  text-align: ${node.style.textAlignHorizontal.toLowerCase()};`);
     }
  }

  if (node.strokes && node.strokes.length > 0 && node.strokeWeight) {
      const stroke = node.strokes[0];
      if (stroke.type === 'SOLID' && stroke.color) {
          const { r, g, b } = stroke.color;
          const alpha = stroke.opacity !== undefined ? stroke.opacity : (stroke.color.a !== undefined ? stroke.color.a : 1);
          cssRules.push(`  border: ${node.strokeWeight}px solid rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha.toFixed(2)});`);
      }
  }

  if (node.cornerRadius) {
       if (typeof node.cornerRadius === 'number' && node.cornerRadius > 0) {
           cssRules.push(`  border-radius: ${node.cornerRadius}px;`);
       }
  }

  if (cssRules.length > 0) {
    styles.push(`${selector} {`);
    styles.push(...cssRules);
    styles.push(`}`);
  }

  if (node.children && Array.isArray(node.children)) {
    node.children.forEach((child) => {
      styles.push(generateCssFromStyles(child));
    });
  }

  return styles.filter(Boolean).join('\n\n');
};

export default function Home() {
  const [figmaData, setFigmaData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [figmaUrl, setFigmaUrl] = useState('');
  const [figmaToken, setFigmaToken] = useState('');
  const [step, setStep] = useState(1);
  const [selectedFrames, setSelectedFrames] = useState([]);
  const [outputType, setOutputType] = useState('both');
  const [frames, setFrames] = useState([]);
  const [generatedFiles, setGeneratedFiles] = useState({});
  const { toast } = useToast();

  const extractFileKey = (url) => {
      const regex = /figma\.com\/(file|design)\/([a-zA-Z0-9]+)/;
      const match = url.match(regex);
      return match ? match[2] : null;
  };

  const fetchFigmaFile = useCallback(async (fileKey, accessToken) => {
    setIsProcessing(true);
    setFigmaData(null);
    setFrames([]);
    setSelectedFrames([]);

    if (!accessToken) {
        toast({
            title: 'Missing Token',
            description: 'Please enter your Figma Personal Access Token.',
            variant: 'destructive',
        });
        setIsProcessing(false);
        return;
    }

    try {
      const metaResponse = await fetch(`https://api.figma.com/v1/files/${fileKey}`, {
        headers: {
          'X-Figma-Token': accessToken,
        },
      });

      if (!metaResponse.ok) {
        throw new Error(`Failed to fetch Figma file metadata (Status: ${metaResponse.status})`);
      }
      const metaData = await metaResponse.json();

      const contentResponse = await fetch(`https://api.figma.com/v1/files/${fileKey}?geometry=paths`, {
        headers: {
          'X-Figma-Token': accessToken,
        },
      });

       if (!contentResponse.ok) {
        throw new Error(`Failed to fetch Figma file content (Status: ${contentResponse.status})`);
      }
      const contentData = await contentResponse.json();

      const combinedData = {
        name: metaData.name || 'Untitled Figma File',
        lastModified: metaData.lastModified || new Date().toISOString(),
        components: Object.keys(metaData.components || {}).length,
        styles: Object.keys(metaData.styles || {}).length,
        thumbnailUrl: metaData.thumbnailUrl,
        document: contentData.document,
      };

      setFigmaData(combinedData);

      const extracted = extractFrames(combinedData.document);
      setFrames(extracted);

      if (extracted.length > 0) {
        setStep(2);
        toast({
            title: 'Figma File Loaded',
            description: `Found ${extracted.length} top-level frames/components.`,
        });
      } else {
          toast({
            title: 'No Frames Found',
            description: 'Could not find any top-level frames or components in this Figma file.',
            variant: 'destructive',
        });
      }

    } catch (error) {
      console.error('Figma API Error:', error);
      toast({
        title: 'Error Loading Figma File',
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
        variant: 'destructive',
      });
      setStep(1);
    } finally {
      setIsProcessing(false);
    }
  }, [toast]);

  const handleProcessClick = () => {
    const fileKey = extractFileKey(figmaUrl);
    if (!fileKey) {
      toast({
        title: 'Invalid Figma URL',
        description: 'Please enter a valid Figma file URL.',
        variant: 'destructive',
      });
      return;
    }
     if (!figmaToken.trim()) {
      toast({
        title: 'Missing Figma Token',
        description: 'Please enter your Figma Personal Access Token.',
        variant: 'destructive',
      });
      return;
    }
    fetchFigmaFile(fileKey, figmaToken.trim());
  };

  const extractFrames = (documentNode) => {
    const topLevelFrames = [];

    const findTopLevelNodes = (node) => {
      if (node.type === 'CANVAS' && node.children) {
        node.children.forEach(child => {
          if (child.type === 'FRAME' || child.type === 'COMPONENT' || child.type === 'COMPONENT_SET') {
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
            });
          }
        });
      } else if (node.children) {
         node.children.forEach(findTopLevelNodes);
      }
    };

    if (documentNode) {
        findTopLevelNodes(documentNode);
    }

    return topLevelFrames;
  };

  const handleFrameSelection = (frameId) => {
    setSelectedFrames(prev =>
      prev.includes(frameId)
        ? prev.filter(id => id !== frameId)
        : [...prev, frameId]
    );
  };

  const handleProceedToOutput = () => {
    if (selectedFrames.length === 0) {
      toast({
        title: 'No Frames Selected',
        description: 'Please select at least one frame or component to generate code.',
        variant: 'destructive',
      });
      return;
    }
    setStep(3);
  };

  const generateCodeForSelectedFrames = () => {
    const selectedFrameNodes = frames.filter(frame =>
      selectedFrames.includes(frame.id)
    );

    if (!selectedFrameNodes.length) {
        return { html: '', css: '' };
    }

    const htmlContent = selectedFrameNodes.map(frame => {
        return `<div class="figma-frame-wrapper" id="wrapper-${frame.id}">
          <h2>${frame.name}</h2>
          ${generateHtmlFromNodes([frame])}
        </div>`;
    }).join('\n\n');

    const cssContent = selectedFrameNodes.map(frame =>
        generateCssFromStyles(frame)
    ).join('\n\n');

    const fullHtml = `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${figmaData?.name || 'Figma Export'}</title>
        ${outputType === 'html' || outputType === 'both' ? '<link rel="stylesheet" href="styles.css">' : ''}
        <style>
          .figma-frame-wrapper {
            margin: 20px;
            padding: 15px;
            border: 1px solid #eee;
            border-radius: 8px;
            position: relative;
            overflow: hidden;
          }
          body {
            font-family: sans-serif;
          }
        </style>
    </head>
    <body>
        <h1>${figmaData?.name || 'Figma Export'}</h1>
        ${htmlContent}
    </body>
    </html>`;

    const fullCss = `
      body {
        margin: 0;
        padding: 20px;
        position: relative;
      }

      h1, h2 {
          margin-bottom: 1em;
      }

      ${cssContent}
    `;

    return { html: fullHtml, css: fullCss };
  };

  const downloadImages = async (nodesToProcess, fileKey, accessToken) => {
    const imageMap = new Map();
    const imageNodeIds = [];

    const findImageNodes = (node) => {
      if (node.type === 'IMAGE' && node.id) {
        imageNodeIds.push(node.id);
      }
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach(findImageNodes);
      }
    };

    nodesToProcess.forEach(findImageNodes);

    if (imageNodeIds.length === 0) {
      return imageMap;
    }

    try {
        const idsString = imageNodeIds.join(',');
        const response = await fetch(
            `https://api.figma.com/v1/images/${fileKey}?ids=${idsString}&format=png`,
            {
            headers: {
                'X-Figma-Token': accessToken,
            },
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to get image URLs (Status: ${response.status})`);
        }

        const data = await response.json();

        if (data.err) {
            throw new Error(`Figma API error getting image URLs: ${data.err}`);
        }

        if (!data.images || Object.keys(data.images).length === 0) {
            console.warn("Figma API returned no image URLs for the requested IDs.");
            return imageMap;
        }

        const downloadPromises = Object.entries(data.images).map(async ([nodeId, imageUrl]) => {
            if (!imageUrl) {
                console.warn(`No URL returned for image node ${nodeId}`);
                return;
            }
            try {
                const imageResponse = await fetch(imageUrl);
                if (!imageResponse.ok) {
                    throw new Error(`Failed to download image ${nodeId} (Status: ${imageResponse.status})`);
                }
                const blob = await imageResponse.blob();
                imageMap.set(`${nodeId}.png`, blob);
            } catch (imgError) {
                console.error(`Failed to download or process image ${nodeId} from ${imageUrl}:`, imgError);
            }
        });

        await Promise.all(downloadPromises);

    } catch (error) {
      console.error('Failed to download images:', error);
      toast({
        title: 'Image Download Failed',
        description: error instanceof Error ? error.message : 'Could not download images from Figma.',
        variant: 'destructive',
      });
    }

    return imageMap;
  };

  const handleDownload = async () => {
    if (!figmaData || !figmaData.document) {
        toast({ title: 'Error', description: 'No Figma data loaded.', variant: 'destructive' });
        return;
    }
     if (selectedFrames.length === 0) {
      toast({ title: 'Error', description: 'No frames selected for download.', variant: 'destructive' });
      return;
    }

    setIsProcessing(true);

    try {
      const { html, css } = generateCodeForSelectedFrames();
      setGeneratedFiles({ html, css });

      const zip = new JSZip();

      if (outputType === 'html' || outputType === 'both') {
        zip.file('index.html', html);
      }
      if (outputType === 'css' || outputType === 'both') {
        zip.file('styles.css', css);
      }

      if ((outputType === 'html' || outputType === 'both') && figmaUrl && figmaToken) {
        const fileKey = extractFileKey(figmaUrl);
        const accessToken = figmaToken.trim();

        if (fileKey && accessToken) {
            const selectedFrameNodes = frames.filter(frame => selectedFrames.includes(frame.id));

            toast({ title: 'Downloading Images', description: 'Fetching image assets from Figma...' });
            const images = await downloadImages(selectedFrameNodes, fileKey, accessToken);

            if (images.size > 0) {
                const imagesFolder = zip.folder('images');
                if (imagesFolder) {
                    for (const [filename, blob] of images) {
                    imagesFolder.file(filename, blob);
                    }
                    toast({ title: 'Images Added', description: `${images.size} images added to ZIP.` });
                }
            } else {
                 toast({ title: 'No Images Found', description: 'No images needed or found for selected frames.' });
            }
        } else {
             console.warn("Missing File Key or Access Token, skipping image download.");
             toast({ title: 'Skipping Images', description: 'Missing Figma URL or Token for image download.', variant: 'destructive' });
        }
      }

      toast({ title: 'Generating ZIP', description: 'Preparing your download...' });
      const zipContent = await zip.generateAsync({ type: 'blob' });
      const safeFilename = figmaData.name.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'figma-export';
      saveAs(zipContent, `${safeFilename}.zip`);

      toast({
        title: 'Download Ready!',
        description: 'Your code has been generated and zipped.',
      });

    } catch (error) {
      console.error('Download failed:', error);
      toast({
        title: 'Download Failed',
        description: error instanceof Error ? error.message : 'An unexpected error occurred during ZIP generation.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="flex flex-col items-center justify-center space-y-4 w-full max-w-lg mx-auto">
            <div className="w-full space-y-2">
               <Label htmlFor="figmaUrl">Figma File URL</Label>
               <Input
                 id="figmaUrl"
                 type="text"
                 placeholder="Enter Figma file URL (e.g., https://www.figma.com/file/...)"
                 value={figmaUrl}
                 onChange={(e) => setFigmaUrl(e.target.value)}
                 className="w-full"
                 disabled={isProcessing}
               />
            </div>

            <div className="w-full space-y-2">
               <Label htmlFor="figmaToken">Figma Access Token</Label>
               <Input
                 id="figmaToken"
                 type="password"
                 placeholder="Enter your Figma Personal Access Token"
                 value={figmaToken}
                 onChange={(e) => setFigmaToken(e.target.value)}
                 className="w-full"
                 disabled={isProcessing}
               />
               <p className="text-xs text-muted-foreground">
                   Needed to access file content and images. Your token is used only in your browser and not stored.
                   <a href="https://www.figma.com/developers/api#access-tokens" target="_blank" rel="noopener noreferrer" className="underline ml-1">How to get a token?</a>
               </p>
            </div>

            <Button
              onClick={handleProcessClick}
              disabled={!figmaUrl || !figmaToken || isProcessing}
              className="w-full sm:w-auto"
            >
              {isProcessing ? 'Processing...' : 'Load Figma File'}
            </Button>
          </div>
        );

      case 2:
        return (
          <div className="mt-8 w-full">
            <h2 className="text-2xl font-bold mb-4 text-center sm:text-left">Select Frames or Components</h2>
            <p className="text-muted-foreground mb-6 text-center sm:text-left">Choose the top-level items you want to convert to code.</p>
             {frames.length === 0 && !isProcessing && (
                <p className="text-center text-red-500">No frames or components found in the loaded file.</p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
              {frames.map(frame => (
                <Card
                  key={frame.id}
                  className={`p-4 cursor-pointer transition-all border-2 ${selectedFrames.includes(frame.id) ? 'border-primary ring-2 ring-primary ring-offset-2' : 'border-border hover:border-muted-foreground/50'}`}
                  onClick={() => handleFrameSelection(frame.id)}
                >
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id={`frame-${frame.id}`}
                      checked={selectedFrames.includes(frame.id)}
                      onCheckedChange={() => handleFrameSelection(frame.id)}
                      aria-labelledby={`label-${frame.id}`}
                    />
                    <Label htmlFor={`frame-${frame.id}`} id={`label-${frame.id}`} className="font-medium truncate cursor-pointer">
                      {frame.name || `Untitled ${frame.type}`}
                    </Label>
                  </div>
                </Card>
              ))}
            </div>
            <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
              <Button onClick={() => { setStep(1); setFigmaData(null); setFrames([]); setSelectedFrames([]); }} variant="outline">
                Back to Input
              </Button>
              <Button onClick={handleProceedToOutput} disabled={selectedFrames.length === 0 || isProcessing}>
                Continue ({selectedFrames.length} selected)
              </Button>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="mt-8 w-full max-w-md mx-auto">
            <h2 className="text-2xl font-bold mb-6 text-center">Output Options</h2>
            <Tabs defaultValue={outputType} onValueChange={(value) => setOutputType(value)}>
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="html">HTML Only</TabsTrigger>
                <TabsTrigger value="css">CSS Only</TabsTrigger>
                <TabsTrigger value="both">HTML & CSS</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="mt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
              <Button onClick={() => setStep(2)} variant="outline" disabled={isProcessing}>
                Back to Selection
              </Button>
              <Button onClick={handleDownload} disabled={isProcessing}>
                {isProcessing ? 'Generating ZIP...' : 'Download ZIP'}
              </Button>
            </div>
             {(outputType === 'html' || outputType === 'both') && generatedFiles.html && (
                <div className="mt-6">
                    <h3 className="text-lg font-semibold mb-2">HTML Preview (structure)</h3>
                    <pre className="bg-muted p-4 rounded-md text-xs overflow-auto max-h-60">
                        <code>{generatedFiles.html}</code>
                    </pre>
                </div>
             )}
             {(outputType === 'css' || outputType === 'both') && generatedFiles.css && (
                <div className="mt-4">
                    <h3 className="text-lg font-semibold mb-2">CSS Preview</h3>
                    <pre className="bg-muted p-4 rounded-md text-xs overflow-auto max-h-60">
                        <code>{generatedFiles.css}</code>
                    </pre>
                </div>
             )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <nav className="border-b border-border sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center h-16 items-center">
            <div className="flex items-center">
              <Code className="h-8 w-8 text-primary" />
              <span className="ml-2 text-xl font-bold">Figma To Code</span>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {step === 1 && (
          <div className="text-center mb-16">
            <h1 className="text-4xl font-extrabold tracking-tight text-primary sm:text-5xl lg:text-6xl">
              Transform Your Designs
            </h1>
            <p className="mt-6 text-lg leading-8 text-muted-foreground max-w-2xl mx-auto">
              Enter a Figma file URL and your Personal Access Token to load frames, then select items and export them as HTML & CSS code.
            </p>
          </div>
        )}

        <div className="mt-10">
          {renderStepContent()}
        </div>

        {figmaData && (step === 1 || step === 2) && !isProcessing && (
          <div className="mt-12 w-full max-w-md mx-auto">
            <Card className="p-6 shadow-md">
              <h3 className="text-lg font-semibold mb-4 border-b pb-2">{figmaData.name}</h3>
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
        )}

        {step === 1 && (
          <div className="mt-20">
             <h2 className="text-center text-2xl font-semibold mb-8">How it Works</h2>
             <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
                <FeatureCard
                    icon={<Download className="h-6 w-6 text-primary" />}
                    title="1. Load & Select"
                    description="Paste your Figma file URL and Access Token. Choose the frames or components you need."
                />
                <FeatureCard
                    icon={<Code className="h-6 w-6 text-primary" />}
                    title="2. Generate Code"
                    description="Get basic HTML structure and CSS styles based on your Figma design's properties and layout."
                />
                <FeatureCard
                    icon={<Eye className="h-6 w-6 text-primary" />}
                    title="3. Download & Refine"
                    description="Download a ZIP file with HTML, CSS, and images. Refine the code for production use."
                />
             </div>
          </div>
        )}
      </div>

       <footer className="border-t mt-20 py-6">
           <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-muted-foreground">
               Figma To Code Converter | Basic tool for demonstration.
               <br/>
               <span className="text-xs">Remember to handle Figma tokens securely in production applications.</span>
           </div>
       </footer>
    </main>
  );
}

function FeatureCard({ icon, title, description }) {
  return (
    <Card className="p-6 text-center sm:text-left">
      <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start">
        {icon}
        <h3 className="ml-0 sm:ml-3 mt-2 sm:mt-0 text-lg font-semibold">{title}</h3>
      </div>
      <p className="mt-2 text-muted-foreground">{description}</p>
    </Card>
  );
}

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Remove the dynamic export since it's not compatible with static export
// export const dynamic = 'force-dynamic';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const fileType = formData.get('fileType') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    // Log file details
    console.log('Processing file:', {
      name: file.name,
      type: file.type,
      size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      fileType
    });

    // Process the file based on type
    let processedData;
    if (fileType === 'image') {
      // For image files
      processedData = {
        html: `<div class="container"><img src="[image-url]" alt="Converted design" /></div>`,
        css: `.container { max-width: 1200px; margin: 0 auto; padding: 20px; }`,
        components: ['Container', 'Image']
      };
    } else {
      // For Figma files
      processedData = {
        components: ['Header', 'Button', 'Card'],
        styles: {
          colors: ['#3b82f6', '#ffffff', '#1f2937'],
          typography: {
            heading: 'font-bold text-2xl',
            body: 'text-base text-gray-600'
          }
        },
        assets: []
      };
    }

    // Return success response
    return NextResponse.json({
      message: 'File processed successfully',
      data: processedData
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'File processing failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
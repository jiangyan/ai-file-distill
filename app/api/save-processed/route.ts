import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

export async function POST(req: Request) {
  try {
    const { content, filename, timestamp } = await req.json()
    
    // Create the distilled directory if it doesn't exist
    const distilledDir = path.join(process.cwd(), 'distilled')
    await fs.mkdir(distilledDir, { recursive: true })
    
    // Create timestamp directory
    const timestampDir = path.join(distilledDir, `distill-${timestamp}`)
    await fs.mkdir(timestampDir, { recursive: true })
    
    // Save the file
    const filePath = path.join(timestampDir, filename)
    await fs.writeFile(filePath, content, 'utf-8')
    
    return NextResponse.json({ success: true, path: filePath })
  } catch (error) {
    console.error('Error saving file:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to save file' },
      { status: 500 }
    )
  }
} 
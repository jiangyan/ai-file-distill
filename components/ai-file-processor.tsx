'use client'

import { useState, useCallback, useEffect } from 'react'
import { FileText, Folder, Upload, RefreshCw, X } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { initializeOpenAI, processFileWithOpenAI } from '@/lib/openai'

interface FileSystemDirectoryHandle {
  kind: 'directory'
  values(): AsyncIterableIterator<FileSystemHandle>
}

interface FileSystemFileHandle {
  kind: 'file'
  getFile(): Promise<File>
}

type FileSystemHandle = FileSystemDirectoryHandle | FileSystemFileHandle

declare global {
  interface Window {
    showDirectoryPicker(): Promise<FileSystemDirectoryHandle>
  }
}

type FileItem = {
  name: string
  content: string
  processedContent?: string
}

export default function AIFileProcessor() {
  const [model, setModel] = useState<string>('')
  const [systemPrompt, setSystemPrompt] = useState<string>('')
  const [files, setFiles] = useState<FileItem[]>([])
  const [processedFiles, setProcessedFiles] = useState<FileItem[]>([])
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null)
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const [progress, setProgress] = useState<number>(0)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Initialize OpenAI with API key from environment variable
    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY
    if (apiKey) {
      try {
        initializeOpenAI(apiKey)
      } catch (error) {
        console.error('Failed to initialize OpenAI:', error)
        setError('Failed to initialize OpenAI API')
      }
    }
  }, [])

  const handleFileDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const droppedFiles = Array.from(e.dataTransfer.files)
    const newFiles = await Promise.all(droppedFiles.map(async file => {
      const content = await file.text()
      return { name: file.name, content }
    }))
    setFiles(prevFiles => [...prevFiles, ...newFiles])
  }, [])

  const handleFolderSelect = useCallback(async () => {
    try {
      const dirHandle: FileSystemDirectoryHandle = await window.showDirectoryPicker()
      const files: FileItem[] = []

      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file') {
          const file = await entry.getFile()
          const content = await file.text()
          files.push({ name: file.name, content })
        }
      }

      setFiles(prevFiles => [...prevFiles, ...files])
    } catch (err) {
      const error = err as Error
      console.error('Folder selection error:', error)
      setError(error.message === 'The user aborted a request.' 
        ? 'Folder selection cancelled' 
        : 'Failed to read folder: ' + error.message)
    }
  }, [])

  const processFiles = useCallback(async () => {
    if (!model || !systemPrompt.trim()) return
    
    setIsProcessing(true)
    setProgress(0)
    setError(null)
    const totalFiles = files.length
    
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '')
      const processedResults: FileItem[] = []

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        try {
          const processedContent = await processFileWithOpenAI(file.content, systemPrompt)
          
          // Save the processed content using the API
          const response = await fetch('/api/save-processed', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              content: processedContent,
              filename: `${file.name.replace(/\.[^/.]+$/, '')}_processed.txt`,
              timestamp
            }),
          })

          if (!response.ok) {
            throw new Error('Failed to save processed file')
          }

          processedResults.push({ ...file, processedContent })
          setProgress(((i + 1) / totalFiles) * 100)
        } catch (err) {
          const error = err as Error
          console.error(`Error processing file ${file.name}:`, error)
          processedResults.push({ ...file, processedContent: `Error: Failed to process file - ${error.message}` })
        }
      }

      setProcessedFiles(processedResults)
    } catch (err) {
      const error = err as Error
      console.error('Processing error:', error)
      setError('Failed to process files: ' + error.message)
    } finally {
      setIsProcessing(false)
    }
  }, [files, model, systemPrompt])

  const clearFiles = useCallback(() => {
    setFiles([])
    setProcessedFiles([])
    setSelectedFile(null)
    setProgress(0)
    setError(null)
  }, [])

  const isProcessButtonDisabled = !model || !systemPrompt.trim() || isProcessing || files.length === 0

  return (
    <div className="container mx-auto p-4">
      <div className="mb-4">
        <Select onValueChange={setModel}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select LLM model" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
            <SelectItem value="claude-3-5-haiku-20241022">claude-3-5-haiku-20241022</SelectItem>
            <SelectItem value="gemini-1.5-flash">gemini-1.5-flash</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="mb-4">
        <Textarea
          placeholder="Enter system prompt here..."
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          className="w-full"
        />
      </div>
      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-lg">
          {error}
        </div>
      )}
      <div className="flex justify-between items-center mb-4">
        <div
          className="border-2 border-dashed rounded-lg p-4 inline-flex flex-col items-center gap-2"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleFileDrop}
        >
          <p>Drop files here or</p>
          <Button onClick={handleFolderSelect} variant="outline">
            <Folder className="mr-2 h-4 w-4" /> Select Folder
          </Button>
        </div>
        <div className="flex gap-2">
          <Button onClick={processFiles} disabled={isProcessButtonDisabled}>
            {isProcessing ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Process
          </Button>
          <Button onClick={clearFiles} variant="outline">
            <X className="mr-2 h-4 w-4" /> Clear
          </Button>
        </div>
      </div>
      {isProcessing && (
        <Progress value={progress} className="w-full mb-4" />
      )}
      <div className="grid grid-cols-2 gap-4">
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-2">Files</h3>
          <ul className="space-y-2">
            {files.map((file, index) => (
              <li
                key={index}
                className="flex items-center p-2 rounded cursor-pointer hover:bg-gray-100"
                onClick={() => {
                  setSelectedFile(file)
                  setIsPreviewOpen(true)
                }}
              >
                <FileText className="mr-2 h-4 w-4" /> {file.name}
              </li>
            ))}
          </ul>
        </div>
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-2">Processed Items</h3>
          <ul className="space-y-2">
            {processedFiles.map((file, index) => (
              <li
                key={index}
                className="flex items-center p-2 rounded cursor-pointer hover:bg-gray-100"
                onClick={() => {
                  setSelectedFile(file)
                  setIsPreviewOpen(true)
                }}
              >
                <FileText className="mr-2 h-4 w-4" /> {file.name}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-[80vw] w-full max-h-[80vh] h-full">
          <DialogHeader>
            <DialogTitle>{selectedFile?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 h-full overflow-hidden">
            <div className="h-full">
              <h3 className="font-semibold mb-2">Original Content</h3>
              <pre className="bg-gray-100 p-4 rounded overflow-auto h-[calc(80vh-150px)] font-mono text-sm">
                {selectedFile?.content}
              </pre>
            </div>
            <div className="h-full">
              <h3 className="font-semibold mb-2">Processed Content</h3>
              <pre className="bg-gray-100 p-4 rounded overflow-auto h-[calc(80vh-150px)] font-mono text-sm">
                {selectedFile?.processedContent || 'Not processed yet'}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}


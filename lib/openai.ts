import OpenAI from 'openai'

let openai: OpenAI | null = null

export const initializeOpenAI = (apiKey: string) => {
  openai = new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true // Note: In production, API calls should be made from the backend
  })
}

export const processFileWithOpenAI = async (
  content: string,
  systemPrompt: string
): Promise<string> => {
  if (!openai) {
    throw new Error('OpenAI client not initialized. Please provide an API key.')
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content
        }
      ]
    })

    return response.choices[0]?.message?.content || 'No response from AI'
  } catch (error) {
    console.error('OpenAI API error:', error)
    throw error
  }
} 